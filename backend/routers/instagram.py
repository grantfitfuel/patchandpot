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
    ("masterclass", "FEED"),   # Monday — static masterclass teaser
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
    "propagation":      "glass jars with pothos cuttings rooting in water on a bright windowsill, soft morning light, tiny white root wisps visible, a terracotta pot of fresh compost beside",
    "pest-control":     "ladybirds on sunlit nasturtium leaves and companion marigolds beside a cabbage, hover-fly in the air, a wildlife-friendly kitchen garden",
    "no-dig":           "a hand lifting dark crumbly compost over a mulched vegetable bed, lettuces and beetroot foliage in rows, no visible soil disturbance",
    "weather":          "rain softly beading on broad kale leaves after a shower, pale sky breaking through cloud, raised beds glistening",
    "flower-arranging": "a stoneware vase on a weathered wooden bench holding freshly-cut dahlias, cosmos and sweet peas, a pair of snips and twine beside",
}
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


async def _get_or_generate_bg(db, slug: str, orientation: str) -> bytes | None:
    """Return cached (or freshly-generated) painterly watercolour bytes
    for a given content slug + orientation. Returns None if the LLM key
    is missing or generation fails — caller falls back to flat palette."""
    cache = await db.ig_bg_watercolours.find_one({
        "slug": slug, "orientation": orientation, "v": _BG_RENDER_VERSION,
    }, {"_id": 0, "png": 1})
    if cache and cache.get("png"):
        return cache["png"]

    key = os.environ.get("EMERGENT_LLM_KEY", "")
    if not key:
        return None

    # Resolve the scene prompt from the slug.
    if slug in _BG_PROMPT_MASTERCLASS:
        scene = _BG_PROMPT_MASTERCLASS[slug]
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
            LlmChat(api_key=key, session_id=f"ig-bg-{slug}-{orientation}",
                    system_message="You are an image generation assistant.")
            .with_model("gemini", "gemini-3.1-flash-image-preview")
            .with_params(modalities=["image", "text"])
        )
        _text, images = await asyncio.wait_for(
            chat.send_message_multimodal_response(UserMessage(text=prompt)),
            timeout=60,
        )
    except Exception:  # noqa: BLE001
        return None
    if not images:
        return None
    try:
        png = base64.b64decode(images[0]["data"])
    except Exception:  # noqa: BLE001
        return None
    await db.ig_bg_watercolours.update_one(
        {"slug": slug, "orientation": orientation, "v": _BG_RENDER_VERSION},
        {"$set": {"slug": slug, "orientation": orientation, "v": _BG_RENDER_VERSION,
                  "png": png, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    return png


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


async def _compose_card(db, slug: str, eyebrow: str, title: str, body: str, variant: str = "forest") -> bytes:
    """Compose a 1080×1080 square JPEG, laying a translucent warm panel
    over a Nano-Banana watercolour background. Falls back to the brand
    flat-colour aesthetic if the watercolour can't be generated."""
    size = 1080
    bg_bytes = await _get_or_generate_bg(db, slug, "square")
    if bg_bytes:
        try:
            img = Image.open(io.BytesIO(bg_bytes)).convert("RGB")
            # Nano Banana usually returns a close-to-square image. Force 1080².
            img = img.resize((size, size), Image.LANCZOS)
        except Exception:
            img = None
    else:
        img = None

    if img is None:
        # Fallback — original flat palette with dot texture.
        bg = PALETTE[variant]
        img = Image.new("RGB", (size, size), bg)
        d = ImageDraw.Draw(img)
        dot = PALETTE["sand"] if variant != "sand" else PALETTE["forest"]
        for y in range(0, size, 28):
            for x in range(0, size, 28):
                d.ellipse([(x, y), (x + 2, y + 2)], fill=dot)

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

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=88, optimize=True)
    return buf.getvalue()


async def _compose_reel(db, slug: str, eyebrow: str, title: str, body: str, variant: str = "forest") -> bytes:
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
    bg_bytes = await _get_or_generate_bg(db, slug, "vertical")
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


def _pick_content(now: datetime) -> dict:
    """Rotate by weekday within Mon/Wed/Fri. Returns a dict including
    both the content kind and the Instagram media format (FEED/REEL)."""
    weekday = now.weekday()  # Mon=0, Wed=2, Fri=4
    idx = {0: 0, 2: 1, 4: 2}.get(weekday, 0)
    week_num = int(now.strftime("%W"))
    kind, media_format = ROTATION[idx]
    content = _pick_masterclass(week_num) if kind == "masterclass" else _pick_seasonal(now)
    content["media_format"] = media_format
    return content


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
        posts_cur = db.ig_posts.find({}, {"image_b64": 0}).sort("created_at", -1).limit(20)
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
    async def preview(token: str = Query(...)):
        require_admin(token)
        now = datetime.now(timezone.utc)
        content = _pick_content(now)
        paragraph = await _write_caption(content["eyebrow"], content["title"], content["body_hint"])
        caption = _assemble_caption(paragraph, content["slug"], now)
        is_reel = content["media_format"] == "REEL"
        if is_reel:
            media_bytes = await _compose_reel(
                db, content["slug"], content["eyebrow"], content["title"],
                content["body_hint"], content["variant"],
            )
            mime = "video/mp4"
            media_b64 = "data:video/mp4;base64," + base64.b64encode(media_bytes).decode()
        else:
            media_bytes = await _compose_card(
                db, content["slug"], content["eyebrow"], content["title"],
                content["body_hint"], content["variant"],
            )
            mime = "image/jpeg"
            media_b64 = "data:image/jpeg;base64," + base64.b64encode(media_bytes).decode()
        return {
            "content": content,
            "caption": caption,
            "media_format": content["media_format"],
            "mime": mime,
            "media_b64": media_b64,
            "media_bytes": len(media_bytes),
            # Legacy fields the old UI used — alias to new values.
            "image_b64": media_b64 if not is_reel else None,
            "image_bytes": len(media_bytes),
        }

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
    async def publish_now(token: str = Query(...)):
        require_admin(token)
        run_id = secrets.token_hex(8)
        asyncio.create_task(_run_post(db, run_id, manual=True))
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
async def _run_post(db, run_id: str, manual: bool = False) -> None:
    """Full publish flow — writes a row to `ig_posts` with every state
    transition so the admin page can show progress. Handles both FEED
    (static JPEG) and REEL (MP4) posts."""
    now = datetime.now(timezone.utc)
    content = _pick_content(now)
    public_id = secrets.token_urlsafe(24)
    is_reel = content["media_format"] == "REEL"
    post_doc = {
        "run_id": run_id,
        "public_id": public_id,
        "kind": content["slug"],
        "eyebrow": content["eyebrow"],
        "title": content["title"],
        "variant": content["variant"],
        "media_format": content["media_format"],
        "manual": manual,
        "created_at": now,
        "status": "COMPOSING",
    }
    await db.ig_posts.insert_one(post_doc)

    try:
        # 1. Compose media + caption (compose off the event loop)
        paragraph = await _write_caption(content["eyebrow"], content["title"], content["body_hint"])
        caption = _assemble_caption(paragraph, content["slug"], now)
        if is_reel:
            mp4 = await _compose_reel(
                db, content["slug"], content["eyebrow"], content["title"],
                content["body_hint"], content["variant"],
            )
            media_url = f"{PUBLIC_API_BASE}/api/public-video/{public_id}"
            await db.ig_posts.update_one({"run_id": run_id}, {"$set": {
                "video_b64": base64.b64encode(mp4).decode(),
                "video_bytes": len(mp4),
                "caption": caption,
                "video_url": media_url,
                "status": "READY",
            }})
        else:
            jpeg = await _compose_card(
                db, content["slug"], content["eyebrow"], content["title"],
                content["body_hint"], content["variant"],
            )
            media_url = f"{PUBLIC_API_BASE}/api/public-image/{public_id}"
            await db.ig_posts.update_one({"run_id": run_id}, {"$set": {
                "image_b64": base64.b64encode(jpeg).decode(),
                "caption": caption,
                "image_url": media_url,
                "status": "READY",
            }})

        # 2. Load Instagram connection
        conn = await db.ig_connection.find_one({"_id": "default"})
        if not conn:
            await db.ig_posts.update_one({"run_id": run_id}, {"$set": {
                "status": "ERROR", "error": "Instagram not connected"}})
            return

        # 3. Create media container
        if is_reel:
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
