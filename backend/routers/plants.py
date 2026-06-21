"""Plant catalogue, single-plant lookup, companion plants, and the
AI-driven plant-image / pest-image endpoints. Also exposes the AI-generated
'any plant' guide endpoints (`/plant-guide`, `/recent-plants`)."""
import logging
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException

from core import (
    LANG_NAMES, PLANTS, PLANT_INDEX, COMPANIONS, COMPANION_REASONS,
    PlantImageRequest, PestImageRequest, PlantGuideRequest,
    _llm_json, _plant_slug,
    make_cached_image, make_plants_in_language, make_translate_companion_reasons,
)

logger = logging.getLogger(__name__)


def make_router(db) -> APIRouter:
    router = APIRouter()
    _plants_in_language = make_plants_in_language(db)
    _translate_companion_reasons = make_translate_companion_reasons(db)
    _cached_image = make_cached_image(db)

    @router.get("/plants")
    async def list_plants(language: str = "en"):
        return await _plants_in_language(language)

    @router.get("/plants/{plant_id}")
    async def get_plant(plant_id: str, language: str = "en"):
        plants = await _plants_in_language(language)
        by_id = {p["id"]: p for p in plants}
        plant = by_id.get(plant_id)
        if not plant:
            raise HTTPException(404, "Plant not found")
        return plant

    @router.get("/plants/{plant_id}/companions")
    async def get_companions(plant_id: str, language: str = "en"):
        """Return curated companion plants for a given plant id."""
        if plant_id not in PLANT_INDEX:
            raise HTTPException(404, "Plant not found")
        plants = await _plants_in_language(language)
        by_id = {p["id"]: p for p in plants}
        companion_ids = COMPANIONS.get(plant_id, [])
        items = []
        for cid in companion_ids:
            p = by_id.get(cid) or PLANT_INDEX.get(cid)
            if not p:
                continue
            reason = COMPANION_REASONS.get((plant_id, cid)) or COMPANION_REASONS.get((cid, plant_id))
            items.append({
                "id": p["id"], "name": p["name"], "category": p["category"],
                "summary": p["summary"], "reason": reason,
            })
        if (language or "en").lower() != "en" and (language or "").lower() in LANG_NAMES and items:
            try:
                items = await _translate_companion_reasons(items, language)
            except Exception as e:  # noqa: BLE001
                logger.warning("companion-reasons translation failed for %s: %s", language, e)
        return {"plant_id": plant_id, "companions": items}

    @router.post("/plant-image")
    async def generate_plant_image(req: PlantImageRequest):
        """Generate (or fetch cached) AI image of a plant. Returns data URL."""
        cache_key = f"plant-image:{req.plant_id}"
        style = req.style_hint or (
            "soft natural light, shallow depth of field, terracotta pot on a weathered wooden "
            "windowsill, warm sand background, editorial gardening magazine style, no text, no people"
        )
        name_lower = (req.plant_name or "").lower()
        is_flower = any(k in name_lower for k in [
            "flower", "nasturtium", "calendula", "sunflower", "marigold", "lavender",
            "cosmos", "viola", "pansy", "sweet pea", "zinnia", "borage", "geranium", "chamomile"
        ])
        subject = (
            f"A beautiful close-up photo of fresh {req.plant_name} flowers in bloom"
            if is_flower else
            f"A beautiful close-up photo of a healthy {req.plant_name} plant"
        )
        prompt = f"{subject}. {style}."
        return await _cached_image(cache_key, prompt, session=f"img-{req.plant_id}-{uuid.uuid4()}")

    @router.post("/pest-image")
    async def generate_pest_image(req: PestImageRequest):
        """Generate (or fetch cached) AI image of a pest/disease."""
        safe_key = re.sub(r"[^a-z0-9]+", "-", req.name.lower()).strip("-")
        cache_key = f"pest-image:{safe_key}"
        prompt = (
            f"A close-up macro reference photograph of '{req.name}' as seen by a home gardener "
            f"on leaves or stems. Naturalistic, soft daylight, gardening field-guide style, "
            f"no text, no people, no pesticide bottles. Subject in sharp focus, background "
            f"a softly blurred green leaf."
        )
        return await _cached_image(cache_key, prompt, session=f"pest-img-{safe_key}-{uuid.uuid4()}")

    @router.post("/plant-guide")
    async def generate_plant_guide(req: PlantGuideRequest):
        """Generate (or return cached) AI plant guide for ANY plant — even ones not
        in the curated database."""
        name = (req.query or "").strip()
        if len(name) < 2:
            raise HTTPException(400, "Query too short")
        if len(name) > 80:
            raise HTTPException(400, "Query too long")

        language = (req.language or "en").lower()
        if language not in LANG_NAMES:
            language = "en"

        slug = _plant_slug(name)
        cache_key = f"plant-guide:{slug}:{language}"
        cached = await db.guidance_cache.find_one({"key": cache_key}, {"_id": 0})
        if cached:
            return cached["data"]

        for p in PLANTS:
            if p["name"].lower() == name.lower():
                return {**p, "ai_generated": False, "curated": True}

        language_name = LANG_NAMES[language]
        system = (
            "You are a careful horticulturalist creating concise, accurate plant care guides "
            "for small-space gardeners. Stick to widely-accepted advice. If asked about a plant "
            "you're unsure exists, set 'unknown' to true and return minimal fields. "
            "ALWAYS respond as valid JSON only — no markdown fences, no extra prose."
        )

        user_prompt = f"""Generate a plant care guide for: "{name}"

OUTPUT LANGUAGE: {language_name}. All string values must be in {language_name}.

Return STRICT JSON with this exact shape (keys stay in English):
{{
  "unknown": false,
  "id": "{slug}",
  "name": "<official common name>",
  "botanical_name": "<botanical name if known, else empty>",
  "category": "Vegetable | Herb | Leafy green | Fruit | Root | Allium | Flower | Other",
  "difficulty": "Very easy | Easy | Medium | Hard",
  "sun": "Full sun | Full to partial | Partial sun | Shade",
  "water": "Low | Moderate | Regular | Frequent",
  "soil": "<one-line soil description>",
  "container": true,
  "edible_part": "<comma-separated parts that are edible, or 'Ornamental' if not edible>",
  "summary": "<1-2 sentence overview>",
  "growing": ["<3-5 short tips on growing — sowing, planting, daily care>"],
  "problems": [
    {{"name": "<pest or disease>", "solution": "<one sentence organic-first control>"}}
  ],
  "companions": ["<3-5 plant names that grow well near this one>"],
  "seasonality": "<one sentence on best growing season(s) in temperate climates>",
  "warnings": "<empty string OR a single safety note e.g. 'Leaves toxic; only fruit is edible' or 'Sap can irritate skin'. Leave empty if no warnings are warranted.>",
  "tags": ["<3-6 short lowercase tags e.g. 'heat', 'beginner', 'perennial'>"]
}}

If the plant is not a real plant or you cannot give a confident answer, return:
{{"unknown": true, "name": "{name}", "id": "{slug}"}}

Return JSON only."""

        data = await _llm_json(system, user_prompt, session_id=f"plant-guide-{slug}-{language}")

        if data.get("unknown"):
            raise HTTPException(404, f"Couldn't find reliable information on '{name}'. Try a more common name.")

        data["id"] = slug
        data["ai_generated"] = True
        data["curated"] = False
        data.setdefault("container", True)
        data.setdefault("tags", [])
        data.setdefault("growing", [])
        data.setdefault("problems", [])
        data.setdefault("companions", [])
        data.setdefault("warnings", "")
        data.setdefault("botanical_name", "")
        data.setdefault("category", "Other")
        data.setdefault("difficulty", "Medium")
        data.setdefault("sun", "Full to partial")
        data.setdefault("water", "Moderate")
        data.setdefault("soil", "Well-drained")
        data.setdefault("edible_part", "Ornamental")
        data.setdefault("summary", f"AI-generated guide for {data['name']}.")
        data.setdefault("seasonality", "")

        await db.guidance_cache.insert_one({
            "key": cache_key, "data": data,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return data

    @router.get("/plant-guide/{slug}")
    async def get_cached_plant_guide(slug: str, language: str = "en"):
        """Lookup an AI plant guide by its slug — used when navigating directly to /plants/ai/{slug}."""
        if not slug.startswith("ai-"):
            raise HTTPException(404, "Not an AI plant slug")
        cache_key = f"plant-guide:{slug}:{language}"
        cached = await db.guidance_cache.find_one({"key": cache_key}, {"_id": 0})
        if cached:
            return cached["data"]
        raise HTTPException(404, "Guide not cached yet — search for the plant from the Plants page.")

    @router.get("/recent-plants")
    async def recent_ai_plants(language: str = "en", limit: int = 8):
        """Most recently generated AI plant guides — 'Recently searched' rail."""
        limit = max(1, min(limit, 24))
        pattern = f"^plant-guide:ai-.*:{re.escape(language)}$"
        cursor = (
            db.guidance_cache
              .find({"key": {"$regex": pattern}}, {"_id": 0})
              .sort("created_at", -1)
              .limit(limit)
        )
        items = []
        seen_ids = set()
        async for row in cursor:
            d = row.get("data") or {}
            if not d.get("id") or d["id"] in seen_ids:
                continue
            seen_ids.add(d["id"])
            items.append({
                "id": d["id"], "name": d.get("name"), "category": d.get("category"),
                "summary": d.get("summary"),
            })
        return {"items": items}

    return router
