"""Server-side composition of the 1200×630 OG share card for /p/{share_id}.

We render this with Pillow only — no AI image generation, no SVG rasterising.
A hand-composed letterpress-style card is fast (<50ms), free (no LLM spend),
and looks polished against the brand palette without depending on Nano Banana
budget. If we ever want richer per-patch backdrops we can layer an AI image
behind this composition without changing callers.

Public entry point: `render_share_og_png(patch_name, region_name, plant_count)`
returns the PNG bytes. `share.py` caches those bytes per `share_id`.
"""
from __future__ import annotations

import io
import math
import textwrap
from functools import lru_cache

from PIL import Image, ImageDraw, ImageFont

# ───────────────────────── Brand palette ─────────────────────────
SAND       = (247, 245, 240)  # background
SURFACE    = (239, 236, 229)  # subtle off-cream for the inner card
FOREST     = (45, 74, 34)
MOSS       = (92, 107, 82)
TERRACOTTA = (198, 93, 71)
INK        = (28, 35, 26)

WIDTH  = 1200
HEIGHT = 630
PADDING = 80


# Resolve fonts once at import — falling back gracefully if the preferred
# face is missing. We want a real serif italic for the patch name and a
# clean upright sans (well, serif) for the wordmark + meta line.
def _font_path(*candidates: str) -> str:
    import os
    for path in candidates:
        if os.path.exists(path):
            return path
    return ""


@lru_cache(maxsize=8)
def _font(weight: str, size: int) -> ImageFont.FreeTypeFont:
    """weight ∈ {'italic', 'bold', 'regular', 'serif-italic-bold'}."""
    mapping = {
        "serif-italic-bold": _font_path(
            "/usr/share/fonts/truetype/freefont/FreeSerifBoldItalic.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSerif-BoldItalic.ttf",
        ),
        "serif-italic": _font_path(
            "/usr/share/fonts/truetype/freefont/FreeSerifItalic.ttf",
            "/usr/share/fonts/truetype/liberation/LiberationSerif-Italic.ttf",
        ),
        "serif-bold": _font_path(
            "/usr/share/fonts/truetype/liberation/LiberationSerif-Bold.ttf",
            "/usr/share/fonts/truetype/freefont/FreeSerifBold.ttf",
        ),
        "sans-bold": _font_path(
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        ),
        "sans-regular": _font_path(
            "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ),
    }
    path = mapping.get(weight, "")
    if not path:
        return ImageFont.load_default()
    return ImageFont.truetype(path, size)


def _wrap_to_width(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    """Greedy word-wrap to fit within max_width pixels."""
    words = text.split()
    if not words:
        return [text]
    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        candidate = current + " " + word
        if draw.textlength(candidate, font=font) <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def _draw_botanical(draw: ImageDraw.ImageDraw, cx: float, cy: float, scale: float):
    """A small line-art sprig in the brand terracotta — drawn off the right
    side as a decorative motif. Deliberately minimal so it never competes
    with the typography for attention."""
    # Stem
    stem_top    = (cx, cy - 110 * scale)
    stem_bottom = (cx, cy + 110 * scale)
    draw.line([stem_top, stem_bottom], fill=TERRACOTTA, width=max(2, int(2 * scale)))

    # Leaves — alternating ellipses around the stem. We draw rotated leaves
    # by rendering each one in a small RGBA canvas, rotating, and pasting.
    leaf_w = int(70 * scale)
    leaf_h = int(28 * scale)
    leaves = [
        (cy - 80 * scale,  25),
        (cy - 40 * scale, -25),
        (cy,               25),
        (cy + 40 * scale, -25),
        (cy + 80 * scale,  25),
    ]
    img = draw._image  # the underlying PIL image — pasting requires it
    for y, angle in leaves:
        leaf = Image.new("RGBA", (leaf_w + 8, leaf_h + 8), (0, 0, 0, 0))
        ld = ImageDraw.Draw(leaf)
        ld.ellipse(
            [4, 4, leaf_w + 4, leaf_h + 4],
            outline=TERRACOTTA, width=max(2, int(2 * scale)),
        )
        # Centre vein
        ld.line([(4, leaf_h / 2 + 4), (leaf_w + 4, leaf_h / 2 + 4)], fill=TERRACOTTA, width=1)
        rotated = leaf.rotate(angle, resample=Image.BICUBIC, expand=True)
        # Offset so the rotated leaf's base sits on the stem
        offset_x = int(cx) - rotated.size[0] // 2
        if angle > 0:
            offset_x += int(leaf_w * 0.35)
        else:
            offset_x -= int(leaf_w * 0.35)
        offset_y = int(y) - rotated.size[1] // 2
        img.paste(rotated, (offset_x, offset_y), rotated)


def render_share_og_png(patch_name: str, region_name: str, plant_count: int) -> bytes:
    """Compose the 1200×630 OG card and return PNG bytes."""
    img = Image.new("RGB", (WIDTH, HEIGHT), SAND)
    draw = ImageDraw.Draw(img)

    # Inner surface block — leaves a thin sand border so the card feels
    # framed even when an aggressive social-card cropper trims edges.
    inset = 32
    draw.rectangle(
        [inset, inset, WIDTH - inset, HEIGHT - inset],
        fill=SURFACE, outline=None,
    )

    # Top-left wordmark
    wordmark_font = _font("sans-bold", 22)
    draw.text(
        (PADDING, PADDING),
        "PATCH & POT",
        fill=MOSS,
        font=wordmark_font,
        spacing=4,
    )
    # Slim divider under wordmark
    draw.line(
        [(PADDING, PADDING + 38), (PADDING + 120, PADDING + 38)],
        fill=TERRACOTTA, width=2,
    )

    # Eyebrow above the patch name
    eyebrow_font = _font("sans-regular", 22)
    eyebrow = "A SHARED GARDEN"
    draw.text(
        (PADDING, PADDING + 90),
        eyebrow,
        fill=MOSS,
        font=eyebrow_font,
    )

    # ─────────── Patch name (big serif italic, wrapped) ───────────
    # Fit-to-box: shrink until it wraps in ≤ 2 lines within the text column.
    text_col_width = WIDTH - PADDING * 2 - 280  # leave room for botanical motif on right
    name_size = 110
    while name_size >= 56:
        name_font = _font("serif-italic-bold", name_size)
        lines = _wrap_to_width(draw, patch_name, name_font, text_col_width)
        if len(lines) <= 2:
            break
        name_size -= 8
    else:
        # Truncate the second line with an ellipsis as a last resort.
        name_font = _font("serif-italic-bold", 56)
        lines = _wrap_to_width(draw, patch_name, name_font, text_col_width)[:2]
        if len(lines) == 2 and draw.textlength(lines[1] + "…", font=name_font) > text_col_width:
            while lines[1] and draw.textlength(lines[1] + "…", font=name_font) > text_col_width:
                lines[1] = lines[1][:-1]
            lines[1] = (lines[1] + "…").strip()

    name_y = PADDING + 150
    line_height = int(name_size * 1.08)
    for i, line in enumerate(lines):
        draw.text((PADDING, name_y + i * line_height), line, fill=FOREST, font=name_font)

    # Terracotta accent rule under the name block
    rule_y = name_y + len(lines) * line_height + 12
    draw.rectangle(
        [PADDING, rule_y, PADDING + 60, rule_y + 4],
        fill=TERRACOTTA,
    )

    # Region line — moss, sans
    region_font = _font("serif-italic", 36)
    region_text = f"Growing in {region_name}" if region_name else "Growing somewhere lovely"
    draw.text(
        (PADDING, rule_y + 30),
        region_text,
        fill=INK,
        font=region_font,
    )

    # Plant count line
    count_font = _font("sans-regular", 24)
    plant_label = "plant" if plant_count == 1 else "plants"
    count_text = f"{plant_count} {plant_label} tracked  ·  monthly seasonal guide"
    draw.text(
        (PADDING, rule_y + 80),
        count_text,
        fill=MOSS,
        font=count_font,
    )

    # Footer URL (bottom-left)
    url_font = _font("sans-regular", 22)
    draw.text(
        (PADDING, HEIGHT - PADDING - 20),
        "patchandpot.app",
        fill=MOSS,
        font=url_font,
    )

    # Bottom-right CTA tag
    cta_font = _font("sans-bold", 22)
    cta = "OPEN THE GARDEN  →"
    cta_w = draw.textlength(cta, font=cta_font)
    draw.text(
        (WIDTH - PADDING - cta_w, HEIGHT - PADDING - 20),
        cta,
        fill=TERRACOTTA,
        font=cta_font,
    )

    # Decorative botanical sprig on the right
    _draw_botanical(draw, cx=WIDTH - PADDING - 90, cy=HEIGHT / 2, scale=1.4)

    # Hairline border around the surface block — adds the letterpress feel
    draw.rectangle(
        [inset, inset, WIDTH - inset, HEIGHT - inset],
        outline=(45, 74, 34, 80), width=1,
    )

    # PNG encode (optimize=True is slow; small image, optimisation worth it
    # once because we cache the result).
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()
