"""Social Media Kit — render the same letterpress patch teaser in four
aspect ratios and ship them as a single ZIP alongside platform-tuned
captions.

Aspect ratios (all 1080-wide minimum so they survive Instagram/TikTok
re-compression):

    instagram_square  1080×1080   1:1   feed posts
    instagram_portrait 1080×1350  4:5   feed posts (taller, more screen)
    reels_story        1080×1920  9:16  Reels / TikTok / Stories / YouTube Shorts
    youtube_twitter    1920×1080  16:9  YouTube cover / Twitter card

Why a fresh renderer instead of reusing `share_og._compose_card`?
The OG composition is tuned to a single landscape ratio with a botanical
motif anchored right. A 9:16 phone-screen shape needs an *entirely*
different vertical hierarchy (eyebrow up top, hero in the middle, CTA
at the thumb-friendly bottom) and an upscaled motif so it stays
visible on a 4-inch preview. Forking the layout is cheaper than
adding 4 layout-mode branches to the existing function.

Public entry points:
    render_kit_images(patch_name, region_name, plant_count) → dict[str, bytes]
        Returns 4 PNGs keyed by friendly filename stem.
    build_kit_zip(patch_name, region_name, plant_count, captions) → bytes
        Wraps the PNGs + a captions.txt into a ZIP archive.
"""
from __future__ import annotations

import io
import zipfile
from dataclasses import dataclass
from typing import Dict

from PIL import Image, ImageDraw, ImageFont

from share_og import (  # reuse palette + font helpers for visual consistency
    FOREST,
    INK,
    MOSS,
    SAND,
    SURFACE,
    TERRACOTTA,
    _draw_botanical,
    _font,
    _wrap_to_width,
)


@dataclass(frozen=True)
class _Layout:
    """Per-aspect-ratio sizing knobs. Kept as a frozen dataclass so each
    aspect ratio's tuning lives in one obvious place — easier to tweak
    than a sprawling if/elif on `aspect_key`."""
    key: str
    width: int
    height: int
    padding: int
    title_size_max: int
    title_size_min: int
    sub1_size: int
    sub2_size: int
    eyebrow_size: int
    motif_position: str   # 'right' | 'top' | 'bottom'
    motif_scale: float


_LAYOUTS = (
    _Layout(
        key="instagram_square",
        width=1080, height=1080, padding=80,
        title_size_max=140, title_size_min=70,
        sub1_size=42, sub2_size=28, eyebrow_size=26,
        motif_position="right", motif_scale=1.8,
    ),
    _Layout(
        key="instagram_portrait",
        width=1080, height=1350, padding=90,
        title_size_max=160, title_size_min=80,
        sub1_size=46, sub2_size=30, eyebrow_size=28,
        motif_position="bottom", motif_scale=2.0,
    ),
    _Layout(
        key="reels_story",
        width=1080, height=1920, padding=100,
        title_size_max=180, title_size_min=90,
        sub1_size=52, sub2_size=34, eyebrow_size=32,
        motif_position="bottom", motif_scale=2.6,
    ),
    _Layout(
        key="youtube_twitter",
        width=1920, height=1080, padding=120,
        title_size_max=160, title_size_min=80,
        sub1_size=46, sub2_size=30, eyebrow_size=26,
        motif_position="right", motif_scale=2.0,
    ),
)


def _compose(layout: _Layout, *, eyebrow: str, title: str, sub1: str, sub2: str, cta: str) -> bytes:
    """Render one teaser image for the given layout. Mirrors the OG card's
    letterpress aesthetic — sand background, inner surface card, wordmark
    + terracotta accent rule + serif-italic title + meta lines + CTA."""
    img = Image.new("RGB", (layout.width, layout.height), SAND)
    draw = ImageDraw.Draw(img)

    inset = max(28, layout.padding // 3)
    draw.rectangle(
        [inset, inset, layout.width - inset, layout.height - inset],
        fill=SURFACE, outline=None,
    )

    # Wordmark (top-left)
    wordmark_font = _font("sans-bold", max(22, int(layout.padding * 0.28)))
    draw.text(
        (layout.padding, layout.padding),
        "PATCH & POT", fill=MOSS, font=wordmark_font, spacing=4,
    )
    draw.line(
        [(layout.padding, layout.padding + int(wordmark_font.size * 1.6)),
         (layout.padding + int(wordmark_font.size * 5.4), layout.padding + int(wordmark_font.size * 1.6))],
        fill=TERRACOTTA, width=2,
    )

    # Eyebrow
    eyebrow_font = _font("sans-regular", layout.eyebrow_size)
    eyebrow_y = layout.padding + int(wordmark_font.size * 2.6)
    draw.text((layout.padding, eyebrow_y), eyebrow, fill=MOSS, font=eyebrow_font)

    # Text column — leaves room for the motif if it's anchored right
    if layout.motif_position == "right":
        text_col_width = layout.width - layout.padding * 2 - int(layout.width * 0.22)
    else:
        text_col_width = layout.width - layout.padding * 2

    # Auto-fit serif-italic title to ≤ 3 lines AND ≤ text_col_width per line.
    # The word-wrap helper can't break inside a single long token (e.g. a
    # patch name with underscores instead of spaces), so we also verify
    # the rendered width of every line and shrink the font further — or
    # ellipsise — until everything fits.
    size = layout.title_size_max
    lines: list[str] = []
    name_font = _font("serif-italic-bold", size)
    while size >= layout.title_size_min:
        name_font = _font("serif-italic-bold", size)
        lines = _wrap_to_width(draw, title, name_font, text_col_width)
        widest = max(
            (draw.textlength(line, font=name_font) for line in lines),
            default=0,
        )
        if len(lines) <= 3 and widest <= text_col_width:
            break
        size -= 8
    else:
        # Reached the minimum size and still overflowing. Ellipsise each
        # over-wide line and cap at 3 lines so we never bleed off the card.
        name_font = _font("serif-italic-bold", layout.title_size_min)
        lines = _wrap_to_width(draw, title, name_font, text_col_width)[:3]
        for idx, line in enumerate(lines):
            if draw.textlength(line, font=name_font) <= text_col_width:
                continue
            trimmed = line
            while trimmed and draw.textlength(trimmed + "…", font=name_font) > text_col_width:
                trimmed = trimmed[:-1]
            lines[idx] = (trimmed.rstrip() + "…") if trimmed else "…"

    name_y = eyebrow_y + int(layout.eyebrow_size * 2.4)
    line_height = int(size * 1.08)
    for i, line in enumerate(lines):
        draw.text((layout.padding, name_y + i * line_height), line, fill=FOREST, font=name_font)

    # Terracotta accent rule under the title block
    rule_y = name_y + len(lines) * line_height + 14
    draw.rectangle(
        [layout.padding, rule_y, layout.padding + max(60, int(layout.width * 0.08)), rule_y + 4],
        fill=TERRACOTTA,
    )

    # Sub-lines
    if sub1:
        sub1_font = _font("serif-italic", layout.sub1_size)
        draw.text((layout.padding, rule_y + int(layout.sub1_size * 0.9)),
                  sub1, fill=INK, font=sub1_font)

    if sub2:
        sub2_font = _font("sans-regular", layout.sub2_size)
        draw.text((layout.padding, rule_y + int(layout.sub1_size * 0.9) + int(layout.sub1_size * 1.4)),
                  sub2, fill=MOSS, font=sub2_font)

    # Footer URL + CTA
    url_font = _font("sans-regular", max(20, layout.eyebrow_size - 2))
    url_y = layout.height - layout.padding - int(url_font.size * 1.1)
    draw.text((layout.padding, url_y), "patchandpot.app", fill=MOSS, font=url_font)

    cta_font = _font("sans-bold", max(20, layout.eyebrow_size - 2))
    cta_w = draw.textlength(cta, font=cta_font)
    draw.text(
        (layout.width - layout.padding - cta_w, url_y),
        cta, fill=TERRACOTTA, font=cta_font,
    )

    # Decorative botanical sprig
    if layout.motif_position == "right":
        _draw_botanical(
            draw,
            cx=layout.width - layout.padding - int(layout.width * 0.09),
            cy=layout.height / 2,
            scale=layout.motif_scale,
        )
    elif layout.motif_position == "bottom":
        _draw_botanical(
            draw,
            cx=layout.width / 2,
            cy=layout.height - layout.padding - int(layout.height * 0.18),
            scale=layout.motif_scale,
        )

    # Hairline frame
    draw.rectangle(
        [inset, inset, layout.width - inset, layout.height - inset],
        outline=(45, 74, 34, 80), width=1,
    )

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


def render_kit_images(patch_name: str, region_name: str, plant_count: int) -> Dict[str, bytes]:
    """Render all four social-kit teasers. Returns dict keyed by layout
    filename stem (e.g. 'instagram_square') → PNG bytes."""
    plant_label = "plant" if plant_count == 1 else "plants"
    eyebrow = "A SHARED GARDEN"
    sub1 = f"Growing in {region_name}" if region_name else "Growing somewhere lovely"
    sub2 = f"{plant_count} {plant_label} tracked  ·  monthly seasonal guide"
    cta = "OPEN  →"

    return {
        layout.key: _compose(
            layout,
            eyebrow=eyebrow, title=patch_name, sub1=sub1, sub2=sub2, cta=cta,
        )
        for layout in _LAYOUTS
    }


def build_kit_zip(
    *,
    patch_name: str,
    region_name: str,
    plant_count: int,
    captions: Dict[str, str] | None = None,
) -> bytes:
    """Bundle the four teasers + a captions.txt (if captions are supplied)
    + a small README into a single ZIP archive ready for download.

    `captions` is keyed by the same friendly stems as `render_kit_images`
    (instagram_square, instagram_portrait, reels_story, youtube_twitter).
    Missing keys are silently skipped — caller decides whether to fail
    when LLM caption generation is unavailable.
    """
    images = render_kit_images(patch_name, region_name, plant_count)

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        # Images
        for stem, png in images.items():
            zf.writestr(f"{stem}.png", png)

        # Captions
        if captions:
            lines = [
                "PATCH & POT — SOCIAL MEDIA CAPTIONS",
                "=" * 40,
                "",
                "Below is one ready-to-paste caption per image. Pick the matching",
                "platform when you upload. All captions are seeds — feel free to",
                "tweak emoji, hashtags or tone to match your account voice.",
                "",
            ]
            label_map = {
                "instagram_square":   "Instagram (square feed post — 1:1)",
                "instagram_portrait": "Instagram (portrait feed post — 4:5)",
                "reels_story":        "Reels / TikTok / Stories / YouTube Shorts (9:16)",
                "youtube_twitter":    "Twitter / YouTube cover (16:9)",
            }
            for stem, label in label_map.items():
                caption = captions.get(stem)
                if not caption:
                    continue
                lines += [label, "-" * len(label), caption.strip(), "", ""]
            zf.writestr("captions.txt", "\n".join(lines))

        # README
        readme = (
            "PATCH & POT — SOCIAL MEDIA KIT\n"
            "==============================\n\n"
            "Four ready-to-post images of your patch, sized for every "
            "major social platform, plus a captions.txt with seed copy.\n\n"
            "Files\n-----\n"
            "  instagram_square.png    1080×1080  Instagram feed (square)\n"
            "  instagram_portrait.png  1080×1350  Instagram feed (portrait)\n"
            "  reels_story.png         1080×1920  Reels / TikTok / Stories / Shorts\n"
            "  youtube_twitter.png     1920×1080  Twitter card / YouTube cover\n"
            "  captions.txt            One caption per image\n\n"
            "Tip: post the 9:16 to your Stories with a 'link sticker' pointing\n"
            "at your patch URL — that's the highest-conversion surface.\n\n"
            f"Patch: {patch_name}\n"
            f"Region: {region_name or '—'}\n"
            f"Plants tracked: {plant_count}\n"
        )
        zf.writestr("README.txt", readme)

    return buf.getvalue()
