"""Patch & Pot – gardening app backend.

Provides:
- /api/guidance     -> AI-generated monthly planting/pest/task guidance for a region (Claude Sonnet 4.5)
- /api/plants       -> curated edible plant database
- /api/plants/{id}  -> single plant
- /api/plant-image  -> AI image generation for a plant (Gemini Nano Banana), cached in Mongo
- /api/regions/search -> simple geolocation/region search via Open-Meteo geocoding
- /api/regions/reverse -> reverse geocode lat/lon -> place + approximate climate zone
"""

import base64
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import List, Optional

import httpx
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException
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


class PlantImageRequest(BaseModel):
    plant_id: str
    plant_name: str
    style_hint: Optional[str] = None


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


def _guidance_cache_key(region: Region, month: int) -> str:
    key_parts = [
        (region.name or "").lower().strip(),
        (region.country or "").lower().strip(),
        (region.climate_zone or "").lower().strip(),
        (region.hemisphere or "northern").lower().strip(),
        str(month),
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
    """Region + month -> AI-generated monthly gardening guidance, cached in Mongo."""
    cache_key = _guidance_cache_key(req.region, req.month)
    cached = await db.guidance_cache.find_one({"key": cache_key}, {"_id": 0})
    if cached:
        return cached["data"]

    month_name = MONTHS[req.month]
    region_label = req.region.name + (f", {req.region.country}" if req.region.country else "")
    climate = req.region.climate_zone or "unknown climate"
    hemi = req.region.hemisphere or "northern"
    plant_names = ", ".join(p["name"] for p in PLANTS)

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

Consider local seasonality (e.g. {month_name} is winter in the southern hemisphere if hemi is southern).
Focus on home-scale, small-space and container growing. Mix food crops and flowers throughout —
do not return flowers-only or food-only lists. Use these plant names where relevant
(but you may mention other locally common edibles and flowers too):
{plant_names}

Return STRICT JSON with this exact shape and keys:
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

    return {
        "name": place.get("name") or "Your location",
        "country": place.get("country"),
        "admin": place.get("admin"),
        "latitude": lat,
        "longitude": lon,
        "hemisphere": hemisphere,
        "climate_zone": climate,
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
