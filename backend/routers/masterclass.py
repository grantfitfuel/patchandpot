"""AI masterclass generation + retrieval + OG metadata for /learn pages.

The heavy text-generation job runs in a FastAPI BackgroundTask; the client
polls `/masterclass/job/{job_id}` and then GETs the finished doc.
"""
import json
import logging
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException

from emergentintegrations.llm.chat import LlmChat, UserMessage

from core import (
    EMERGENT_LLM_KEY, LANG_NAMES,
    MASTERCLASS_VOICE_SAMPLE, STATIC_MASTERCLASS_OG,
    MasterclassGenRequest,
    _first_paragraph, _slugify, make_grant_is_active,
)

logger = logging.getLogger(__name__)


def make_router(db) -> APIRouter:
    router = APIRouter()
    _grant_is_active = make_grant_is_active(db)

    async def _run_masterclass_generation(job_id: str, topic: str, language: str, slug: str, owner_token: str):
        """Background worker — runs the slow Claude call and persists the result."""
        try:
            lang_label = LANG_NAMES.get(language, "English")
            sys_msg = (
                "You are a senior gardening editor for a magazine-quality app called "
                "'Patch & Pot'. The user gives you a TOPIC; you produce a long, deeply "
                "educational masterclass on it.\n\n"
                "VOICE: warm, opinionated, practical, occasionally addressing the reader "
                "as 'you'. Confident expert, never patronising. Include real numbers — "
                "temperatures (°C), distances (cm), pH ranges, days-to-maturity, "
                "dilution rates. Mention common mistakes by name. UK/temperate climate "
                "is the default, but call out regional variation where it matters.\n\n"
                f"OUTPUT LANGUAGE: write all visible text in {lang_label}. Keep all JSON "
                "keys in English exactly as given.\n\n"
                "STRUCTURE: return ONE JSON object with exactly these keys:\n"
                "  title         (string — Title Case, no quotes)\n"
                "  tagline       (string — one vivid sentence)\n"
                "  duration_minutes (integer 40–75)\n"
                "  lessons       (array of 5 or 6 objects)\n\n"
                "Each lesson has:\n"
                "  title    (string)\n"
                "  eyebrow  (string like 'Lesson 1', 'Lesson 2', …)\n"
                "  body     (array of 2–4 paragraphs, each 60–140 words)\n"
                "  boxes    (array of 1–2 objects, each {label, items[3–6 strings]})\n"
                "             — typical labels: 'What you'll learn', 'Common mistakes', "
                "             'Numbers that matter', 'Quick reference'\n"
                "  steps    (optional, only when there's a real procedure: "
                "             {title, items[4–8 strings, imperative voice]})\n"
                "  tip      (single-sentence practical insight)\n\n"
                "HARD RULES:\n"
                "- Never use markdown — output is rendered as plain text with light "
                "  paragraph breaks.\n"
                "- Never hedge with 'might', 'could possibly', 'in some cases'. Be "
                "  decisive (you can say 'usually' or 'in our climate').\n"
                "- Never repeat the same word at the start of two consecutive paragraphs.\n"
                "- No bullet points inside paragraphs — use the boxes/steps arrays "
                "  for lists.\n"
                "- Return ONLY the JSON object — no prose around it, no markdown fence.\n\n"
                "VARIETY & COMPLETENESS RULE — IMPORTANT:\n"
                "When a topic has multiple recognised variety types, families, "
                "categories or culinary uses, the masterclass MUST cover the "
                "representative breadth — including HERITAGE / heirloom cultivars "
                "and SPECIALIST / regional varieties, not just the modern F1 hybrids "
                "you'd see in a supermarket. Examples of the breadth expected:\n"
                "  • Tomatoes → cherry / salad / beefsteak / heritage (Brandywine, "
                "    Black Krim, Costoluto Fiorentino, Green Zebra) / Italian PASTE "
                "    types including San Marzano, Roma, San Marzano Lampadina, "
                "    Datterino — name them and explain when each is right.\n"
                "  • Apples → eaters / cookers / cider / heritage Pearmains and "
                "    Russets, plus modern Coxes/Galas.\n"
                "  • Potatoes → first / second early / maincrop / salad / heritage "
                "    Pink Fir Apple, Shetland Black, Belle de Fontenay.\n"
                "  • Lettuces → butterhead / cos / oakleaf / loose-leaf / heritage "
                "    Tom Thumb, Marvel of Four Seasons.\n"
                "  • Roses → hybrid teas / floribundas / shrub / climbers / English "
                "    (David Austin) / old garden / rambling.\n"
                "Apply the same logic to ANY topic — always include the historic / "
                "heritage / specialist tier alongside the easy modern picks. Name "
                "at least 4–6 specific cultivars in the relevant lesson, with one "
                "concrete sentence per cultivar on why a reader might choose it.\n\n"
                "VOICE REFERENCE (a real Patch & Pot masterclass — match this tone, "
                f"density, and pace, not the topic):\n{MASTERCLASS_VOICE_SAMPLE}"
            )

            chat = LlmChat(api_key=EMERGENT_LLM_KEY, session_id=f"mc-{job_id}", system_message=sys_msg)
            chat.with_model("anthropic", "claude-sonnet-4-5-20250929")
            chat.with_params(max_tokens=10000)
            resp = await chat.send_message(UserMessage(text=f"TOPIC: {topic}"))

            text = (resp or "").strip()
            text = re.sub(r"^```(?:json)?\s*", "", text)
            text = re.sub(r"\s*```$", "", text)
            try:
                parsed = json.loads(text)
            except json.JSONDecodeError:
                m = re.search(r"\{[\s\S]*\}", text)
                if not m:
                    raise RuntimeError("AI returned malformed content")
                parsed = json.loads(m.group(0))

            lessons_out = []
            for i, ls in enumerate(parsed.get("lessons") or [], 1):
                lessons_out.append({
                    "slug": _slugify(ls.get("title") or f"lesson-{i}") or f"lesson-{i}",
                    "title": (ls.get("title") or f"Lesson {i}").strip(),
                    "eyebrow": (ls.get("eyebrow") or f"Lesson {i}").strip(),
                    "body": [str(p).strip() for p in (ls.get("body") or []) if str(p).strip()],
                    "boxes": [
                        {"label": str(b.get("label") or "").strip(),
                         "items": [str(x).strip() for x in (b.get("items") or []) if str(x).strip()]}
                        for b in (ls.get("boxes") or []) if isinstance(b, dict)
                    ],
                    "steps": (
                        {"title": str((ls.get("steps") or {}).get("title") or "").strip(),
                         "items": [str(x).strip() for x in ((ls.get("steps") or {}).get("items") or []) if str(x).strip()]}
                        if isinstance(ls.get("steps"), dict) and (ls.get("steps") or {}).get("items") else None
                    ),
                    "tip": (ls.get("tip") or "").strip() or None,
                })

            masterclass = {
                "slug": slug,
                "title": (parsed.get("title") or topic).strip(),
                "tagline": (parsed.get("tagline") or "").strip(),
                "topic": topic,
                "duration": f"About {int(parsed.get('duration_minutes') or 50)} minutes",
                "duration_minutes": int(parsed.get("duration_minutes") or 50),
                "language": language,
                "lessons": lessons_out,
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "imageSubject": topic + " gardening",
            }

            await db.generated_masterclasses.insert_one({
                "cache_key": f"{slug}|{language}",
                "slug": slug, "language": language, "topic": topic,
                "data": masterclass, "views": 1, "owner_token": owner_token,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "last_seen": datetime.now(timezone.utc).isoformat(),
            })
            await db.masterclass_jobs.update_one(
                {"job_id": job_id},
                {"$set": {"status": "done", "completed_at": datetime.now(timezone.utc).isoformat()}},
            )
        except Exception as e:
            logger.exception("masterclass-gen job %s failed: %s", job_id, e)
            await db.masterclass_jobs.update_one(
                {"job_id": job_id},
                {"$set": {"status": "error", "error": str(e)[:300],
                          "completed_at": datetime.now(timezone.utc).isoformat()}},
            )

    @router.post("/masterclass/generate")
    async def generate_masterclass(req: MasterclassGenRequest, background: BackgroundTasks):
        """Kick off (or fetch cached) an AI-authored masterclass."""
        token = (req.access_token or "").strip()
        if not await _grant_is_active(token):
            raise HTTPException(402, "Access required — pay to unlock.")

        topic = (req.topic or "").strip()
        if len(topic) < 3:
            raise HTTPException(400, "Topic must be at least 3 characters.")
        if len(topic) > 120:
            raise HTTPException(400, "Topic must be 120 characters or fewer.")

        language = (req.language or "en").lower()
        slug = _slugify(topic)
        cache_key = f"{slug}|{language}"

        cached = await db.generated_masterclasses.find_one({"cache_key": cache_key}, {"_id": 0})
        if cached:
            await db.generated_masterclasses.update_one(
                {"cache_key": cache_key},
                {"$inc": {"views": 1}, "$set": {"last_seen": datetime.now(timezone.utc).isoformat()}},
            )
            return {"status": "done", "slug": slug, "job_id": None}

        if not EMERGENT_LLM_KEY:
            raise HTTPException(500, "EMERGENT_LLM_KEY not configured")

        job_id = uuid.uuid4().hex
        await db.masterclass_jobs.insert_one({
            "job_id": job_id, "slug": slug, "topic": topic, "language": language,
            "owner_token": token, "status": "pending",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        background.add_task(_run_masterclass_generation, job_id, topic, language, slug, token)
        return {"status": "pending", "slug": slug, "job_id": job_id}

    @router.get("/masterclass/job/{job_id}")
    async def get_masterclass_job(job_id: str):
        """Poll endpoint — returns {status: pending|done|error, slug?, error?}."""
        job = await db.masterclass_jobs.find_one({"job_id": job_id}, {"_id": 0})
        if not job:
            raise HTTPException(404, "Job not found.")
        out = {"status": job.get("status", "pending"), "slug": job.get("slug")}
        if job.get("status") == "error":
            out["error"] = job.get("error") or "Generation failed."
        return out

    @router.get("/masterclass/library")
    async def my_masterclass_library(access_token: str, language: str = "en"):
        """List the masterclasses generated by — OR previously viewed by — this user."""
        token = (access_token or "").strip()
        if not token:
            return {"items": []}
        cursor = db.generated_masterclasses.find(
            {"$or": [
                {"owner_token": token},
                {"viewers": token},
            ]},
            {"_id": 0, "data.lessons": 0},
        ).sort([("last_seen", -1)]).limit(60)
        items = await cursor.to_list(length=60)
        return {"items": [{
            "slug": it.get("slug"),
            "topic": it.get("topic"),
            "title": (it.get("data") or {}).get("title"),
            "tagline": (it.get("data") or {}).get("tagline"),
            "language": it.get("language"),
            "mine": it.get("owner_token") == token,
            "created_at": it.get("created_at"),
        } for it in items]}

    @router.get("/masterclass/generated/{slug}")
    async def get_generated_masterclass(slug: str, language: str = "en", access_token: str = ""):
        """Fetch a previously-generated masterclass by slug."""
        cache_key = f"{slug}|{language.lower()}"
        cached = await db.generated_masterclasses.find_one({"cache_key": cache_key}, {"_id": 0})
        if not cached:
            cached = await db.generated_masterclasses.find_one(
                {"slug": slug, "language": "en"}, {"_id": 0}
            )
        if not cached:
            raise HTTPException(404, "Masterclass not found.")

        token = (access_token or "").strip()
        if token:
            await db.generated_masterclasses.update_one(
                {"slug": cached["slug"], "language": cached["language"]},
                {"$addToSet": {"viewers": token},
                 "$inc": {"views": 1},
                 "$set": {"last_seen": datetime.now(timezone.utc).isoformat()}},
            )
        return cached["data"]

    @router.get("/masterclass/generated")
    async def list_generated_masterclasses(limit: int = 12):
        """Recent community-generated masterclass topics, ordered by popularity."""
        cursor = db.generated_masterclasses.find(
            {"language": "en"}, {"_id": 0, "data.lessons": 0}
        ).sort([("views", -1), ("created_at", -1)]).limit(max(1, min(limit, 40)))
        items = await cursor.to_list(length=limit)
        return {"items": [{
            "slug": it.get("slug"),
            "topic": it.get("topic"),
            "title": (it.get("data") or {}).get("title"),
            "tagline": (it.get("data") or {}).get("tagline"),
            "views": it.get("views", 1),
        } for it in items]}

    @router.get("/og/learn/{topic}")
    async def og_learn_meta(topic: str, language: str = "en"):
        """OpenGraph + intro metadata for a /learn/:topic landing page."""
        slug = (topic or "").strip().lower()
        if not slug:
            raise HTTPException(400, "Missing topic.")

        if slug in STATIC_MASTERCLASS_OG:
            m = STATIC_MASTERCLASS_OG[slug]
            return {
                "source": "static",
                "slug": slug,
                "title": m["title"],
                "tagline": m["tagline"],
                "description": _first_paragraph(m["intro"]),
                "intro_paragraphs": [m["intro"]],
                "image_subject": m["image_subject"],
                "lesson_count": None,
                "url_path": f"/learn/{slug}",
            }

        cache_key = f"{slug}|{language.lower()}"
        cached = await db.generated_masterclasses.find_one({"cache_key": cache_key}, {"_id": 0})
        if not cached:
            cached = await db.generated_masterclasses.find_one(
                {"slug": slug, "language": "en"}, {"_id": 0}
            )
        if not cached:
            raise HTTPException(404, "Topic not found.")

        data = cached.get("data") or {}
        lessons = data.get("lessons") or []
        intro_body = []
        if lessons and isinstance(lessons[0], dict):
            intro_body = lessons[0].get("body") or []
        return {
            "source": "ai",
            "slug": slug,
            "title": data.get("title") or slug.replace("-", " ").title(),
            "tagline": data.get("tagline") or "",
            "description": _first_paragraph((intro_body[0] if intro_body else data.get("tagline")) or ""),
            "intro_paragraphs": intro_body[:3],
            "image_subject": data.get("imageSubject") or data.get("topic") or data.get("title"),
            "lesson_count": len(lessons),
            "url_path": f"/learn/{slug}",
        }

    return router
