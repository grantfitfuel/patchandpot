"""Guidance generation pipeline — extracted from server.py so the PDF, admin
refresh, cron job and the public /api/guidance route all share the same
prompt + caching code path.
"""
import logging
from datetime import datetime, timezone

from core import (
    LANG_NAMES, MONTHS, PLANTS,
    GuidanceRequest, _climate_context, _guidance_cache_key, _llm_json,
)

logger = logging.getLogger(__name__)


def make_generate_and_cache_guidance(db):
    """Factory: returns `async _generate_and_cache_guidance(req, force=False)`."""

    async def _generate_and_cache_guidance(req: GuidanceRequest, force: bool = False) -> dict:
        """Core guidance generator. Returns the cached entry if present (and `force=False`),
        otherwise calls Claude, writes a fresh cache row, and returns the new data."""
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

        month_name = MONTHS[req.month]
        region_label = req.region.name + (f", {req.region.country}" if req.region.country else "")
        climate = req.region.climate_zone or "unknown climate"
        hemi = req.region.hemisphere or "northern"
        plant_names = ", ".join(p["name"] for p in PLANTS)
        language_name = LANG_NAMES[language]

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

        user = f"""Generate a practical gardening guide for THIS specific region and month.
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

OUTPUT LANGUAGE: {language_name}. All text values in the JSON (summary, season_label, names,
why, how, tip, signs, control, etc.) MUST be written in {language_name}. The JSON KEYS stay in English.
Use locally common plant names in {language_name} where natural.

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

Return STRICT JSON with this exact shape and keys (keys MUST stay in English):
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

The "kind" value MUST remain in English ("food" or "flower"). Everything else translates to {language_name}.
For plant_now and harvest_now include a healthy mix: at least 2 food items AND at least 2 flowers
(edible or ornamental). Provide 4-6 items each for plant_now, harvest_now, tasks, and pests.
Keep advice realistic for {region_label} in {month_name} — respect the climate facts above. Return JSON only."""

        data = await _llm_json(system, user, session_id=f"guidance-{cache_key}")

        await db.guidance_cache.update_one(
            {"key": cache_key},
            {"$set": {
                "key": cache_key,
                "data": data,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "region": req.region.model_dump() if hasattr(req.region, "model_dump") else req.region.dict(),
                "month": req.month,
                "language": language,
                "my_garden": list(garden),
                "kind": "guidance",
            }},
            upsert=True,
        )
        return data

    return _generate_and_cache_guidance
