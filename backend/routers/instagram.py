"""Instagram Content Publishing — automated 3x/week posting.

Flow summary (see /app/scripts for the integration playbook):
1. Admin visits `/admin/instagram` and clicks "Connect".
2. Backend `/api/instagram/oauth/start` returns a Meta OAuth URL.
3. Meta redirects back to `/api/instagram/oauth/callback` with ?code=…
4. We exchange the code → short-user-token → long-user-token → Page
   access-token + Instagram Business Account ID, and store those in
   `ig_connection` (one row, _id='default').
5. Every Mon/Wed/Fri at 09:00 UK the platform cron hits
   `/api/cron/instagram-post` which:
   - picks the next content slot (alternating masterclass teaser and
     seasonal highlight) based on rotation offset,
   - generates a 1080×1080 JPEG into Mongo and a caption via Claude,
   - creates an IG media container pointing at
     `/api/public-image/{post_id}` (so Meta can fetch the bytes),
   - polls until FINISHED, then publishes.

Image hosting: Meta requires a public HTTPS URL. We serve the JPEG from
`/api/public-image/{post_id}` straight out of the `ig_posts` Mongo doc
(no object-storage dependency needed yet).
"""
from __future__ import annotations

import asyncio
import base64
import io
import os
import random
import secrets
import subprocess
import tempfile
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlencode

import httpx
import imageio.v2 as imageio
import imageio_ffmpeg
import numpy as np
from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from core import STATIC_MASTERCLASS_OG
from routers.admin._shared import require_admin


# ────────────────────────── config ──────────────────────────
META_APP_ID = os.environ.get("META_APP_ID", "")
META_APP_SECRET = os.environ.get("META_APP_SECRET", "")
META_API = os.environ.get("META_API_VERSION", "v26.0")
META_OAUTH_REDIRECT = os.environ.get(
    "META_OAUTH_REDIRECT",
    "https://patchandpot.app/api/instagram/oauth/callback",
)
WEBHOOK_CRON_SECRET = os.environ.get("WEBHOOK_CRON_SECRET", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://patchandpot.app")
GRAPH = f"https://graph.facebook.com/{META_API}"

# Public base URL — used to compose the `image_url` we hand to Meta.
# Defaults to production domain; override in .env for preview testing.
PUBLIC_API_BASE = os.environ.get("PUBLIC_API_BASE", "https://patchandpot.app")

# Palette — mirrors the frontend brand so composed cards match the app.
PALETTE = {
    "forest": (45, 74, 34),
    "moss": (92, 107, 82),
    "terracotta": (198, 93, 71),
    "butter": (244, 201, 107),
    "sand": (247, 245, 240),
    "ink": (28, 35, 26),
}

MONTHS_UK = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
]

# Rotation strategy — Mon/Wed/Fri. Mix content type AND media format
# so the feed never feels algorithmic. Fri is the Reel slot (Reels get
# 3-5x the reach of static posts on Instagram's current ranking).
# Each entry: (content_kind, media_format)
ROTATION = [
    ("masterclass", "CAROUSEL"),  # Monday — 3-slide masterclass carousel
    ("seasonal",    "FEED"),   # Wednesday — static seasonal highlight
    ("masterclass", "REEL"),   # Friday — animated reel (5s)
]

# ────────────────────────── hashtag pools ─────────────────────────
# Rotate per content type AND season. Each caption pulls:
#   - the two anchors ALWAYS (#PatchAndPot, #UKGardening)
#   - 2 from the common pool (random each post)
#   - 3 from the content-specific pool (random)
#   - 1 from the current-season pool (random)
# → 7 tags, naturally varied so the feed doesn't look spam-templated.
HASHTAG_ANCHORS = ["#PatchAndPot", "#UKGardening"]
HASHTAG_COMMON = [
    "#GardenersOfInstagram", "#GrowYourOwn", "#KitchenGarden", "#AllotmentLife",
    "#RHS", "#SmallSpaceGardening", "#OrganicGardening", "#GardeningTips",
    "#LifeInTheGarden", "#GardenersWorld", "#HomeGrown",
]
HASHTAG_POOLS = {
    "propagation": [
        "#PlantPropagation", "#TakingCuttings", "#RootedCuttings",
        "#DividePerennials", "#Layering", "#SeedToPlant", "#FreePlants",
    ],
    "pest-control": [
        "#OrganicPestControl", "#CompanionPlanting", "#NaturalGardening",
        "#AphidControl", "#SlugFree", "#WildlifeFriendlyGarden", "#NoChemicals",
    ],
    "no-dig": [
        "#NoDigGarden", "#NoDigGardening", "#CharlesDowding", "#LivingSoil",
        "#SoilHealth", "#CompostLove", "#RegenerativeGardening",
    ],
    "weather": [
        "#GardenWeather", "#ClimateGardening", "#FrostProtection", "#RainGarden",
        "#DryGarden", "#SeasonalGardening",
    ],
    "flower-arranging": [
        "#CutFlowerGarden", "#FlowerArranging", "#FloristFromGarden",
        "#BritishFlowers", "#SeasonalFlowers", "#VaseLife", "#FlowerFarmer",
    ],
    "plant-care": [
        "#PlantCare", "#ContainerGardening", "#PotPlants", "#Houseplants",
        "#WateringTips", "#Repotting", "#PlantParent",
    ],
    "seasonal": [
        # Fallback when a specific sub-pool wasn't picked.
        "#SeasonalGardening", "#FollowTheSeasons", "#InTheGardenToday",
        "#GardenJournal", "#WildAndFree",
    ],
}
SEASONAL_SUBPOOL = {
    "spring": ["#SpringGarden", "#SpringPlanting", "#EarlyGrowth", "#FreshStart", "#BlossomSeason"],
    "summer": ["#SummerGarden", "#SummerHarvest", "#LongDays", "#InBloom", "#GardenGlory"],
    "autumn": ["#AutumnGarden", "#AutumnHarvest", "#FirstFrost", "#MulchSeason", "#GoldenLight"],
    "winter": ["#WinterGarden", "#WinterRest", "#BareRoot", "#Dormancy", "#GardenPlanning"],
}


def _season_for_month(month: int) -> str:
    """UK meteorological seasons — spring Mar-May, summer Jun-Aug,
    autumn Sep-Nov, winter Dec-Feb."""
    if 3 <= month <= 5: return "spring"
    if 6 <= month <= 8: return "summer"
    if 9 <= month <= 11: return "autumn"
    return "winter"


def _build_hashtags(content_slug: str, now: datetime, rng: random.Random) -> str:
    """Compose a 7-tag line that mixes anchors, two common tags, three
    content-specific, and one seasonal. Returns a space-separated string
    starting with the anchors."""
    # Pick pool key from content slug.
    pool_key = content_slug
    if content_slug.startswith("seasonal-"):
        pool_key = "seasonal"
    specific = HASHTAG_POOLS.get(pool_key, HASHTAG_POOLS["seasonal"])

    picked = list(HASHTAG_ANCHORS)
    picked += rng.sample(HASHTAG_COMMON, k=min(2, len(HASHTAG_COMMON)))
    picked += rng.sample(specific, k=min(3, len(specific)))
    season_tags = SEASONAL_SUBPOOL[_season_for_month(now.month)]
    picked += rng.sample(season_tags, k=1)
    # De-dup while preserving order.
    seen: set[str] = set()
    out: list[str] = []
    for t in picked:
        if t not in seen:
            seen.add(t); out.append(t)
    return " ".join(out)


# ────────────────────────── helpers ─────────────────────────
async def _graph_get(path: str, token: str, params: dict | None = None):
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{GRAPH}{path}", params={**(params or {}), "access_token": token})
    body = r.json()
    if r.is_error or "error" in body:
        e = body.get("error", {})
        raise HTTPException(502, f"Graph error: {e.get('message', body)}")
    return body


# ────────────────────────── watercolour backgrounds ─────────────────────────
# A library of hand-crafted prompts per content slug, so the composed card
# feels like it was illustrated for *this* post rather than templated.
# Results are cached in Mongo (`ig_bg_watercolours` collection) keyed by
# (slug, orientation, render_version) so a 3-month campaign only pays
# the Nano-Banana cost once per content × shape pair.
_BG_PROMPT_MASTERCLASS = {
    "propagation": {
        "spring": "glass jars of rooting cuttings on a sunny spring windowsill, seed trays of fresh green seedlings and a terracotta pot of compost beside, blossom branches outside",
        "summer": "softwood cuttings of lavender and rosemary in a gritty pot on a sun-warmed potting bench, summer flowers blurred behind",
        "autumn": "a gardener's bench with divided perennial clumps, paper seed envelopes and dried seed heads, russet autumn leaves drifting",
        "winter": "hardwood cuttings of willow and currant pushed into a deep pot by a frosty greenhouse window, bare branches beyond",
    },
    "pest-control": {
        "spring": "ladybirds on fresh broad bean tops with a few aphids, early marigold seedlings and blossom in a wildlife-friendly spring plot",
        "summer": "hover-flies over nasturtiums and calendula beside netted cabbages, ladybirds on sunlit leaves in a busy summer kitchen garden",
        "autumn": "a hedgehog by a leaf pile under rosehips, a log pile and mulched brassica bed in soft autumn light",
        "winter": "a bug hotel of hollow stems and pine cones in a frosted garden, a robin and blue tit at a feeder above dormant beds",
    },
    "plant-care": {
        "spring": "a watering can and a cluster of freshly repotted plants in terracotta pots on a sunny spring patio",
        "summer": "potted tomatoes, herbs and geraniums on a sun-drenched balcony with a full watering can and morning dew",
        "autumn": "pot plants being moved into a sheltered porch, a sack of compost and fallen leaves, warm low autumn light",
        "winter": "houseplants grouped on a bright winter windowsill with a mister and a pebble tray, frost patterns on the glass",
    },
    "seasonal-planting": {
        "spring": "a vegetable bed being sown in spring sunshine, seed packets, a dibber and rows of pea and lettuce seedlings",
        "summer": "planting out courgettes and beans into a lush summer bed, a trug of young plants and a watering can",
        "autumn": "planting garlic cloves and spring bulbs into dark crumbly soil, a basket of bulbs and autumn leaves around",
        "winter": "bare-root fruit trees and rose bundles waiting by a dug planting hole, light frost on the grass",
    },
    "flower-arranging": {
        "spring": "a stoneware jug of tulips, narcissi and blossom branches on a weathered wooden bench, snips and twine beside",
        "summer": "a stoneware vase of freshly cut dahlias, cosmos and sweet peas on a sunny wooden bench, snips and twine beside",
        "autumn": "a rustic arrangement of chrysanthemums, rosehips, seed heads and copper beech leaves in an earthenware pot",
        "winter": "a winter arrangement of evergreen foliage, hellebores, holly berries and dried hydrangea heads in a pewter jug",
    },
}
SEASONS = ("spring", "summer", "autumn", "winter")
_BG_PROMPT_SEASONAL = {
    "January":   "bare winter garden with frosted brassicas and a robin on an empty raised bed, pale low sun through bare branches",
    "February":  "chitting seed potatoes in egg trays on a bright, cold windowsill, early tulip shoots in a pot behind",
    "March":     "waking vegetable beds with pea seedlings pushing through soil, a wooden dibber laid across a seed packet",
    "April":     "a cold frame open to spring sun, tomato seedlings in modules hardening off beside a wooden bench",
    "May":       "a late-spring kitchen garden in full growth, broad beans flowering, sweet pea tendrils climbing twine",
    "June":      "a lush June plot peaking — strawberries ripening in rows, nasturtiums spilling, a wren on a stake",
    "July":      "courgettes under broad leaves, tomato trusses yellowing, netted brassicas, a watering can on bare earth",
    "August":    "sunflowers bowing in late-summer heat, overflowing basket of courgettes and tomatoes beside a hose",
    "September": "a late-season allotment with a basket of green tomatoes, pumpkins swelling, sunflower seed heads",
    "October":   "an autumn vegetable patch after the first frost — blackened dahlias, russet apples, mist in the hollows",
    "November":  "a quiet November garden with a thick blanket of compost on empty beds, hand tools cleaned in a tray",
    "December":  "a dormant December plot with structural seed heads and a dusting of frost, bare-root rose bundles waiting",
}
_WATERCOLOUR_STYLE = (
    "Loose soft watercolour illustration, hand-painted on textured cream paper, "
    "earthy palette, painterly brush strokes, warm seasonal light, slightly "
    "dappled shadows, no text, no logos, no people, editorial gardening-magazine "
    "style, calm and inviting."
)
_BG_RENDER_VERSION = 1  # bump to invalidate every cached watercolour


_BG_LOCKS: dict[tuple, asyncio.Lock] = {}


async def _get_or_generate_bg(db, slug: str, orientation: str, season: str | None = None) -> bytes | None:
    """Return cached (or freshly-generated) watercolour bytes for a slug +
    orientation (+ season for masterclass slugs). None on failure."""
    is_mc = slug in _BG_PROMPT_MASTERCLASS
    if is_mc:
        season = season or _season_for_month(datetime.now(timezone.utc).month)
    else:
        season = None
    q = {"slug": slug, "orientation": orientation, "season": season, "v": _BG_RENDER_VERSION}
    lock = _BG_LOCKS.setdefault((slug, orientation, season), asyncio.Lock())
    async with lock:
        cache = await db.ig_bg_watercolours.find_one(q, {"_id": 0, "png": 1})
        if cache and cache.get("png"):
            return cache["png"]

        key = os.environ.get("EMERGENT_LLM_KEY", "")
        if not key:
            return None

        if is_mc:
            scene = f"{_BG_PROMPT_MASTERCLASS[slug][season]}, unmistakably {season} in a UK garden"
        elif slug.startswith("seasonal-"):
            month = slug.split("-", 1)[1].title()
            scene = _BG_PROMPT_SEASONAL.get(month, "a cottage kitchen garden in gentle seasonal light")
        else:
            scene = "a cottage kitchen garden in gentle seasonal light"

        shape = (
            "Square 1:1 composition with extra breathing room toward the bottom third for a text overlay"
            if orientation == "square"
            else "Vertical 9:16 composition with extra breathing room toward the bottom half for a text overlay"
        )
        prompt = f"{_WATERCOLOUR_STYLE} Scene: {scene}. {shape}."

        try:
            from emergentintegrations.llm.chat import LlmChat, UserMessage
            chat = (
                LlmChat(api_key=key, session_id=f"ig-bg-{slug}-{orientation}-{season}-{secrets.token_hex(3)}",
                        system_message="You are an image generation assistant.")
                .with_model("gemini", "gemini-3.1-flash-image-preview")
                .with_params(modalities=["image", "text"])
            )
            _text, images = await asyncio.wait_for(
                chat.send_message_multimodal_response(UserMessage(text=prompt)),
                timeout=90,
            )
            png = base64.b64decode(images[0]["data"]) if images else None
        except Exception:  # noqa: BLE001
            return None
        if not png:
            return None
        await db.ig_bg_watercolours.update_one(
            q,
            {"$set": {**q, "png": png, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
        return png


PREGEN_STATE: dict[str, Any] = {"running": False, "total": 0, "done": 0, "failed": [], "started_at": None, "finished_at": None}


async def pregenerate_seasonal_bgs(db) -> None:
    """Background job: make sure every masterclass x season x orientation
    watercolour exists. Skips cached ones, so it's cheap to re-run."""
    if PREGEN_STATE["running"]:
        return
    combos = [(s, o, se) for s in _BG_PROMPT_MASTERCLASS for se in SEASONS for o in ("square", "vertical")]
    PREGEN_STATE.update(running=True, total=len(combos), done=0, failed=[],
                        started_at=datetime.now(timezone.utc).isoformat(), finished_at=None)
    sem = asyncio.Semaphore(3)

    async def one(slug, orientation, season):
        async with sem:
            png = await _get_or_generate_bg(db, slug, orientation, season)
        if png:
            PREGEN_STATE["done"] += 1
        else:
            PREGEN_STATE["failed"].append(f"{slug}/{season}/{orientation}")

    try:
        await asyncio.gather(*(one(*c) for c in combos))
    finally:
        PREGEN_STATE.update(running=False, finished_at=datetime.now(timezone.utc).isoformat())


async def _graph_post(path: str, token: str, params: dict):
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{GRAPH}{path}", params={**params, "access_token": token})
    body = r.json()
    if r.is_error or "error" in body:
        e = body.get("error", {})
        raise HTTPException(502, f"Graph error: {e.get('message', body)}")
    return body


def _font(size: int) -> ImageFont.FreeTypeFont:
    """Load the first available serif TTF, falling back to default."""
    paths = [
        "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
    ]
    for p in paths:
        if os.path.exists(p):
            return ImageFont.truetype(p, size=size)
    return ImageFont.load_default()


def _wrap_lines(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont,
                max_width: int) -> list[str]:
    """Greedy word-wrap honouring font metrics."""
    words = text.split()
    lines: list[str] = []
    cur = ""
    for w in words:
        probe = f"{cur} {w}".strip()
        if draw.textlength(probe, font=font) <= max_width:
            cur = probe
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def _blur_overlay(img: Image.Image, box: tuple[int, int, int, int], tint: tuple[int, int, int], alpha: int, blur: int = 14) -> Image.Image:
    """Crop a region of the painting, optionally blur-and-darken it to a
    warm panel, paste it back. Pass blur=0 for a tint-only pass that
    keeps detail visible — used on the main image so the painting stays
    crisp — vs blur>0 on the lower text panel where legibility matters."""
    x1, y1, x2, y2 = box
    crop = img.crop(box)
    if blur > 0:
        crop = crop.filter(ImageFilter.GaussianBlur(blur))
    overlay = Image.new("RGBA", crop.size, tint + (alpha,))
    blended = Image.alpha_composite(crop.convert("RGBA"), overlay)
    out = img.copy()
    out.paste(blended.convert("RGB"), box)
    return out


async def _square_base(db, slug: str, variant: str, season: str | None) -> Image.Image:
    """1080² watercolour (or flat-palette fallback) to build square slides on."""
    size = 1080
    img = None
    bg_bytes = await _get_or_generate_bg(db, slug, "square", season)
    if bg_bytes:
        try:
            img = Image.open(io.BytesIO(bg_bytes)).convert("RGB").resize((size, size), Image.LANCZOS)
        except Exception:  # noqa: BLE001
            img = None
    if img is None:
        img = Image.new("RGB", (size, size), PALETTE[variant])
        d = ImageDraw.Draw(img)
        dot = PALETTE["sand"] if variant != "sand" else PALETTE["forest"]
        for y in range(0, size, 28):
            for x in range(0, size, 28):
                d.ellipse([(x, y), (x + 2, y + 2)], fill=dot)
    return img


def _to_jpeg(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=88, optimize=True)
    return buf.getvalue()


async def _compose_card(db, slug: str, eyebrow: str, title: str, body: str, variant: str = "forest",
                        season: str | None = None) -> bytes:
    """1080×1080 JPEG: warm text panel over the watercolour background."""
    size = 1080
    img = await _square_base(db, slug, variant, season)

    # Darken the whole image slightly so text pops; apply a stronger
    # warm panel on the bottom third for the body + brand footer.
    img = _blur_overlay(img, (0, 0, size, size), PALETTE["ink"], 55, blur=0)
    img = _blur_overlay(img, (0, int(size * 0.52), size, size), PALETTE["forest"], 160, blur=14)
    d = ImageDraw.Draw(img)

    # Terracotta accent bar top-left.
    d.rectangle([(72, 72), (160, 82)], fill=PALETTE["terracotta"])

    # Eyebrow in butter.
    eyebrow_font = _font(30)
    d.text((72, 108), eyebrow.upper(), font=eyebrow_font, fill=PALETTE["butter"])

    # Title — big serif, wrapped. Sits in the upper band.
    title_font = _font(84)
    title_lines = _wrap_lines(d, title, title_font, max_width=size - 144)[:3]
    y = 170
    for line in title_lines:
        # Draw a faint drop shadow so text stays legible even if the
        # watercolour is bright behind.
        d.text((74, y + 2), line, font=title_font, fill=PALETTE["ink"])
        d.text((72, y), line, font=title_font, fill=PALETTE["sand"])
        y += 94

    # Body — sits inside the warm panel bottom half.
    body_font = _font(36)
    body_lines = _wrap_lines(d, body, body_font, max_width=size - 144)[:5]
    by = int(size * 0.56) + 24
    for line in body_lines:
        d.text((72, by), line, font=body_font, fill=PALETTE["sand"])
        by += 46

    # Footer brand.
    foot_font = _font(30)
    d.text((72, size - 86), "patchandpot.app", font=foot_font, fill=PALETTE["butter"])
    return _to_jpeg(img)


def _slide_counter(d: ImageDraw.ImageDraw, idx: int, total: int = 3) -> None:
    f = _font(26)
    label = f"{idx}/{total}"
    w = d.textlength(label, font=f)
    d.rounded_rectangle([(1080 - 72 - w - 32, 64), (1080 - 72, 112)], radius=24, fill=PALETTE["ink"])
    d.text((1080 - 72 - w - 16, 74), label, font=f, fill=PALETTE["sand"])


async def _compose_carousel(db, slug: str, eyebrow: str, title: str, tips: list[str],
                            variant: str = "forest", season: str | None = None) -> list[bytes]:
    """3 square slides: cover (title) → tips → CTA. Same seasonal painting,
    three different treatments so the swipe feels like a story."""
    size = 1080
    base = await _square_base(db, slug, variant, season)

    # 1 — Cover: painting stays crisp, title on top band.
    crisp = _blur_overlay(base, (0, 0, size, size), PALETTE["ink"], 50, blur=0)
    soft = _blur_overlay(crisp, (0, 0, size, size), PALETTE["forest"], 130, blur=10)
    mask = Image.linear_gradient("L").rotate(180).resize((size, size))
    mask = mask.point(lambda v: max(0, min(255, int((v - 90) * 3))))
    s1 = Image.composite(soft, crisp, mask)
    d = ImageDraw.Draw(s1)
    d.rectangle([(72, 72), (160, 82)], fill=PALETTE["terracotta"])
    d.text((72, 108), eyebrow.upper(), font=_font(30), fill=PALETTE["butter"])
    tf = _font(88)
    y = 168
    for line in _wrap_lines(d, title, tf, size - 144)[:3]:
        d.text((74, y + 2), line, font=tf, fill=PALETTE["ink"])
        d.text((72, y), line, font=tf, fill=PALETTE["sand"])
        y += 98
    _slide_counter(d, 1)
    sw = _font(32)
    d.rounded_rectangle([(72, size - 132), (392, size - 68)], radius=32, fill=PALETTE["terracotta"])
    d.text((104, size - 118), "Swipe for tips  →", font=sw, fill=PALETTE["sand"])

    # 2 — Tips: heavily blurred, sand-tinted panel for legibility.
    s2 = _blur_overlay(base, (0, 0, size, size), PALETTE["sand"], 215, blur=22)
    d = ImageDraw.Draw(s2)
    d.text((72, 96), f"{season.upper() + ' ' if season else ''}QUICK TIPS", font=_font(30), fill=PALETTE["terracotta"])
    d.text((72, 140), title, font=_font(52), fill=PALETTE["forest"])
    bf = _font(38)
    y = 260
    for i, tip in enumerate(tips[:3], start=1):
        d.ellipse([(72, y), (136, y + 64)], fill=PALETTE["forest"])
        n = str(i)
        d.text((104 - d.textlength(n, font=_font(34)) / 2, y + 12), n, font=_font(34), fill=PALETTE["butter"])
        lines = _wrap_lines(d, tip, bf, size - 72 - 168)[:4]
        ty = y + 8
        for line in lines:
            d.text((168, ty), line, font=bf, fill=PALETTE["ink"])
            ty += 48
        y = max(y + 96, ty + 40)
    d.text((72, size - 86), "patchandpot.app", font=_font(30), fill=PALETTE["moss"])
    _slide_counter(d, 2)

    # 3 — CTA: forest panel, butter headline, terracotta link-in-bio pill.
    s3 = _blur_overlay(base, (0, 0, size, size), PALETTE["forest"], 175, blur=16)
    d = ImageDraw.Draw(s3)
    d.rectangle([(72, 300), (160, 310)], fill=PALETTE["terracotta"])
    hf = _font(92)
    y = 340
    for line in ["Plan your", "patch free"]:
        d.text((72, y), line, font=hf, fill=PALETTE["sand"])
        y += 104
    d.text((72, y + 16), "at patchandpot.app", font=_font(52), fill=PALETTE["butter"])
    pf = _font(36)
    label = "Link in bio  ↑"
    w = d.textlength(label, font=pf)
    d.rounded_rectangle([(72, y + 130), (72 + w + 64, y + 206)], radius=38, fill=PALETTE["terracotta"])
    d.text((104, y + 148), label, font=pf, fill=PALETTE["sand"])
    _slide_counter(d, 3)

    return [_to_jpeg(s1), _to_jpeg(s2), _to_jpeg(s3)]


async def _compose_reel(db, slug: str, eyebrow: str, title: str, body: str, variant: str = "forest",
                        season: str | None = None) -> bytes:
    """Compose a 1080×1920 vertical MP4 for Instagram Reels, using a
    Nano-Banana watercolour background with a slow Ken Burns zoom and
    animated text layered over a warm panel. Falls back to the flat
    palette version if the watercolour can't be generated.

    5-second animation:
      0.0-0.6s  — eyebrow fades up from 50% y
      0.6-1.8s  — title slides in word-by-word (left reveal)
      1.8-3.0s  — body paragraph fades in
      0.0-5.0s  — slow 4% Ken Burns zoom on the background
    Produces an H.264 MP4 with silent AAC audio (~1-2 MB typical)."""
    W, H, FPS, DUR = 1080, 1920, 24, 5
    N_FRAMES = DUR * FPS

    # Load or fall back on the watercolour.
    bg_bytes = await _get_or_generate_bg(db, slug, "vertical", season)
    if bg_bytes:
        try:
            bg_img = Image.open(io.BytesIO(bg_bytes)).convert("RGB")
            # Scale up slightly beyond W×H so Ken Burns can crop in.
            over_w = int(W * 1.08)
            over_h = int(H * 1.08)
            bg_img = bg_img.resize((over_w, over_h), Image.LANCZOS)
        except Exception:
            bg_img = None
    else:
        bg_img = None

    body_colour = PALETTE["sand"]
    accent = PALETTE["butter"]

    # Pre-wrap text once (expensive).
    scratch = Image.new("RGB", (W, H), PALETTE["forest"])
    scratch_draw = ImageDraw.Draw(scratch)
    title_font = _font(104)
    body_font = _font(44)
    eyebrow_font = _font(34)
    foot_font = _font(34)
    title_lines = _wrap_lines(scratch_draw, title, title_font, W - 180)[:4]
    body_lines = _wrap_lines(scratch_draw, body, body_font, W - 180)[:6]

    def render_frame(f: int) -> np.ndarray:
        t = f / FPS
        # 1. Base — watercolour with Ken Burns, OR flat palette fallback.
        if bg_img is not None:
            zoom = 1.0 + 0.04 * (t / DUR)  # subtle 0 → 4% zoom
            crop_w = int(bg_img.width / zoom)
            crop_h = int(bg_img.height / zoom)
            # Pan: drift top-left to centre as time progresses.
            ox = int((bg_img.width - crop_w) * (t / DUR) * 0.6)
            oy = int((bg_img.height - crop_h) * (t / DUR) * 0.4)
            frame = bg_img.crop((ox, oy, ox + crop_w, oy + crop_h)).resize((W, H), Image.LANCZOS)
        else:
            frame = Image.new("RGB", (W, H), PALETTE[variant])
            d0 = ImageDraw.Draw(frame)
            dot = PALETTE["sand"] if variant != "sand" else PALETTE["forest"]
            for y in range(0, H, 36):
                for x in range(0, W, 36):
                    d0.ellipse([(x, y), (x + 3, y + 3)], fill=dot)

        # 2. Warm darken overlay (full + stronger lower half).
        frame = _blur_overlay(frame, (0, 0, W, H), PALETTE["ink"], 55, blur=0)
        frame = _blur_overlay(frame, (0, int(H * 0.60), W, H), PALETTE["forest"], 160, blur=14)
        d = ImageDraw.Draw(frame)

        # Accent bar (fade in 0 → 0.4s).
        bar_a = max(0.0, min(1.0, t / 0.4))
        if bar_a > 0:
            cur = PALETTE["terracotta"]
            d.rectangle([(90, 90), (178, 100)], fill=cur)

        # Eyebrow (0.2 → 0.6s fade up).
        eb_a = max(0.0, min(1.0, (t - 0.2) / 0.4))
        if eb_a > 0:
            off = int(40 * (1 - eb_a))
            col = tuple(int(PALETTE["forest"][i] * (1 - eb_a) + accent[i] * eb_a) for i in range(3))
            d.text((90, 130 + off), eyebrow.upper(), font=eyebrow_font, fill=col)

        # Title lines — slide in per line.
        y = 220
        for i, line in enumerate(title_lines):
            start = 0.5 + i * 0.25
            end = start + 0.5
            a = max(0.0, min(1.0, (t - start) / (end - start)))
            if a > 0:
                dx = int(-120 * (1 - a))
                col = tuple(int(PALETTE["forest"][k] * (1 - a) + body_colour[k] * a) for k in range(3))
                # Drop shadow.
                d.text((92 + dx, y + 2), line, font=title_font, fill=PALETTE["ink"])
                d.text((90 + dx, y), line, font=title_font, fill=col)
            y += 116

        # Body (1.8 → 3.0s fade).
        body_a = max(0.0, min(1.0, (t - 1.8) / 1.2))
        if body_a > 0:
            by = int(H * 0.64)
            for line in body_lines:
                dy = int(16 * (1 - body_a))
                col = tuple(int(PALETTE["forest"][k] * (1 - body_a) + body_colour[k] * body_a) for k in range(3))
                d.text((90, by + dy), line, font=body_font, fill=col)
                by += 54

        # Footer — fade in 1.5s onwards.
        pulse_a = max(0.0, min(1.0, (t - 1.5) / 0.5))
        if pulse_a > 0:
            col = tuple(int(PALETTE["forest"][i] * (1 - pulse_a) + accent[i] * pulse_a) for i in range(3))
            d.text((90, H - 110), "patchandpot.app", font=foot_font, fill=col)

        return np.asarray(frame)

    tmpdir = tempfile.mkdtemp(prefix="ig_reel_")
    raw_mp4 = os.path.join(tmpdir, "silent.mp4")
    final_mp4 = os.path.join(tmpdir, "reel.mp4")
    try:
        with imageio.get_writer(
            raw_mp4, fps=FPS, codec="libx264", macro_block_size=1,
            ffmpeg_params=["-pix_fmt", "yuv420p", "-movflags", "+faststart"],
        ) as writer:
            for f in range(N_FRAMES):
                writer.append_data(render_frame(f))
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        subprocess.run(
            [ffmpeg, "-y", "-loglevel", "error",
             "-i", raw_mp4,
             "-f", "lavfi", "-t", str(DUR), "-i", "anullsrc=r=44100:cl=stereo",
             "-c:v", "copy", "-c:a", "aac", "-shortest", final_mp4],
            check=True,
        )
        with open(final_mp4, "rb") as fh:
            return fh.read()
    finally:
        for p in (raw_mp4, final_mp4):
            try: os.remove(p)
            except OSError: pass
        try: os.rmdir(tmpdir)
        except OSError: pass


async def _write_caption(subject: str, title: str, body_hint: str) -> str:
    """Have Claude write a 60-100 word warm paragraph of advice. We DO NOT
    ask the LLM for hashtags here — hashtags are composed from pools per
    post (`_build_hashtags`) so the set rotates and never looks spam-templated.
    The caller is responsible for appending the hashtag line + the brand URL."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage  # local import
    key = os.environ.get("EMERGENT_LLM_KEY", "")
    fallback = f"{title}\n\n{body_hint}"
    if not key:
        return fallback
    chat = LlmChat(api_key=key, session_id=f"ig-caption-{secrets.token_hex(4)}",
                   system_message=(
                       "You write warm, informative Instagram paragraphs for a UK gardening app "
                       "called Patch & Pot. Style: 60-100 words of practical, actionable advice. "
                       "UK English. Naturalistic, not salesy. No emojis inside the paragraph. "
                       "Do NOT include hashtags or links — those are added later. Return ONLY "
                       "the paragraph, no preamble, no code fences, no title."
                   ))
    chat.with_model("anthropic", "claude-sonnet-4-5-20250929")
    chat.with_params(max_tokens=400)
    try:
        resp = await asyncio.wait_for(
            chat.send_message(UserMessage(
                text=(
                    f"Write the paragraph. Topic: {subject}. Title: {title}. "
                    f"Factual anchor: {body_hint}."
                )
            )),
            timeout=25,
        )
        return resp.strip()
    except Exception:  # noqa: BLE001
        return fallback


async def _write_tips(title: str, body_hint: str, season: str, fallback_text: str) -> list[str]:
    """Three short, season-aware tips for carousel slide 2."""
    import re
    sentences = [x.strip() for x in re.split(r"(?<=[.!?])\s+", f"{body_hint} {fallback_text}") if x.strip()]
    fallback = (sentences + ["Little and often beats a big weekend blitz."] * 3)[:3]
    key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not key:
        return fallback
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    chat = LlmChat(api_key=key, session_id=f"ig-tips-{secrets.token_hex(4)}",
                   system_message=(
                       "You write ultra-short practical gardening tips for UK Instagram carousels. "
                       "UK English, no emojis, no hashtags, no numbering. Each tip max 14 words. "
                       "Return exactly 3 lines, one tip per line, nothing else."
                   ))
    chat.with_model("anthropic", "claude-sonnet-4-5-20250929")
    chat.with_params(max_tokens=200)
    try:
        resp = await asyncio.wait_for(chat.send_message(UserMessage(
            text=f"Topic: {title}. Season: {season} (UK). Context: {body_hint}"
        )), timeout=25)
        tips = [t.strip(" -•*0123456789.").strip() for t in resp.strip().splitlines() if t.strip()]
        return tips[:3] if len(tips) >= 3 else fallback
    except Exception:  # noqa: BLE001
        return fallback


def _assemble_caption(paragraph: str, content_slug: str, now: datetime) -> str:
    """Glue the LLM paragraph together with brand URL + fresh hashtag line."""
    # Per-post RNG seeded on the public-id-ish; this makes it stable
    # within a single run_id but different across runs.
    rng = random.Random(secrets.token_bytes(16))
    hashtags = _build_hashtags(content_slug, now, rng)
    return f"{paragraph}\n\n📖 Full guide at patchandpot.app\n\n{hashtags}"


# ────────────────────────── content picker ─────────────────────────
def _pick_masterclass(week_num: int) -> dict:
    """Deterministic rotation across the 5 masterclasses by ISO week."""
    keys = list(STATIC_MASTERCLASS_OG.keys())
    k = keys[week_num % len(keys)]
    mc = STATIC_MASTERCLASS_OG[k]
    return {
        "slug": k,
        "eyebrow": "Masterclass",
        "title": mc["title"].replace(" Masterclass", "").strip(),
        "body_hint": mc.get("tagline") or mc.get("intro", "")[:200],
        "intro": mc.get("intro", ""),
        "link": f"patchandpot.app/masterclasses",
        "variant": "forest",
    }


def _pick_seasonal(now: datetime) -> dict:
    """Seasonal highlight — pulls the current month's planting + pest
    advice from a tiny built-in digest. Deliberately not fetched from the
    region-aware guidance API so the cron doesn't need a region."""
    month = MONTHS_UK[now.month - 1]
    SEASONAL = {
        "January":   ("Plan the year", "Order seeds, sharpen tools and prune apple and pear trees on a dry day. Force rhubarb crowns under a bucket for an early, sweet crop."),
        "February":  ("Chit potatoes", "Stand seed potatoes in egg trays by a bright, cool window. Sow broad beans undercover and start chillies on a warm sill."),
        "March":     ("Wake the beds", "Sow tomatoes, peppers and aubergines inside. Direct sow carrots, parsnips and peas once soil crumbs easily in the hand."),
        "April":     ("Harden off", "Move seedlings outside by day, back in at night. Sow salad in succession and keep the hoe moving — weeds grow faster than the crop now."),
        "May":       ("Plant out", "After the last frost, plant courgettes, beans and squash. Pinch out tomato side-shoots and start a weekly tomato-feed routine."),
        "June":      ("Prime of year", "Water deeply but less often, so roots chase the moisture down. Deadhead sweet peas twice a week to keep them flowering."),
        "July":      ("Hold the harvest", "Pick courgettes small, pinch out runner-bean tips, and net brassicas before the whites move in. Water pots early morning or evening only."),
        "August":    ("Save seeds", "Let a few lettuces and herbs flower and set seed. Sow the last of the salads and the first of the overwintering onions."),
        "September": ("Soft landing", "Collect ripe tomatoes under glass. Lift maincrop potatoes on a dry day and sow green manures on empty beds to feed next year's soil."),
        "October":   ("Let things die", "The first frost will take the dahlias and basil — it's the market, not a loss. Cut, compost, clear, exhale."),
        "November":  ("Mulch and tuck", "Spread a thick blanket of compost or leaf-mould over bare soil. Clean, oil and store the hand tools before the cold truly sets in."),
        "December":  ("Rest and read", "Plan next year's rotation on paper. Order bare-root fruit, prune grapes and currants, and keep bird feeders topped up through frost."),
    }
    headline, body_hint = SEASONAL.get(month, ("This month", "Keep watching the sky, the soil and the plants — the patch will tell you what it needs."))
    return {
        "slug": f"seasonal-{month.lower()}",
        "eyebrow": f"{month} in your patch",
        "title": headline,
        "body_hint": body_hint,
        "link": "patchandpot.app/calendar",
        "variant": "terracotta",
    }


def _pick_content(now: datetime, media_format: str | None = None) -> dict:
    """Rotate by weekday (Mon carousel / Wed feed / Fri reel). Pass
    media_format to force a slot (admin previews)."""
    if media_format in {f for _, f in ROTATION}:
        kind = next(k for k, f in ROTATION if f == media_format)
    else:
        idx = {0: 0, 2: 1, 4: 2}.get(now.weekday(), 0)
        kind, media_format = ROTATION[idx]
    week_num = int(now.strftime("%W"))
    content = _pick_masterclass(week_num) if kind == "masterclass" else _pick_seasonal(now)
    content["media_format"] = media_format
    content["season"] = _season_for_month(now.month)
    return content


async def _compose_media(db, content: dict) -> tuple[list[bytes], str]:
    """Compose media for a picked content slot. Returns (bytes list, mime)."""
    args = (db, content["slug"], content["eyebrow"], content["title"])
    fmt, season = content["media_format"], content["season"]
    if fmt == "REEL":
        return [await _compose_reel(*args, content["body_hint"], content["variant"], season)], "video/mp4"
    if fmt == "CAROUSEL":
        tips = await _write_tips(content["title"], content["body_hint"], season, content.get("intro", ""))
        content["tips"] = tips
        return await _compose_carousel(*args, tips, content["variant"], season), "image/jpeg"
    return [await _compose_card(*args, content["body_hint"], content["variant"], season)], "image/jpeg"


# ────────────────────────── router factory ─────────────────────────
def make_router(db):
    router = APIRouter(prefix="/instagram", tags=["instagram"])

    async def _connection():
        row = await db.ig_connection.find_one({"_id": "default"})
        if not row:
            raise HTTPException(409, "Instagram not connected. Visit /admin/instagram.")
        return row

    # ─── OAuth: start ──────────────────────────────────────────────
    @router.get("/oauth/start")
    async def oauth_start(token: str = Query(...)):
        """Returns a Meta login URL. Admin-gated so random visitors can't
        start the flow and clobber the stored token."""
        require_admin(token)
        if not META_APP_ID:
            raise HTTPException(503, "META_APP_ID not configured")
        state = secrets.token_urlsafe(32)
        await db.ig_oauth_state.insert_one({
            "state": state,
            "created_at": datetime.now(timezone.utc),
        })
        q = urlencode({
            "client_id": META_APP_ID,
            "redirect_uri": META_OAUTH_REDIRECT,
            "state": state,
            "response_type": "code",
            "scope": "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement",
        })
        return {"url": f"https://www.facebook.com/{META_API}/dialog/oauth?{q}"}

    # ─── OAuth: callback ───────────────────────────────────────────
    @router.get("/oauth/callback", response_class=HTMLResponse)
    async def oauth_callback(code: str = Query(...), state: str = Query(...)):
        found = await db.ig_oauth_state.find_one_and_delete({"state": state})
        if not found:
            return HTMLResponse("<h1>Invalid state</h1>", status_code=400)
        async with httpx.AsyncClient(timeout=30) as c:
            # 1. Exchange code → short-user-token
            r = await c.get(f"{GRAPH}/oauth/access_token", params={
                "client_id": META_APP_ID,
                "client_secret": META_APP_SECRET,
                "redirect_uri": META_OAUTH_REDIRECT,
                "code": code,
            })
            short = r.json()
            if "access_token" not in short:
                return HTMLResponse(f"<h1>Token exchange failed</h1><pre>{short}</pre>", status_code=400)
            # 2. Short → long-user-token
            r = await c.get(f"{GRAPH}/oauth/access_token", params={
                "grant_type": "fb_exchange_token",
                "client_id": META_APP_ID,
                "client_secret": META_APP_SECRET,
                "fb_exchange_token": short["access_token"],
            })
            long = r.json()
            if "access_token" not in long:
                return HTMLResponse(f"<h1>Long-lived exchange failed</h1><pre>{long}</pre>", status_code=400)
            # 3. Fetch Pages + connected IG accounts
            r = await c.get(f"{GRAPH}/me/accounts", params={
                "fields": "id,name,access_token,instagram_business_account",
                "access_token": long["access_token"],
            })
            pages = r.json()
        page = next((p for p in pages.get("data", []) if p.get("instagram_business_account")), None)
        if not page:
            return HTMLResponse(
                "<h1>No Instagram Business account found</h1>"
                "<p>Make sure your Instagram is Business or Creator and linked to a Facebook Page you admin.</p>",
                status_code=400,
            )
        await db.ig_connection.replace_one({"_id": "default"}, {
            "_id": "default",
            "page_id": page["id"],
            "page_name": page.get("name"),
            "ig_user_id": page["instagram_business_account"]["id"],
            "page_access_token": page["access_token"],
            "connected_at": datetime.now(timezone.utc),
        }, upsert=True)
        return RedirectResponse(f"{FRONTEND_URL}/admin/instagram?connected=1")

    # ─── Status / posts list ───────────────────────────────────────
    @router.get("/status")
    async def status(token: str = Query(...)):
        require_admin(token)
        conn = await db.ig_connection.find_one({"_id": "default"})
        posts_cur = db.ig_posts.find({}, {"image_b64": 0, "video_b64": 0, "slides_b64": 0}).sort("created_at", -1).limit(20)
        posts = []
        async for p in posts_cur:
            p["_id"] = str(p["_id"])
            if isinstance(p.get("created_at"), datetime):
                p["created_at"] = p["created_at"].isoformat()
            if isinstance(p.get("published_at"), datetime):
                p["published_at"] = p["published_at"].isoformat()
            posts.append(p)
        return {
            "connected": bool(conn),
            "page_name": conn.get("page_name") if conn else None,
            "ig_user_id": conn.get("ig_user_id") if conn else None,
            "posts": posts,
        }

    # ─── Preview a post (admin, no publish) ────────────────────────
    @router.post("/preview")
    async def preview(token: str = Query(...), media_format: str | None = Query(None)):
        require_admin(token)
        now = datetime.now(timezone.utc)
        content = _pick_content(now, media_format)
        paragraph = await _write_caption(content["eyebrow"], content["title"], content["body_hint"])
        caption = _assemble_caption(paragraph, content["slug"], now)
        items, mime = await _compose_media(db, content)
        uris = [f"data:{mime};base64," + base64.b64encode(b).decode() for b in items]
        content.pop("intro", None)
        return {
            "content": content,
            "caption": caption,
            "media_format": content["media_format"],
            "mime": mime,
            "media_b64": uris[0],
            "slides_b64": uris if content["media_format"] == "CAROUSEL" else None,
            "media_bytes": sum(len(b) for b in items),
        }

    # ─── Seasonal watercolour library (admin) ──────────────────────
    @router.get("/seasonal-bgs")
    async def seasonal_bgs(token: str = Query(...)):
        require_admin(token)
        have = set()
        async for r in db.ig_bg_watercolours.find(
            {"v": _BG_RENDER_VERSION, "season": {"$in": list(SEASONS)}},
            {"_id": 0, "slug": 1, "season": 1, "orientation": 1},
        ):
            have.add((r["slug"], r["season"], r["orientation"]))
        grid = [
            {"slug": s, "season": se, "square": (s, se, "square") in have, "vertical": (s, se, "vertical") in have}
            for s in _BG_PROMPT_MASTERCLASS for se in SEASONS
        ]
        return {"job": PREGEN_STATE, "grid": grid, "current_season": _season_for_month(datetime.now(timezone.utc).month)}

    @router.post("/seasonal-bgs/pregenerate")
    async def seasonal_bgs_pregenerate(token: str = Query(...)):
        require_admin(token)
        if not PREGEN_STATE["running"]:
            asyncio.create_task(pregenerate_seasonal_bgs(db))
        return {"ok": True, "queued": True}

    @router.get("/seasonal-bgs/thumb")
    async def seasonal_bg_thumb(token: str = Query(...), slug: str = Query(...), season: str = Query(...),
                                orientation: str = Query("square")):
        require_admin(token)
        row = await db.ig_bg_watercolours.find_one(
            {"slug": slug, "season": season, "orientation": orientation, "v": _BG_RENDER_VERSION},
            {"_id": 0, "png": 1},
        )
        if not row:
            raise HTTPException(404, "Not generated yet")
        img = Image.open(io.BytesIO(row["png"])).convert("RGB")
        img.thumbnail((360, 360))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=80)
        return Response(content=buf.getvalue(), media_type="image/jpeg",
                        headers={"Cache-Control": "private, max-age=600"})

    # ─── Public image route (Meta fetches this) ────────────────────
    @router.get("/public-image/{post_id}")
    async def public_image(post_id: str):
        """PUBLIC — Meta hits this to download the JPEG. No auth; the
        post_id is a random 32-char token Meta can't guess."""
        row = await db.ig_posts.find_one({"public_id": post_id})
        if not row or not row.get("image_b64"):
            raise HTTPException(404, "Not found")
        img = base64.b64decode(row["image_b64"])
        return Response(content=img, media_type="image/jpeg", headers={
            "Cache-Control": "public, max-age=3600",
        })

    # ─── Cron: publish one post ────────────────────────────────────
    @router.post("/cron/post")
    async def cron_post(request: Request):
        # Cron endpoints must ack 2xx immediately; enqueue/background the actual work.
        auth = request.headers.get("Authorization", "")
        if not WEBHOOK_CRON_SECRET or not secrets.compare_digest(
            auth, f"Bearer {WEBHOOK_CRON_SECRET}"
        ):
            raise HTTPException(401, "Unauthorized")
        run_id = request.headers.get("X-Webhook-Id", secrets.token_hex(8))
        # Dedupe — if we already have a post for this run_id, no-op.
        if await db.ig_posts.find_one({"run_id": run_id}):
            return {"ok": True, "deduped": True, "run_id": run_id}
        # Hand off to background.
        asyncio.create_task(_run_post(db, run_id))
        return {"ok": True, "run_id": run_id, "queued": True}

    # ─── Manual publish (admin) ────────────────────────────────────
    @router.post("/publish-now")
    async def publish_now(token: str = Query(...), media_format: str | None = Query(None)):
        require_admin(token)
        run_id = secrets.token_hex(8)
        asyncio.create_task(_run_post(db, run_id, manual=True, media_format=media_format))
        return {"ok": True, "run_id": run_id, "queued": True}

    return router


# Public media routes need to live outside the /instagram prefix so Meta
# fetches a clean short URL. We register them separately on the main app.
def register_public_image_route(app, db):
    @app.get("/api/public-image/{post_id}")
    async def public_image(post_id: str):
        row = await db.ig_posts.find_one({"public_id": post_id})
        if not row or not row.get("image_b64"):
            raise HTTPException(404, "Not found")
        img = base64.b64decode(row["image_b64"])
        return Response(content=img, media_type="image/jpeg", headers={
            "Cache-Control": "public, max-age=3600",
        })

    @app.get("/api/public-image/{post_id}/{idx}")
    async def public_carousel_slide(post_id: str, idx: int):
        """PUBLIC — carousel slide JPEGs for Meta."""
        row = await db.ig_posts.find_one({"public_id": post_id}, {"slides_b64": 1})
        slides = (row or {}).get("slides_b64") or []
        if not 0 <= idx < len(slides):
            raise HTTPException(404, "Not found")
        return Response(content=base64.b64decode(slides[idx]), media_type="image/jpeg", headers={
            "Cache-Control": "public, max-age=3600",
        })

    @app.get("/api/public-video/{post_id}")
    async def public_video(post_id: str):
        """PUBLIC — Meta hits this to download Reel MP4s. Same unguessable
        token system as the image route."""
        row = await db.ig_posts.find_one({"public_id": post_id})
        if not row or not row.get("video_b64"):
            raise HTTPException(404, "Not found")
        mp4 = base64.b64decode(row["video_b64"])
        return Response(content=mp4, media_type="video/mp4", headers={
            "Cache-Control": "public, max-age=3600",
            "Accept-Ranges": "bytes",
        })


# ────────────────────────── worker ─────────────────────────
async def _run_post(db, run_id: str, manual: bool = False, media_format: str | None = None) -> None:
    """Full publish flow — writes a row to `ig_posts` with every state
    transition so the admin page can show progress. Handles FEED, REEL
    and CAROUSEL posts."""
    now = datetime.now(timezone.utc)
    content = _pick_content(now, media_format)
    public_id = secrets.token_urlsafe(24)
    fmt = content["media_format"]
    is_reel = fmt == "REEL"
    post_doc = {
        "run_id": run_id,
        "public_id": public_id,
        "kind": content["slug"],
        "eyebrow": content["eyebrow"],
        "title": content["title"],
        "variant": content["variant"],
        "season": content["season"],
        "media_format": fmt,
        "manual": manual,
        "created_at": now,
        "status": "COMPOSING",
    }
    await db.ig_posts.insert_one(post_doc)

    try:
        # 1. Compose media + caption
        paragraph = await _write_caption(content["eyebrow"], content["title"], content["body_hint"])
        caption = _assemble_caption(paragraph, content["slug"], now)
        items, _mime = await _compose_media(db, content)
        update: dict[str, Any] = {"caption": caption, "status": "READY"}
        if is_reel:
            media_url = f"{PUBLIC_API_BASE}/api/public-video/{public_id}"
            update.update(video_b64=base64.b64encode(items[0]).decode(), video_bytes=len(items[0]), video_url=media_url)
        elif fmt == "CAROUSEL":
            slide_urls = [f"{PUBLIC_API_BASE}/api/public-image/{public_id}/{i}" for i in range(len(items))]
            update.update(slides_b64=[base64.b64encode(b).decode() for b in items],
                          slide_urls=slide_urls, tips=content.get("tips"))
        else:
            media_url = f"{PUBLIC_API_BASE}/api/public-image/{public_id}"
            update.update(image_b64=base64.b64encode(items[0]).decode(), image_url=media_url)
        await db.ig_posts.update_one({"run_id": run_id}, {"$set": update})

        # 2. Load Instagram connection
        conn = await db.ig_connection.find_one({"_id": "default"})
        if not conn:
            await db.ig_posts.update_one({"run_id": run_id}, {"$set": {
                "status": "ERROR", "error": "Instagram not connected"}})
            return

        # 3. Create media container (carousel: one child per slide, then parent)
        if fmt == "CAROUSEL":
            child_ids = []
            for url in slide_urls:
                child = await _graph_post(f"/{conn['ig_user_id']}/media", conn["page_access_token"],
                                          {"image_url": url, "is_carousel_item": "true"})
                child_ids.append(child["id"])
            await db.ig_posts.update_one({"run_id": run_id}, {"$set": {"child_container_ids": child_ids}})
            container_params = {"media_type": "CAROUSEL", "children": ",".join(child_ids), "caption": caption}
        elif is_reel:
            container_params = {
                "media_type": "REELS",
                "video_url": media_url,
                "caption": caption,
                "share_to_feed": "true",
            }
        else:
            container_params = {"image_url": media_url, "caption": caption}
        container = await _graph_post(f"/{conn['ig_user_id']}/media",
                                      conn["page_access_token"], container_params)
        cid = container.get("id")
        await db.ig_posts.update_one({"run_id": run_id}, {"$set": {
            "container_id": cid, "status": "CONTAINER_CREATED"}})

        # 4. Poll container until FINISHED (max ~90s for feed, ~5min for reels)
        poll_max = 100 if is_reel else 30
        for _ in range(poll_max):
            await asyncio.sleep(3)
            s = await _graph_get(f"/{cid}", conn["page_access_token"],
                                 {"fields": "status_code,status"})
            code = s.get("status_code")
            if code == "FINISHED":
                break
            if code in ("ERROR", "EXPIRED"):
                await db.ig_posts.update_one({"run_id": run_id}, {"$set": {
                    "status": "ERROR", "error": f"container {code}: {s}"}})
                return
        else:
            await db.ig_posts.update_one({"run_id": run_id}, {"$set": {
                "status": "ERROR", "error": "container timeout"}})
            return

        # 5. Publish
        result = await _graph_post(f"/{conn['ig_user_id']}/media_publish",
                                   conn["page_access_token"],
                                   {"creation_id": cid})
        await db.ig_posts.update_one({"run_id": run_id}, {"$set": {
            "media_id": result.get("id"),
            "status": "PUBLISHED",
            "published_at": datetime.now(timezone.utc),
        }})
    except HTTPException as e:
        await db.ig_posts.update_one({"run_id": run_id}, {"$set": {
            "status": "ERROR", "error": str(e.detail)}})
    except Exception as e:  # noqa: BLE001
        await db.ig_posts.update_one({"run_id": run_id}, {"$set": {
            "status": "ERROR", "error": f"{type(e).__name__}: {e}"}})
