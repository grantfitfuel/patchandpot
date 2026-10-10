"""Instagram graphics — "postcard on a painting" design system.

Pure PIL rendering (no I/O): crisp seasonal watercolour + paper grain +
vignette, frosted sand cards with soft shadows, brand fonts (Cormorant
Garamond + Outfit), Patch & Pot badge. Used for Feed cards, Carousels and
the 11s three-scene Reel.
"""
from __future__ import annotations

import functools
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

FOREST = (45, 74, 34)
MOSS = (92, 107, 82)
TERRACOTTA = (198, 93, 71)
BUTTER = (244, 201, 107)
SAND = (247, 245, 240)
INK = (28, 35, 26)
BODY = (58, 66, 54)

_FONT_DIR = Path(__file__).resolve().parent.parent / "assets" / "fonts"
_FONTS = {
    "display": ("CormorantGaramond-VF.ttf", b"SemiBold"),
    "display_bold": ("CormorantGaramond-VF.ttf", b"Bold"),
    "italic": ("CormorantGaramond-Italic-VF.ttf", b"SemiBold Italic"),
    "sans": ("Outfit-VF.ttf", b"Regular"),
    "sans_med": ("Outfit-VF.ttf", b"Medium"),
    "sans_bold": ("Outfit-VF.ttf", b"SemiBold"),
}
_MEASURE = ImageDraw.Draw(Image.new("RGB", (4, 4)))


@functools.lru_cache(maxsize=96)
def font(kind: str, size: int) -> ImageFont.FreeTypeFont:
    fname, var = _FONTS[kind]
    try:
        f = ImageFont.truetype(str(_FONT_DIR / fname), size=size)
        f.set_variation_by_name(var)
        return f
    except Exception:  # noqa: BLE001
        return ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf", size=size)


def rgba(c, a: int = 255) -> tuple:
    return tuple(c[:3]) + (a,)


def ease(x: float) -> float:
    x = max(0.0, min(1.0, x))
    return 1 - (1 - x) ** 3


def wrap(text: str, f, max_w: int) -> list[str]:
    lines, cur = [], ""
    for w in text.split():
        probe = f"{cur} {w}".strip()
        if _MEASURE.textlength(probe, font=f) <= max_w:
            cur = probe
        else:
            if cur:
                lines.append(cur)
            cur = w
    if cur:
        lines.append(cur)
    return lines


def tracked_width(text: str, f, tracking: float) -> float:
    return sum(_MEASURE.textlength(ch, font=f) for ch in text) + f.size * tracking * max(0, len(text) - 1)


def draw_tracked(d, xy, text: str, f, fill, tracking: float = 0.14) -> None:
    x, y = xy
    for ch in text:
        d.text((x, y), ch, font=f, fill=fill)
        x += _MEASURE.textlength(ch, font=f) + f.size * tracking


def put(base: Image.Image, layer: Image.Image, xy, op: float = 1.0) -> None:
    """Alpha-composite `layer` onto RGBA `base` at xy with opacity."""
    if op <= 0.01:
        return
    if op < 0.99:
        layer = layer.copy()
        layer.putalpha(layer.getchannel("A").point(lambda v, o=op: int(v * o)))
    base.alpha_composite(layer, (int(xy[0]), int(xy[1])))


def arrow(d, x: float, y: float, size: int, colour, direction: str = "right", width: int = 4) -> None:
    if direction == "right":
        d.line([(x, y), (x + size, y)], fill=colour, width=width)
        d.line([(x + size * 0.6, y - size * 0.38), (x + size, y), (x + size * 0.6, y + size * 0.38)],
               fill=colour, width=width, joint="curve")
    else:  # up
        d.line([(x, y), (x, y - size)], fill=colour, width=width)
        d.line([(x - size * 0.38, y - size * 0.6), (x, y - size), (x + size * 0.38, y - size * 0.6)],
               fill=colour, width=width, joint="curve")


# ─── Brand pieces ──────────────────────────────────────────────────
def sprout(size: int, colour) -> Image.Image:
    s = size * 4
    im = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.line([(s * 0.5, s * 0.96), (s * 0.5, s * 0.42)], fill=rgba(colour), width=max(2, s // 13))
    leaf = Image.new("RGBA", (int(s * 0.5), int(s * 0.24)), (0, 0, 0, 0))
    ImageDraw.Draw(leaf).ellipse([0, 0, leaf.width - 1, leaf.height - 1], fill=rgba(colour))
    right = leaf.rotate(32, expand=True, resample=Image.BICUBIC)
    left = leaf.rotate(-32, expand=True, resample=Image.BICUBIC)
    im.alpha_composite(right, (int(s * 0.5), int(s * 0.12)))
    im.alpha_composite(left, (int(s * 0.5) - left.width, int(s * 0.30)))
    return im.resize((size, size), Image.LANCZOS)


def pill(text: str, f, bg, fg, padx: int = 24, pady: int = 13, tracking: float = 0.14, bg_alpha: int = 255) -> Image.Image:
    _, y0, _, y1 = f.getbbox("H")
    cap = y1 - y0
    w = int(tracked_width(text, f, tracking)) + padx * 2
    h = cap + pady * 2
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([(0, 0), (w - 1, h - 1)], radius=h // 2, fill=rgba(bg, bg_alpha))
    draw_tracked(d, (padx, pady - y0), text, f, rgba(fg), tracking)
    return im


@functools.lru_cache(maxsize=4)
def brand_badge(scale: float = 1.0) -> Image.Image:
    f = font("display_bold", int(36 * scale))
    icon = sprout(int(34 * scale), FOREST)
    label = "Patch & Pot"
    pad = int(18 * scale)
    tw = int(_MEASURE.textlength(label, font=f))
    h = int(64 * scale)
    w = pad + icon.width + int(10 * scale) + tw + pad + int(6 * scale)
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([(0, 0), (w - 1, h - 1)], radius=h // 2, fill=rgba(SAND, 238))
    im.alpha_composite(icon, (pad, (h - icon.height) // 2))
    _, y0, _, y1 = f.getbbox("Pp")
    d.text((pad + icon.width + int(10 * scale), (h - (y1 - y0)) // 2 - y0), label, font=f, fill=rgba(FOREST))
    return im


def card(w: int, h: int, fill=SAND, alpha: int = 244, radius: int = 34, shadow: int = 26) -> tuple[Image.Image, int]:
    """Rounded paper card with a soft drop shadow. Returns (layer, pad)."""
    pad = shadow * 2
    im = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    sh = Image.new("RGBA", im.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle([(pad, pad + 12), (pad + w, pad + h + 12)], radius=radius, fill=(18, 26, 16, 95))
    im = Image.alpha_composite(im, sh.filter(ImageFilter.GaussianBlur(shadow)))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([(pad, pad), (pad + w, pad + h)], radius=radius, fill=rgba(fill, alpha))
    return im, pad


# ─── Painting treatments ───────────────────────────────────────────
def _grain(img: Image.Image, amount: float = 0.045) -> Image.Image:
    w, h = img.size
    noise = Image.effect_noise((w // 2 + 1, h // 2 + 1), 48).resize((w, h)).convert("RGB")
    return Image.blend(img, noise, amount)


def finish(img: Image.Image) -> Image.Image:
    """Crisp painting + gentle edge vignette + paper grain."""
    w, h = img.size
    v = Image.radial_gradient("L").resize((w, h))
    v = v.point(lambda x: int(max(0, x - 110) * 0.85))
    img = Image.composite(Image.new("RGB", (w, h), INK), img, v)
    return _grain(img)


def wash(img: Image.Image, colour, alpha: int, blur: int) -> Image.Image:
    soft = img.filter(ImageFilter.GaussianBlur(blur)).convert("RGBA")
    return Image.alpha_composite(soft, Image.new("RGBA", img.size, rgba(colour, alpha))).convert("RGB")


def flat_fallback(size: tuple[int, int], variant: str) -> Image.Image:
    colours = {"forest": FOREST, "moss": MOSS, "terracotta": TERRACOTTA, "sand": SAND, "butter": BUTTER}
    img = Image.new("RGB", size, colours.get(variant, FOREST))
    return _grain(img, 0.06)


# ─── Text blocks (shared between stills and Reel) ──────────────────
def text_layer(lines: list[str], f, fill, line_h: int, width: int) -> Image.Image:
    h = line_h * len(lines) + int(f.size * 0.45)
    im = Image.new("RGBA", (width, max(1, h)), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for i, line in enumerate(lines):
        d.text((0, i * line_h), line, font=f, fill=rgba(fill))
    return im


def eyebrow_text(eyebrow: str, season: str | None) -> str:
    e = eyebrow.upper()
    return f"{season.upper()}  ·  {e}" if season and season.lower() not in e.lower() else e


def footer_layer(width: int, scale: float = 1.0, colour=TERRACOTTA) -> Image.Image:
    f = font("sans_med", int(25 * scale))
    im = Image.new("RGBA", (width, int(40 * scale)), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.line([(0, int(20 * scale)), (int(44 * scale), int(20 * scale))], fill=rgba(colour), width=max(2, int(3 * scale)))
    draw_tracked(d, (int(60 * scale), int(4 * scale)), "PATCHANDPOT.APP", f, rgba(colour), 0.16)
    return im


def tip_layer(n: int, tip: str, width: int, scale: float = 1.0) -> Image.Image:
    nf = font("italic", int(120 * scale))
    tf = font("sans", int(34 * scale))
    col = int(92 * scale)
    lines = wrap(tip, tf, width - col)[:3]
    lh = int(46 * scale)
    h = max(int(96 * scale), lh * len(lines) + int(14 * scale))
    im = Image.new("RGBA", (width, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.text((0, int(-52 * scale)), str(n), font=nf, fill=rgba(TERRACOTTA))
    for i, line in enumerate(lines):
        d.text((col, int(8 * scale) + i * lh), line, font=tf, fill=rgba(BODY))
    return im


def rule(width: int, colour=MOSS, alpha: int = 70) -> Image.Image:
    im = Image.new("RGBA", (width, 2), rgba(colour, alpha))
    return im


# ─── Feed card (1080²) ─────────────────────────────────────────────
def render_card(bg: Image.Image, eyebrow: str, title: str, body: str, season: str | None) -> Image.Image:
    S, M, IN = 1080, 56, 56
    base = finish(bg).convert("RGBA")
    put(base, brand_badge(), (M, M))
    cw = S - 2 * M
    tw = cw - 2 * IN
    tf, bf = font("display", 78), font("sans", 31)
    tl, bl = wrap(title, tf, tw)[:3], wrap(body, bf, tw)[:4]
    eb = pill(eyebrow_text(eyebrow, season), font("sans_bold", 21), TERRACOTTA, SAND)
    title_l = text_layer(tl, tf, FOREST, 80, tw)
    body_l = text_layer(bl, bf, BODY, 44, tw)
    foot = footer_layer(tw)
    ch = IN + eb.height + 26 + title_l.height + 10 + body_l.height + 22 + foot.height + IN - 20
    c, pad = card(cw, ch)
    y = pad + IN
    put(c, eb, (pad + IN, y)); y += eb.height + 26
    put(c, title_l, (pad + IN, y)); y += title_l.height + 10
    put(c, body_l, (pad + IN, y)); y += body_l.height + 22
    put(c, foot, (pad + IN, y))
    put(base, c, (M - pad, S - M - ch - pad))
    return base.convert("RGB")


# ─── Carousel (3 × 1080²) ──────────────────────────────────────────
def _counter(base: Image.Image, idx: int, total: int = 3, dark: bool = False) -> None:
    p = pill(f"{idx} / {total}", font("sans_bold", 21), INK if not dark else SAND, SAND if not dark else FOREST,
             padx=20, pady=13, tracking=0.08, bg_alpha=200 if not dark else 235)
    put(base, p, (1080 - 56 - p.width, 64))


def render_carousel(bg: Image.Image, eyebrow: str, title: str, tips: list[str], season: str | None) -> list[Image.Image]:
    S, M, IN = 1080, 56, 56
    cw, tw = S - 2 * M, S - 2 * M - 2 * IN
    painted = finish(bg)

    # 1 — Cover
    s1 = painted.convert("RGBA")
    put(s1, brand_badge(), (M, M))
    _counter(s1, 1)
    tf = font("display", 92)
    tl = wrap(title, tf, tw)[:3]
    eb = pill(eyebrow_text(eyebrow, season), font("sans_bold", 21), TERRACOTTA, SAND)
    title_l = text_layer(tl, tf, FOREST, 92, tw)
    swipe = Image.new("RGBA", (tw, 44), (0, 0, 0, 0))
    sd = ImageDraw.Draw(swipe)
    draw_tracked(sd, (0, 6), "SWIPE FOR 3 TIPS", font("sans_bold", 23), rgba(TERRACOTTA), 0.16)
    arrow(sd, tracked_width("SWIPE FOR 3 TIPS", font("sans_bold", 23), 0.16) + 18, 20, 30, rgba(TERRACOTTA))
    ch = IN + eb.height + 26 + title_l.height + 16 + swipe.height + IN - 14
    c, pad = card(cw, ch)
    y = pad + IN
    put(c, eb, (pad + IN, y)); y += eb.height + 26
    put(c, title_l, (pad + IN, y)); y += title_l.height + 16
    put(c, swipe, (pad + IN, y))
    put(s1, c, (M - pad, S - M - ch - pad))

    # 2 — Tips
    s2 = wash(painted, SAND, 120, 16).convert("RGBA")
    put(s2, brand_badge(), (M, M))
    _counter(s2, 2)
    head = text_layer([f"{(season or 'Quick').capitalize()} tips"], font("italic", 46), TERRACOTTA, 50, tw)
    sub = text_layer(wrap(title, font("display", 60), tw)[:2], font("display", 60), FOREST, 62, tw)
    tips_l = [tip_layer(i, t, tw) for i, t in enumerate(tips[:3], start=1)]
    top = 150
    ch = S - M - top
    c, pad = card(cw, ch)
    y = pad + IN - 6
    put(c, head, (pad + IN, y)); y += head.height + 2
    put(c, sub, (pad + IN, y)); y += sub.height + 18
    gap = max(20, (pad + ch - IN - y - sum(t.height for t in tips_l)) // max(1, len(tips_l)))
    for i, tl_ in enumerate(tips_l):
        put(c, rule(tw), (pad + IN, y)); y += gap // 2
        put(c, tl_, (pad + IN, y)); y += tl_.height + gap // 2
    put(s2, c, (M - pad, top - pad))

    # 3 — CTA
    s3 = wash(painted, FOREST, 205, 12).convert("RGBA")
    _counter(s3, 3, dark=True)
    _cta(s3, 1080, 1080, scale=1.0)
    return [s1.convert("RGB"), s2.convert("RGB"), s3.convert("RGB")]


def cta_layers(scale: float = 1.0) -> list[tuple[Image.Image, int]]:
    """Ordered CTA elements with their vertical gap after (for staggering)."""
    hf, itf = font("display", int(112 * scale)), font("italic", int(112 * scale))
    icon = sprout(int(84 * scale), BUTTER)
    l1 = text_layer(["Plan your patch,"], hf, SAND, int(112 * scale), int(1000 * scale))
    l2 = text_layer(["free."], itf, BUTTER, int(112 * scale), int(1000 * scale))
    url = Image.new("RGBA", (int(900 * scale), int(60 * scale)), (0, 0, 0, 0))
    draw_tracked(ImageDraw.Draw(url), (0, 0), "at patchandpot.app", font("sans_med", int(40 * scale)), rgba(SAND, 235), 0.02)
    bio = pill("LINK IN BIO", font("sans_bold", int(26 * scale)), TERRACOTTA, SAND, padx=int(34 * scale), pady=int(20 * scale))
    feat = Image.new("RGBA", (int(1000 * scale), int(44 * scale)), (0, 0, 0, 0))
    draw_tracked(ImageDraw.Draw(feat), (0, 0), "SEASONAL CALENDAR  ·  PEST GUIDE  ·  PLANT CARE",
                 font("sans_med", int(21 * scale)), rgba(SAND, 170), 0.12)
    return [(icon, int(36 * scale)), (l1, int(-34 * scale)), (l2, int(14 * scale)), (url, int(48 * scale)),
            (bio, int(70 * scale)), (feat, 0)]


def _cta(base: Image.Image, w: int, h: int, scale: float, top: int | None = None, t: float | None = None,
         start: float = 0.0) -> None:
    layers = cta_layers(scale)
    x = int(72 * scale)
    y = top if top is not None else (h - sum(la.height + gp for la, gp in layers)) // 2
    for i, (layer, gap) in enumerate(layers):
        if t is None:
            put(base, layer, (x, y))
        else:
            a = ease((t - start - i * 0.22) / 0.55)
            put(base, layer, (x, y + int(36 * (1 - a))), a)
        y += layer.height + gap


# ─── What-to-sow carousel (cover + 3-plant list slides + CTA) ─────
def _fit_lines(text: str, f, width: int, max_lines: int) -> list[str]:
    """Wrap to max_lines, trimming to whole clauses/sentences, never mid-thought."""
    import re
    lines = wrap(text, f, width)
    if len(lines) <= max_lines:
        return lines
    parts = re.split(r"(?<=[.;])\s+", text)
    while len(parts) > 1:
        parts.pop()
        cand = " ".join(parts).rstrip(";,")
        cand = cand if cand.endswith(".") else cand + "."
        lines = wrap(cand, f, width)
        if len(lines) <= max_lines:
            return lines
    lines = wrap(text, f, width)[:max_lines]
    lines[-1] = lines[-1].rstrip(",;. ") + "…"
    return lines


def _plant_row(p: dict, width: int) -> Image.Image:
    nf, hf = font("display", 54), font("sans", 29)
    kind = (p.get("kind") or "food").lower()
    tag = pill("FLOWER" if "flower" in kind else "FOOD", font("sans_bold", 17),
               TERRACOTTA if "flower" in kind else MOSS, SAND, padx=16, pady=10)
    lines = _fit_lines(p.get("how") or p.get("why") or "", hf, width, 3)
    h = 66 + 16 + 40 * len(lines)
    im = Image.new("RGBA", (width, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    name = p.get("name", "")
    d.text((0, -6), name, font=nf, fill=rgba(FOREST))
    put(im, tag, (int(_MEASURE.textlength(name, font=nf)) + 20, 20))
    for i, line in enumerate(lines):
        d.text((0, 76 + i * 40), line, font=hf, fill=rgba(BODY))
    return im


def render_sow_carousel(bg: Image.Image, month: str, plants: list[dict], season: str | None) -> list[Image.Image]:
    S, M, IN = 1080, 56, 56
    cw, tw = S - 2 * M, S - 2 * M - 2 * IN
    groups = [plants[i:i + 3] for i in range(0, min(len(plants), 9), 3)] or [[]]
    total = len(groups) + 2
    painted = finish(bg)

    # Cover
    s1 = painted.convert("RGBA")
    put(s1, brand_badge(), (M, M))
    _counter(s1, 1, total)
    eb = pill(f"{month.upper()}  ·  UK SOWING GUIDE", font("sans_bold", 21), TERRACOTTA, SAND)
    tf = font("display", 96)
    t1 = text_layer(["What to sow"], tf, FOREST, 92, tw)
    t2 = text_layer([f"in {month}"], font("italic", 96), TERRACOTTA, 92, tw)
    sub = text_layer(wrap(f"{len(plants[:9])} picks for pots, beds & borders this month", font("sans", 30), tw)[:2],
                     font("sans", 30), BODY, 42, tw)
    swipe = Image.new("RGBA", (tw, 44), (0, 0, 0, 0))
    sd = ImageDraw.Draw(swipe)
    draw_tracked(sd, (0, 6), "SWIPE TO SEE THEM", font("sans_bold", 23), rgba(TERRACOTTA), 0.16)
    arrow(sd, tracked_width("SWIPE TO SEE THEM", font("sans_bold", 23), 0.16) + 18, 20, 30, rgba(TERRACOTTA))
    ch = IN + eb.height + 24 + t1.height + t2.height - 30 + sub.height + 14 + swipe.height + IN - 14
    c, pad = card(cw, ch)
    y = pad + IN
    for layer, gap in ((eb, 24), (t1, -20), (t2, -10), (sub, 14), (swipe, 0)):
        put(c, layer, (pad + IN, y)); y += layer.height + gap
    put(s1, c, (M - pad, S - M - ch - pad))
    slides = [s1]

    # Plant list slides
    soft = wash(painted, SAND, 120, 16)
    for gi, group in enumerate(groups):
        sl = soft.convert("RGBA")
        put(sl, brand_badge(), (M, M))
        _counter(sl, gi + 2, total)
        head = text_layer([f"Sow now · {month}"], font("italic", 44), TERRACOTTA, 48, tw)
        rows = [_plant_row(p, tw) for p in group]
        top = 150
        ch = S - M - top
        c, pad = card(cw, ch)
        y = pad + IN - 6
        put(c, head, (pad + IN, y)); y += head.height + 10
        gap = max(24, (pad + ch - IN - y - sum(r.height for r in rows)) // max(1, len(rows)))
        for r in rows:
            put(c, rule(tw), (pad + IN, y)); y += gap // 2
            put(c, r, (pad + IN, y)); y += r.height + gap // 2
        put(sl, c, (M - pad, top - pad))
        slides.append(sl)

    # CTA
    s_end = wash(painted, FOREST, 205, 12).convert("RGBA")
    _counter(s_end, total, total, dark=True)
    _cta(s_end, 1080, 1080, scale=1.0)
    slides.append(s_end)
    return [x.convert("RGB") for x in slides]


# ─── Reel (1080×1920, 12s, 3 scenes) ───────────────────────────────
REEL_W, REEL_H, REEL_FPS, REEL_DUR = 1080, 1920, 24, 12
_A_END, _B_END, _XF = 3.6, 8.6, 0.6


def make_reel_renderer(bg_over: Image.Image, eyebrow: str, title: str, tips: list[str], season: str | None):
    """Returns render_frame(f) -> np.ndarray for the 3-scene Reel.
    bg_over is the painting scaled ~8% beyond 1080×1920 for Ken Burns."""
    W, H, M, IN = REEL_W, REEL_H, 64, 62
    cw, tw = W - 2 * M, W - 2 * M - 2 * IN

    bg_a = finish(bg_over)
    bg_b = wash(bg_a, SAND, 125, 18)
    bg_c = wash(bg_a, FOREST, 205, 12)
    badge = brand_badge(1.2)

    # Scene A pieces
    tf = font("display", 112)
    eb = pill(eyebrow_text(eyebrow, season), font("sans_bold", 25), TERRACOTTA, SAND, padx=28, pady=16)
    title_lines = [text_layer([ln], tf, FOREST, 112, tw) for ln in wrap(title, tf, tw)[:3]]
    foot = footer_layer(tw, 1.2)
    a_h = IN + eb.height + 30 + 112 * len(title_lines) + 30 + 26 + foot.height + IN - 20
    a_card, a_pad = card(cw, a_h)
    a_y = H - 300 - a_h

    # Scene B pieces
    head = text_layer([f"{(season or 'Quick').capitalize()} tips"], font("italic", 58), TERRACOTTA, 62, tw)
    sub = text_layer(wrap(title, font("display", 74), tw)[:2], font("display", 74), FOREST, 76, tw)
    tip_ls = [tip_layer(i, t, tw, 1.2) for i, t in enumerate(tips[:3], start=1)]
    gap = 76
    b_h = IN + head.height + sub.height + 30 + sum(t.height for t in tip_ls) + gap * len(tip_ls) + IN - 30
    b_top = max(240, (H - b_h) // 2 + 40)
    b_card, b_pad = card(cw, b_h)
    body_y0 = b_top + IN + head.height + sub.height + 30

    def bg_at(src: Image.Image, t: float) -> Image.Image:
        p = t / REEL_DUR
        zoom = 1.0 + 0.06 * p
        cw_, ch_ = int(src.width / zoom), int(src.height / zoom)
        ox = int((src.width - cw_) * (0.2 + 0.6 * p))
        oy = int((src.height - ch_) * (0.3 + 0.4 * p))
        return src.crop((ox, oy, ox + cw_, oy + ch_)).resize((W, H), Image.BILINEAR).convert("RGBA")

    def scene_a(t: float) -> Image.Image:
        fr = bg_at(bg_a, t)
        put(fr, badge, (M, 96), ease(t / 0.5))
        k = ease((t - 0.15) / 0.7)
        put(fr, a_card, (M - a_pad, a_y - a_pad + int(90 * (1 - k))), k)
        y = a_y + IN + int(90 * (1 - k))
        put(fr, eb, (M + IN, y), ease((t - 0.55) / 0.4)); y += eb.height + 30
        for i, ln in enumerate(title_lines):
            a = ease((t - 0.75 - i * 0.2) / 0.5)
            put(fr, ln, (M + IN + int(-50 * (1 - a)), y), a)
            y += 112
        put(fr, foot, (M + IN, y + 30), ease((t - 1.6) / 0.5))
        return fr

    def scene_b(t: float) -> Image.Image:
        lt = t - (_A_END - _XF)
        fr = bg_at(bg_b, t)
        put(fr, badge, (M, 96))
        k = ease(lt / 0.6)
        put(fr, b_card, (M - b_pad, b_top - b_pad + int(60 * (1 - k))), k)
        y = b_top + IN + int(60 * (1 - k))
        put(fr, head, (M + IN, y), ease((lt - 0.3) / 0.4)); y += head.height
        put(fr, sub, (M + IN, y), ease((lt - 0.45) / 0.45)); y = body_y0
        for i, tl_ in enumerate(tip_ls):
            a = ease((lt - 0.7 - i * 0.8) / 0.55)
            put(fr, rule(tw), (M + IN, y), a); y += gap // 2
            put(fr, tl_, (M + IN, y + int(30 * (1 - a))), a); y += tl_.height + gap // 2
        return fr

    def scene_c(t: float) -> Image.Image:
        lt = t - (_B_END - _XF)
        fr = bg_at(bg_c, t)
        put(fr, badge, (M, 96))
        _cta(fr, W, H, scale=1.25, t=lt, start=0.3)
        return fr

    def render_frame(f: int) -> np.ndarray:
        t = f / REEL_FPS
        if t < _A_END - _XF:
            fr = scene_a(t)
        elif t < _A_END:
            fr = Image.blend(scene_a(t), scene_b(t), ease((t - (_A_END - _XF)) / _XF))
        elif t < _B_END - _XF:
            fr = scene_b(t)
        elif t < _B_END:
            fr = Image.blend(scene_b(t), scene_c(t), ease((t - (_B_END - _XF)) / _XF))
        else:
            fr = scene_c(t)
        return np.asarray(fr.convert("RGB"))

    return render_frame
