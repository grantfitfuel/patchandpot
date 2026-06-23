"""Guidance generation pipeline — three-pass for maximum cost efficiency.

Design:
  1. Base (region, month) guidance is generated ONCE in English via Sonnet 4.5
     and cached forever. This is the bulk of the content — summary, plant_now,
     harvest_now, GENERAL tasks, pests, tip. No garden personalisation.
  2. Non-EN languages translate the base via cheap Claude Haiku 4.5.
  3. If the user has a personal garden, a tiny Haiku call generates 2-4
     plant-specific tasks in the target language. These are prepended to the
     base tasks. The merged result is cached under the full key.

Net effect: the expensive Sonnet base call runs once per (region, month) tuple
— not once per (region, month, language, garden) combination. For a hot
region viewed in 10 languages by 50 users with different gardens, we go from
500 Sonnet calls down to 1 Sonnet + 10 Haiku translation + 50 tiny Haiku
personalisation calls.
"""
import json
import logging
from datetime import datetime, timezone

from core import (
    LANG_NAMES, MONTHS, PLANTS,
    GuidanceRequest, _climate_context, _guidance_cache_key,
    _llm_json, _llm_json_cheap,
)

logger = logging.getLogger(__name__)


def _build_base_guidance_prompts(req: GuidanceRequest) -> tuple[str, str]:
    """Returns (system, user) prompts for the expensive EN base generation pass.
    This is the GENERAL guidance for the region/month — no garden personalisation.
    A separate Haiku call adds personalised tasks on top."""
    month_name = MONTHS[req.month]
    region_label = req.region.name + (f", {req.region.country}" if req.region.country else "")
    climate = req.region.climate_zone or "unknown climate"
    hemi = req.region.hemisphere or "northern"
    plant_names = ", ".join(p["name"] for p in PLANTS)

    cc = _climate_context(req.region, req.month)
    season_facts = (
        f"GROUND-TRUTH CLIMATE FACTS (computed, NOT guessed — respect them strictly):\n"
        f"- Calendar month: {month_name} (#{req.month})\n"
        f"- Hemisphere: {'southern' if cc['is_southern_hemisphere'] else 'northern'}\n"
        f"- Effective seasonal month (the equivalent northern-hem month for "
        f"reasoning about seasons): {cc['effective_seasonal_month_name']}\n"
        f"- Latitude: {cc['latitude']}°\n"
        f"- Daylight at mid-month: {cc['daylight_hours_midmonth']} hours\n"
        f"- Growing-season phase: {cc['season_bucket']}\n"
        f"- Frost outlook: {cc['frost_outlook']}\n"
    )

    system = (
        "You are an expert kitchen gardener, flower grower and horticulturalist who advises "
        "home growers around the world on small-space, container, balcony and patio growing of "
        "both edibles AND flowers (ornamental and edible). You give warm, practical, "
        "plain-language advice tailored to a specific region and month. "
        "You ALWAYS respond as valid JSON only, with no markdown fences and no extra prose."
    )

    user = f"""Generate a practical gardening guide for THIS specific region and month, IN ENGLISH.
The guide MUST cover BOTH food (vegetables, herbs, fruit) AND flowers (ornamental and edible).

Region: {region_label}
Approximate climate: {climate}
Hemisphere: {hemi}
Month: {month_name} (month #{req.month})

PLACE-NAME RULES (mandatory):
- When you reference the place in any text field (summary, plant.why, harvest.tip,
  task.detail, pest.control, etc.) ALWAYS use the actual place name "{region_label}"
  or its city portion "{req.region.name}".
- NEVER write generic phrases like "your location", "your area", "your region",
  "in your part of the world", "where you live", or any equivalent translation.
  This is a printed almanac for one specific city — name the city.
{season_facts}
CLIMATE-RESPECT RULES (mandatory — violating any of these is a critical error):
- Treat the Ground-Truth Climate Facts above as authoritative. If the frost
  outlook says hard frost is likely, you must NOT recommend tender warm-season
  crops (tomato, pepper, aubergine, basil, courgette, cucumber, French bean,
  sweet corn, dahlia tubers, nasturtium, zinnia) for sowing direct or planting
  out. They may still be sown indoors under heat if appropriate.
- If daylight is under 10 hours, do not recommend long-day crops to mature
  outdoors this month (onions from sets, bolting-prone lettuces, long-day
  brassicas). Instead favour short-day-tolerant crops (overwintering garlic,
  broad beans in mild zones, salad leaves under cover, hardy alliums).
- If daylight is over 15 hours, factor in fast bolting risk for lettuce,
  spinach, coriander/cilantro and rocket — recommend bolt-resistant varieties.
- In the southern hemisphere ({'YES THIS REGION IS SOUTHERN' if cc['is_southern_hemisphere'] else 'this region is northern, so this rule does not apply'}),
  flip ALL conventional seasonal advice. January = mid-summer, July = mid-winter.
  Use the effective seasonal month ({cc['effective_seasonal_month_name']}) to
  reason about season-typical tasks.
- Pest pressure must match the season bucket: aphids surge in warm weather
  (under 25°C), slugs and snails surge in cool-wet conditions, vine weevil
  larvae chew roots autumn–spring, whitefly and red spider mite peak in dry
  summer heat. Do NOT recommend hunting for slugs in 35°C dry heat or aphid
  squashing on dormant winter plants.
- Tasks must be possible this month: do not say 'plant the dahlias outside'
  if frost is still likely; do not say 'harvest the squash' in mid-spring.
- The 'season_label' you return must align with the effective seasonal month —
  e.g. for southern-hem July return 'mid-winter', not 'mid-summer'.

Focus on home-scale, small-space and container growing. Mix food crops and flowers throughout —
do not return flowers-only or food-only lists. You may reference these (English) plant names
but feel free to mention other locally common edibles and flowers too:
{plant_names}

Tasks in this base guide must be GENERAL maintenance for the month (watering, feeding,
mulching, pinching out, succession sowing, pest watch). Do not personalise to a particular
user's plant list — that is added separately.

Return STRICT JSON with this exact shape and keys (all keys AND values in English):
{{
  "summary": "2-3 sentence overview of what {month_name} feels like for a grower in {region_label}, grounded in the climate facts above.",
  "season_label": "Short label e.g. 'Late spring', 'Dry season', 'Monsoon', 'Mid-winter'.",
  "plant_now": [
    {{ "name": "Plant name", "kind": "food | flower", "why": "1 sentence why this month suits it (refer to daylight / frost / season where relevant)", "how": "1-2 sentence sowing/planting tip" }}
  ],
  "harvest_now": [
    {{ "name": "Plant name", "kind": "food | flower", "tip": "1 sentence harvest or cut-flower tip" }}
  ],
  "tasks": [
    {{ "title": "Short imperative task", "detail": "1-2 sentence how-to" }}
  ],
  "pests": [
    {{ "name": "Pest or disease name", "signs": "What to look for", "control": "Organic-first control advice" }}
  ],
  "tip": "One short 'mindful growing' wisdom for the month."
}}

For plant_now and harvest_now include a healthy mix: at least 2 food items AND at least 2 flowers
(edible or ornamental). Provide 4-6 items each for plant_now, harvest_now, tasks, and pests.
Keep advice realistic for {region_label} in {month_name} — respect the climate facts above. Return JSON only."""

    return system, user


async def _translate_guidance_json(en_data: dict, language: str) -> dict:
    """Cheap Haiku call to translate the EN guidance JSON in-place."""
    language_name = LANG_NAMES[language]
    system = (
        "You translate gardening JSON content from English. The JSON keys stay in English. "
        "Translate every string value to the target language using natural, locally idiomatic "
        "phrasing. The 'kind' field stays English ('food' or 'flower'). Preserve numbers, "
        "em-dashes, ellipses and bullet structure. Return STRICT JSON only — no markdown."
    )
    user = f"""Translate every string value in this gardening guide into {language_name}.

Rules:
- Keep JSON keys in English. Keep JSON shape EXACTLY the same.
- Translate every string value to {language_name} using natural, locally-common phrasing.
- For plant names, use the locally-common name where one exists; if there is no native name,
  transliterate naturally.
- Keep the "kind" field in English ("food" or "flower"). Do not translate it.
- Preserve em-dashes (—), hyphens, ellipses (…), and number formatting.

Source (English):
{json.dumps(en_data, ensure_ascii=False, indent=2)}

Return JSON only, in the same shape with all string values translated to {language_name}.
"""
    return await _llm_json_cheap(system, user, session_id=f"trans-guidance-{language}")


async def _personalised_tasks(req: GuidanceRequest, garden: list, language: str) -> list:
    """Tiny Haiku call: generate 2-4 specific, this-month tasks for the user's
    actual garden. Always written in the target language. Cheap because the
    prompt is small and the response is small."""
    if not garden:
        return []

    language_name = LANG_NAMES.get(language, "English")
    month_name = MONTHS[req.month]
    region_label = req.region.name + (f", {req.region.country}" if req.region.country else "")
    cc = _climate_context(req.region, req.month)
    garden_list = ", ".join(garden)

    system = (
        "You are a kitchen gardener generating short, personalised monthly tasks for the "
        "specific plants in a reader's garden. Be concrete (mention timing, tools, mistakes). "
        "Output STRICT JSON only, no markdown."
    )
    user = f"""The reader's garden in {region_label} this {month_name} contains: {garden_list}.

Effective season: {cc['season_bucket']} (effective month for season reasoning: {cc['effective_seasonal_month_name']}).
Daylight mid-month: {cc['daylight_hours_midmonth']} hours. Frost: {cc['frost_outlook']}.

Write 2-4 personalised tasks — one per plant where it makes sense for THIS month and
this climate. Each task names the plant clearly. Tasks must be realistic for the season
(don't say 'harvest tomatoes' in mid-winter). Skip plants that need no specific attention
this month.

OUTPUT LANGUAGE: {language_name}. Write all titles + details in {language_name}.

Return STRICT JSON:
{{
  "tasks": [
    {{ "title": "Short imperative task naming the plant", "detail": "1-2 sentence how-to" }}
  ]
}}

Return JSON only."""

    try:
        data = await _llm_json_cheap(
            system, user,
            session_id=f"personalised-tasks-{req.region.name}-{req.month}-{language}",
        )
        return [
            {"title": str(t.get("title") or "").strip(), "detail": str(t.get("detail") or "").strip()}
            for t in (data.get("tasks") or [])
            if isinstance(t, dict) and t.get("title")
        ][:4]
    except Exception as e:  # noqa: BLE001
        logger.warning("Personalised tasks failed (%s) — serving base tasks only.", e)
        return []


def make_generate_and_cache_guidance(db):
    """Factory: returns `async _generate_and_cache_guidance(req, force=False)`."""

    async def _get_or_generate_base(req: GuidanceRequest, language: str) -> dict:
        """Returns the base (no-garden) guidance for (region, month, language).
        EN goes via Sonnet. Other languages translate cached EN via Haiku."""
        base_key_en = _guidance_cache_key(req.region, req.month, "en", "")
        base_key_lang = _guidance_cache_key(req.region, req.month, language, "")

        if language != "en":
            lang_cached = await db.guidance_cache.find_one({"key": base_key_lang}, {"_id": 0})
            if lang_cached:
                return lang_cached["data"]

        en_cached = await db.guidance_cache.find_one({"key": base_key_en}, {"_id": 0})
        if en_cached:
            en_data = en_cached["data"]
        else:
            system, user = _build_base_guidance_prompts(req)
            en_data = await _llm_json(system, user, session_id=f"guidance-base-{base_key_en}")
            await db.guidance_cache.update_one(
                {"key": base_key_en},
                {"$set": {
                    "key": base_key_en, "data": en_data,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "region": req.region.model_dump() if hasattr(req.region, "model_dump") else req.region.dict(),
                    "month": req.month, "language": "en", "my_garden": [],
                    "kind": "guidance-base",
                }},
                upsert=True,
            )

        if language == "en":
            return en_data

        try:
            translated = await _translate_guidance_json(en_data, language)
        except Exception as e:  # noqa: BLE001
            logger.warning("Base translation to %s failed (%s) — using EN.", language, e)
            return en_data

        await db.guidance_cache.update_one(
            {"key": base_key_lang},
            {"$set": {
                "key": base_key_lang, "data": translated,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "region": req.region.model_dump() if hasattr(req.region, "model_dump") else req.region.dict(),
                "month": req.month, "language": language, "my_garden": [],
                "kind": "guidance-base", "translated_from": "en",
            }},
            upsert=True,
        )
        return translated

    async def _generate_and_cache_guidance(req: GuidanceRequest, force: bool = False) -> dict:
        language = (req.language or "en").lower()
        if language not in LANG_NAMES:
            language = "en"

        garden = [(p or "").strip() for p in (req.my_garden or []) if (p or "").strip()]
        garden = sorted({p.lower(): p for p in garden}.values())
        garden_key = "garden:" + ",".join(p.lower() for p in garden) if garden else ""

        full_key = _guidance_cache_key(req.region, req.month, language, garden_key)
        if not force:
            cached = await db.guidance_cache.find_one({"key": full_key}, {"_id": 0})
            if cached:
                return cached["data"]

        # 1. Base guidance (region+month+language, no garden) — shared across users.
        base_data = await _get_or_generate_base(req, language)

        # 2. No garden → base is the result.
        if not garden:
            await db.guidance_cache.update_one(
                {"key": full_key},
                {"$set": {
                    "key": full_key, "data": base_data,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "region": req.region.model_dump() if hasattr(req.region, "model_dump") else req.region.dict(),
                    "month": req.month, "language": language, "my_garden": [],
                    "kind": "guidance",
                }},
                upsert=True,
            )
            return base_data

        # 3. Garden present → tiny Haiku call for personalised tasks, prepended.
        extra_tasks = await _personalised_tasks(req, garden, language)
        merged = dict(base_data)
        merged["tasks"] = (extra_tasks or []) + (base_data.get("tasks") or [])

        await db.guidance_cache.update_one(
            {"key": full_key},
            {"$set": {
                "key": full_key, "data": merged,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "region": req.region.model_dump() if hasattr(req.region, "model_dump") else req.region.dict(),
                "month": req.month, "language": language, "my_garden": list(garden),
                "kind": "guidance", "base_key": _guidance_cache_key(req.region, req.month, language, ""),
            }},
            upsert=True,
        )
        return merged

    return _generate_and_cache_guidance
