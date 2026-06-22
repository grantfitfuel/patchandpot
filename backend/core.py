"""Shared models, helpers and data used across the per-feature routers.

Anything that more than one router needs lives here. server.py and the
individual routers in /routers import from this module. The goal is to keep
routers small and focused on HTTP shape, while the heavy lifting (LLM calls,
caching, climate maths, paywall guards) stays factored out.

Most helpers come in two flavours:
  - pure functions (no Mongo handle): import directly
  - factories `make_xxx(db)` that close over the Mongo handle and return the
    function/coroutine the routers actually call.
"""
import json
import logging
import math
import os
import re
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import HTTPException
from pydantic import BaseModel, Field

from emergentintegrations.llm.chat import LlmChat, UserMessage
from emergentintegrations.payments.stripe.checkout import StripeCheckout

logger = logging.getLogger(__name__)

# Load .env eagerly — core is imported by routers BEFORE server.py runs, so
# we cannot rely on server.py's load_dotenv() having happened yet.
load_dotenv(Path(__file__).parent / ".env")


# ───────────────────────── Env / constants ─────────────────────────
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
STRIPE_API_KEY = os.environ.get("STRIPE_API_KEY", "")

# Hard cap on monthly AI spend. When the rolling 30-day cost (estimated from
# row counts in our caches) exceeds this, all AI endpoints return 503 instead
# of running fresh generation. Cache hits still serve normally. Set to 0 or
# leave unset to disable the cap (production default).
try:
    AI_MONTHLY_BUDGET_GBP = float(os.environ.get("AI_MONTHLY_BUDGET_GBP", "0") or 0)
except (TypeError, ValueError):
    AI_MONTHLY_BUDGET_GBP = 0.0

# Cost factors used to convert call counts → estimated GBP spend. These are
# rough order-of-magnitude — tune against your actual Anthropic invoice.
AI_COST_SONNET_GBP = 0.03   # ~£0.03 per Sonnet generation (1500 in + 2000 out tokens)
AI_COST_HAIKU_GBP = 0.008   # ~£0.008 per Haiku call
AI_COST_IMAGE_GBP = 0.03    # ~£0.03 per Nano Banana image


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

MONTHS = ["", "January", "February", "March", "April", "May", "June",
          "July", "August", "September", "October", "November", "December"]


# ───────────────────────── Models ─────────────────────────
class Region(BaseModel):
    name: str
    country: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    climate_zone: Optional[str] = None
    hemisphere: Optional[str] = "northern"


class GuidanceRequest(BaseModel):
    region: Region
    month: int = Field(ge=1, le=12)
    language: Optional[str] = "en"
    my_garden: Optional[List[str]] = None


class PlantImageRequest(BaseModel):
    plant_id: str
    plant_name: str
    style_hint: Optional[str] = None


class PestImageRequest(BaseModel):
    name: str


class ArrangementRequest(BaseModel):
    region: Region
    month: int = Field(ge=1, le=12)
    my_garden: List[str] = []
    language: Optional[str] = "en"


class AccessCheckRequest(BaseModel):
    token: str


class CheckoutRequest(BaseModel):
    origin_url: str
    email: Optional[str] = None
    package_id: Optional[str] = None
    # Optional attribution token, e.g. "embed-mygardenblog.com" — set by the
    # frontend from a captured ?ref= query param (see useReferralCapture).
    # Sanitised server-side; safe to ignore if unknown.
    ref: Optional[str] = None


class SeasonalPdfRequest(BaseModel):
    region: Region
    month: int
    language: str = "en"
    orientation: str = "portrait"
    my_garden: List[str] = []
    access_token: str


class MasterclassGenRequest(BaseModel):
    topic: str
    language: str = "en"
    access_token: str = ""


class PlantGuideRequest(BaseModel):
    query: str
    language: Optional[str] = "en"


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
    kind: str


class VendorBlurbRequest(BaseModel):
    plant_name: str
    vendors: List[VendorRef]
    region: Optional[Region] = None
    language: str = "en"


# ───────────────────────── LLM helpers ─────────────────────────
def _strip_code_fences(text: str) -> str:
    """Pull a JSON object out of an LLM response, even wrapped in markdown fences."""
    text = text.strip()
    m = re.search(r"\{[\s\S]*\}", text)
    return m.group(0) if m else text


# Budget circuit-breaker state. Refreshed at most once a minute to keep the
# per-request cost negligible. When `over_budget` is True every fresh LLM
# call short-circuits with 503; cache hits still serve normally.
import time as _time
_BUDGET_STATE = {"over_budget": False, "checked_at": 0.0, "estimated_gbp": 0.0}


async def refresh_ai_budget_state(db) -> dict:
    """Recompute monthly AI spend from cache row counts and update the in-memory
    flag. Called by the monthly cron + on demand by /admin/ai-usage; safe to
    call from anywhere."""
    if AI_MONTHLY_BUDGET_GBP <= 0:
        _BUDGET_STATE["over_budget"] = False
        _BUDGET_STATE["estimated_gbp"] = 0.0
        _BUDGET_STATE["checked_at"] = _time.time()
        return dict(_BUDGET_STATE)

    since = (datetime.now(timezone.utc) - timedelta(days=30)).isoformat()
    sonnet_count = await db.guidance_cache.count_documents({
        "$or": [
            {"kind": "guidance-base", "language": "en", "created_at": {"$gte": since}},
            {"key": {"$regex": "^plant-guide:ai-.*:en$"}, "created_at": {"$gte": since}},
        ],
    })
    sonnet_count += await db.arrangement_cache.count_documents({"created_at": {"$gte": since}})
    sonnet_count += await db.generated_masterclasses.count_documents({"created_at": {"$gte": since}})

    haiku_count = await db.guidance_cache.count_documents({
        "$or": [
            {"kind": "guidance-base", "language": {"$ne": "en"}, "created_at": {"$gte": since}},
            {"kind": "guidance", "my_garden": {"$exists": True, "$not": {"$size": 0}},
             "created_at": {"$gte": since}},
            {"key": {"$regex": "^plant-guide:ai-"}, "created_at": {"$gte": since}},
        ],
    })

    image_count = await db.image_cache.count_documents({"created_at": {"$gte": since}})

    estimated = round(
        sonnet_count * AI_COST_SONNET_GBP
        + haiku_count * AI_COST_HAIKU_GBP
        + image_count * AI_COST_IMAGE_GBP,
        2,
    )
    _BUDGET_STATE["estimated_gbp"] = estimated
    _BUDGET_STATE["over_budget"] = estimated >= AI_MONTHLY_BUDGET_GBP
    _BUDGET_STATE["checked_at"] = _time.time()
    if _BUDGET_STATE["over_budget"]:
        logger.warning(
            "AI budget exceeded: estimated £%.2f >= cap £%.2f — new generations will 503",
            estimated, AI_MONTHLY_BUDGET_GBP,
        )
    return dict(_BUDGET_STATE)


def _enforce_budget_or_503():
    """Cheap synchronous check before every LLM call. Reads the cached
    `_BUDGET_STATE`; refreshes happen on cron + admin endpoints."""
    if AI_MONTHLY_BUDGET_GBP <= 0:
        return
    if _BUDGET_STATE.get("over_budget"):
        raise HTTPException(
            503,
            "Our AI quota for the month is full — cached guides still load. "
            "Please try again next month.",
        )



async def _llm_json(system_prompt: str, user_prompt: str, session_id: str) -> dict:
    """Call Claude Sonnet 4.5 and parse the JSON response."""
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY not configured")
    _enforce_budget_or_503()
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


async def _llm_json_cheap(system_prompt: str, user_prompt: str, session_id: str) -> dict:
    """Call Claude Haiku — ~4× cheaper than Sonnet. Use for pure translation or
    other mechanical JSON transforms where creative quality isn't the bottleneck.

    Falls back to Sonnet if Haiku errors out so quality is never the failure mode.
    """
    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY not configured")
    _enforce_budget_or_503()
    try:
        chat = LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=session_id,
            system_message=system_prompt,
        ).with_model("anthropic", "claude-haiku-4-5-20251001")
        response = await chat.send_message(UserMessage(text=user_prompt))
        raw = response if isinstance(response, str) else getattr(response, "content", str(response))
        return json.loads(_strip_code_fences(raw))
    except (json.JSONDecodeError, HTTPException) as e:
        logger.warning("Haiku call failed (%s), falling back to Sonnet", e)
        return await _llm_json(system_prompt, user_prompt, session_id)
    except Exception as e:  # noqa: BLE001 — any transport / SDK error
        logger.warning("Haiku call errored (%s), falling back to Sonnet", e)
        return await _llm_json(system_prompt, user_prompt, session_id)


def _image_gen(prompt: str, session: str) -> LlmChat:
    return LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session,
        system_message="You are an image generation assistant.",
    ).with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])


def make_cached_image(db):
    """Factory: returns an `async _cached_image(key, prompt, session)` coroutine
    that reads/writes the image_cache collection on the supplied db handle."""
    async def _cached_image(key: str, prompt: str, session: str) -> dict:
        cached = await db.image_cache.find_one({"key": key}, {"_id": 0})
        if cached:
            return {"image": cached["image"], "cached": True}
        if not EMERGENT_LLM_KEY:
            raise HTTPException(500, "EMERGENT_LLM_KEY not configured")
        try:
            _text, images = await _image_gen(prompt, session).send_message_multimodal_response(
                UserMessage(text=prompt)
            )
        except Exception as e:
            logger.error("Image gen failed for %s: %s", key, e)
            raise HTTPException(502, "Image generation failed")
        if not images:
            raise HTTPException(502, "No image returned")
        img = images[0]
        data_url = f"data:{img['mime_type']};base64,{img['data']}"
        await db.image_cache.insert_one({
            "key": key, "image": data_url,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return {"image": data_url, "cached": False}
    return _cached_image


# ───────────────────────── Slug / text utils ─────────────────────────
def _slugify(text: str) -> str:
    s = re.sub(r"[^A-Za-z0-9]+", "-", (text or "").strip().lower()).strip("-")
    return s[:60] or "topic"


def _plant_slug(name: str) -> str:
    return "ai-" + re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")[:48]


def _first_paragraph(text: str, max_chars: int = 280) -> str:
    """Trim a paragraph to ~280 chars without breaking mid-word; suitable for og:description."""
    t = (text or "").strip().replace("\n", " ")
    if len(t) <= max_chars:
        return t
    cut = t[: max_chars].rsplit(" ", 1)[0]
    return cut.rstrip(",.;:") + "…"


# ───────────────────────── Paywall ─────────────────────────
PAYWALL_PACKAGES = {
    "monthly": {
        "id": "monthly", "amount": 2.99, "currency": "gbp",
        "label": "Patch & Pot — 1 month access", "duration_days": 31,
    },
    "quarterly": {
        "id": "quarterly", "amount": 5.0, "currency": "gbp",
        "label": "Patch & Pot — 3 month access", "duration_days": 92,
    },
    "biannual": {
        "id": "biannual", "amount": 9.0, "currency": "gbp",
        "label": "Patch & Pot — 6 month access", "duration_days": 183,
    },
    "annual": {
        "id": "annual", "amount": 15.0, "currency": "gbp",
        "label": "Patch & Pot — 12 month access", "duration_days": 365,
    },
    "lifetime": {
        "id": "lifetime", "amount": 50.0, "currency": "gbp",
        "label": "Patch & Pot — lifetime access", "duration_days": None,
    },
    # Founding-member cohort. Limited to FOUNDING_TOTAL sales — once sold out,
    # the checkout endpoint redirects buyers to regular `lifetime` at £50.
    "lifetime_founding": {
        "id": "lifetime_founding", "amount": 35.0, "currency": "gbp",
        "label": "Patch & Pot — Founding Member (lifetime)", "duration_days": None,
    },
    # Tip-jar — does NOT grant any access; pure thank-you.
    "tip": {
        "id": "tip", "amount": 3.0, "currency": "gbp",
        "label": "Patch & Pot — support the gardener", "duration_days": 0,
    },
}
DEFAULT_PACKAGE_ID = "annual"

# Cap on Founding Member lifetime sales. After this many succeed, the offer
# closes and the home-page banner switches to "Thank you, sold out".
FOUNDING_TOTAL = 30


def _stripe_checkout(host_url: str) -> StripeCheckout:
    if not STRIPE_API_KEY:
        raise HTTPException(503, "Payments are not configured.")
    webhook_url = f"{host_url.rstrip('/')}/api/webhook/stripe"
    return StripeCheckout(api_key=STRIPE_API_KEY, webhook_url=webhook_url)


def _expiry_for(package_id: str) -> Optional[str]:
    pkg = PAYWALL_PACKAGES.get(package_id or DEFAULT_PACKAGE_ID)
    if not pkg or not pkg.get("duration_days"):
        return None
    return (datetime.now(timezone.utc) + timedelta(days=int(pkg["duration_days"]))).isoformat()


def make_grant_is_active(db):
    """Factory: returns `async _grant_is_active(token)` bound to this db."""
    async def _grant_is_active(token: str) -> bool:
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
    return _grant_is_active


# ───────────────────────── Climate maths ─────────────────────────
def _day_of_year_midmonth(month: int) -> int:
    starts = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334]
    return starts[max(1, min(12, month)) - 1] + 15


def _daylight_hours(latitude: float, month: int) -> float:
    """Mid-month sunrise-to-sunset duration at the given latitude."""
    n = _day_of_year_midmonth(month)
    decl = 23.45 * math.sin(math.radians(360.0 * (284 + n) / 365.0))
    lat_r = math.radians(latitude)
    decl_r = math.radians(decl)
    cos_h = -math.tan(lat_r) * math.tan(decl_r)
    if cos_h >= 1.0:
        return 0.0
    if cos_h <= -1.0:
        return 24.0
    h = math.degrees(math.acos(cos_h))
    return round((2.0 * h) / 15.0, 1)


def _climate_context(region: Region, month: int) -> dict:
    """Compute concrete climate facts for the prompt."""
    lat = float(region.latitude or 0.0)
    abs_lat = abs(lat)
    is_southern = lat < 0
    eff_month = ((month + 5) % 12 + 1) if is_southern else month
    daylight = _daylight_hours(lat, month)

    def _frost_band(am: int) -> str:
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

    if eff_month in (12, 1, 2):
        bucket = "deep winter / dormant" if abs_lat >= 35 else "cool season"
    elif eff_month in (3, 4, 5):
        bucket = "early spring → late spring" if abs_lat >= 25 else "warm dry/wet transition"
    elif eff_month in (6, 7, 8):
        bucket = "summer / peak growing" if abs_lat >= 25 else "hot/wet season"
    else:
        bucket = "autumn / harvest & wind-down" if abs_lat >= 25 else "cooling season"

    return {
        "latitude": round(lat, 2),
        "is_southern_hemisphere": is_southern,
        "effective_seasonal_month": eff_month,
        "effective_seasonal_month_name": MONTHS[eff_month],
        "daylight_hours_midmonth": daylight,
        "season_bucket": bucket,
        "frost_outlook": frost_note,
    }


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


# ───────────────────────── Plant catalogue ─────────────────────────
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
    # ── Flowers ─────────────────────────────
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

_PLANT_TRANS_FIELDS = ("name", "category", "summary", "difficulty", "sun", "water", "soil", "edible_part", "tags")


def make_plants_in_language(db):
    """Factory: returns `async _plants_in_language(language)`. Caches translated
    catalogues in the guidance_cache collection."""
    async def _plants_in_language(language: str) -> list:
        language = (language or "en").lower()
        if language == "en" or language not in LANG_NAMES:
            return PLANTS

        cache_key = f"plants:{language}"
        cached = await db.guidance_cache.find_one({"key": cache_key}, {"_id": 0})
        if cached:
            return cached["data"]

        language_name = LANG_NAMES[language]
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
            translated_map = await _llm_json_cheap(system, user, session_id=f"plants-trans-{language}")
        except Exception as e:
            logger.warning("plants translation failed for %s: %s — falling back to English", language, e)
            return PLANTS

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
    return _plants_in_language


# Companion planting pairs
COMPANIONS = {
    "tomato": ["basil", "marigold", "nasturtium", "chives", "borage"],
    "basil": ["tomato", "chilli", "marigold"],
    "lettuce": ["chives", "radish", "carrot", "viola"],
    "mint": [],
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


def make_translate_companion_reasons(db):
    """Factory: returns `async _translate_companion_reasons(items, language)`."""
    async def _translate_companion_reasons(items: list, language: str) -> list:
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
            reasons_map = await _llm_json_cheap(system, user, session_id=f"companion-reasons-{language}")
            await db.guidance_cache.insert_one({
                "key": cache_key,
                "data": reasons_map,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })
        for i in items:
            if i["id"] in reasons_map and reasons_map[i["id"]]:
                i["reason"] = reasons_map[i["id"]]
        return items
    return _translate_companion_reasons


# ───────────────────────── Static registries used by routers ─────────────────────────
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
    "flower-arranging": {
        "title": "The Art of Flower Arranging",
        "tagline": "From a fistful of garden stems to a vase you'd be proud to put on any table — principles, mechanics, and seasonal recipes.",
        "intro": (
            "Flower arranging is not florist's work — it's domestic alchemy. "
            "The flowers in a supermarket bunch are six days old before they "
            "reach you; the flowers from your garden are six minutes old. "
            "This masterclass teaches the everyday gesture of cutting what you "
            "grew, conditioning it well, and putting it where you'll see it — "
            "kitchen jug, hall table, bedside."
        ),
        "image_subject": "an unstudied loose hand-tied bouquet of garden roses, sweet peas, scabious and dill flower in a stoneware jug on cream linen, soft natural daylight",
    },
}

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

__all__ = [
    # constants
    "LANG_NAMES", "MONTHS", "EMERGENT_LLM_KEY", "STRIPE_API_KEY",
    "PAYWALL_PACKAGES", "DEFAULT_PACKAGE_ID",
    "FOUNDING_TOTAL", "AI_MONTHLY_BUDGET_GBP",
    "PLANTS", "PLANT_INDEX", "COMPANIONS", "COMPANION_REASONS",
    "FLOWER_PORTRAITS", "SHARE_MOTIFS", "STATIC_MASTERCLASS_OG",
    "MASTERCLASS_VOICE_SAMPLE", "_GUIDE_PDFS",
    # models
    "Region", "GuidanceRequest", "PlantImageRequest", "PestImageRequest",
    "ArrangementRequest", "AccessCheckRequest", "CheckoutRequest",
    "SeasonalPdfRequest", "MasterclassGenRequest", "PlantGuideRequest",
    "TopicImageRequest", "LessonAdaptRequest", "ShareImageRequest",
    "VendorRef", "VendorBlurbRequest",
    # helpers
    "_strip_code_fences", "_llm_json", "_llm_json_cheap", "_image_gen", "make_cached_image",
    "_enforce_budget_or_503", "refresh_ai_budget_state",
    "_slugify", "_plant_slug", "_first_paragraph",
    "_stripe_checkout", "_expiry_for", "make_grant_is_active",
    "_day_of_year_midmonth", "_daylight_hours", "_climate_context",
    "_guidance_cache_key",
    "make_plants_in_language", "make_translate_companion_reasons",
]
