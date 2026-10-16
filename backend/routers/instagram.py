"""Instagram Content Publishing — automated 3x/week posting.

Flow summary (see /app/scripts for the integration playbook):
1. Admin visits `/admin/instagram` and clicks "Connect".
2. Backend `/api/instagram/oauth/start` returns a Meta OAuth URL.
3. Meta redirects back to `/api/instagram/oauth/callback` with ?code=…
4. We exchange the code → short-user-token → long-user-token → Page
   access-token + Instagram Business Account ID, and store those in
   `ig_connection` (one row, _id='default').
5. Every Mon/Wed/Fri/Sat at 18:00 UK the platform cron hits
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
import ctypes
import gc
import io
import json
import os
import random
import secrets
import shutil
import subprocess
import tempfile
from datetime import datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlencode

import httpx
import imageio_ffmpeg

from routers import ig_graphics as g
from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import HTMLResponse, RedirectResponse
from PIL import Image, ImageDraw, ImageFilter, ImageFont

from core import STATIC_MASTERCLASS_OG
from routers.admin._shared import require_admin


# ────────────────────────── config ──────────────────────────
# Instagram API with Instagram Login — IDs come from the Instagram use case's
# "Business login settings" (not the Meta app ID).
IG_APP_ID = os.environ.get("INSTAGRAM_APP_ID", "")
IG_APP_SECRET = os.environ.get("INSTAGRAM_APP_SECRET", "")
META_API = os.environ.get("META_API_VERSION", "v26.0")
META_OAUTH_REDIRECT = os.environ.get(
    "META_OAUTH_REDIRECT",
    "https://patchandpot.app/api/instagram/oauth/callback",
)
WEBHOOK_CRON_SECRET = os.environ.get("WEBHOOK_CRON_SECRET", "")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "https://patchandpot.app")
GRAPH = f"https://graph.instagram.com/{META_API}"
# Facebook-Login graph — only used for Instagram-library music on Reels
# (Meta's Audio API isn't available on the Instagram-Login API).
FB_GRAPH = f"https://graph.facebook.com/{META_API}"
FB_SCOPES = "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement,business_management"

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
# weekday → (content kind, Instagram media type). Admin previews pick by key.
# All slots publish as Reels so every post can carry library music.
SLOTS = {
    "CAROUSEL": (0, "masterclass", "carousel"),  # Monday — masterclass slideshow Reel
    "FEED":     (2, "seasonal",    "card"),      # Wednesday — 8s seasonal card Reel
    "REEL":     (4, "masterclass", "reel"),      # Friday — 12s 3-scene Reel
    "SOW":      (5, "sow",         "sow"),       # Saturday — what-to-sow slideshow Reel
}
# Business accounts get Meta's royalty-free library — artist names return
# unrelated tracks, so search by genre.
MUSIC_QUERIES = [
    "upbeat folk", "folk", "feel good acoustic folk", "indie folk", "acoustic", "folk pop",
    "happy acoustic", "ukulele", "banjo", "acoustic guitar happy", "country folk", "summer acoustic",
]
MUSIC_NO_REPEAT = 30  # skip the last N tracks used

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
    "what-to-sow": [
        "#WhatToSow", "#SowingSeeds", "#SeedSowing", "#GrowYourOwn",
        "#SeedStarting", "#VegPlot", "#SowNow",
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
async def _graph_get(path: str, token: str, params: dict | None = None, base: str = GRAPH):
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get(f"{base}{path}", params={**(params or {}), "access_token": token})
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


async def mark_interrupted_posts(db) -> None:
    """A restart kills in-flight publish tasks; don't leave them 'COMPOSING' forever."""
    await db.ig_posts.update_many(
        {"status": {"$in": ["COMPOSING", "READY", "CONTAINER_CREATED"]}},
        {"$set": {"status": "ERROR", "error": "Interrupted by a server restart — tap Publish now to retry."}},
    )


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


async def _graph_post(path: str, token: str, params: dict, base: str = GRAPH):
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.post(f"{base}{path}", params={**params, "access_token": token})
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


async def _load_bg(db, slug: str, orientation: str, season: str | None, size: tuple[int, int], variant: str) -> Image.Image:
    """Seasonal watercolour resized to `size`, or a flat brand fallback."""
    bg_bytes = await _get_or_generate_bg(db, slug, orientation, season)
    if bg_bytes:
        try:
            return Image.open(io.BytesIO(bg_bytes)).convert("RGB").resize(size, Image.LANCZOS)
        except Exception:  # noqa: BLE001
            pass
    return g.flat_fallback(size, variant)


def _to_jpeg(img: Image.Image) -> bytes:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90, optimize=True)
    return buf.getvalue()


async def _compose_card(db, slug: str, eyebrow: str, title: str, body: str, variant: str = "forest",
                        season: str | None = None) -> bytes:
    """1080×1080 feed card: crisp painting + frosted postcard panel."""
    bg = await _load_bg(db, slug, "square", season, (1080, 1080), variant)
    img = await asyncio.to_thread(g.render_card, bg, eyebrow, title, body, season)
    return _to_jpeg(img)


async def _compose_carousel(db, slug: str, eyebrow: str, title: str, tips: list[str],
                            variant: str = "forest", season: str | None = None) -> list[bytes]:
    """3 square slides: cover → seasonal tips → CTA."""
    bg = await _load_bg(db, slug, "square", season, (1080, 1080), variant)
    slides = await asyncio.to_thread(g.render_carousel, bg, eyebrow, title, tips, season)
    return [_to_jpeg(s) for s in slides]


async def _compose_reel(db, slug: str, eyebrow: str, title: str, tips: list[str], variant: str = "forest",
                        season: str | None = None) -> bytes:
    """16s 1080×1920 Reel: painting + title → tips one by one → CTA, with
    crossfades and a slow Ken Burns drift. Frames are rendered to disk
    first and memory released BEFORE x264 starts, so the two peaks never
    stack (prod pods have a 512Mi limit)."""
    over = (int(g.REEL_W * 1.08), int(g.REEL_H * 1.08))
    bg = await _load_bg(db, slug, "vertical", season, over, variant)
    tmpdir = tempfile.mkdtemp(prefix="ig_reel_")
    try:
        render_frame = await asyncio.to_thread(g.make_reel_renderer, bg, eyebrow, title, tips, season)
        await asyncio.to_thread(_write_frames, render_frame, g.REEL_DUR * g.REEL_FPS, tmpdir)
        del render_frame, bg
        _release_memory()
        return await asyncio.to_thread(_encode_reel, tmpdir, g.REEL_FPS, g.REEL_DUR)
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


async def _compose_slideshow(db, content: dict, slides: list[Image.Image], per_slide: float) -> bytes:
    """Square slides as postcards over the vertical painting → MP4 Reel."""
    over = (int(g.REEL_W * 1.08), int(g.REEL_H * 1.08))
    season = content["season"] if content["slug"] in _BG_PROMPT_MASTERCLASS else None
    bg = await _load_bg(db, content["slug"], "vertical", season, over, content["variant"])
    tmpdir = tempfile.mkdtemp(prefix="ig_show_")
    try:
        render_frame, dur = await asyncio.to_thread(g.make_slideshow_renderer, bg, slides, per_slide)
        n_frames = int(dur * g.REEL_FPS)
        await asyncio.to_thread(_write_frames, render_frame, n_frames, tmpdir)
        del render_frame, bg, slides
        _release_memory()
        return await asyncio.to_thread(_encode_reel, tmpdir, g.REEL_FPS, round(dur, 2))
    finally:
        shutil.rmtree(tmpdir, ignore_errors=True)


def _write_frames(render_frame, n_frames: int, tmpdir: str) -> None:
    for f in range(n_frames):
        Image.fromarray(render_frame(f)).save(os.path.join(tmpdir, f"f{f:04d}.jpg"), quality=94, subsampling=0)


def _release_memory() -> None:
    gc.collect()
    try:
        ctypes.CDLL("libc.so.6").malloc_trim(0)
    except Exception:  # noqa: BLE001
        pass


def _encode_reel(tmpdir: str, fps: int, dur: int) -> bytes:
    """Single-threaded x264 (~135MB peak at 1080×1920) + silent AAC."""
    out = os.path.join(tmpdir, "reel.mp4")
    subprocess.run(
        [imageio_ffmpeg.get_ffmpeg_exe(), "-y", "-loglevel", "error", "-filter_threads", "1",
         "-threads", "1", "-framerate", str(fps), "-i", os.path.join(tmpdir, "f%04d.jpg"),
         "-f", "lavfi", "-t", str(dur), "-i", "anullsrc=r=44100:cl=stereo",
         "-c:v", "libx264", "-preset", "faster", "-crf", "20", "-threads", "1",
         "-x264-params", "rc-lookahead=0:threads=1:bframes=0:ref=1",
         "-pix_fmt", "yuv420p", "-c:a", "aac", "-t", str(dur), "-movflags", "+faststart", out],
        check=True,
    )
    with open(out, "rb") as fh:
        return fh.read()


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
    chat.with_model("anthropic", "claude-sonnet-5-5")
    chat.with_params(max_tokens=2000)
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
    chat.with_model("anthropic", "claude-sonnet-5-5")
    chat.with_params(max_tokens=1500)
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


async def _caption_for(content: dict, now: datetime) -> str:
    hint = content["body_hint"]
    if content.get("plants"):
        hint = f"Sow or plant now in the UK: {', '.join(p['name'] for p in content['plants'])}."
    paragraph = await _write_caption(content["eyebrow"], content["title"], hint)
    return _assemble_caption(paragraph, content.get("tag_slug", content["slug"]), now)


def _pick_sow(now: datetime) -> dict:
    month = MONTHS_UK[now.month - 1]
    return {
        "slug": f"seasonal-{month.lower()}",
        "tag_slug": "what-to-sow",
        "eyebrow": "What to sow",
        "title": f"What to sow in {month}",
        "body_hint": f"The best seeds and plants to sow or plant in UK gardens, pots and balconies in {month}.",
        "link": "patchandpot.app/calendar",
        "variant": "forest",
        "month": month,
    }


def _pick_content(now: datetime, media_format: str | None = None) -> dict:
    """Weekday slot (Mon carousel / Wed feed / Fri reel / Sat what-to-sow).
    Pass media_format (a SLOTS key) to force a slot for admin previews."""
    by_day = {d: k for k, (d, _, _) in SLOTS.items()}
    key = media_format if media_format in SLOTS else by_day.get(now.weekday(), "CAROUSEL")
    _, kind, style = SLOTS[key]
    week_num = int(now.strftime("%W"))
    if kind == "masterclass":
        content = _pick_masterclass(week_num)
    elif kind == "sow":
        content = _pick_sow(now)
    else:
        content = _pick_seasonal(now)
    content["kind"] = kind
    content["style"] = style
    content["slot"] = key
    content["media_format"] = "REEL"
    content["season"] = _season_for_month(now.month)
    return content


async def _sow_plants(db, month_idx: int) -> list[dict]:
    """'Plant now' list from the app's own planting calendar (UK / London)."""
    from core import GuidanceRequest, Region
    from services_guidance import make_generate_and_cache_guidance
    gen = make_generate_and_cache_guidance(db)
    req = GuidanceRequest(region=Region(name="London", country="United Kingdom", latitude=51.5074,
                                        longitude=-0.1278, climate_zone="temperate oceanic",
                                        hemisphere="northern"), month=month_idx, language="en")
    data = await gen(req)
    return [p for p in (data.get("plant_now") or []) if p.get("name")][:6]


_REEL_SEM = asyncio.Semaphore(1)


async def _compose_media(db, content: dict) -> tuple[list[bytes], str]:
    """Every slot publishes as a Reel (Meta only allows library music on
    Reels): Fri = 3-scene Reel, Mon/Sat = slideshow Reels of the carousel
    slides, Wed = 8s card Reel. Returns ([mp4], mime)."""
    args = (db, content["slug"], content["eyebrow"], content["title"])
    style, season = content["style"], content["season"]
    if style in ("reel", "carousel"):
        content["tips"] = await _write_tips(content["title"], content["body_hint"], season, content.get("intro", ""))
    async with _REEL_SEM:  # one heavy render per pod keeps us under the memory limit
        if style == "reel":
            return [await _compose_reel(*args, content["tips"], content["variant"], season)], "video/mp4"
        sq_season = season if content["slug"] in _BG_PROMPT_MASTERCLASS else None
        bg = await _load_bg(db, content["slug"], "square", sq_season, (1080, 1080), content["variant"])
        if style == "sow":
            content["plants"] = await _sow_plants(db, datetime.now(timezone.utc).month)
            slides = await asyncio.to_thread(g.render_sow_carousel, bg, content["month"], content["plants"], season, True)
        elif style == "carousel":
            slides = await asyncio.to_thread(g.render_carousel, bg, content["eyebrow"], content["title"],
                                             content["tips"], season, True)
        else:
            slides = [await asyncio.to_thread(g.render_card, bg, content["eyebrow"], content["title"],
                                              content["body_hint"], season)]
        del bg
        per = 10.0 if style == "card" else 5.0
        return [await _compose_slideshow(db, content, slides, per)], "video/mp4"


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
        if not IG_APP_ID:
            raise HTTPException(503, "INSTAGRAM_APP_ID not configured")
        state = secrets.token_urlsafe(32)
        await db.ig_oauth_state.insert_one({
            "state": state,
            "created_at": datetime.now(timezone.utc),
        })
        q = urlencode({
            "client_id": IG_APP_ID,
            "redirect_uri": META_OAUTH_REDIRECT,
            "response_type": "code",
            "scope": "instagram_business_basic,instagram_business_content_publish",
            "state": state,
            "enable_fb_login": "false",
        })
        return {"url": f"https://www.instagram.com/oauth/authorize?{q}"}

    # ─── OAuth: callback ───────────────────────────────────────────
    @router.get("/oauth/callback", response_class=HTMLResponse)
    async def oauth_callback(state: str = Query(...), code: str | None = Query(None),
                             error_description: str | None = Query(None)):
        back = f"<p><a href='{FRONTEND_URL}/admin/instagram'>Back to admin</a></p>"
        if not code:
            return HTMLResponse(f"<h1>Instagram connection cancelled</h1><p>{error_description or 'No code returned.'}</p>{back}",
                                status_code=400)
        if not await db.ig_oauth_state.find_one_and_delete({"state": state}):
            return HTMLResponse(f"<h1>Link expired</h1><p>Please tap Connect again.</p>{back}", status_code=400)
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.post("https://api.instagram.com/oauth/access_token", data={
                "client_id": IG_APP_ID,
                "client_secret": IG_APP_SECRET,
                "grant_type": "authorization_code",
                "redirect_uri": META_OAUTH_REDIRECT,
                "code": code.removesuffix("#_"),
            })
            short = r.json()
            short = (short.get("data") or [short])[0]
            if "access_token" not in short:
                return HTMLResponse(f"<h1>Token exchange failed</h1><pre>{short}</pre>{back}", status_code=400)
            r = await c.get("https://graph.instagram.com/access_token", params={
                "grant_type": "ig_exchange_token",
                "client_secret": IG_APP_SECRET,
                "access_token": short["access_token"],
            })
            long = r.json()
            if "access_token" not in long:
                return HTMLResponse(f"<h1>Long-lived exchange failed</h1><pre>{long}</pre>{back}", status_code=400)
            r = await c.get(f"{GRAPH}/me", params={"fields": "user_id,username", "access_token": long["access_token"]})
            me = r.json()
        if "user_id" not in me:
            return HTMLResponse(f"<h1>Couldn't read your Instagram account</h1><pre>{me}</pre>{back}", status_code=400)
        now = datetime.now(timezone.utc)
        await db.ig_connection.replace_one({"_id": "default"}, {
            "_id": "default",
            "ig_user_id": str(me["user_id"]),
            "username": me.get("username"),
            "access_token": long["access_token"],
            "token_expires_at": now + timedelta(seconds=int(long.get("expires_in", 5184000))),
            "token_refreshed_at": now,
            "connected_at": now,
        }, upsert=True)
        return RedirectResponse(f"{FRONTEND_URL}/admin/instagram?connected=1")

    # ─── Facebook Login (music only) ───────────────────────────────
    @router.get("/fb/oauth/start")
    async def fb_oauth_start(token: str = Query(...)):
        require_admin(token)
        app_id = os.environ.get("FB_APP_ID")
        if not app_id:
            raise HTTPException(503, "FB_APP_ID not configured")
        state = secrets.token_urlsafe(32)
        await db.ig_oauth_state.insert_one({"state": state, "kind": "fb", "created_at": datetime.now(timezone.utc)})
        params = {"client_id": app_id, "redirect_uri": _fb_redirect(), "state": state, "response_type": "code"}
        config_id = os.environ.get("FB_LOGIN_CONFIG_ID")
        if config_id:
            params["config_id"] = config_id
        else:
            params["scope"] = FB_SCOPES
        return {"url": f"https://www.facebook.com/{META_API}/dialog/oauth?{urlencode(params)}"}

    @router.get("/fb/oauth/callback", response_class=HTMLResponse)
    async def fb_oauth_callback(state: str = Query(...), code: str | None = Query(None),
                                error_description: str | None = Query(None)):
        back = f"<p><a href='{FRONTEND_URL}/admin/instagram'>Back to admin</a></p>"
        if not code:
            return HTMLResponse(f"<h1>Facebook connection cancelled</h1><p>{error_description or ''}</p>{back}", status_code=400)
        if not await db.ig_oauth_state.find_one_and_delete({"state": state, "kind": "fb"}):
            return HTMLResponse(f"<h1>Link expired</h1><p>Please tap Connect again.</p>{back}", status_code=400)
        app_id, secret = os.environ.get("FB_APP_ID", ""), os.environ.get("FB_APP_SECRET", "")
        async with httpx.AsyncClient(timeout=30) as c:
            short = (await c.get(f"{FB_GRAPH}/oauth/access_token", params={
                "client_id": app_id, "client_secret": secret, "redirect_uri": _fb_redirect(), "code": code})).json()
            if "access_token" not in short:
                return HTMLResponse(f"<h1>Token exchange failed</h1><pre>{short}</pre>{back}", status_code=400)
            long = (await c.get(f"{FB_GRAPH}/oauth/access_token", params={
                "grant_type": "fb_exchange_token", "client_id": app_id, "client_secret": secret,
                "fb_exchange_token": short["access_token"]})).json()
            user_token = long.get("access_token", short["access_token"])
            pages = (await c.get(f"{FB_GRAPH}/me/accounts", params={
                "fields": "name,access_token,instagram_business_account{id,username}", "access_token": user_token})).json()
        page = next((p for p in pages.get("data", []) if p.get("instagram_business_account")), None)
        if not page:
            return HTMLResponse(
                "<h1>No Instagram account found</h1><p>None of your Facebook Pages has an Instagram professional "
                f"account linked. Link @patchandpot to your Page, then connect again.</p><pre>{pages}</pre>{back}",
                status_code=400)
        iga = page["instagram_business_account"]
        await db.ig_fb_connection.replace_one({"_id": "default"}, {
            "_id": "default", "page_name": page.get("name"), "page_token": page["access_token"],
            "ig_user_id": iga["id"], "ig_username": iga.get("username"),
            "connected_at": datetime.now(timezone.utc),
        }, upsert=True)
        return RedirectResponse(f"{FRONTEND_URL}/admin/instagram?music=1")

    @router.get("/fb/music-test")
    async def fb_music_test(token: str = Query(...), q: str | None = Query(None)):
        require_admin(token)
        fb = await db.ig_fb_connection.find_one({"_id": "default"})
        if not fb:
            raise HTTPException(400, "Facebook (music) not connected")
        queries = [q] if q else MUSIC_QUERIES
        out = []
        for query in queries:
            try:
                tracks = await _find_tracks(fb, query)
                out.append({"query": query, "tracks": [
                    {"id": t["id"], "title": t.get("title") or t.get("name"),
                     "artist": t.get("display_artist") or t.get("artist"),
                     "preview": t.get("on_platform_audio_preview_link")} for t in tracks[:5]]})
            except HTTPException as e:
                out.append({"query": query, "error": e.detail})
        return {"results": out}

    @router.post("/fb/disconnect")
    async def fb_disconnect(token: str = Query(...)):
        require_admin(token)
        await db.ig_fb_connection.delete_one({"_id": "default"})
        return {"ok": True}

    # ─── Status / posts list ───────────────────────────────────────
    @router.get("/status")
    async def status(token: str = Query(...)):
        require_admin(token)
        conn = await db.ig_connection.find_one({"_id": "default"})
        fb = await db.ig_fb_connection.find_one({"_id": "default"}, {"page_token": 0})
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
            "page_name": f"@{conn.get('username')}" if conn else None,
            "ig_user_id": conn.get("ig_user_id") if conn else None,
            "music_connected": bool(fb),
            "music_page_name": fb.get("page_name") if fb else None,
            "music_configured": bool(os.environ.get("FB_APP_ID")),
            "posts": posts,
        }

    # ─── Preview a post (admin, no publish) ────────────────────────
    async def _build_preview(pid: str, media_format: str | None):
        try:
            now = datetime.now(timezone.utc)
            content = _pick_content(now, media_format)
            items, mime = await _compose_media(db, content)
            caption = await _caption_for(content, now)
            uris = [f"data:{mime};base64," + base64.b64encode(b).decode() for b in items]
            content.pop("intro", None)
            result = {
                "content": content,
                "caption": caption,
                "media_format": content["media_format"],
                "mime": mime,
                "media_b64": uris[0],
                "slides_b64": uris if content["media_format"] == "CAROUSEL" else None,
                "media_bytes": sum(len(b) for b in items),
            }
            await db.ig_previews.update_one({"_id": pid}, {"$set": {"status": "DONE", "result": result}})
        except Exception as e:  # noqa: BLE001
            await db.ig_previews.update_one({"_id": pid}, {"$set": {"status": "ERROR", "error": f"{type(e).__name__}: {e}"}})

    @router.post("/preview")
    async def preview(token: str = Query(...), media_format: str | None = Query(None)):
        """Starts a background preview build (Reels can take a while on small
        pods) — poll GET /preview/{preview_id} for the result."""
        require_admin(token)
        await db.ig_previews.create_index("created_at", expireAfterSeconds=3600)
        pid = secrets.token_hex(8)
        await db.ig_previews.insert_one({"_id": pid, "status": "RUNNING", "created_at": datetime.now(timezone.utc)})
        asyncio.create_task(_build_preview(pid, media_format))
        return {"preview_id": pid, "status": "RUNNING"}

    @router.get("/preview/{pid}")
    async def preview_result(pid: str, token: str = Query(...)):
        require_admin(token)
        row = await db.ig_previews.find_one({"_id": pid}, {"_id": 0, "created_at": 0})
        if not row:
            raise HTTPException(404, "Preview expired — please start a new one.")
        return row

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


# ────────────────────────── music (Facebook Login) ─────────────────────────
def _fb_redirect() -> str:
    return META_OAUTH_REDIRECT.replace("/oauth/callback", "/fb/oauth/callback")


async def _find_tracks(fb: dict, query: str) -> list[dict]:
    """Search Instagram's music library (Audio API, Facebook Login only)."""
    body = await _graph_get("/ig_audio", fb["page_token"], {
        "audio_type": "music", "user_id": fb["ig_user_id"], "search_query": query,
    }, base=FB_GRAPH)
    items = body.get("audio") or body.get("data") or []
    return [{**t, "id": str(t.get("audio_id") or t.get("id"))} for t in items if t.get("audio_id") or t.get("id")]


async def _pick_track(db, fb: dict) -> dict | None:
    """Random folky track that hasn't been used in the last MUSIC_NO_REPEAT
    posts. Queries are shuffled each time; full result lists are pooled."""
    recent = [
        p["music"]["audio_id"]
        async for p in db.ig_posts.find({"music.audio_id": {"$exists": True}}, {"music.audio_id": 1})
        .sort("created_at", -1).limit(MUSIC_NO_REPEAT)
    ]
    queries = random.sample(MUSIC_QUERIES, len(MUSIC_QUERIES))
    fresh: list[tuple[str, dict]] = []
    fallback: list[tuple[str, dict]] = []
    for q in queries:
        try:
            tracks = await _find_tracks(fb, q)
        except HTTPException:
            continue
        for t in tracks:
            (fallback if t["id"] in recent else fresh).append((q, t))
        if len({t["id"] for _, t in fresh}) >= 8:
            break
    pool = fresh or fallback
    if not pool:
        return None
    if not fresh:  # everything used recently → take the least recently used
        pool = sorted(pool, key=lambda qt: recent.index(qt[1]["id"]), reverse=True)[:3]
    q, t = random.choice(pool)
    return {"audio_id": t["id"], "query": q,
            "title": t.get("title") or t.get("name"), "artist": t.get("display_artist") or t.get("artist")}


# ────────────────────────── worker ─────────────────────────
async def _maybe_refresh_token(db, conn: dict) -> dict:
    """Long-lived IG tokens last 60 days; refresh once they're >24h old.
    Runs before every publish (3x/week) so the token never lapses."""
    last = conn.get("token_refreshed_at")
    if last and last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    if last and datetime.now(timezone.utc) - last < timedelta(days=1):
        return conn
    try:
        async with httpx.AsyncClient(timeout=30) as c:
            r = await c.get("https://graph.instagram.com/refresh_access_token", params={
                "grant_type": "ig_refresh_token", "access_token": conn["access_token"],
            })
        data = r.json()
    except Exception:  # noqa: BLE001
        return conn
    if "access_token" not in data:
        return conn
    now = datetime.now(timezone.utc)
    upd = {"access_token": data["access_token"], "token_refreshed_at": now,
           "token_expires_at": now + timedelta(seconds=int(data.get("expires_in", 5184000)))}
    await db.ig_connection.update_one({"_id": "default"}, {"$set": upd})
    return {**conn, **upd}


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
        "slot": content["slot"],
        "manual": manual,
        "created_at": now,
        "status": "COMPOSING",
    }
    await db.ig_posts.insert_one(post_doc)

    try:
        # 1. Compose media + caption
        items, _mime = await _compose_media(db, content)
        caption = await _caption_for(content, now)
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
        if not conn or not conn.get("access_token"):
            await db.ig_posts.update_one({"run_id": run_id}, {"$set": {
                "status": "ERROR", "error": "Instagram not connected"}})
            return
        conn = await _maybe_refresh_token(db, conn)
        api, api_token, ig_id = GRAPH, conn["access_token"], conn["ig_user_id"]
        music = None
        if is_reel:
            fb = await db.ig_fb_connection.find_one({"_id": "default"})
            if fb:
                music = await _pick_track(db, fb)
                if music:
                    api, api_token, ig_id = FB_GRAPH, fb["page_token"], fb["ig_user_id"]
                    await db.ig_posts.update_one({"run_id": run_id}, {"$set": {"music": music}})

        # 3. Create media container (carousel: one child per slide, then parent)
        if fmt == "CAROUSEL":
            child_ids = []
            for url in slide_urls:
                child = await _graph_post(f"/{ig_id}/media", api_token,
                                          {"image_url": url, "is_carousel_item": "true"}, base=api)
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
            if music:
                container_params["audio_configuration"] = json.dumps(
                    {"audio_id": music["audio_id"], "audio_volume": 100, "video_volume": 0})
        else:
            container_params = {"image_url": media_url, "caption": caption}
        try:
            container = await _graph_post(f"/{ig_id}/media", api_token, container_params, base=api)
        except HTTPException as e:
            if not music:
                raise
            # Music path failed — post silently via Instagram Login instead.
            await db.ig_posts.update_one({"run_id": run_id}, {"$set": {"music_error": str(e.detail)}})
            container_params.pop("audio_configuration", None)
            api, api_token, ig_id, music = GRAPH, conn["access_token"], conn["ig_user_id"], None
            container = await _graph_post(f"/{ig_id}/media", api_token, container_params, base=api)
        cid = container.get("id")
        await db.ig_posts.update_one({"run_id": run_id}, {"$set": {
            "container_id": cid, "status": "CONTAINER_CREATED"}})

        # 4. Poll container until FINISHED (max ~90s for feed, ~5min for reels)
        poll_max = 100 if is_reel else 30
        for _ in range(poll_max):
            await asyncio.sleep(3)
            s = await _graph_get(f"/{cid}", api_token, {"fields": "status_code,status"}, base=api)
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
        result = await _graph_post(f"/{ig_id}/media_publish", api_token, {"creation_id": cid}, base=api)
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
