"""Server-side counterpart of frontend/src/components/illustrations/MonthlyIllustrations.jsx.

We keep the SVGs as raw strings here (effectively duplicated from the
React file) and use svglib to convert them into reportlab Drawings for
the seasonal-PDF cover. Duplicating ~50 lines of XML is the cheapest way
to avoid a build-time SVG export step, and the artwork is small enough
that it won't drift in any meaningful way (each shape is simple lines /
circles / ellipses).
"""
from io import StringIO

from reportlab.graphics.shapes import Drawing
from svglib.svglib import svg2rlg


# Common opening: 80×80 viewBox, terracotta stroke (#C45D3D = our brand
# accent), no fill, rounded line caps so curves print smoothly.
_PRELUDE = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80" '
    'width="80" height="80" fill="none" '
    'stroke="#C45D3D" stroke-width="1.4" '
    'stroke-linecap="round" stroke-linejoin="round">'
)
_EPILOGUE = "</svg>"


# Each entry is the *body* of the SVG — paths/circles only — without the
# wrapping <svg> tag. Order is January → December so the index aligns
# with month - 1.
_BODIES = [
    # January — frosted leaf
    """
    <path d="M40 14 q -22 14 -18 38 q 14 8 22 8 q 8 0 16 -10 q 4 -22 -20 -36 z"/>
    <path d="M40 14 V 60"/>
    <path d="M40 24 q -8 6 -10 14"/>
    <path d="M40 28 q 8 4 12 12"/>
    <path d="M40 38 q -8 4 -10 12"/>
    <path d="M40 42 q 8 2 11 10"/>
    <path d="M22 30 l -4 -2"/><path d="M20 40 l -5 0"/><path d="M22 50 l -4 2"/>
    <path d="M58 30 l 4 -2"/><path d="M60 40 l 5 0"/><path d="M58 50 l 4 2"/>
    <path d="M40 12 V 6"/>
    """,
    # February — snowdrop
    """
    <path d="M40 76 V 32"/>
    <path d="M40 60 q -10 -2 -14 -14 q 8 -2 14 8"/>
    <path d="M40 30 q -3 -3 -3 -7 q 3 -1 6 0 q 0 4 -3 7"/>
    <path d="M40 30 q -7 4 -8 14 q 5 1 8 -2 q 3 3 8 2 q -1 -10 -8 -14 z"/>
    <path d="M40 30 q -2 6 -2 14"/>
    <path d="M40 30 q 2 6 2 14"/>
    """,
    # March — daffodil
    """
    <path d="M40 76 V 50"/>
    <ellipse cx="40" cy="36" rx="6" ry="5"/>
    <path d="M40 36 q -14 -10 -14 -22 q 8 -2 14 6"/>
    <path d="M40 36 q 14 -10 14 -22 q -8 -2 -14 6"/>
    <path d="M40 36 q -22 -2 -22 8 q 8 6 22 2"/>
    <path d="M40 36 q 22 -2 22 8 q -8 6 -22 2"/>
    <path d="M40 36 q -10 8 -8 18 q 6 -2 8 -10"/>
    <path d="M40 36 q 10 8 8 18 q -6 -2 -8 -10"/>
    <path d="M40 64 q -10 -2 -12 -12 q 6 -1 12 8"/>
    """,
    # April — three blossoms on a branch
    """
    <path d="M14 60 q 14 -8 26 -16 q 8 -6 26 -10"/>
    <circle cx="22" cy="56" r="2.5"/><circle cx="27" cy="58" r="2.5"/>
    <circle cx="22" cy="61" r="2.5"/><circle cx="17" cy="58" r="2.5"/>
    <circle cx="17" cy="53" r="2.5"/><circle cx="22" cy="56" r="1" fill="#C45D3D" stroke="none"/>
    <circle cx="42" cy="40" r="2.5"/><circle cx="47" cy="42" r="2.5"/>
    <circle cx="42" cy="45" r="2.5"/><circle cx="37" cy="42" r="2.5"/>
    <circle cx="37" cy="37" r="2.5"/><circle cx="42" cy="40" r="1" fill="#C45D3D" stroke="none"/>
    <circle cx="60" cy="30" r="2.5"/><circle cx="65" cy="32" r="2.5"/>
    <circle cx="60" cy="35" r="2.5"/><circle cx="55" cy="32" r="2.5"/>
    <circle cx="55" cy="27" r="2.5"/><circle cx="60" cy="30" r="1" fill="#C45D3D" stroke="none"/>
    """,
    # May — peony
    """
    <path d="M40 76 V 56"/>
    <circle cx="40" cy="38" r="14"/>
    <path d="M30 30 q 10 6 20 0"/>
    <path d="M28 36 q 12 8 24 0"/>
    <path d="M30 44 q 10 6 20 0"/>
    <path d="M34 30 q 0 8 6 12 q 6 -4 6 -12"/>
    <path d="M40 26 V 50"/>
    <path d="M40 60 q 9 -2 12 -10 q -6 -2 -12 6"/>
    <path d="M40 64 q -8 -2 -10 -10 q 6 -2 10 6"/>
    """,
    # June — sweet pea
    """
    <path d="M22 76 q 8 -10 8 -28 q 0 -16 14 -28"/>
    <path d="M44 22 q -6 -8 0 -12 q 6 4 0 12 z"/>
    <path d="M44 22 q -6 4 -10 0 q 4 -8 10 -4"/>
    <path d="M44 22 q 6 4 10 0 q -4 -8 -10 -4"/>
    <path d="M30 46 q -6 -8 0 -12 q 6 4 0 12 z"/>
    <path d="M30 46 q -8 4 -10 0 q 4 -8 10 -4"/>
    <path d="M30 60 q 8 0 8 -6 q 0 -6 -6 -6 q -4 0 -2 4"/>
    """,
    # July — sunflower
    """
    <path d="M40 76 V 52"/>
    <path d="M49 36 L58 36"/><path d="M47 41 L54 47"/><path d="M45 43 L49 50"/>
    <path d="M40 45 L40 54"/><path d="M35 43 L31 50"/><path d="M33 41 L26 47"/>
    <path d="M31 36 L22 36"/><path d="M33 31 L26 25"/><path d="M35 29 L31 22"/>
    <path d="M40 27 L40 18"/><path d="M45 29 L49 22"/><path d="M47 31 L54 25"/>
    <circle cx="40" cy="36" r="7"/>
    <circle cx="38" cy="35" r="0.8" fill="#C45D3D" stroke="none"/>
    <circle cx="42" cy="37" r="0.8" fill="#C45D3D" stroke="none"/>
    <circle cx="40" cy="33" r="0.8" fill="#C45D3D" stroke="none"/>
    <path d="M40 60 q -10 -2 -14 -10 q 6 -2 14 6"/>
    """,
    # August — blackberries
    """
    <path d="M22 76 q 8 -8 14 -22"/>
    <circle cx="40" cy="32" r="1.7"/><circle cx="37" cy="30" r="1.7"/>
    <circle cx="43" cy="30" r="1.7"/><circle cx="37" cy="34" r="1.7"/>
    <circle cx="43" cy="34" r="1.7"/><circle cx="40" cy="29" r="1.7"/>
    <circle cx="40" cy="35" r="1.7"/>
    <circle cx="54" cy="28" r="1.7"/><circle cx="51" cy="26" r="1.7"/>
    <circle cx="57" cy="26" r="1.7"/><circle cx="51" cy="30" r="1.7"/>
    <circle cx="57" cy="30" r="1.7"/><circle cx="54" cy="25" r="1.7"/>
    <circle cx="54" cy="31" r="1.7"/>
    <circle cx="46" cy="18" r="1.7"/><circle cx="43" cy="16" r="1.7"/>
    <circle cx="49" cy="16" r="1.7"/><circle cx="43" cy="20" r="1.7"/>
    <circle cx="49" cy="20" r="1.7"/><circle cx="46" cy="15" r="1.7"/>
    <circle cx="46" cy="21" r="1.7"/>
    <path d="M30 60 q 12 0 16 -10 q -10 -3 -16 4"/>
    <path d="M30 60 q 4 -4 12 -8"/>
    """,
    # September — dahlia
    """
    <path d="M40 76 V 54"/>
    <circle cx="40" cy="36" r="2.4" fill="#C45D3D" stroke="none"/>
    <circle cx="45" cy="36" r="3"/><circle cx="42.5" cy="40.3" r="3"/>
    <circle cx="37.5" cy="40.3" r="3"/><circle cx="35" cy="36" r="3"/>
    <circle cx="37.5" cy="31.7" r="3"/><circle cx="42.5" cy="31.7" r="3"/>
    <ellipse cx="50.2" cy="40.2" rx="4" ry="2.5"/>
    <ellipse cx="44.2" cy="46.6" rx="4" ry="2.5"/>
    <ellipse cx="35.8" cy="46.6" rx="4" ry="2.5"/>
    <ellipse cx="29.8" cy="40.2" rx="4" ry="2.5"/>
    <ellipse cx="29.8" cy="31.8" rx="4" ry="2.5"/>
    <ellipse cx="35.8" cy="25.4" rx="4" ry="2.5"/>
    <ellipse cx="44.2" cy="25.4" rx="4" ry="2.5"/>
    <ellipse cx="50.2" cy="31.8" rx="4" ry="2.5"/>
    <path d="M40 62 q -10 -2 -12 -10 q 6 -2 12 6"/>
    """,
    # October — rose hip
    """
    <path d="M14 76 q 6 -8 10 -16 q 6 -12 18 -22"/>
    <ellipse cx="46" cy="32" rx="10" ry="11"/>
    <path d="M46 21 q -2 -6 0 -10 q 2 4 0 10"/>
    <path d="M44 21 q -3 -2 -5 -1 q 1 3 5 4"/>
    <path d="M48 21 q 3 -2 5 -1 q -1 3 -5 4"/>
    <path d="M42 28 q 0 -4 4 -5"/>
    <path d="M22 60 l -3 -2"/><path d="M30 50 l -3 -2"/><path d="M36 38 l -3 -2"/>
    """,
    # November — holly
    """
    <path d="M40 76 V 24"/>
    <path d="M40 50 q -4 -3 -8 -1 q 0 -3 -4 -2 q 2 -4 -2 -5 q 4 -3 0 -7 q 5 1 6 -3 q 4 4 8 2 z"/>
    <path d="M40 36 q 4 -3 8 -1 q 0 -3 4 -2 q -2 -4 2 -5 q -4 -3 0 -7 q -5 1 -6 -3 q -4 4 -8 2 z"/>
    <circle cx="40" cy="22" r="2.4"/>
    <circle cx="36" cy="20" r="2.4"/>
    <circle cx="44" cy="20" r="2.4"/>
    """,
    # December — evergreen sprig
    """
    <path d="M40 76 V 14"/>
    <path d="M40 70 L 60 56"/><path d="M40 70 L 20 56"/>
    <path d="M40 65 L 56 53"/><path d="M40 65 L 24 53"/>
    <path d="M40 60 L 60 50"/><path d="M40 60 L 20 50"/>
    <path d="M40 55 L 54 46"/><path d="M40 55 L 26 46"/>
    <path d="M40 50 L 56 41"/><path d="M40 50 L 24 41"/>
    <path d="M40 45 L 60 36"/><path d="M40 45 L 20 36"/>
    <path d="M40 40 L 50 34"/><path d="M40 40 L 30 34"/>
    <path d="M40 35 L 52 28"/><path d="M40 35 L 28 28"/>
    <path d="M40 30 L 56 22"/><path d="M40 30 L 24 22"/>
    <path d="M40 25 L 48 20"/><path d="M40 25 L 32 20"/>
    <path d="M40 20 L 48 16"/><path d="M40 20 L 32 16"/>
    """,
]


def monthly_drawing(month: int, *, target_width_mm: float = 30.0) -> Drawing | None:
    """Return a reportlab `Drawing` for the given month (1-12), scaled so the
    artwork is roughly `target_width_mm` mm wide on the printed page. Returns
    None if anything goes wrong rendering the SVG (we never want a missing
    illustration to crash a paid PDF download).
    """
    try:
        idx = ((int(month) - 1) % 12)
        svg = _PRELUDE + _BODIES[idx] + _EPILOGUE
        drawing = svg2rlg(StringIO(svg))
        # svglib reads the SVG at its declared dimensions (80×80 px ≈
        # 80×0.353 mm = 28 mm). Rescale to the requested target width
        # while preserving aspect ratio. 1 mm ≈ 2.835 reportlab points.
        target_pt = target_width_mm * 2.83464567
        scale = target_pt / drawing.width
        drawing.width *= scale
        drawing.height *= scale
        drawing.scale(scale, scale)
        return drawing
    except Exception:  # noqa: BLE001 — best-effort decoration only.
        return None
