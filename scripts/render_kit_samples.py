"""One-off sample renderer: produces three different "Social Media Kit"
aesthetic options as 1080×1080 PNGs for side-by-side user comparison.

Run with:
    cd /app/backend && python ../scripts/render_kit_samples.py

Outputs to /tmp/sample_kit_option_{A,B,C}.png.

Option A: Bolder typography on solid forest background
Option B: AI-painted watercolour hero (Gemini Nano Banana)
Option C: Stock-photo overlay (uses a curated CC0 image URL)

This script is NOT wired into any endpoint — it's just a render
harness for the design decision. Once the user picks an option, we'll
extend that single approach to all four aspect ratios and integrate
into share_social_kit.py.
"""
import asyncio
import base64
import io
import os
import sys
from pathlib import Path

import requests

sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter  # noqa: E402

from share_og import (  # noqa: E402
    FOREST, INK, MOSS, SAND, SURFACE, TERRACOTTA, _draw_botanical, _font,
)

PATCH_NAME = "Sunny Window Patch"
REGION = "London, United Kingdom"
PLANT_COUNT = 7
OUT = Path("/tmp")
SIZE = 1080


# ────────────────────────── OPTION A: BOLD TYPE ──────────────────────────
def render_option_a() -> Path:
    """Saturated forest background + huge sand display word + terracotta
    accent block + small wordmark. Inspired by Apartamento magazine
    covers — confident, editorial, scroll-stopping."""
    img = Image.new("RGB", (SIZE, SIZE), FOREST)
    draw = ImageDraw.Draw(img)

    # Terracotta diagonal corner block (top-right) for graphic energy
    corner = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    cdraw = ImageDraw.Draw(corner)
    cdraw.polygon([(SIZE, 0), (SIZE, 360), (SIZE - 360, 0)], fill=TERRACOTTA + (255,))
    img.paste(corner, (0, 0), corner)

    # Sand dot grid background pattern (very subtle)
    pattern = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    pdraw = ImageDraw.Draw(pattern)
    for x in range(60, SIZE, 60):
        for y in range(60, SIZE, 60):
            pdraw.ellipse([x - 2, y - 2, x + 2, y + 2], fill=SAND + (40,))
    img.paste(pattern, (0, 0), pattern)

    # Top-left wordmark (sand)
    wm = _font("sans-bold", 32)
    draw.text((70, 70), "PATCH & POT", fill=SAND, font=wm)
    draw.line([(70, 120), (260, 120)], fill=SAND, width=3)

    # Eyebrow
    eyebrow = _font("sans-regular", 28)
    draw.text((70, 160), "GROWING IN", fill=SAND, font=eyebrow)
    draw.text((70, 198), REGION.upper(), fill=SAND, font=_font("sans-bold", 30))

    # HERO: massive sand display word
    # Use the patch name in giant italic serif
    hero_size = 220
    hero_font = _font("serif-italic-bold", hero_size)
    while draw.textlength(PATCH_NAME, font=hero_font) > SIZE - 140 and hero_size > 100:
        hero_size -= 8
        hero_font = _font("serif-italic-bold", hero_size)
    # If still too wide, split into two lines
    if draw.textlength(PATCH_NAME, font=hero_font) > SIZE - 140:
        words = PATCH_NAME.split()
        mid = len(words) // 2
        line1 = " ".join(words[:mid])
        line2 = " ".join(words[mid:])
        draw.text((70, 380), line1, fill=SAND, font=hero_font)
        draw.text((70, 380 + hero_size + 10), line2, fill=SAND, font=hero_font)
    else:
        draw.text((70, 450), PATCH_NAME, fill=SAND, font=hero_font)

    # Big terracotta rule under the hero
    draw.rectangle([70, 720, 70 + 200, 730], fill=TERRACOTTA)

    # Plant count meta
    meta = _font("serif-italic", 40)
    draw.text((70, 770),
              f"{PLANT_COUNT} plants, one month at a time",
              fill=SAND, font=meta)

    # Footer URL + CTA
    url_font = _font("sans-regular", 26)
    draw.text((70, SIZE - 100), "patchandpot.app", fill=SAND, font=url_font)
    cta_font = _font("sans-bold", 26)
    cta = "OPEN  →"
    cta_w = draw.textlength(cta, font=cta_font)
    draw.text((SIZE - 70 - cta_w, SIZE - 100), cta, fill=TERRACOTTA, font=cta_font)

    out = OUT / "sample_kit_option_A.png"
    img.save(out, format="PNG", optimize=True)
    return out


# ────────────────────────── OPTION B: AI WATERCOLOUR ──────────────────────────
async def render_option_b() -> Path:
    """Gemini Nano Banana generates a painterly watercolour of the patch.
    We composite text over a dark gradient panel at the bottom so type
    stays legible regardless of the illustration's tonal range."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage

    prompt = (
        "Loose, soft watercolour illustration of a sunny London windowsill "
        "kitchen garden in late morning light. Terracotta clay pots holding "
        "tomato plants with red fruit, fresh basil, lettuce, kale, mint, "
        "thyme, rosemary. Painterly brush strokes, warm light, slightly "
        "dappled. Hand-painted look on textured cream paper. No text, no "
        "logos, no people. Square composition with breathing room at the "
        "bottom for text overlay. Editorial gardening magazine style, "
        "calm and inviting."
    )
    chat = LlmChat(
        api_key=os.environ["EMERGENT_LLM_KEY"],
        session_id="kit-sample-watercolour",
        system_message="You are an image generation assistant.",
    ).with_model("gemini", "gemini-3.1-flash-image-preview").with_params(modalities=["image", "text"])

    _text, images = await chat.send_message_multimodal_response(UserMessage(text=prompt))
    if not images:
        raise RuntimeError("Gemini returned no image")
    img_data = base64.b64decode(images[0]["data"])
    bg = Image.open(io.BytesIO(img_data)).convert("RGB")
    # Force-resize/crop to square 1080
    bg = _crop_square(bg).resize((SIZE, SIZE), Image.LANCZOS)

    # Subtle warm filter so it blends with our palette
    bg = ImageEnhance.Color(bg).enhance(1.05)

    # Dark gradient panel at the bottom (40% of canvas) for text legibility
    overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    panel_top = int(SIZE * 0.55)
    for y in range(panel_top, SIZE):
        # Smooth ramp from transparent at panel_top to ~88% black at bottom
        t = (y - panel_top) / (SIZE - panel_top)
        alpha = int(225 * (t ** 0.85))
        odraw.line([(0, y), (SIZE, y)], fill=(20, 30, 18, alpha))
    bg = Image.alpha_composite(bg.convert("RGBA"), overlay).convert("RGB")

    # Compose text
    draw = ImageDraw.Draw(bg)
    # Wordmark — top-left, semi-translucent panel behind so it survives any background
    wm_bg = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    wbdraw = ImageDraw.Draw(wm_bg)
    wbdraw.rounded_rectangle([40, 40, 320, 110], radius=8, fill=(20, 30, 18, 200))
    bg = Image.alpha_composite(bg.convert("RGBA"), wm_bg).convert("RGB")
    draw = ImageDraw.Draw(bg)
    draw.text((70, 60), "PATCH & POT", fill=SAND, font=_font("sans-bold", 28))
    draw.line([(70, 100), (220, 100)], fill=TERRACOTTA, width=3)

    # HERO text in the bottom panel
    eyebrow = _font("sans-regular", 26)
    draw.text((70, panel_top + 60), "GROWING IN " + REGION.upper(),
              fill=(255, 240, 220), font=eyebrow)

    hero_size = 110
    hero_font = _font("serif-italic-bold", hero_size)
    while draw.textlength(PATCH_NAME, font=hero_font) > SIZE - 140 and hero_size > 50:
        hero_size -= 6
        hero_font = _font("serif-italic-bold", hero_size)
    draw.text((70, panel_top + 110), PATCH_NAME, fill=(255, 250, 240), font=hero_font)

    draw.rectangle([70, panel_top + 110 + hero_size + 8,
                    70 + 120, panel_top + 110 + hero_size + 14],
                   fill=TERRACOTTA)

    meta = _font("serif-italic", 30)
    draw.text((70, panel_top + 110 + hero_size + 30),
              f"{PLANT_COUNT} plants, one month at a time",
              fill=(255, 250, 240), font=meta)

    url_font = _font("sans-regular", 22)
    draw.text((70, SIZE - 60), "patchandpot.app", fill=(255, 240, 220), font=url_font)
    cta_font = _font("sans-bold", 22)
    cta = "OPEN  →"
    cta_w = draw.textlength(cta, font=cta_font)
    draw.text((SIZE - 70 - cta_w, SIZE - 60), cta, fill=TERRACOTTA, font=cta_font)

    out = OUT / "sample_kit_option_B.png"
    bg.save(out, format="PNG", optimize=True)
    return out


# ────────────────────────── OPTION C: STOCK PHOTO ──────────────────────────
def render_option_c() -> Path:
    """Curated CC0 stock photo + dark gradient overlay + bold type.
    Uses a known Unsplash CC0 URL for this sample; the real
    implementation would have a small categorised library."""
    # Curated CC0 source — "kitchen herbs on windowsill" by Markus Spiske
    # via Unsplash (CC0 — free for commercial use, no attribution required)
    stock_url = "https://images.unsplash.com/photo-1466692476868-aef1dfb1e735?w=1600&q=80"
    r = requests.get(stock_url, timeout=30)
    r.raise_for_status()
    bg = Image.open(io.BytesIO(r.content)).convert("RGB")
    bg = _crop_square(bg).resize((SIZE, SIZE), Image.LANCZOS)

    # Slight blur + colour-warm to feel less "stock-photo-y"
    bg = bg.filter(ImageFilter.GaussianBlur(radius=1.5))
    bg = ImageEnhance.Color(bg).enhance(0.85)

    # Strong dark gradient from bottom up — text needs to read
    overlay = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    odraw = ImageDraw.Draw(overlay)
    for y in range(SIZE):
        # Top: light tint for wordmark; bottom: heavy black for text
        if y < 200:
            alpha = int(80 * (1 - y / 200))
        else:
            t = max(0, (y - 200) / (SIZE - 200))
            alpha = int(220 * (t ** 1.1))
        odraw.line([(0, y), (SIZE, y)], fill=(15, 20, 12, alpha))
    bg = Image.alpha_composite(bg.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(bg)

    # Top: wordmark + terracotta rule (over the lighter top overlay)
    draw.text((70, 60), "PATCH & POT", fill=SAND, font=_font("sans-bold", 30))
    draw.line([(70, 105), (235, 105)], fill=TERRACOTTA, width=3)

    # Bottom: hero text
    eyebrow = _font("sans-regular", 26)
    draw.text((70, SIZE - 380), "GROWING IN " + REGION.upper(),
              fill=(255, 240, 220), font=eyebrow)

    hero_size = 110
    hero_font = _font("serif-italic-bold", hero_size)
    while draw.textlength(PATCH_NAME, font=hero_font) > SIZE - 140 and hero_size > 50:
        hero_size -= 6
        hero_font = _font("serif-italic-bold", hero_size)
    draw.text((70, SIZE - 330), PATCH_NAME, fill=(255, 250, 240), font=hero_font)

    draw.rectangle([70, SIZE - 330 + hero_size + 8,
                    70 + 120, SIZE - 330 + hero_size + 14],
                   fill=TERRACOTTA)

    meta = _font("serif-italic", 30)
    draw.text((70, SIZE - 330 + hero_size + 30),
              f"{PLANT_COUNT} plants, one month at a time",
              fill=(255, 250, 240), font=meta)

    url_font = _font("sans-regular", 22)
    draw.text((70, SIZE - 60), "patchandpot.app", fill=(255, 240, 220), font=url_font)
    cta_font = _font("sans-bold", 22)
    cta = "OPEN  →"
    cta_w = draw.textlength(cta, font=cta_font)
    draw.text((SIZE - 70 - cta_w, SIZE - 60), cta, fill=TERRACOTTA, font=cta_font)

    out = OUT / "sample_kit_option_C.png"
    bg.save(out, format="PNG", optimize=True)
    return out


# ────────────────────────── helpers ──────────────────────────
def _crop_square(img: Image.Image) -> Image.Image:
    w, h = img.size
    if w == h:
        return img
    side = min(w, h)
    left = (w - side) // 2
    top = (h - side) // 2
    return img.crop((left, top, left + side, top + side))


async def main():
    print("Rendering OPTION A (bold type) …")
    a = render_option_a()
    print(f"  → {a} ({a.stat().st_size // 1024} KB)")

    print("Rendering OPTION B (AI watercolour) …")
    try:
        b = await render_option_b()
        print(f"  → {b} ({b.stat().st_size // 1024} KB)")
    except Exception as e:  # noqa: BLE001
        print(f"  ❌ B failed: {e!r}")

    print("Rendering OPTION C (stock photo) …")
    try:
        c = render_option_c()
        print(f"  → {c} ({c.stat().st_size // 1024} KB)")
    except Exception as e:  # noqa: BLE001
        print(f"  ❌ C failed: {e!r}")


if __name__ == "__main__":
    asyncio.run(main())
