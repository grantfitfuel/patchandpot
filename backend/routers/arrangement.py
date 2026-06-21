"""'What's in your garden right now' — AI flower arrangement suggester.

Looks at the user's My Garden list + region + month, then proposes a single
seasonal arrangement they could actually build today, using only what they
already grow. Cached per (region, month, garden, language).
"""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from core import (
    LANG_NAMES, MONTHS, ArrangementRequest,
    _climate_context, _llm_json,
)


def make_router(db) -> APIRouter:
    router = APIRouter()

    @router.post("/arrangement/suggest")
    async def suggest_arrangement(req: ArrangementRequest, regenerate: bool = False):
        """Generate (or fetch cached) seasonal arrangement using what the user grows."""
        language = (req.language or "en").lower()
        if language not in LANG_NAMES:
            language = "en"

        garden = sorted({(p or "").strip().lower() for p in (req.my_garden or []) if (p or "").strip()})
        if not garden:
            raise HTTPException(400, "Empty garden — add at least one plant to suggest an arrangement.")

        cc = _climate_context(req.region, req.month)
        region_label = req.region.name + (f", {req.region.country}" if req.region.country else "")
        month_name = MONTHS[req.month]
        cache_key = (
            "arr|" + req.region.name.lower() + "|" + (req.region.country or "").lower() +
            "|" + str(req.month) + "|" + language + "|" + ",".join(garden)
        )

        if not regenerate:
            cached = await db.arrangement_cache.find_one({"key": cache_key}, {"_id": 0})
            if cached:
                return cached["data"]

        language_name = LANG_NAMES[language]
        garden_str = ", ".join(garden)

        system = (
            "You are a generous home florist who teaches the principles of seasonal "
            "flower arranging — focal/filler/line/accent roles, mechanics, conditioning. "
            "You build arrangements using ONLY what someone has in their garden right "
            "now, never sending them out to buy. You ALWAYS respond as valid JSON only, "
            "no markdown fences, no preamble."
        )

        user = f"""The user lives in {region_label} and it is currently {month_name}.

Climate facts (computed, NOT guessed):
- Effective seasonal month: {cc['effective_seasonal_month_name']}
- Daylight at mid-month: {cc['daylight_hours_midmonth']} hours
- Season phase: {cc['season_bucket']}
- Frost outlook: {cc['frost_outlook']}

Their garden contains: {garden_str}.

Propose ONE realistic, beautiful, seasonal flower arrangement they could build
TODAY using only what's listed above. If they have very few flowering plants,
include foliage from edible herbs (basil flower spikes, dill flower, mint, rosemary,
oregano), seedheads, branches, fruit (rosehip, blackberry stems) — every kitchen-garden
plant has something to offer.

If literally nothing in their list could go in a vase this month (e.g. all crops are
dormant or pre-flowering), say so in the 'intro' field and suggest 2 stems to forage
or buy as a one-off complement. Do NOT invent plants they don't have.

OUTPUT LANGUAGE: {language_name}. All text in {language_name} except the role enum
('focal'|'filler'|'line'|'accent'|'foliage') which stays English.

Return STRICT JSON in this exact shape:
{{
  "title": "Short evocative title — e.g. 'September jug from your back step'",
  "intro": "2-3 sentence intro grounded in the climate and the actual garden list. Warm, plain language.",
  "vase": "1 sentence on what kind of vessel suits this arrangement (low bowl, jug, tumbler) and why.",
  "mechanic": "One of: 'chicken wire ball' | 'kenzan / pin holder' | 'tape grid' | 'no mechanic needed' — with a 1-sentence reason.",
  "stems": [
    {{
      "plant": "Name of plant — must come from the user's garden list (or be explicitly flagged as a one-off foraged complement)",
      "role": "focal | filler | line | accent | foliage",
      "count": "Suggested number of stems (string, e.g. '3 stems' or '1 branch')",
      "cutting_tip": "One sentence: when in the day, what stage, where on the plant to cut"
    }}
  ],
  "build_steps": [
    "Step 1 — short imperative",
    "Step 2 — short imperative",
    "etc., 5-7 steps total following the principles: mechanic → foliage → line → focal → filler → accent → edit"
  ],
  "tip": "One pithy 'why this works' or 'don't forget' line. Could be about scent, light, or longevity."
}}

Aim for 6-10 stems total in the 'stems' array. Balance roles — at least one focal,
several fillers, ideally a line stem and an accent. Be honest about what works in
{month_name} in {region_label}; respect the climate facts above. Return JSON only."""

        data = await _llm_json(system, user, session_id=f"arrangement-{cache_key}")

        await db.arrangement_cache.update_one(
            {"key": cache_key},
            {"$set": {
                "key": cache_key,
                "data": data,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "region": req.region.model_dump() if hasattr(req.region, "model_dump") else req.region.dict(),
                "month": req.month,
                "language": language,
                "my_garden": list(garden),
            }},
            upsert=True,
        )
        return data

    return router
