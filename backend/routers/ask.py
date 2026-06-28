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
"""
import base64
import logging
import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel, Field

from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent
from core import make_grant_is_active

logger = logging.getLogger(__name__)

DAILY_QUESTION_CAP = 7
ASK_MODEL = "claude-haiku-4-5-20251001"
SYSTEM_PROMPT = (
    "You are the friendly, knowledgeable in-house gardening expert for Patch & Pot, "
    "a regional gardening companion app. Answer concisely and warmly. "
    "Cover edibles, cut flowers, ornamentals, lawn care, soil, composting, pests, "
    "diseases, pruning, and propagation. When the user includes an image, identify "
    "what you see and respond accordingly. Prefer organic-first methods; mention "
    "chemical interventions only when nothing else will do. If a question is unsafe, "
    "off-topic, or beyond gardening, gently steer back. Always assume the user is a "
    "hobby gardener, not a professional — give actionable, practical advice. "
    "Use short paragraphs and the occasional bullet list. UK English spelling."
)


def make_router(db) -> APIRouter:
    router = APIRouter()
    _grant_is_active = make_grant_is_active(db)

    async def _guard(access_token: str) -> str:
        token = (access_token or "").strip()
        if not await _grant_is_active(token):
            raise HTTPException(402, "Membership required — Ask the Garden is a paid feature.")
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
    @router.get("/ask/usage")
    async def get_usage(access_token: str = ""):
        token = await _guard(access_token)
        used = await _usage_count(token)
        return {"used": used, "cap": DAILY_QUESTION_CAP, "remaining": max(0, DAILY_QUESTION_CAP - used)}

    @router.get("/ask/sessions", response_model=List[SessionOut])
    async def list_sessions(access_token: str = ""):
        token = await _guard(access_token)
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

        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(503, "AI temporarily unavailable.")

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
