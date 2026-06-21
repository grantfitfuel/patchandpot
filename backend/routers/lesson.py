"""Lesson adaptation + vendor blurbs — both are short LLM-translated /
personalised bits of text that live in the guidance_cache collection."""
import json
import logging
from datetime import datetime, timezone

from fastapi import APIRouter

from core import (
    EMERGENT_LLM_KEY, LANG_NAMES,
    LessonAdaptRequest, VendorBlurbRequest,
    _llm_json,
)

logger = logging.getLogger(__name__)


def make_router(db) -> APIRouter:
    router = APIRouter()

    @router.post("/lesson-adapt")
    async def adapt_lesson(req: LessonAdaptRequest):
        """Translate + optionally personalise a masterclass lesson for a region."""
        language = (req.language or "en").lower()
        if language not in LANG_NAMES:
            language = "en"

        region_key = ""
        region_label = ""
        if req.region:
            region_label = req.region.name + (f", {req.region.country}" if req.region.country else "")
            region_key = "|".join([
                (req.region.name or "").lower(),
                (req.region.country or "").lower(),
                (req.region.climate_zone or "").lower(),
                (req.region.hemisphere or "northern").lower(),
            ])

        key = f"lesson-adapt:{req.masterclass_slug}:{req.lesson_slug}:{language}:{region_key}"
        cached = await db.guidance_cache.find_one({"key": key}, {"_id": 0})
        if cached:
            return cached["data"]

        if language == "en" and not req.region:
            return {
                "body": req.body, "steps_items": req.steps_items,
                "box_items": req.box_items, "tip": req.tip,
                "translated": False, "personalised": False,
            }

        system = (
            "You are an expert kitchen gardener who adapts existing gardening lesson content "
            "for a specific reader. Preserve the meaning, voice and order of the original lesson — "
            "do not invent unrelated facts, do not add headers, do not add disclaimers. "
            "Return STRICT JSON only — no markdown fences, no commentary."
        )

        region_clause = (
            f"PERSONALISE for a reader gardening in {region_label} "
            f"({req.region.climate_zone or 'unknown climate'}, "
            f"{req.region.hemisphere or 'northern'} hemisphere). "
            f"Where the original mentions seasons, pest timing or temperature, ADJUST so the example "
            f"makes sense in this region — switch hemispheres, swap species for locally common ones "
            f"where natural, keep timing realistic. "
            if req.region else ""
        )

        lang_clause = (
            f"OUTPUT LANGUAGE: {LANG_NAMES[language]}. Translate every string to {LANG_NAMES[language]}."
            if language != "en" else "OUTPUT LANGUAGE: English."
        )

        user_prompt = f"""Adapt the following gardening lesson.

Masterclass: {req.masterclass_slug}
Lesson title: {req.lesson_title}

{region_clause}
{lang_clause}

Return STRICT JSON with this exact shape:
{{
  "body": [<adapted body paragraphs, same count as input>],
  "steps_items": [<adapted step items, same count as input, or [] if no steps>],
  "box_items": [<adapted info-box items, same count, or [] if no box>],
  "tip": "<adapted tip, or empty string if none>",
  "translated": {str(language != "en").lower()},
  "personalised": {str(bool(req.region)).lower()}
}}

Original body paragraphs:
{json.dumps(req.body, ensure_ascii=False)}

Original steps (title: "{req.steps_title or ''}"):
{json.dumps(req.steps_items, ensure_ascii=False)}

Original info-box items:
{json.dumps(req.box_items, ensure_ascii=False)}

Original tip:
{json.dumps(req.tip or '', ensure_ascii=False)}

Return JSON only."""

        data = await _llm_json(system, user_prompt, session_id=f"lesson-adapt-{key}")
        data.setdefault("body", req.body)
        data.setdefault("steps_items", req.steps_items)
        data.setdefault("box_items", req.box_items)
        if "tip" not in data or data.get("tip") in (None, ""):
            data["tip"] = req.tip
        data["translated"] = language != "en"
        data["personalised"] = bool(req.region)

        await db.guidance_cache.insert_one({
            "key": key, "data": data, "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return data

    @router.post("/vendor-blurbs")
    async def vendor_blurbs(req: VendorBlurbRequest):
        """One-line, region-specific reason why each vendor pairs well with the plant."""
        language = (req.language or "en").lower()
        if language not in LANG_NAMES:
            language = "en"

        country = (req.region.country if req.region and req.region.country else "").strip()
        region_name = (req.region.name if req.region and req.region.name else "").strip()
        climate = (req.region.climate_zone if req.region and req.region.climate_zone else "").strip()
        hemisphere = (req.region.hemisphere if req.region and req.region.hemisphere else "northern").strip()

        vendor_ids = sorted(v.id for v in req.vendors)
        key = "vendor-blurbs:" + "|".join([
            req.plant_name.lower().strip(),
            country.lower(),
            language,
            ",".join(vendor_ids),
        ])

        cached = await db.guidance_cache.find_one({"key": key}, {"_id": 0})
        if cached:
            return {**cached["data"], "cached": True}

        if not EMERGENT_LLM_KEY:
            return {"blurbs": {}, "cached": False}

        vendor_lines = "\n".join(
            f"- id: {v.id} | name: {v.name} | sells: {v.kind}" for v in req.vendors
        )
        region_clause = (
            f"The reader gardens in {region_name}{', ' + country if country else ''} "
            f"({climate or 'unknown climate'}, {hemisphere} hemisphere). "
            if region_name else ""
        )
        lang_clause = (
            f"Write the sentence in {LANG_NAMES[language]}."
            if language != "en" else "Write the sentence in English."
        )

        system = (
            "You are a knowledgeable kitchen-garden writer. Given a plant, a reader's region, "
            "and a list of garden suppliers in that region, write ONE short, specific sentence "
            "(max 18 words) for EACH vendor explaining why that supplier is a good pick for "
            "this plant in this region. Be concrete: mention real strengths (e.g. heritage seed "
            "range, climate-tolerant varieties, container sizes, local stock, organic compost) "
            "and tie it to the plant + climate where it makes sense. NEVER invent product names. "
            "NEVER use marketing fluff like 'amazing' or 'best ever'. Return STRICT JSON only."
        )

        user_prompt = f"""Plant: {req.plant_name}
{region_clause}{lang_clause}

Vendors:
{vendor_lines}

Return STRICT JSON with this exact shape:
{{
  "blurbs": {{
    "<vendor id 1>": "<one-sentence reason, <=18 words>",
    "<vendor id 2>": "<one-sentence reason, <=18 words>",
    ...
  }}
}}

Use the exact `id` strings as keys. Return JSON only."""

        try:
            data = await _llm_json(system, user_prompt, session_id=f"vendor-blurbs-{key}")
        except Exception:
            return {"blurbs": {}, "cached": False}

        blurbs = data.get("blurbs") or {}
        known = {v.id for v in req.vendors}
        blurbs = {
            k: (str(v).strip()[:220])
            for k, v in blurbs.items()
            if k in known and isinstance(v, str) and v.strip()
        }
        result = {"blurbs": blurbs}

        await db.guidance_cache.insert_one({
            "key": key, "data": result, "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return {**result, "cached": False}

    return router
