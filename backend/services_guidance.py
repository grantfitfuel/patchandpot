"""Guidance generation pipeline — two-pass i18n for cost.

Pattern:
  - For EN requests: original Sonnet call (creative, expensive).
  - For non-EN: look up the EN cache for the same region+month+garden. If it
    exists, run a CHEAP Haiku translation of the JSON and cache it. If it
    doesn't, generate EN with Sonnet (and cache it), then translate.

That means we run the expensive Sonnet generation ONCE per unique
(region, month, garden) tuple instead of once per language. For a hot region
viewed in 10 languages, that's ~75% saving on AI bills.
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


def _build_en_guidance_prompts(req: GuidanceRequest, garden: list) -> tuple[str, str]:
    """Returns (system, user) prompts for the expensive EN generation pass.
    Extracted so the pure-EN code path and the two-pass code path share one
    prompt template."""
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

{(
  f"THE USER'S PERSONAL GARDEN this month contains: {', '.join(garden)}. "
  f"IMPORTANT: in the 'tasks' list, include at least ONE specific task per plant in this list, "
  f"clearly named, tailored to {month_name} in {region_label}. These personalised tasks should come "
  f"first in the tasks array. After them, add general tasks for the month."
) if garden else ""}

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
    """Cheap Haiku call to translate the EN guidance JSON in-place.

    Preserves the JSON shape, translates every string except the 'kind' enum
    which stays in English ('food' / 'flower'). Uses idiomatic plant names
    where they exist in the target language."""
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


def make_generate_and_cache_guidance(db):
    """Factory: returns `async _generate_and_cache_guidance(req, force=False)`."""

    async def _generate_en_and_cache(en_key: str, req: GuidanceRequest, garden: list) -> dict:
        """Generate EN guidance via Sonnet and cache it under the EN key."""
        system, user = _build_en_guidance_prompts(req, garden)
        en_data = await _llm_json(system, user, session_id=f"guidance-en-{en_key}")
        await db.guidance_cache.update_one(
            {"key": en_key},
            {"$set": {
                "key": en_key,
                "data": en_data,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "region": req.region.model_dump() if hasattr(req.region, "model_dump") else req.region.dict(),
                "month": req.month,
                "language": "en",
                "my_garden": list(garden),
                "kind": "guidance",
            }},
            upsert=True,
        )
        return en_data

    async def _generate_and_cache_guidance(req: GuidanceRequest, force: bool = False) -> dict:
        language = (req.language or "en").lower()
        if language not in LANG_NAMES:
            language = "en"

        garden = [(p or "").strip() for p in (req.my_garden or []) if (p or "").strip()]
        garden = sorted({p.lower(): p for p in garden}.values())
        garden_key = "garden:" + ",".join(p.lower() for p in garden) if garden else ""

        cache_key = _guidance_cache_key(req.region, req.month, language, garden_key)
        if not force:
            cached = await db.guidance_cache.find_one({"key": cache_key}, {"_id": 0})
            if cached:
                return cached["data"]

        # EN path: generate directly with the expensive Sonnet model.
        if language == "en":
            return await _generate_en_and_cache(cache_key, req, garden)

        # Non-EN path: two-pass. Get (or generate) the EN source first, then
        # do a cheap Haiku translation pass that we also cache.
        en_key = _guidance_cache_key(req.region, req.month, "en", garden_key)
        en_cached = await db.guidance_cache.find_one({"key": en_key}, {"_id": 0})
        if en_cached:
            en_data = en_cached["data"]
        else:
            # Build a synthetic EN request that mirrors `req` but with language='en'
            # so the same (region, month, garden) tuple is reused for the EN cache.
            en_req = GuidanceRequest(
                region=req.region, month=req.month, language="en", my_garden=req.my_garden,
            )
            en_data = await _generate_en_and_cache(en_key, en_req, garden)

        try:
            translated = await _translate_guidance_json(en_data, language)
        except Exception as e:  # noqa: BLE001
            logger.warning(
                "Two-pass translation to %s failed (%s) — serving EN content as fallback.",
                language, e,
            )
            translated = en_data  # graceful — UI still works in EN

        await db.guidance_cache.update_one(
            {"key": cache_key},
            {"$set": {
                "key": cache_key,
                "data": translated,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "region": req.region.model_dump() if hasattr(req.region, "model_dump") else req.region.dict(),
                "month": req.month,
                "language": language,
                "my_garden": list(garden),
                "kind": "guidance",
                "translated_from": "en",
            }},
            upsert=True,
        )
        return translated

    return _generate_and_cache_guidance
