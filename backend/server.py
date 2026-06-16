"""Patch & Pot – gardening app backend.

Provides:
- /api/guidance     -> AI-generated monthly planting/pest/task guidance (Claude Sonnet 4.5, multi-language)
- /api/plants       -> curated edible/flower plant database
- /api/plants/{id}  -> single plant
- /api/plants/{id}/companions -> companion planting suggestions
- /api/plant-image  -> AI image generation for a plant (Gemini Nano Banana), cached in Mongo
- /api/pest-image   -> AI image generation for a pest, cached in Mongo
- /api/regions/search  -> place search via Open-Meteo geocoding
- /api/regions/reverse -> reverse geocode lat/lon -> place + approximate climate zone
"""

import base64
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.responses import Response
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from starlette.middleware.cors import CORSMiddleware

from emergentintegrations.llm.chat import LlmChat, UserMessage

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# MongoDB
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

app = FastAPI(title="Patch & Pot API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)


# ───────────────────────── Models ─────────────────────────
class Region(BaseModel):
    name: str
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    climate_zone: Optional[str] = None  # e.g. "Temperate Oceanic", "USDA 7b", "Tropical"
    hemisphere: Optional[str] = "northern"  # "northern" | "southern"


class GuidanceRequest(BaseModel):
    region: Region
    month: int = Field(ge=1, le=12)
    language: Optional[str] = "en"  # en | de | fr | ja | zh
    my_garden: Optional[List[str]] = None  # plant names the user is growing


class PlantImageRequest(BaseModel):
    plant_id: str
    plant_name: str
    style_hint: Optional[str] = None


class PestImageRequest(BaseModel):
    name: str


LANG_NAMES = {
    "en": "English", "de": "German", "fr": "French", "ja": "Japanese", "zh": "Simplified Chinese",
    "es": "Spanish", "gd": "Scottish Gaelic (Gàidhlig)", "cy": "Welsh (Cymraeg)",
    "ga": "Irish (Gaeilge)",
    "da": "Danish", "nb": "Norwegian Bokmål", "sv": "Swedish",
    "is": "Icelandic", "fi": "Finnish",
}


# ───────────────────────── Plant database ─────────────────────────
PLANTS = [
    {"id": "tomato", "name": "Tomato", "category": "Vegetable", "difficulty": "Easy", "sun": "Full sun",
     "water": "Regular", "soil": "Rich, well-drained", "container": True, "edible_part": "Fruit",
     "summary": "Sun-loving fruit that thrives in pots with stakes or cages.",
     "tags": ["beginner", "patio", "summer"]},
    {"id": "basil", "name": "Basil", "category": "Herb", "difficulty": "Easy", "sun": "Full sun",
     "water": "Regular", "soil": "Light, moist", "container": True, "edible_part": "Leaves",
     "summary": "Fragrant culinary herb, pinch flowers to keep leaves coming.",
     "tags": ["beginner", "herb", "kitchen"]},
    {"id": "lettuce", "name": "Lettuce", "category": "Leafy green", "difficulty": "Easy", "sun": "Partial sun",
     "water": "Frequent", "soil": "Cool, moist", "container": True, "edible_part": "Leaves",
     "summary": "Quick salad crop, cut-and-come-again in shallow pots.",
     "tags": ["beginner", "fast", "cool-season"]},
    {"id": "mint", "name": "Mint", "category": "Herb", "difficulty": "Very easy", "sun": "Partial sun",
     "water": "Regular", "soil": "Moist", "container": True, "edible_part": "Leaves",
     "summary": "Vigorous spreader – keep in its own pot or it takes over.",
     "tags": ["beginner", "herb", "shade-tolerant"]},
    {"id": "chilli", "name": "Chilli Pepper", "category": "Vegetable", "difficulty": "Medium", "sun": "Full sun",
     "water": "Moderate", "soil": "Well-drained", "container": True, "edible_part": "Fruit",
     "summary": "Heat-loving fruit – perfect for sunny balconies.",
     "tags": ["sunny", "patio", "heat"]},
    {"id": "strawberry", "name": "Strawberry", "category": "Fruit", "difficulty": "Easy", "sun": "Full to partial",
     "water": "Regular", "soil": "Rich, well-drained", "container": True, "edible_part": "Fruit",
     "summary": "Perennial fruit perfect for hanging baskets and railings.",
     "tags": ["hanging", "fruit", "perennial"]},
    {"id": "radish", "name": "Radish", "category": "Root", "difficulty": "Very easy", "sun": "Full to partial",
     "water": "Regular", "soil": "Loose, sandy", "container": True, "edible_part": "Root",
     "summary": "Ready to eat in just 4 weeks – fastest reward in gardening.",
     "tags": ["beginner", "fast", "cool-season"]},
    {"id": "spinach", "name": "Spinach", "category": "Leafy green", "difficulty": "Easy", "sun": "Partial sun",
     "water": "Regular", "soil": "Rich, moist", "container": True, "edible_part": "Leaves",
     "summary": "Cool-weather green packed with iron. Sow successionally.",
     "tags": ["cool-season", "fast"]},
    {"id": "carrot", "name": "Carrot", "category": "Root", "difficulty": "Medium", "sun": "Full sun",
     "water": "Regular", "soil": "Deep, loose, stone-free", "container": True, "edible_part": "Root",
     "summary": "Use deep pots and stone-free compost for straight roots.",
     "tags": ["root", "patio"]},
    {"id": "rosemary", "name": "Rosemary", "category": "Herb", "difficulty": "Easy", "sun": "Full sun",
     "water": "Low", "soil": "Sandy, well-drained", "container": True, "edible_part": "Leaves",
     "summary": "Drought-tolerant Mediterranean herb. Hates wet feet.",
     "tags": ["mediterranean", "drought", "perennial"]},
    {"id": "thyme", "name": "Thyme", "category": "Herb", "difficulty": "Easy", "sun": "Full sun",
     "water": "Low", "soil": "Sandy, well-drained", "container": True, "edible_part": "Leaves",
     "summary": "Tiny aromatic leaves – tucks into cracks and pots.",
     "tags": ["mediterranean", "drought", "perennial"]},
    {"id": "chives", "name": "Chives", "category": "Herb", "difficulty": "Very easy", "sun": "Full to partial",
     "water": "Regular", "soil": "Average", "container": True, "edible_part": "Leaves & flowers",
     "summary": "Mild onion flavour – the lavender pompom flowers are edible too.",
     "tags": ["beginner", "herb", "perennial"]},
    {"id": "kale", "name": "Kale", "category": "Leafy green", "difficulty": "Easy", "sun": "Full to partial",
     "water": "Regular", "soil": "Rich", "container": True, "edible_part": "Leaves",
     "summary": "Tough, frost-sweetened leaves. A winter workhorse.",
     "tags": ["winter", "frost-tolerant"]},
    {"id": "cucumber", "name": "Cucumber", "category": "Vegetable", "difficulty": "Medium", "sun": "Full sun",
     "water": "Frequent", "soil": "Rich, moist", "container": True, "edible_part": "Fruit",
     "summary": "Train up a trellis to save space. Pick small and often.",
     "tags": ["climber", "summer"]},
    {"id": "courgette", "name": "Courgette / Zucchini", "category": "Vegetable", "difficulty": "Easy",
     "sun": "Full sun", "water": "Regular", "soil": "Rich", "container": True, "edible_part": "Fruit",
     "summary": "One plant feeds a household. Use a big pot (40 L+).",
     "tags": ["summer", "productive"]},
    {"id": "spring-onion", "name": "Spring Onion", "category": "Allium", "difficulty": "Very easy",
     "sun": "Full to partial", "water": "Regular", "soil": "Average", "container": True,
     "edible_part": "Whole plant", "summary": "Regrow from kitchen scraps in water then pot up.",
     "tags": ["regrow", "beginner"]},
    {"id": "coriander", "name": "Coriander / Cilantro", "category": "Herb", "difficulty": "Easy",
     "sun": "Partial sun", "water": "Regular", "soil": "Cool, moist", "container": True,
     "edible_part": "Leaves & seeds", "summary": "Bolts in heat – sow small batches every few weeks.",
     "tags": ["fast", "succession"]},
    {"id": "parsley", "name": "Parsley", "category": "Herb", "difficulty": "Easy", "sun": "Partial sun",
     "water": "Regular", "soil": "Rich, moist", "container": True, "edible_part": "Leaves",
     "summary": "Biennial that gives leaves for two seasons.",
     "tags": ["biennial", "kitchen"]},
    {"id": "beetroot", "name": "Beetroot", "category": "Root", "difficulty": "Easy", "sun": "Full to partial",
     "water": "Regular", "soil": "Loose, fertile", "container": True, "edible_part": "Root & leaves",
     "summary": "Two crops in one – roots and tasty leaves.",
     "tags": ["root", "cool-season"]},
    {"id": "garlic", "name": "Garlic", "category": "Allium", "difficulty": "Very easy", "sun": "Full sun",
     "water": "Low", "soil": "Well-drained", "container": True, "edible_part": "Bulb",
     "summary": "Plant cloves in autumn, harvest in early summer.",
     "tags": ["autumn-plant", "perennial-feel"]},

    # ── Flowers (edible & ornamental) ─────────────────────────────
    {"id": "nasturtium", "name": "Nasturtium", "category": "Flower", "difficulty": "Very easy",
     "sun": "Full to partial", "water": "Low", "soil": "Poor, well-drained", "container": True,
     "edible_part": "Flowers & leaves",
     "summary": "Peppery edible flowers that thrive on neglect — perfect first flower.",
     "tags": ["edible-flower", "beginner", "trailing"]},
    {"id": "calendula", "name": "Calendula", "category": "Flower", "difficulty": "Very easy",
     "sun": "Full sun", "water": "Moderate", "soil": "Average", "container": True,
     "edible_part": "Petals",
     "summary": "Sunny orange petals — edible, medicinal, and adored by pollinators.",
     "tags": ["edible-flower", "pollinator", "cut-flower"]},
    {"id": "sunflower", "name": "Sunflower", "category": "Flower", "difficulty": "Easy",
     "sun": "Full sun", "water": "Regular", "soil": "Rich", "container": True,
     "edible_part": "Seeds",
     "summary": "Showstopper blooms — dwarf varieties grow happily in 25 cm pots.",
     "tags": ["pollinator", "seeds", "summer"]},
    {"id": "marigold", "name": "Marigold", "category": "Flower", "difficulty": "Very easy",
     "sun": "Full sun", "water": "Moderate", "soil": "Average", "container": True,
     "edible_part": "Petals (French varieties)",
     "summary": "Companion-planting hero — repels pests around tomatoes and beans.",
     "tags": ["companion", "pollinator", "summer"]},
    {"id": "lavender", "name": "Lavender", "category": "Flower", "difficulty": "Easy",
     "sun": "Full sun", "water": "Low", "soil": "Sandy, well-drained", "container": True,
     "edible_part": "Flowers",
     "summary": "Fragrant, drought-tolerant perennial that hums with bees in summer.",
     "tags": ["pollinator", "perennial", "drought"]},
    {"id": "cosmos", "name": "Cosmos", "category": "Flower", "difficulty": "Easy",
     "sun": "Full sun", "water": "Moderate", "soil": "Average", "container": True,
     "edible_part": "Ornamental",
     "summary": "Airy daisies on tall stems — flower from midsummer until frost.",
     "tags": ["cut-flower", "pollinator", "long-bloom"]},
    {"id": "viola", "name": "Viola / Pansy", "category": "Flower", "difficulty": "Easy",
     "sun": "Full to partial", "water": "Regular", "soil": "Rich", "container": True,
     "edible_part": "Whole flower",
     "summary": "Cheerful, cool-season faces — edible and at home on winter sills.",
     "tags": ["edible-flower", "cool-season", "winter"]},
    {"id": "sweet-pea", "name": "Sweet Pea", "category": "Flower", "difficulty": "Easy",
     "sun": "Full to partial", "water": "Regular", "soil": "Rich", "container": True,
     "edible_part": "Ornamental",
     "summary": "Climbing fragrant blooms — the scent is the whole point.",
     "tags": ["climber", "fragrant", "cut-flower"]},
    {"id": "zinnia", "name": "Zinnia", "category": "Flower", "difficulty": "Easy",
     "sun": "Full sun", "water": "Moderate", "soil": "Well-drained", "container": True,
     "edible_part": "Ornamental",
     "summary": "Heat-loving cut flower in every colour — keeps producing if you pick.",
     "tags": ["cut-flower", "heat", "pollinator"]},
    {"id": "borage", "name": "Borage", "category": "Flower", "difficulty": "Very easy",
     "sun": "Full to partial", "water": "Moderate", "soil": "Average", "container": True,
     "edible_part": "Flowers & young leaves",
     "summary": "Star-shaped blue flowers — bees adore them and they taste of cucumber.",
     "tags": ["edible-flower", "pollinator", "self-seeds"]},
    {"id": "geranium", "name": "Scented Geranium", "category": "Flower", "difficulty": "Easy",
     "sun": "Full to partial", "water": "Low", "soil": "Well-drained", "container": True,
     "edible_part": "Leaves & flowers",
     "summary": "Crush a leaf — rose, lemon or mint depending on variety.",
     "tags": ["fragrant", "drought", "perennial"]},
    {"id": "chamomile", "name": "Chamomile", "category": "Flower", "difficulty": "Easy",
     "sun": "Full to partial", "water": "Moderate", "soil": "Average", "container": True,
     "edible_part": "Flowers",
     "summary": "Tiny apple-scented daisies — pick and dry for soothing tea.",
     "tags": ["edible-flower", "tea", "pollinator"]},
]

PLANT_INDEX = {p["id"]: p for p in PLANTS}


# ───────────────────────── AI helpers ─────────────────────────
def _strip_code_fences(text: str) -> str:
    """Pull JSON object out of an LLM response, even if wrapped in markdown fences."""
    text = text.strip()
    m = re.search(r"\{[\s\S]*\}", text)
    return m.group(0) if m else text


async def _llm_json(system_prompt: str, user_prompt: str, session_id: str) -> dict:
    """Call Claude Sonnet 4.5 and parse the JSON response."""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY not configured")

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=system_prompt,
    ).with_model("anthropic", "claude-sonnet-4-5-20250929")

    response = await chat.send_message(UserMessage(text=user_prompt))
    raw = response if isinstance(response, str) else getattr(response, "content", str(response))
    try:
        return json.loads(_strip_code_fences(raw))
    except json.JSONDecodeError as e:
        logger.error("LLM JSON parse failed: %s\nRaw: %s", e, raw[:400])
        raise HTTPException(502, "AI response could not be parsed. Please retry.")


MONTHS = ["", "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"]


def _guidance_cache_key(region: Region, month: int, language: str = "en", garden_key: str = "") -> str:
    key_parts = [
        (region.name or "").lower().strip(),
        (region.country or "").lower().strip(),
        (region.climate_zone or "").lower().strip(),
        (region.hemisphere or "northern").lower().strip(),
        str(month),
        (language or "en").lower().strip(),
        garden_key,
    ]
    return "|".join(key_parts)


# ───────────────────────── Endpoints ─────────────────────────
@api_router.get("/")
async def root():
    return {"app": "Patch & Pot", "status": "ok"}


@api_router.get("/plants")
async def list_plants():
    return PLANTS


@api_router.get("/plants/{plant_id}")
async def get_plant(plant_id: str):
    plant = PLANT_INDEX.get(plant_id)
    if not plant:
        raise HTTPException(404, "Plant not found")
    return plant


@api_router.post("/guidance")
async def get_guidance(req: GuidanceRequest):
    """Region + month + language -> AI-generated monthly gardening guidance, cached in Mongo."""
    language = (req.language or "en").lower()
    if language not in LANG_NAMES:
        language = "en"

    # Normalise user's My Garden list and produce a stable cache key component.
    garden = [(p or "").strip() for p in (req.my_garden or []) if (p or "").strip()]
    garden = sorted({p.lower(): p for p in garden}.values())  # dedupe case-insensitive
    garden_key = "garden:" + ",".join(p.lower() for p in garden) if garden else ""

    cache_key = _guidance_cache_key(req.region, req.month, language, garden_key)
    cached = await db.guidance_cache.find_one({"key": cache_key}, {"_id": 0})
    if cached:
        return cached["data"]

    month_name = MONTHS[req.month]
    region_label = req.region.name + (f", {req.region.country}" if req.region.country else "")
    climate = req.region.climate_zone or "unknown climate"
    hemi = req.region.hemisphere or "northern"
    plant_names = ", ".join(p["name"] for p in PLANTS)
    language_name = LANG_NAMES[language]

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
OUTPUT LANGUAGE: {language_name}. All text values in the JSON (summary, season_label, names,
why, how, tip, signs, control, etc.) MUST be written in {language_name}. The JSON KEYS stay in English.
Use locally common plant names in {language_name} where natural.

Consider local seasonality (e.g. {month_name} is winter in the southern hemisphere if hemi is southern).
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
  "summary": "2-3 sentence overview of what {month_name} feels like for a grower in {region_label}.",
  "season_label": "Short label e.g. 'Late spring', 'Dry season', 'Monsoon', 'Mid-winter'.",
  "plant_now": [
    {{ "name": "Plant name", "kind": "food | flower", "why": "1 sentence why this month suits it", "how": "1-2 sentence sowing/planting tip" }}
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
Keep advice realistic for {region_label} in {month_name}. Return JSON only."""

    data = await _llm_json(system, user, session_id=f"guidance-{cache_key}")

    await db.guidance_cache.insert_one({
        "key": cache_key,
        "data": data,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return data


@api_router.post("/plant-image")
async def generate_plant_image(req: PlantImageRequest):
    """Generate (or fetch cached) AI image of a plant. Returns data URL."""
    cache_key = f"plant-image:{req.plant_id}"
    cached = await db.image_cache.find_one({"key": cache_key}, {"_id": 0})
    if cached:
        return {"image": cached["image"], "cached": True}

    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY not configured")

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

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"img-{req.plant_id}-{uuid.uuid4()}",
        system_message="You are an image generation assistant.",
    ).with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])

    try:
        _text, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
    except Exception as e:
        logger.error("Image gen failed for %s: %s", req.plant_name, e)
        raise HTTPException(502, "Image generation failed")

    if not images:
        raise HTTPException(502, "No image returned")

    img = images[0]
    data_url = f"data:{img['mime_type']};base64,{img['data']}"

    await db.image_cache.insert_one({
        "key": cache_key,
        "image": data_url,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"image": data_url, "cached": False}


# Companion planting pairs (curated from patchandpot.com & gardening references)
COMPANIONS = {
    "tomato": ["basil", "marigold", "nasturtium", "chives", "borage"],
    "basil": ["tomato", "chilli", "marigold"],
    "lettuce": ["chives", "radish", "carrot", "viola"],
    "mint": [],  # keep mint isolated — it spreads
    "chilli": ["basil", "marigold", "calendula"],
    "strawberry": ["thyme", "chives", "borage"],
    "radish": ["lettuce", "carrot", "spring-onion"],
    "spinach": ["radish", "strawberry", "chives"],
    "carrot": ["spring-onion", "chives", "lettuce", "radish"],
    "rosemary": ["thyme", "lavender"],
    "thyme": ["rosemary", "strawberry", "lavender"],
    "chives": ["carrot", "tomato", "strawberry", "kale", "lettuce"],
    "kale": ["chives", "garlic", "calendula", "nasturtium"],
    "cucumber": ["coriander", "nasturtium", "borage", "marigold"],
    "courgette": ["nasturtium", "borage", "marigold"],
    "spring-onion": ["carrot", "lettuce", "beetroot"],
    "coriander": ["cucumber", "spinach", "spring-onion"],
    "parsley": ["tomato", "chives", "rosemary"],
    "beetroot": ["spring-onion", "lettuce", "garlic"],
    "garlic": ["kale", "beetroot", "strawberry"],
    # Flowers
    "nasturtium": ["courgette", "cucumber", "tomato", "kale"],
    "calendula": ["kale", "tomato", "chilli"],
    "sunflower": ["cucumber", "courgette"],
    "marigold": ["tomato", "chilli", "courgette", "basil"],
    "lavender": ["rosemary", "thyme"],
    "cosmos": ["zinnia", "marigold"],
    "viola": ["lettuce", "parsley", "chives"],
    "sweet-pea": [],
    "zinnia": ["cosmos", "marigold"],
    "borage": ["strawberry", "tomato", "courgette", "cucumber"],
    "geranium": ["lavender", "thyme"],
    "chamomile": ["kale", "basil", "chives"],
}

# Hand-written reasons keep this useful (not just a list of names)
COMPANION_REASONS = {
    ("tomato", "basil"): "Classic pairing — basil masks tomato's scent from pests and is said to boost flavour.",
    ("tomato", "marigold"): "Marigolds pull in pollinators and confuse whitefly around tomatoes.",
    ("tomato", "nasturtium"): "Nasturtium lures aphids away from your tomatoes.",
    ("tomato", "chives"): "Chives discourage aphids and look beautiful in flower together.",
    ("tomato", "borage"): "Borage brings bees and is said to improve tomato flavour.",
    ("courgette", "nasturtium"): "Trailing nasturtiums shade the soil and decoy aphids.",
    ("cucumber", "nasturtium"): "Lures aphids and adds edible flowers to your salads.",
    ("kale", "chives"): "Onion scent deters cabbage aphids.",
    ("carrot", "spring-onion"): "Muddles carrot fly with onion volatiles — classic combo.",
    ("strawberry", "thyme"): "Bee traffic for berries; thyme likes the same dry feet.",
    ("strawberry", "borage"): "Borage attracts pollinators that help strawberries set fruit.",
    ("chilli", "marigold"): "Marigolds pull pollinators in and confuse pests.",
}


@api_router.get("/plants/{plant_id}/companions")
async def get_companions(plant_id: str):
    """Return curated companion plants for a given plant id."""
    if plant_id not in PLANT_INDEX:
        raise HTTPException(404, "Plant not found")
    companion_ids = COMPANIONS.get(plant_id, [])
    items = []
    for cid in companion_ids:
        p = PLANT_INDEX.get(cid)
        if not p:
            continue
        reason = COMPANION_REASONS.get((plant_id, cid)) or COMPANION_REASONS.get((cid, plant_id))
        items.append({
            "id": p["id"],
            "name": p["name"],
            "category": p["category"],
            "summary": p["summary"],
            "reason": reason,
        })
    return {"plant_id": plant_id, "companions": items}


@api_router.post("/pest-image")
async def generate_pest_image(req: PestImageRequest):
    """Generate (or fetch cached) AI image of a pest/disease. Returns data URL."""
    safe_key = re.sub(r"[^a-z0-9]+", "-", req.name.lower()).strip("-")
    cache_key = f"pest-image:{safe_key}"
    cached = await db.image_cache.find_one({"key": cache_key}, {"_id": 0})
    if cached:
        return {"image": cached["image"], "cached": True}

    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY not configured")

    prompt = (
        f"A close-up macro reference photograph of '{req.name}' as seen by a home gardener "
        f"on leaves or stems. Naturalistic, soft daylight, gardening field-guide style, "
        f"no text, no people, no pesticide bottles. Subject in sharp focus, background "
        f"a softly blurred green leaf."
    )

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=f"pest-img-{safe_key}-{uuid.uuid4()}",
        system_message="You are an image generation assistant.",
    ).with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])

    try:
        _text, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
    except Exception as e:
        logger.error("Pest image gen failed for %s: %s", req.name, e)
        raise HTTPException(502, "Image generation failed")

    if not images:
        raise HTTPException(502, "No image returned")

    img = images[0]
    data_url = f"data:{img['mime_type']};base64,{img['data']}"

    await db.image_cache.insert_one({
        "key": cache_key,
        "image": data_url,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"image": data_url, "cached": False}


class TopicImageRequest(BaseModel):
    subject: str
    style: Optional[str] = None
    cache_key: Optional[str] = None


class LessonAdaptRequest(BaseModel):
    masterclass_slug: str
    lesson_slug: str
    lesson_title: str
    body: List[str] = []
    steps_title: Optional[str] = None
    steps_items: List[str] = []
    box_items: List[str] = []
    tip: Optional[str] = None
    language: str = "en"
    region: Optional[Region] = None


class ShareImageRequest(BaseModel):
    masterclass_slug: str
    masterclass_title: str
    region_name: Optional[str] = None


class VendorRef(BaseModel):
    id: str
    name: str
    kind: str  # "seeds" | "pots" | other


class VendorBlurbRequest(BaseModel):
    plant_name: str
    vendors: List[VendorRef]
    region: Optional[Region] = None
    language: str = "en"


def _image_gen(prompt: str, session: str):
    return LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session,
        system_message="You are an image generation assistant.",
    ).with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])


async def _cached_image(key: str, prompt: str, session: str) -> dict:
    cached = await db.image_cache.find_one({"key": key}, {"_id": 0})
    if cached:
        return {"image": cached["image"], "cached": True}
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY not configured")
    try:
        _text, images = await _image_gen(prompt, session).send_message_multimodal_response(UserMessage(text=prompt))
    except Exception as e:
        logger.error("Image gen failed for %s: %s", key, e)
        raise HTTPException(502, "Image generation failed")
    if not images:
        raise HTTPException(502, "No image returned")
    img = images[0]
    data_url = f"data:{img['mime_type']};base64,{img['data']}"
    await db.image_cache.insert_one({
        "key": key, "image": data_url, "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"image": data_url, "cached": False}


@api_router.post("/topic-image")
async def generate_topic_image(req: TopicImageRequest):
    """General-purpose AI image for masterclass cards, lesson heroes, flowers etc."""
    key = req.cache_key or "topic:" + re.sub(r"[^a-z0-9]+", "-", req.subject.lower()).strip("-")
    style = req.style or (
        "natural daylight, soft focus, terracotta and cream palette, botanical editorial "
        "magazine style, shallow depth of field, no text, no people, no logos"
    )
    prompt = f"A beautiful photograph of {req.subject}. {style}."
    return await _cached_image(key, prompt, session=f"topic-{key}-{uuid.uuid4()}")


SHARE_MOTIFS = {
    "propagation": "delicate green cuttings in a vintage glass jar, light from a window, soft pastel cream background",
    "pest-control": "macro of a single ladybird on a healthy green leaf, golden afternoon light, cream background",
    "plant-care": "watering can pouring on terracotta pot of basil, sunlight on a windowsill, cream background",
    "rose": "single antique pink rose in soft natural light, cream backdrop",
    "dahlia": "single Cafe au Lait dahlia bloom on cream linen, soft natural light",
    "peony": "single blush peony in full bloom, cream backdrop, painterly natural light",
    "tulip": "trio of tulip bulbs and one open tulip on cream linen",
    "lily": "single white oriental lily bloom on cream backdrop",
    "sweet-pea": "small bunch of pastel sweet peas in a glass jar, cream backdrop",
    "cosmos": "three cosmos flowers in pink and apricot on cream linen",
    "zinnia": "trio of vibrant zinnias on cream linen, summer light",
    "sunflower": "single sunflower head against cream linen, golden hour",
    "aster": "small posy of late-season asters on cream linen",
    "chrysanthemum": "small chrysanthemum bloom in copper tones on cream linen",
    "lavender": "small bundle of fresh lavender stems on cream linen",
}


@api_router.post("/share-image")
async def generate_share_image(req: ShareImageRequest):
    """Bloom-motif backdrop for the 'masterclass complete' share card.
    Client composites the masterclass title + region text on top via canvas."""
    safe = re.sub(r"[^a-z0-9]+", "-", req.masterclass_slug.lower()).strip("-")
    key = f"share-bg:{safe}"
    motif = SHARE_MOTIFS.get(req.masterclass_slug, "single beautiful flower bloom on cream linen background")
    prompt = (
        f"A serene square portrait composition for a social share card. {motif}. "
        f"Botanical editorial style, soft cream/sand background with plenty of negative space "
        f"on the lower third for text. Painterly natural daylight. No text, no people, no logos. "
        f"Highly aesthetic, Instagram-ready."
    )
    return await _cached_image(key, prompt, session=f"share-{safe}-{uuid.uuid4()}")


@api_router.post("/lesson-adapt")
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


@api_router.post("/vendor-blurbs")
async def vendor_blurbs(req: VendorBlurbRequest):
    """One-line, region-specific reason why each vendor pairs well with the plant.

    Returns: {"blurbs": {<vendor_id>: "<sentence>", ...}, "cached": <bool>}

    Cached per (plant, country, language, vendor-id-set) so we make at most
    one LLM call per page-view per region. Fails soft — on any error we return
    an empty blurbs map so the UI silently falls back to the static sub-text.
    """
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
    except HTTPException:
        # Fail soft: empty map means UI uses static sub-text fallback.
        return {"blurbs": {}, "cached": False}

    blurbs = data.get("blurbs") or {}
    # Filter to known vendor ids only and trim long output.
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


@api_router.get("/regions/search")
async def search_regions(q: str):
    """Search places via Open-Meteo geocoding (free, no key)."""
    if not q or len(q.strip()) < 2:
        return {"results": []}

    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {"name": q.strip(), "count": 8, "language": "en", "format": "json"}
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            r = await http.get(url, params=params)
            r.raise_for_status()
            payload = r.json()
    except Exception as e:
        logger.error("Geocoding search failed: %s", e)
        return {"results": []}

    results = []
    for item in payload.get("results", []):
        results.append({
            "name": item.get("name"),
            "admin": item.get("admin1"),
            "country": item.get("country"),
            "latitude": item.get("latitude"),
            "longitude": item.get("longitude"),
            "timezone": item.get("timezone"),
        })
    return {"results": results}


@api_router.get("/regions/reverse")
async def reverse_geocode(lat: float, lon: float):
    """Reverse geocode coordinates and infer hemisphere + a rough climate label."""
    url = "https://geocoding-api.open-meteo.com/v1/reverse"
    params = {"latitude": lat, "longitude": lon, "language": "en", "count": 1, "format": "json"}
    place = {"name": None, "country": None}
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            r = await http.get(url, params=params)
            if r.status_code == 200:
                items = r.json().get("results") or []
                if items:
                    it = items[0]
                    place = {"name": it.get("name"), "country": it.get("country"),
                             "admin": it.get("admin1"), "timezone": it.get("timezone")}
    except Exception as e:
        logger.warning("Reverse geocode failed: %s", e)

    hemisphere = "southern" if lat < 0 else "northern"
    abs_lat = abs(lat)
    if abs_lat < 23.5:
        climate = "Tropical"
    elif abs_lat < 35:
        climate = "Subtropical"
    elif abs_lat < 55:
        climate = "Temperate"
    elif abs_lat < 66.5:
        climate = "Cool temperate / Subpolar"
    else:
        climate = "Polar"
    assert climate  # all paths above assign — keeps linters happy

    return {
        "name": place.get("name") or "Your location",
        "country": place.get("country"),
        "admin": place.get("admin"),
        "latitude": lat,
        "longitude": lon,
        "hemisphere": hemisphere,
        "climate_zone": climate,
    }


# Flower portrait subjects, mirrored from frontend data so /api/admin/prewarm
# can generate every masterclass card image up-front (cached to MongoDB).
FLOWER_PORTRAITS = {
    "dahlia": "a single 'Cafe au Lait' dahlia bloom in soft natural light against a cream linen background",
    "aster": "a small cluster of late-season Symphyotrichum 'Little Carlow' Michaelmas daisies, lilac-blue, on cream backdrop",
    "rose": "a single antique pink garden rose in full bloom with morning dew, soft natural light, cream backdrop",
    "sweet-pea": "a small bunch of pastel sweet pea flowers (Lathyrus odoratus) in a clear glass jar on cream linen, soft natural light",
    "tulip": "a trio of elegant tulip blooms in cream and dusty pink standing in a stoneware vase, soft natural light",
    "sunflower": "a single sunflower head (Helianthus annuus 'Vanilla Ice'), creamy yellow petals, golden hour light, cream backdrop",
    "peony": "a single fully open blush peony bloom (Paeonia lactiflora) on cream linen, painterly natural light",
    "cosmos": "three Cosmos bipinnatus flowers in pink, apricot and white, airy stems, cream backdrop",
    "zinnia": "a trio of bright Zinnia elegans 'Benary's Giant' blooms in coral and lemon, summer light, cream backdrop",
    "lavender": "a small bundle of fresh English lavender stems (Lavandula angustifolia) tied with twine on cream linen, soft daylight",
    "lily": "a single white oriental lily flower (Lilium 'Casa Blanca') in full bloom on cream backdrop, natural daylight",
    "chrysanthemum": "a single bronze chrysanthemum bloom (Chrysanthemum 'Emperor of China') with coppery petals on cream linen",
}


@api_router.post("/admin/prewarm")
async def prewarm_image_cache():
    """One-shot endpoint: generate every flower-card image that isn't already
    cached. Safe to call repeatedly. Returns counts so admins can verify.
    Skips any image whose cache key already exists in MongoDB."""
    generated, skipped, failed = 0, 0, []
    for slug, subject in FLOWER_PORTRAITS.items():
        key = f"masterclass-card:{slug}"
        existing = await db.image_cache.find_one({"key": key}, {"_id": 1})
        if existing:
            skipped += 1
            continue
        try:
            await _cached_image(
                key=key,
                prompt=f"A beautiful photograph of {subject}. natural daylight, soft focus, "
                       f"terracotta and cream palette, botanical editorial magazine style, "
                       f"shallow depth of field, no text, no people, no logos.",
                session=f"prewarm-{slug}-{uuid.uuid4()}",
            )
            generated += 1
        except Exception as e:
            logger.warning("prewarm failed for %s: %s", slug, e)
            failed.append(slug)
    return {"generated": generated, "skipped_cached": skipped, "failed": failed, "total": len(FLOWER_PORTRAITS)}


# ───────────────────────── AI plant guide (any plant) ─────────────────────────
class PlantGuideRequest(BaseModel):
    query: str  # plant common or botanical name
    language: Optional[str] = "en"


def _plant_slug(name: str) -> str:
    return "ai-" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:48]


@api_router.post("/plant-guide")
async def generate_plant_guide(req: PlantGuideRequest):
    """Generate (or return cached) AI plant guide for ANY plant — even ones not
    in the curated database. Returned in the same shape as curated plants, with
    extra fields (growing, problems, companions, seasonality, ai_generated)."""
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

    # First — check whether the curated DB already has it (case-insensitive name).
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
  "unknown": false,                                  // true if you cannot identify the plant
  "id": "{slug}",
  "name": "<official common name>",
  "botanical_name": "<botanical name if known, else empty>",
  "category": "Vegetable | Herb | Leafy green | Fruit | Root | Allium | Flower | Other",
  "difficulty": "Very easy | Easy | Medium | Hard",
  "sun": "Full sun | Full to partial | Partial sun | Shade",
  "water": "Low | Moderate | Regular | Frequent",
  "soil": "<one-line soil description>",
  "container": true,                                  // grows OK in pots/containers?
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

    # Ensure required fields + force the slug/flag
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


@api_router.get("/plant-guide/{slug}")
async def get_cached_plant_guide(slug: str, language: str = "en"):
    """Lookup an AI plant guide by its slug — used when navigating directly to /plants/ai/{slug}."""
    if not slug.startswith("ai-"):
        raise HTTPException(404, "Not an AI plant slug")
    cache_key = f"plant-guide:{slug}:{language}"
    cached = await db.guidance_cache.find_one({"key": cache_key}, {"_id": 0})
    if cached:
        return cached["data"]
    raise HTTPException(404, "Guide not cached yet — search for the plant from the Plants page.")


@api_router.get("/recent-plants")
async def recent_ai_plants(language: str = "en", limit: int = 8):
    """Most recently generated AI plant guides — used to seed a 'Recently searched'
    rail on the Plants page so the AI cache grows visibly and other users benefit."""
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


class FeedbackRequest(BaseModel):
    target_type: str       # e.g. "plant-guide" | "lesson" | "guidance"
    target_id: str         # e.g. "ai-okra"
    rating: str            # "up" | "down"
    comment: Optional[str] = None


@api_router.get("/admin/feedback")
async def list_feedback(token: str, target_type: Optional[str] = None, limit: int = 100):
    """Read-only feedback log. Requires ?token=... matching ADMIN_TOKEN env var.
    No token configured → endpoint is disabled (returns 503)."""
    admin_token = os.environ.get("ADMIN_TOKEN", "")
    if not admin_token:
        raise HTTPException(503, "ADMIN_TOKEN not configured")
    if token != admin_token:
        raise HTTPException(401, "Bad token")

    query = {}
    if target_type:
        query["target_type"] = target_type
    limit = max(1, min(limit, 500))

    rows = []
    cursor = db.feedback.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
    async for row in cursor:
        rows.append(row)

    # tiny aggregate
    counts = {"up": 0, "down": 0}
    for r in rows:
        if r.get("rating") in counts:
            counts[r["rating"]] += 1
    return {"items": rows, "counts": counts, "total": len(rows)}


@api_router.post("/feedback")
async def submit_feedback(req: FeedbackRequest):
    """Store user feedback on AI-generated content. Lightweight signal so we can
    later improve quality and decide which AI plants to curate."""
    if req.rating not in ("up", "down"):
        raise HTTPException(400, "rating must be 'up' or 'down'")
    if req.target_type not in ("plant-guide", "lesson", "guidance"):
        raise HTTPException(400, "unknown target_type")
    doc = {
        "target_type": req.target_type,
        "target_id": req.target_id[:128],
        "rating": req.rating,
        "comment": (req.comment or "")[:500] or None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.feedback.insert_one(doc)
    return {"ok": True}


# ───────────────────────── Affiliate click tracking ─────────────────────────

class AffiliateClick(BaseModel):
    vendor_id: str
    vendor_name: Optional[str] = None
    plant_name: Optional[str] = None
    country: Optional[str] = None
    language: Optional[str] = None
    slot: Optional[str] = None  # "seeds" | "pots" | "tools"


@api_router.post("/affiliate/click")
async def affiliate_click(click: AffiliateClick):
    """Fire-and-forget log of an outbound vendor click. Stored without IP for
    privacy. Returns 204 No Content so navigator.sendBeacon is happy."""
    doc = {
        **click.dict(),
        "ts": datetime.now(timezone.utc).isoformat(),
    }
    try:
        await db.affiliate_clicks.insert_one(doc)
    except Exception as e:  # never let logging fail the click-through
        logger.warning("affiliate_click insert failed: %s", e)
    return Response(status_code=204)


@api_router.get("/affiliate/stats")
async def affiliate_stats(days: int = 30, token: Optional[str] = None):
    """Aggregated click stats so you can see which vendors / regions / plants
    drive traffic — even before any affiliate codes are wired up.

    If the env var ADMIN_TOKEN is set, callers must pass `?token=<value>`.
    Otherwise the endpoint is open (handy for solo use)."""
    admin_token = os.environ.get("ADMIN_TOKEN")
    if admin_token and token != admin_token:
        raise HTTPException(status_code=401, detail="invalid token")

    since = (datetime.now(timezone.utc) - timedelta(days=max(1, int(days)))).isoformat()
    base_match = {"$match": {"ts": {"$gte": since}}}

    async def top_by(field: str, limit: int = 10):
        cursor = db.affiliate_clicks.aggregate([
            base_match,
            {"$group": {"_id": f"${field}", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": limit},
        ])
        return [
            {"key": doc["_id"] or "(unknown)", "count": doc["count"]}
            async for doc in cursor
        ]

    total = await db.affiliate_clicks.count_documents({"ts": {"$gte": since}})
    return {
        "since": since,
        "days": days,
        "total_clicks": total,
        "top_vendors": await top_by("vendor_id"),
        "top_countries": await top_by("country"),
        "top_plants": await top_by("plant_name"),
        "top_languages": await top_by("language"),
        "top_slots": await top_by("slot"),
    }


# ───────────────────────── App wiring ─────────────────────────
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
