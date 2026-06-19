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
from fastapi import APIRouter, BackgroundTasks, FastAPI, HTTPException, Request
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
    "pt": "Portuguese", "it": "Italian", "nl": "Dutch",
    "pl": "Polish", "cs": "Czech", "sk": "Slovak", "sl": "Slovenian",
    "hr": "Croatian", "bg": "Bulgarian", "ro": "Romanian", "hu": "Hungarian",
    "el": "Greek", "et": "Estonian", "lv": "Latvian", "lt": "Lithuanian",
    "mt": "Maltese", "uk": "Ukrainian",
    # Indian subcontinent
    "hi": "Hindi", "bn": "Bengali", "te": "Telugu", "mr": "Marathi",
    "ta": "Tamil", "gu": "Gujarati", "ur": "Urdu", "kn": "Kannada",
    "ml": "Malayalam", "pa": "Punjabi",
    # Southeast & East Asian
    "id": "Indonesian", "ms": "Malay", "vi": "Vietnamese", "th": "Thai",
    "ko": "Korean", "tl": "Filipino (Tagalog)",
    # Pacific
    "mi": "Māori",
    # Middle East / Turkish
    "ar": "Arabic (Modern Standard)", "tr": "Turkish",
    # Russia / Former USSR
    "ru": "Russian", "be": "Belarusian", "kk": "Kazakh", "uz": "Uzbek",
    "az": "Azerbaijani", "ky": "Kyrgyz", "hy": "Armenian", "ka": "Georgian",
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


# ───────────────────────── Paywall (Stripe Checkout) ─────────────────────────
# £5 GBP, one-time, lifetime access. No traditional accounts — the Stripe
# checkout session_id IS the access token. Stored in MongoDB once verified.
from emergentintegrations.payments.stripe.checkout import (  # noqa: E402
    StripeCheckout, CheckoutSessionRequest,
)

STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")

# Single fixed package — amount lives server-side so the frontend can't manipulate price.
PAYWALL_PACKAGES = {
    "annual": {
        "id": "annual",
        "amount": 5.0,
        "currency": "gbp",
        "label": "Patch & Pot — 12-month access",
        "duration_days": 365,
    },
    "lifetime": {
        "id": "lifetime",
        "amount": 25.0,
        "currency": "gbp",
        "label": "Patch & Pot — lifetime access",
        "duration_days": None,  # never expires
    },
}
DEFAULT_PACKAGE_ID = "lifetime"


def _stripe_checkout(host_url: str) -> StripeCheckout:
    if not STRIPE_API_KEY:
        raise HTTPException(503, "Payments are not configured.")
    webhook_url = f"{host_url.rstrip('/')}/api/webhook/stripe"
    return StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)


class CheckoutRequest(BaseModel):
    origin_url: str  # frontend window.location.origin, used to build success/cancel URLs
    email: Optional[str] = None  # optional, captured for recovery
    package_id: Optional[str] = None  # "annual" | "lifetime", defaults to lifetime


@api_router.post("/checkout/session")
async def create_checkout(payload: CheckoutRequest, request: Request):
    """Create a Stripe Checkout session for the chosen access tier."""
    sc = _stripe_checkout(str(request.base_url))
    pkg_id = (payload.package_id or DEFAULT_PACKAGE_ID).strip()
    pkg = PAYWALL_PACKAGES.get(pkg_id)
    if not pkg:
        raise HTTPException(400, "Unknown package_id")

    origin = payload.origin_url.rstrip("/")
    success_url = f"{origin}/checkout/success?session_id={{CHECKOUT_SESSION_ID}}"
    cancel_url = f"{origin}/checkout/cancel"
    metadata = {"package_id": pkg["id"], "source": "web"}
    if payload.email:
        metadata["email"] = payload.email[:120]

    req = CheckoutSessionRequest(
        amount=pkg["amount"],
        currency=pkg["currency"],
        success_url=success_url,
        cancel_url=cancel_url,
        metadata=metadata,
    )
    session = await sc.create_checkout_session(req)

    await db.payment_transactions.insert_one({
        "session_id": session.session_id,
        "amount": pkg["amount"],
        "currency": pkg["currency"],
        "package_id": pkg["id"],
        "payment_status": "pending",
        "status": "open",
        "metadata": metadata,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "access_granted": False,
    })
    return {"url": session.url, "session_id": session.session_id, "package_id": pkg["id"]}


def _expiry_for(package_id: str) -> Optional[str]:
    """Compute an ISO expires_at for a given package_id (None = lifetime)."""
    pkg = PAYWALL_PACKAGES.get(package_id or DEFAULT_PACKAGE_ID)
    if not pkg or not pkg.get("duration_days"):
        return None
    return (datetime.now(timezone.utc) + timedelta(days=int(pkg["duration_days"]))).isoformat()


@api_router.get("/checkout/status/{session_id}")
async def get_checkout_status(session_id: str, request: Request):
    """Poll Stripe, update our record, and grant access on first 'paid' result."""
    sc = _stripe_checkout(str(request.base_url))
    status = await sc.get_checkout_status(session_id)

    update = {
        "status": status.status,
        "payment_status": status.payment_status,
        "checked_at": datetime.now(timezone.utc).isoformat(),
    }
    txn = await db.payment_transactions.find_one_and_update(
        {"session_id": session_id},
        {"$set": update},
        return_document=True,
    )

    paid = status.payment_status == "paid"
    # On the first paid result, atomically create the access_grant. The
    # `access_granted` flip guards against double-credit on parallel polling.
    if paid and txn and not txn.get("access_granted"):
        flipped = await db.payment_transactions.update_one(
            {"session_id": session_id, "access_granted": {"$ne": True}},
            {"$set": {"access_granted": True}},
        )
        if flipped.modified_count == 1:
            pkg_id = txn.get("package_id") or (status.metadata or {}).get("package_id") or DEFAULT_PACKAGE_ID
            await db.access_grants.update_one(
                {"token": session_id},
                {"$set": {
                    "token": session_id,
                    "email": (status.metadata or {}).get("email"),
                    "package_id": pkg_id,
                    "expires_at": _expiry_for(pkg_id),
                    "granted_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )

    return {
        "session_id": session_id,
        "status": status.status,
        "payment_status": status.payment_status,
        "amount_total": status.amount_total,
        "currency": status.currency,
        "paid": paid,
    }


@api_router.post("/webhook/stripe")
async def stripe_webhook(request: Request):
    """Idempotent webhook — backstop for cases where the user closes the success tab."""
    sc = _stripe_checkout(str(request.base_url))
    body = await request.body()
    signature = request.headers.get("Stripe-Signature", "")
    try:
        evt = await sc.handle_webhook(body, signature)
    except Exception as e:  # noqa: BLE001
        logger.warning("stripe webhook verification failed: %s", e)
        raise HTTPException(400, "Invalid webhook")

    if evt.payment_status == "paid" and evt.session_id:
        txn = await db.payment_transactions.find_one_and_update(
            {"session_id": evt.session_id, "access_granted": {"$ne": True}},
            {"$set": {
                "payment_status": "paid",
                "access_granted": True,
                "webhook_at": datetime.now(timezone.utc).isoformat(),
            }},
            return_document=True,
        )
        if txn:
            pkg_id = txn.get("package_id") or (evt.metadata or {}).get("package_id") or DEFAULT_PACKAGE_ID
            await db.access_grants.update_one(
                {"token": evt.session_id},
                {"$set": {
                    "token": evt.session_id,
                    "email": (evt.metadata or {}).get("email"),
                    "package_id": pkg_id,
                    "expires_at": _expiry_for(pkg_id),
                    "granted_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )
    return {"ok": True}


class AccessCheckRequest(BaseModel):
    token: str


@api_router.post("/access/check")
async def check_access(payload: AccessCheckRequest):
    """Validate that a session_id has been granted access AND that any expiry
    has not yet passed. Lifetime grants have expires_at=None and never expire."""
    token = (payload.token or "").strip()
    if not token:
        return {"paid": False}
    grant = await db.access_grants.find_one({"token": token}, {"_id": 0})
    if not grant:
        return {"paid": False}
    expires_at = grant.get("expires_at")
    now_iso = datetime.now(timezone.utc).isoformat()
    expired = bool(expires_at) and now_iso > expires_at
    return {
        "paid": not expired,
        "expired": expired,
        "package_id": grant.get("package_id"),
        "granted_at": grant.get("granted_at"),
        "expires_at": expires_at,
    }


async def _grant_is_active(token: str) -> bool:
    """Shared helper — server-side paywall guard for PDF/masterclass endpoints."""
    token = (token or "").strip()
    if not token:
        return False
    grant = await db.access_grants.find_one({"token": token})
    if not grant:
        return False
    expires_at = grant.get("expires_at")
    if not expires_at:
        return True  # lifetime
    return datetime.now(timezone.utc).isoformat() <= expires_at


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
async def list_plants(language: str = "en"):
    return await _plants_in_language(language)


# ────────────────────────────────────────────────────────────────────────────
# Guide downloads — proxy patchandpot.com PDFs so they download cleanly on every
# device (avoids cross-origin inline-render quirks on iOS Safari, in-app
# webviews, etc.) and lets us serve them with a friendly filename.

_GUIDE_PDFS = {
    "cut-flower-journal": {
        "url": "https://patchandpot.com/pdf/cut-flowers.pdf",
        "filename": "Cut-Flower-Journal.pdf",
    },
    "arranging-and-colour-guide": {
        "url": "https://patchandpot.com/pdf/arranging-and-colour-guide.pdf",
        "filename": "Arranging-and-Colour-Guide.pdf",
    },
}


@api_router.get("/guide-pdf/{slug}")
async def guide_pdf(slug: str):
    """Stream a guide PDF from patchandpot.com with attachment headers."""
    entry = _GUIDE_PDFS.get(slug)
    if not entry:
        raise HTTPException(404, "PDF not found")
    try:
        async with httpx.AsyncClient(timeout=20) as http:
            r = await http.get(entry["url"])
        if r.status_code != 200 or not r.content:
            raise HTTPException(502, "Upstream PDF unavailable")
    except httpx.HTTPError as e:
        logger.warning("guide_pdf fetch failed for %s: %s", slug, e)
        raise HTTPException(502, "Upstream PDF unavailable") from e
    return Response(
        content=r.content,
        media_type="application/pdf",
        headers={
            # `inline` lets the browser render the PDF in the new tab so users
            # see the document directly. A Save button is one click away.
            "Content-Disposition": f'inline; filename="{entry["filename"]}"',
            "Cache-Control": "public, max-age=86400",
        },
    )


@api_router.get("/plants/{plant_id}")
async def get_plant(plant_id: str, language: str = "en"):
    plants = await _plants_in_language(language)
    by_id = {p["id"]: p for p in plants}
    plant = by_id.get(plant_id)
    if not plant:
        raise HTTPException(404, "Plant not found")
    return plant


# Fields on each plant that must be re-rendered in the target language.
_PLANT_TRANS_FIELDS = ("name", "category", "summary", "difficulty", "sun", "water", "soil", "edible_part", "tags")


async def _plants_in_language(language: str) -> list:
    """Return PLANTS — original English OR a cached/AI-translated copy."""
    language = (language or "en").lower()
    if language == "en" or language not in LANG_NAMES:
        return PLANTS

    cache_key = f"plants:{language}"
    cached = await db.guidance_cache.find_one({"key": cache_key}, {"_id": 0})
    if cached:
        return cached["data"]

    language_name = LANG_NAMES[language]
    # Build a compact source dict: id → translatable fields only.
    source = {
        p["id"]: {f: p.get(f) for f in _PLANT_TRANS_FIELDS}
        for p in PLANTS
    }

    system = (
        "You translate a gardening plant catalogue into the target language. "
        "Use natural, locally idiomatic plant names. Keep summaries calm and concise — "
        "do NOT change their length significantly. Preserve em-dashes (—), hyphens and "
        "ellipses. Return ONLY valid JSON, no markdown fences."
    )
    user = f"""Translate the values of this plant catalogue into {language_name}.

Rules:
- Keep the JSON shape EXACTLY the same: every plant id maps to an object with the same fields.
- Translate string values (name, category, summary, difficulty, sun, water, soil, edible_part).
- Translate each tag in the `tags` array (keep array length the same).
- If a value is null, return null.
- Use the locally-common plant name where one exists; if the plant has no native name, transliterate naturally.
- Keep "summary" punchy — the same idea, similar length.

Source:
{json.dumps(source, ensure_ascii=False, indent=2)}

Return JSON only, in the same shape.
"""
    try:
        translated_map = await _llm_json(system, user, session_id=f"plants-trans-{language}")
    except Exception as e:  # noqa: BLE001 — soft-fallback to English if Claude misbehaves
        logger.warning("plants translation failed for %s: %s — falling back to English", language, e)
        return PLANTS

    # Re-assemble the full plant list, replacing only translated fields. Non-translated
    # fields (id, container, image_url, etc.) keep their original values.
    out = []
    for p in PLANTS:
        merged = dict(p)
        t = translated_map.get(p["id"]) if isinstance(translated_map, dict) else None
        if isinstance(t, dict):
            for field in _PLANT_TRANS_FIELDS:
                if field in t and t[field] is not None:
                    merged[field] = t[field]
        out.append(merged)

    await db.guidance_cache.insert_one({
        "key": cache_key,
        "data": out,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return out


# ─────────────────── Climate / season computation ──────────────────────────
# These are deterministic facts we pass to the LLM as hard constraints, so it
# stops *guessing* seasonal context for a given lat/long/month.

def _day_of_year_midmonth(month: int) -> int:
    """Approximate mid-month day-of-year (15th of each month)."""
    # cumulative days at start of each month (non-leap)
    starts = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    return starts[max(1, min(12, month)) - 1] + 15


def _daylight_hours(latitude: float, month: int) -> float:
    """Mid-month sunrise-to-sunset duration at the given latitude.

    Standard astronomy formula, clamped 0–24 h for polar latitudes.
    """
    import math
    n = _day_of_year_midmonth(month)
    decl = 23.45 * math.sin(math.radians(360.0 * (284 + n) / 365.0))
    lat_r = math.radians(latitude)
    decl_r = math.radians(decl)
    cos_h = -math.tan(lat_r) * math.tan(decl_r)
    if cos_h >= 1.0:   # polar night
        return 0.0
    if cos_h <= -1.0:  # midnight sun
        return 24.0
    h = math.degrees(math.acos(cos_h))
    return round((2.0 * h) / 15.0, 1)


def _climate_context(region: Region, month: int) -> dict:
    """Compute concrete climate facts for the prompt: daylight, season bucket,
    frost-window indicator, hemisphere-adjusted month label."""
    lat = float(region.latitude or 0.0)
    abs_lat = abs(lat)
    is_southern = lat < 0
    # Effective "season month" — flip the calendar so summer = peak day length
    # in either hemisphere. This is the month the LLM should reason about
    # for season-naming (e.g. southern-hem July → effective month 1 = January).
    eff_month = ((month + 5) % 12 + 1) if is_southern else month

    daylight = _daylight_hours(lat, month)

    # Frost-likelihood band by absolute latitude + effective month.
    # >55° lat: long frost season (Oct–Apr effective). 45-55°: Nov–Mar.
    # 35-45°: Dec–Feb. 25-35°: only marginal in midwinter. <25°: no frost
    # at low elevation, but flag uncertainty for upland tropical.
    def _frost_band(am: int) -> str:
        # am = effective month (1=Jan = peak winter for north hem reference)
        if abs_lat >= 55:
            return "very high — last spring frost typically mid-May, first autumn frost early October" \
                if 4 <= am <= 10 else "extreme — frost expected most nights"
        if abs_lat >= 45:
            return "moderate — last spring frost late April to mid-May, first autumn frost mid-October" \
                if 5 <= am <= 9 else "high — hard frost likely"
        if abs_lat >= 35:
            return "low to moderate — last spring frost mid-March, first autumn frost mid-November" \
                if 4 <= am <= 10 else "moderate in midwinter only"
        if abs_lat >= 25:
            return "very rare — only in unusual cold snaps; ignore for most planning"
        return "absent at low elevation; possible in upland tropical zones — verify locally"

    frost_note = _frost_band(eff_month)

    # Growing-season bucket (relative to effective month).
    if eff_month in (12, 1, 2):
        bucket = "deep winter / dormant" if abs_lat >= 35 else "cool season"
    elif eff_month in (3, 4, 5):
        bucket = "early spring → late spring" if abs_lat >= 25 else "warm dry/wet transition"
    elif eff_month in (6, 7, 8):
        bucket = "summer / peak growing" if abs_lat >= 25 else "hot/wet season"
    else:  # 9-11
        bucket = "autumn / harvest & wind-down" if abs_lat >= 25 else "cooling season"

    # Hemisphere-adjusted month name for the LLM's seasonal reasoning.
    eff_month_name = MONTHS[eff_month]

    # Continental vs maritime heuristic (rough): high inland longitude span
    # without ocean buffering → wider temp swings. We can't compute this
    # cleanly without a map, so just expose lat/long and let the LLM
    # contextualise from the place name.
    return {
        "latitude": round(lat, 2),
        "is_southern_hemisphere": is_southern,
        "effective_seasonal_month": eff_month,
        "effective_seasonal_month_name": eff_month_name,
        "daylight_hours_midmonth": daylight,
        "season_bucket": bucket,
        "frost_outlook": frost_note,
    }


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

    # Deterministic climate facts — passed as ground truth so the LLM can't
    # hallucinate the season for this location.
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

    await db.guidance_cache.insert_one({
        "key": cache_key,
        "data": data,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return data


# ─────────────────── Seasonal PDF (paywalled) ────────────────────
from pdf_seasonal import build_seasonal_pdf  # noqa: E402


class SeasonalPdfRequest(BaseModel):
    region: Region
    month: int
    language: str = "en"
    orientation: str = "portrait"  # "portrait" | "landscape"
    my_garden: List[str] = []
    access_token: str  # Stripe session_id stored in localStorage


@api_router.post("/seasonal-pdf")
async def seasonal_pdf(req: SeasonalPdfRequest, request: Request):
    """Build a personalised A4 PDF of the current monthly guide. Paywalled."""
    token = (req.access_token or "").strip()
    if not await _grant_is_active(token):
        raise HTTPException(402, "Access required — pay to unlock.")

    if not (1 <= req.month <= 12):
        raise HTTPException(400, "month must be 1–12")

    # Reuse the existing guidance pipeline (cached per region+month+language+garden).
    guidance = await get_guidance(GuidanceRequest(
        region=req.region,
        month=req.month,
        language=req.language,
        my_garden=req.my_garden,
    ))

    language = (req.language or "en").lower()
    if language not in LANG_NAMES:
        language = "en"
    month_label = MONTHS[req.month]
    region_label = req.region.name + (f", {req.region.country}" if req.region.country else "")

    # QR target — the public host the user actually sees (X-Forwarded-* set by
    # Emergent's ingress reflects preview/production domain; base_url is the
    # internal cluster name).
    fwd_host = request.headers.get("x-forwarded-host") or request.url.hostname or "patchandpot.com"
    fwd_proto = request.headers.get("x-forwarded-proto") or request.url.scheme or "https"
    qr_url = f"{fwd_proto}://{fwd_host.split(',')[0].strip()}/calendar"

    pdf_bytes = build_seasonal_pdf(
        guidance=guidance,
        region_name=region_label,
        month_label=month_label,
        language=language,
        orientation=(req.orientation or "portrait").lower(),
        qr_url=qr_url,
    )

    safe_region = re.sub(r"[^A-Za-z0-9_-]+", "-", req.region.name)[:40] or "region"
    filename = f"Patch-and-Pot-{month_label}-{safe_region}.pdf"
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'inline; filename="{filename}"',
            "Cache-Control": "private, max-age=300",
        },
    )


# ── AI-generated Masterclasses ───────────────────────────────────────────────
class MasterclassGenRequest(BaseModel):
    topic: str
    language: str = "en"
    access_token: str = ""


def _slugify(text: str) -> str:
    s = re.sub(r"[^A-Za-z0-9]+", "-", (text or "").strip().lower()).strip("-")
    return s[:60] or "topic"


# A short authored example pasted into the system prompt so Claude matches the
# Patch & Pot voice (warm, opinionated, practical, occasional "you" address).
MASTERCLASS_VOICE_SAMPLE = """\
{
  "title": "Propagation",
  "tagline": "Turn one plant into many — from cuttings, division, layering and seed.",
  "duration_minutes": 45,
  "lessons": [
    {
      "title": "Why propagate?",
      "eyebrow": "Lesson 1",
      "body": [
        "Propagation is the quiet heart of gardening. It is how generations of plants have travelled across windowsills, balconies and gardens — passed hand to hand, free.",
        "Once you can propagate, you stop being a buyer of plants and become a maker of them. One pelargonium becomes ten. A neighbour's basil becomes your basil."
      ],
      "boxes": [
        {"label": "What you'll learn", "items": [
          "How to choose the right method for the plant in front of you",
          "When in the year to attempt each technique",
          "What 'good roots' look like and when to pot on"
        ]}
      ],
      "tip": "Take cuttings in the cool of morning — they wilt far less."
    },
    {
      "title": "Starting from seed",
      "eyebrow": "Lesson 2",
      "body": [
        "Seed is the cheapest, most miraculous propagation. A packet of basil seeds costs less than a coffee and yields thirty plants.",
        "The principles are simple: a moist, free-draining seed compost; warmth (most edibles want 18–24°C to germinate); light from the moment the first leaf appears; and patience."
      ],
      "steps": {
        "title": "The reliable indoor sowing routine",
        "items": [
          "Fill small pots with fresh seed compost; level the surface.",
          "Water from below for 10 minutes until the surface is dark.",
          "Sow 2–3 seeds per cell; cover lightly; press down gently.",
          "Cover with a clear lid; place somewhere warm.",
          "The moment a shoot appears, remove the cover and move to bright light."
        ]
      },
      "tip": "If your seedlings stretch and flop, they want more light, not more water."
    }
  ]
}
"""


@api_router.post("/masterclass/generate")
async def generate_masterclass(req: MasterclassGenRequest, background: BackgroundTasks):
    """Kick off (or fetch cached) an AI-authored masterclass. Returns
    `{job_id, status, slug}` immediately. Frontend polls /masterclass/job/{job_id}
    until status='done', then GETs /masterclass/generated/{slug}. Paywalled."""
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


@api_router.get("/masterclass/job/{job_id}")
async def get_masterclass_job(job_id: str):
    """Poll endpoint — returns {status: pending|done|error, slug?, error?}."""
    job = await db.masterclass_jobs.find_one({"job_id": job_id}, {"_id": 0})
    if not job:
        raise HTTPException(404, "Job not found.")
    out = {"status": job.get("status", "pending"), "slug": job.get("slug")}
    if job.get("status") == "error":
        out["error"] = job.get("error") or "Generation failed."
    return out

@api_router.get("/masterclass/library")
async def my_masterclass_library(access_token: str, language: str = "en"):
    """List the masterclasses generated by — OR previously viewed by — this
    user. Includes their own creations + topics they've opened via the
    'recent' / shared list."""
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


@api_router.get("/masterclass/generated/{slug}")
async def get_generated_masterclass(slug: str, language: str = "en", access_token: str = ""):
    """Fetch a previously-generated masterclass by slug. Not paywalled — once
    a topic is generated, anyone can read it. Passing an access_token adds the
    topic to that user's personal library."""
    cache_key = f"{slug}|{language.lower()}"
    cached = await db.generated_masterclasses.find_one({"cache_key": cache_key}, {"_id": 0})
    if not cached:
        # Fallback to English if the requested language hasn't been generated yet.
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


@api_router.get("/masterclass/generated")
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


# Hand-authored / curated masterclasses live in the frontend bundle so we keep
# a parallel registry here for OG/SEO metadata only. This is intentionally tiny
# (title + tagline + intro paragraph + cover-image subject). Lessons remain on
# the frontend so we don't dual-maintain authored content.
STATIC_MASTERCLASS_OG = {
    "propagation": {
        "title": "Propagation Masterclass",
        "tagline": "Turn one plant into many — from cuttings, division, layering and seed.",
        "intro": (
            "Propagation is the quiet heart of gardening. It is how generations of "
            "plants have travelled across windowsills, balconies and gardens — passed "
            "hand to hand, free. Once you can propagate, you stop being a buyer of "
            "plants and become a maker of them."
        ),
        "image_subject": "a hand holding three rooted basil cuttings in clear jars on cream linen, soft natural light",
    },
    "pest-control": {
        "title": "Organic Pest Control Masterclass",
        "tagline": "Identify, prevent, and treat the common pests of pots and small gardens — organic-first.",
        "intro": (
            "Pest control isn't about a final battle — it's about tipping the daily "
            "balance away from pests and towards the predators and conditions that "
            "keep them in check. Healthy plants in healthy compost, with airflow, "
            "sun and pollinator-friendly companions, will deal with 90% of pest "
            "pressure themselves."
        ),
        "image_subject": "a healthy basil plant with a ladybird on a leaf, soft natural daylight, cream backdrop",
    },
    "plant-care": {
        "title": "Plant Care Masterclass",
        "tagline": "Watering, feeding, light, repotting and the seasonal rhythm of caring for plants in pots.",
        "intro": (
            "If you can get watering right, you can grow almost anything. If you "
            "can't, no other technique saves you. Most house plants and pot plants "
            "die from over-watering, not under. This masterclass walks through every "
            "core skill — watering, feeding, light, repotting, pruning — so the year "
            "becomes a rhythm rather than a worry."
        ),
        "image_subject": "a row of healthy potted herbs on a sunlit windowsill, soft cream and terracotta palette",
    },
    "seasonal-planting": {
        "title": "Seasonal Planting Masterclass",
        "tagline": "Read the year like a gardener — sowing windows, succession, and stretching every season.",
        "intro": (
            "Generic gardening calendars fail because the year is not the same "
            "everywhere. The trick is to read your own year by the three signals "
            "that actually matter: last frost date, average daylight, and soil "
            "temperature. This masterclass teaches you that rhythm — and how to "
            "stretch the season at both ends."
        ),
        "image_subject": "seed packets, a notebook and a clay pot on a wooden bench in spring sunlight",
    },
}


def _first_paragraph(text: str, max_chars: int = 280) -> str:
    """Trim a paragraph to ~280 chars without breaking mid-word; suitable for og:description."""
    t = (text or "").strip().replace("\n", " ")
    if len(t) <= max_chars:
        return t
    cut = t[: max_chars].rsplit(" ", 1)[0]
    return cut.rstrip(",.;:") + "…"


@api_router.get("/og/learn/{topic}")
async def og_learn_meta(topic: str, language: str = "en"):
    """Return OpenGraph + intro metadata for a /learn/:topic landing page.

    Resolves the topic from (a) the static-masterclass registry above, or
    (b) the AI-generated masterclass cache. The frontend uses this to populate
    `react-helmet-async` tags; a future edge worker could SSR these into the
    document head for scrapers that don't execute JavaScript.
    """
    slug = (topic or "").strip().lower()
    if not slug:
        raise HTTPException(400, "Missing topic.")

    # 1) Static / curated masterclass
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

    # 2) AI-generated masterclass — prefer requested language, fallback to en
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
            "id": p["id"],
            "name": p["name"],
            "category": p["category"],
            "summary": p["summary"],
            "reason": reason,
        })
    # Translate `reason` strings too (short, sentence-length) when language != en.
    if (language or "en").lower() != "en" and (language or "").lower() in LANG_NAMES and items:
        try:
            items = await _translate_companion_reasons(items, language)
        except Exception as e:  # noqa: BLE001 — soft-fallback: keep English reasons
            logger.warning("companion-reasons translation failed for %s: %s", language, e)
    return {"plant_id": plant_id, "companions": items}


async def _translate_companion_reasons(items: list, language: str) -> list:
    """Batch-translate the short companion `reason` strings for a single plant."""
    language_name = LANG_NAMES[language]
    cache_key = f"companion-reasons:{language}:{':'.join(sorted(i['id'] for i in items))}"
    cached = await db.guidance_cache.find_one({"key": cache_key}, {"_id": 0})
    if cached:
        reasons_map = cached["data"]
    else:
        source = {i["id"]: i.get("reason") for i in items if i.get("reason")}
        if not source:
            return items
        system = "You translate concise gardening companion-planting reasons. Return ONLY a JSON object."
        user = (
            f"Translate these companion-planting reasons into {language_name}. "
            "Keep them short and gardener-friendly. Return JSON with the same keys.\n\n"
            f"{json.dumps(source, ensure_ascii=False, indent=2)}"
        )
        reasons_map = await _llm_json(system, user, session_id=f"companion-reasons-{language}")
        await db.guidance_cache.insert_one({
            "key": cache_key,
            "data": reasons_map,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    for i in items:
        if i["id"] in reasons_map and reasons_map[i["id"]]:
            i["reason"] = reasons_map[i["id"]]
    return items


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
    # Initialise up-front so every return path has `climate` defined even if a
    # branch is somehow missed later.
    climate = "Temperate"
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
