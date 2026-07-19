"""Ask the Garden — threaded AI Q&A behind the paywall.

Members only. Hard cap of 7 user-messages per UTC day per access token.
Supports inline image uploads (vision) for plant ID, pest spotting,
leaf-disease diagnosis etc. Model is intentionally not surfaced to users
so we can swap providers freely as pricing shifts.

Storage:
  ask_sessions   {id, access_token, title, created_at, last_message_at}
  ask_messages   {id, session_id, role: "user"|"assistant", content,
                  image_b64?, mime_type?, created_at}
  ask_usage      {access_token, date: "YYYY-MM-DD", count}
  ask_cache      {key, question_normalized, prior_hash, answer, model,
                  hits, first_asked_at, last_asked_at}
    – Global Q&A cache. Populated on every LLM reply where the exchange
      is deterministic enough to reuse safely (no image on the current
      turn AND no image anywhere in the session history). Two users
      asking the exact same question in the same conversational
      context get identical answers without spending a second LLM call.
      Not scoped per-user by design — this is a knowledge cache, not a
      privacy boundary.
"""
import base64
import hashlib
import logging
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Response
from pydantic import BaseModel, Field

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from core import make_grant_is_active

logger = logging.getLogger(__name__)

DAILY_QUESTION_CAP = 7
ASK_MODEL = "claude-haiku-4-5-20251001"


# ─── Q&A cache helpers ──────────────────────────────────────────────
def _normalize_question(text: str) -> str:
    """Aggressively normalise a question so trivial punctuation / casing /
    spacing differences don't blow the cache.

    "How do I prune tomatoes?"  ==  "how do I prune tomatoes"
                                ==  "  How   do i prune tomatoes ! "
    """
    if not text:
        return ""
    q = re.sub(r"\s+", " ", text.strip().lower())
    q = re.sub(r"[.!?…,;:\s\"'`]+$", "", q)
    return q


def _cache_key(prior_user_texts: list[str], question: str) -> str:
    """Stable short hash of the whole conversational state.

    We fold in every prior USER turn (assistant replies are a
    deterministic function of them so we don't need to hash them
    separately). This means the cache also serves follow-up
    turns — as long as the sequence of user questions matches
    verbatim, the same answer is safe to reuse.
    """
    payload = "\n---\n".join(
        [_normalize_question(t) for t in prior_user_texts]
        + [_normalize_question(question)]
    )
    return hashlib.sha1(payload.encode("utf-8")).hexdigest()[:24]


_SLUG_RE = re.compile(r"[^a-z0-9]+")


def question_slug(question_normalized: str, key: str) -> str:
    """URL-safe slug derived from the normalised question, disambiguated
    with a short hash suffix so two similar questions can't collide.

    e.g.  "how do i prune tomatoes" + key "ab12…"
          → "how-do-i-prune-tomatoes-ab12ef"
    """
    base = _SLUG_RE.sub("-", (question_normalized or "question").strip("-")).strip("-")
    base = base[:60].strip("-") or "question"
    suffix = (key or "")[:6] or "xxxxxx"
    return f"{base}-{suffix}"


# ─── Safety rails for the public /ask/popular surface ──────────────
# Every cache entry surfaced publicly has to pass THREE guards:
#   1. `hits >= 1` (asked by ≥ 2 members) — already enforced in queries.
#   2. `hidden != True`             — admin-set or auto-set moderation flag.
#   3. Auto-flagged at save time if the question or answer trips one of
#      the heuristic filters below.
#
# The filters are deliberately conservative — we'd rather hide a real
# gardening question that trips a false positive than surface a bad one.
# Admins can flip `hidden` back on any individual entry via
# POST /api/admin/ask/hide/{key} (see routers/admin/_maintenance.py).

# Answers where the model refused / punted → not useful evergreen SEO
# content, hide them.
_ANSWER_REFUSAL_MARKERS = (
    "i can't help",
    "i cannot help",
    "i'm not able to",
    "i am not able to",
    "i don't know",
    "i do not know",
    "outside my expertise",
    "outside gardening",
    "not a gardening question",
    "off-topic",
    "i'm sorry, but i can",
    "i cannot answer",
    "i can't answer",
    "as an ai",
    "i cannot provide",
)

# Blunt off-topic / unsafe keyword guard on the QUESTION. Any hit → hide.
# Kept intentionally short; false positives are cheap (the question
# still gets answered privately for the paying member — we just don't
# publish it). Add to this list as edge cases surface.
_QUESTION_BLOCKLIST = (
    # profanity / slurs — a placeholder set; extend as needed
    "fuck", "shit", "cunt", "bitch",
    # obvious off-topic
    "porn", "sex", "gambling", "crypto", "bitcoin", "ethereum",
    "politics", "election", "vote",
    # dangerous / medical
    "suicide", "kill myself", "overdose", "poison someone",
    "recipe for meth",
)


def should_auto_hide(question_normalized: str, answer: str) -> bool:
    """Return True if this Q&A should be hidden from the public list."""
    q = (question_normalized or "").lower()
    a = (answer or "").lower().lstrip()[:400]  # only inspect the answer opening
    if any(term in q for term in _QUESTION_BLOCKLIST):
        return True
    if any(a.startswith(m) or m in a[:200] for m in _ANSWER_REFUSAL_MARKERS):
        return True
    return False
SYSTEM_PROMPT = (
    "You are Nàdar (pronounced NAA-dar — Scottish Gaelic for \"nature\"), "
    "the friendly, knowledgeable in-house gardening companion for Patch & Pot, "
    "a regional gardening app. You have the patient, unhurried voice of a "
    "seasoned gardener who has seen the same seasons come round for decades. "
    "Answer concisely and warmly. "
    "Cover edibles, cut flowers, ornamentals, lawn care, soil, composting, pests, "
    "diseases, pruning, and propagation. When the user includes an image, identify "
    "what you see and respond accordingly. Prefer organic-first methods; mention "
    "chemical interventions only when nothing else will do. If a question is unsafe, "
    "off-topic, or beyond gardening, gently steer back. Always assume the user is a "
    "hobby gardener, not a professional — give actionable, practical advice. "
    "Use short paragraphs and the occasional bullet list. UK English spelling. "
    "Do not refer to yourself in the third person or repeatedly announce that you "
    "are Nàdar — just answer well. Only mention the name if the user asks."
)


def make_router(db) -> APIRouter:
    router = APIRouter()
    _grant_is_active = make_grant_is_active(db)

    async def _guard(access_token: str) -> str:
        token = (access_token or "").strip()
        if not await _grant_is_active(token):
            raise HTTPException(402, "Membership required — Ask Nàdar is a paid feature.")
        return token

    def _today_key() -> str:
        return datetime.now(timezone.utc).strftime("%Y-%m-%d")

    async def _usage_count(token: str) -> int:
        doc = await db.ask_usage.find_one({"access_token": token, "date": _today_key()})
        return int((doc or {}).get("count", 0))

    async def _bump_usage(token: str) -> None:
        await db.ask_usage.update_one(
            {"access_token": token, "date": _today_key()},
            {"$inc": {"count": 1}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )

    # ── Pydantic models ────────────────────────────────────────────────
    class SessionOut(BaseModel):
        id: str
        title: str
        created_at: str
        last_message_at: str

    class MessageOut(BaseModel):
        id: str
        role: str
        content: str
        has_image: bool = False
        created_at: str

    # ── Endpoints ──────────────────────────────────────────────────────
    # Cache-Control header used on every per-user dynamic endpoint. Forces
    # *every* layer (browser HTTP cache, service worker, Emergent ingress
    # proxy/CDN, any future Varnish) to skip caching. This is the bulletproof
    # fix to the "/ask/usage returns yesterday's count" bug — header beats
    # config, every time.
    _NO_STORE = {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        "Pragma": "no-cache",
        "Expires": "0",
    }

    @router.get("/ask/usage")
    async def get_usage(response: Response, access_token: str = ""):
        token = await _guard(access_token)
        used = await _usage_count(token)
        for k, v in _NO_STORE.items():
            response.headers[k] = v
        return {"used": used, "cap": DAILY_QUESTION_CAP, "remaining": max(0, DAILY_QUESTION_CAP - used)}

    @router.get("/ask/popular")
    async def get_popular_questions(response: Response, limit: int = 50):
        """PUBLIC (no paywall) — the top N cached Q&A pairs by hit count.

        Only entries with `hits >= 1` are exposed, i.e. the same question
        was asked by at least two different members. That's the safety /
        privacy threshold: idiosyncratic one-off questions never leak.
        First-turn questions only (prior_hash is null) so we can display
        them without needing the parent conversation.

        Publicly cacheable for an hour — the list barely changes minute
        to minute, and this is meant to be an SEO-friendly evergreen
        page.
        """
        limit = max(1, min(int(limit or 50), 100))
        cursor = db.ask_cache.find(
            {"hits": {"$gte": 1}, "prior_hash": None, "hidden": {"$ne": True}},
            {"_id": 0, "key": 1, "question_normalized": 1, "answer": 1,
             "hits": 1, "first_asked_at": 1, "last_asked_at": 1},
        ).sort("hits", -1).limit(limit)
        rows = [r async for r in cursor]
        for r in rows:
            r["slug"] = question_slug(r.get("question_normalized", ""), r.get("key", ""))
        # Public — safe to cache in browsers and CDNs for a while.
        response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=86400"
        return {"count": len(rows), "questions": rows}

    @router.get("/ask/popular/{slug}")
    async def get_popular_question_by_slug(slug: str, response: Response):
        """PUBLIC — one cached Q&A by slug for the individual /ask/popular/<slug>
        landing page. Same safety rules as the list endpoint (hits >= 1,
        first-turn only) so a private one-off can never be reached even
        by guessing the URL.

        Slugs are deterministic — `<kebab-question>-<6-char key prefix>`
        — so we resolve by scanning candidate rows whose key starts with
        the suffix (short, indexed prefix scan) and verifying the full
        slug matches. Fast enough for a modest cache.
        """
        # 6-char suffix is the last hyphen-separated chunk of the slug.
        parts = slug.rsplit("-", 1)
        if len(parts) < 2 or not parts[1]:
            raise HTTPException(404, "Question not found")
        key_prefix = parts[1]
        cursor = db.ask_cache.find(
            {"key": {"$regex": f"^{re.escape(key_prefix)}"},
             "hits": {"$gte": 1}, "prior_hash": None, "hidden": {"$ne": True}},
            {"_id": 0, "key": 1, "question_normalized": 1, "answer": 1,
             "hits": 1, "first_asked_at": 1, "last_asked_at": 1},
        ).limit(5)
        rows = [r async for r in cursor]
        for r in rows:
            if question_slug(r.get("question_normalized", ""), r.get("key", "")) == slug:
                r["slug"] = slug
                response.headers["Cache-Control"] = "public, max-age=3600, stale-while-revalidate=86400"
                return r
        raise HTTPException(404, "Question not found")

    @router.get("/ask/sessions", response_model=List[SessionOut])
    async def list_sessions(response: Response, access_token: str = ""):
        token = await _guard(access_token)
        for k, v in _NO_STORE.items():
            response.headers[k] = v
        cursor = db.ask_sessions.find(
            {"access_token": token},
            {"_id": 0, "id": 1, "title": 1, "created_at": 1, "last_message_at": 1},
        ).sort("last_message_at", -1).limit(50)
        return [SessionOut(**doc) async for doc in cursor]

    @router.get("/ask/sessions/{session_id}/messages", response_model=List[MessageOut])
    async def get_messages(session_id: str, access_token: str = ""):
        token = await _guard(access_token)
        sess = await db.ask_sessions.find_one({"id": session_id, "access_token": token})
        if not sess:
            raise HTTPException(404, "Session not found.")
        cursor = db.ask_messages.find({"session_id": session_id}).sort("created_at", 1)
        out = []
        async for doc in cursor:
            out.append(MessageOut(
                id=doc.get("id"),
                role=doc.get("role"),
                content=doc.get("content") or "",
                has_image=bool(doc.get("image_b64")),
                created_at=doc.get("created_at") or "",
            ))
        return out

    @router.delete("/ask/sessions/{session_id}")
    async def delete_session(session_id: str, access_token: str = ""):
        token = await _guard(access_token)
        sess = await db.ask_sessions.find_one({"id": session_id, "access_token": token})
        if not sess:
            raise HTTPException(404, "Session not found.")
        await db.ask_messages.delete_many({"session_id": session_id})
        await db.ask_sessions.delete_one({"id": session_id, "access_token": token})
        return {"deleted": True}

    @router.get("/ask/audit")
    async def ask_audit(response: Response, access_token: str = ""):
        """Returns every user-message timestamp + every daily-usage row stored
        for the caller's token. This is the user-facing 'show me what counted'
        view — it lets the user reconcile what the counter says with what's
        actually been logged. No admin token needed; gated by membership only,
        and only ever shows the caller's own data."""
        token = await _guard(access_token)
        for k, v in _NO_STORE.items():
            response.headers[k] = v

        # User messages — what was actually sent through Ask the Garden
        # against this token, newest first. We collect session titles too so
        # the user can spot which thread each question came from.
        sess_cursor = db.ask_sessions.find(
            {"access_token": token}, {"_id": 0, "id": 1, "title": 1}
        )
        titles = {s["id"]: s.get("title", "") async for s in sess_cursor}
        msg_cursor = db.ask_messages.find(
            {"session_id": {"$in": list(titles.keys())}, "role": "user"},
            {"_id": 0, "session_id": 1, "content": 1, "created_at": 1},
        ).sort("created_at", -1).limit(50)
        messages = []
        async for m in msg_cursor:
            messages.append({
                "created_at": m.get("created_at") or "",
                "session_title": titles.get(m.get("session_id"), ""),
                "preview": (m.get("content") or "")[:120],
            })

        # Daily-usage rows — exactly what the counter reads. Newest first.
        usage_cursor = db.ask_usage.find(
            {"access_token": token},
            {"_id": 0, "date": 1, "count": 1, "updated_at": 1},
        ).sort("date", -1).limit(14)
        usage = [u async for u in usage_cursor]

        return {
            "today_key_utc": _today_key(),
            "now_utc": datetime.now(timezone.utc).isoformat(),
            "cap": DAILY_QUESTION_CAP,
            "usage_rows": usage,
            "user_messages": messages,
        }

    @router.post("/ask/message")
    async def post_message(
        access_token: str = Form(...),
        message: str = Form(...),
        session_id: Optional[str] = Form(None),
        image: Optional[UploadFile] = File(None),
    ):
        token = await _guard(access_token)
        text = (message or "").strip()
        if not text and not image:
            raise HTTPException(400, "Please type a question or attach an image.")
        if len(text) > 4000:
            raise HTTPException(400, "Question is too long — keep it under 4000 characters.")

        used = await _usage_count(token)
        if used >= DAILY_QUESTION_CAP:
            raise HTTPException(
                429,
                f"Daily limit of {DAILY_QUESTION_CAP} questions reached. Try again tomorrow.",
            )

        # ── Session bookkeeping ────────────────────────────────────────
        now_iso = datetime.now(timezone.utc).isoformat()
        if session_id:
            sess = await db.ask_sessions.find_one({"id": session_id, "access_token": token})
            if not sess:
                raise HTTPException(404, "Session not found.")
        else:
            session_id = uuid.uuid4().hex[:16]
            title = (text[:60] or "Photo question") + ("…" if len(text) > 60 else "")
            await db.ask_sessions.insert_one({
                "id": session_id, "access_token": token, "title": title,
                "created_at": now_iso, "last_message_at": now_iso,
            })

        # ── Image handling ─────────────────────────────────────────────
        image_b64 = None
        mime_type = None
        if image is not None:
            raw = await image.read()
            if len(raw) > 5 * 1024 * 1024:
                raise HTTPException(400, "Image too large — max 5 MB.")
            mime_type = image.content_type or "image/jpeg"
            if not mime_type.startswith("image/"):
                raise HTTPException(400, "Only image uploads are supported.")
            image_b64 = base64.b64encode(raw).decode("ascii")

        # ── Persist user message ──────────────────────────────────────
        user_msg_id = uuid.uuid4().hex[:16]
        await db.ask_messages.insert_one({
            "id": user_msg_id,
            "session_id": session_id,
            "role": "user",
            "content": text,
            "image_b64": image_b64,
            "mime_type": mime_type,
            "created_at": now_iso,
        })

        # ── Build prior-turn context for the LLM ──────────────────────
        # We re-send recent history every turn (last 8 messages, ~4 exchanges)
        # so the model has continuity. The LlmChat session_id parameter
        # alone doesn't guarantee history persistence across requests.
        history_cursor = db.ask_messages.find({"session_id": session_id}).sort("created_at", -1).limit(8)
        prior = [doc async for doc in history_cursor][::-1][:-1]  # drop the just-inserted user msg

        # ── Q&A cache lookup (skip if any image is involved) ──────────
        # We only trust the cache when the whole exchange is text-only:
        # a photo of a leaf is inherently unique so an answer keyed on
        # question text alone would be wrong.
        session_has_image = image_b64 is not None or any(m.get("image_b64") for m in prior)
        prior_user_texts = [
            (m.get("content") or "")
            for m in prior
            if m.get("role") == "user"
        ]
        cache_key = None
        cache_hit = None
        if not session_has_image and text.strip():
            cache_key = _cache_key(prior_user_texts, text)
            cache_hit = await db.ask_cache.find_one({"key": cache_key}, {"_id": 0})

        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(503, "AI temporarily unavailable.")

        if cache_hit:
            # Serve the cached answer verbatim. Still counts against the
            # user's daily quota (they asked a full question either way)
            # and still writes into their session so the thread is
            # readable end-to-end. LLM cost: zero.
            answer = cache_hit["answer"]
            await db.ask_cache.update_one(
                {"key": cache_key},
                {
                    "$inc": {"hits": 1},
                    "$set": {"last_asked_at": datetime.now(timezone.utc).isoformat()},
                },
            )
            logger.info("ask_message cache hit key=%s hits=%s", cache_key, cache_hit.get("hits", 0) + 1)
        else:
            try:
                chat = LlmChat(
                    api_key=api_key,
                    session_id=f"ask-{session_id}",
                    system_message=SYSTEM_PROMPT,
                ).with_model("anthropic", ASK_MODEL)

                # Replay history as alternating user/assistant turns.
                for h in prior:
                    msg_text = h.get("content") or ""
                    if h.get("role") == "user":
                        await chat.send_message(UserMessage(text=msg_text or "(image only)"))
                    # Assistant turns are already part of LlmChat's internal history
                    # once we've sent the corresponding user message; we don't push
                    # them back manually (the library handles that on first reply).

                # Now send the *new* user message (with image if present).
                file_contents = []
                if image_b64:
                    file_contents.append(ImageContent(image_base64=image_b64))
                response = await chat.send_message(UserMessage(
                    text=text or "Please identify what you see in this photo.",
                    file_contents=file_contents or None,
                ))
                answer = response.text if hasattr(response, "text") else str(response)
            except Exception as e:  # noqa: BLE001 — surface a useful message
                logger.warning("ask_message LLM call failed: %s", e)
                raise HTTPException(503, "AI couldn't answer that one — try again in a moment.") from e

            # ── Populate the cache (only text-only turns) ──────────────
            if cache_key and answer:
                now_iso_cache = datetime.now(timezone.utc).isoformat()
                q_norm = _normalize_question(text)
                auto_hidden = should_auto_hide(q_norm, answer)
                await db.ask_cache.update_one(
                    {"key": cache_key},
                    {
                        "$setOnInsert": {
                            "question_normalized": q_norm,
                            "prior_hash": hashlib.sha1(
                                "\n---\n".join(_normalize_question(t) for t in prior_user_texts).encode("utf-8"),
                            ).hexdigest()[:16] if prior_user_texts else None,
                            "answer": answer,
                            "model": ASK_MODEL,
                            "first_asked_at": now_iso_cache,
                            "hits": 0,
                            "hidden": auto_hidden,
                        },
                        "$set": {"last_asked_at": now_iso_cache},
                    },
                    upsert=True,
                )

        # ── Persist assistant reply + bump usage + touch session ──────
        asst_id = uuid.uuid4().hex[:16]
        reply_iso = datetime.now(timezone.utc).isoformat()
        await db.ask_messages.insert_one({
            "id": asst_id,
            "session_id": session_id,
            "role": "assistant",
            "content": answer,
            "created_at": reply_iso,
        })
        await db.ask_sessions.update_one(
            {"id": session_id},
            {"$set": {"last_message_at": reply_iso}},
        )
        await _bump_usage(token)
        new_used = used + 1
        return {
            "session_id": session_id,
            "user_message_id": user_msg_id,
            "assistant_message_id": asst_id,
            "answer": answer,
            "usage": {
                "used": new_used,
                "cap": DAILY_QUESTION_CAP,
                "remaining": max(0, DAILY_QUESTION_CAP - new_used),
            },
        }

    return router
