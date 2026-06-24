"""Garden-gate QR sticker — printable PDF for a /p/{share_id} share link.

A user prints this, sticks it on their actual garden gate / allotment shed,
and anyone walking past can scan to land on the public preview of their
patch. Physical → digital growth loop.

The PDF is a single ~A6 sticker:
  - Big terracotta accent rule
  - Patch name in italic serif
  - Region line
  - Big QR code (35mm × 35mm — well above the iPhone-camera 20mm threshold)
  - "Find me online" + the human-readable URL
  - "Patch & Pot" wordmark
"""
from io import BytesIO

import qrcode
from qrcode.constants import ERROR_CORRECT_H
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A6
from reportlab.lib.units import mm
from reportlab.lib.utils import ImageReader
from reportlab.pdfgen import canvas as rl_canvas


# Brand palette (matches share_og.py)
SAND       = HexColor("#F7F5F0")
SURFACE    = HexColor("#EFECE5")
FOREST     = HexColor("#2D4A22")
MOSS       = HexColor("#5C6B52")
TERRACOTTA = HexColor("#C65D47")
INK        = HexColor("#1C231A")


def _qr_image(url: str) -> ImageReader:
    """Render the URL into a high-error-correction QR PNG bytes wrapped in a
    reportlab ImageReader (so we can drawImage() it into the PDF canvas)."""
    qr = qrcode.QRCode(
        version=None,
        error_correction=ERROR_CORRECT_H,  # 30% redundancy — survives prints, dirt, smudges
        box_size=10,
        border=2,
    )
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#1C231A", back_color="#F7F5F0").convert("RGB")
    buf = BytesIO()
    img.save(buf, format="PNG", optimize=True)
    buf.seek(0)
    return ImageReader(buf)


def render_qr_sticker_pdf(*, patch_name: str, region_name: str, share_url: str, display_url: str) -> bytes:
    """Compose the A6 sticker PDF and return the raw bytes."""
    buf = BytesIO()
    page_w, page_h = A6  # 105 × 148 mm
    c = rl_canvas.Canvas(buf, pagesize=A6)

    # Background — sand wash; an inner surface card with a hairline forest border
    c.setFillColor(SAND)
    c.rect(0, 0, page_w, page_h, stroke=0, fill=1)
    inset = 5 * mm
    c.setFillColor(SURFACE)
    c.setStrokeColor(FOREST)
    c.setLineWidth(0.4)
    c.rect(inset, inset, page_w - 2 * inset, page_h - 2 * inset, stroke=1, fill=1)

    # Top — terracotta wordmark + accent rule
    c.setFillColor(MOSS)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(10 * mm, page_h - 13 * mm, "PATCH & POT")
    c.setStrokeColor(TERRACOTTA)
    c.setLineWidth(1.2)
    c.line(10 * mm, page_h - 15 * mm, 24 * mm, page_h - 15 * mm)

    # Eyebrow
    c.setFont("Helvetica", 7)
    c.setFillColor(MOSS)
    c.drawString(10 * mm, page_h - 22 * mm, "FIND ME ONLINE")

    # Patch name (italic serif). reportlab built-in italic — switch to a real
    # Cormorant if/when we register custom fonts. Times-Italic is the
    # closest stock match.
    c.setFillColor(FOREST)
    c.setFont("Times-BoldItalic", 18)
    # Manual ellipsis if the name is too long for the sticker width.
    max_w = page_w - 20 * mm
    name = patch_name
    while c.stringWidth(name, "Times-BoldItalic", 18) > max_w and len(name) > 3:
        name = name[:-1]
    if name != patch_name:
        name = name.rstrip() + "…"
    c.drawString(10 * mm, page_h - 31 * mm, name)

    # Region
    if region_name:
        c.setFillColor(INK)
        c.setFont("Times-Italic", 10)
        region_text = region_name
        while c.stringWidth(region_text, "Times-Italic", 10) > max_w and len(region_text) > 3:
            region_text = region_text[:-1]
        if region_text != region_name:
            region_text = region_text.rstrip() + "…"
        c.drawString(10 * mm, page_h - 38 * mm, region_text)

    # QR code — centred, 50×50mm. ERROR_CORRECT_H lets us cover the bottom
    # 5mm with the human-readable URL later if we want; for now we keep it
    # clean.
    qr_size = 50 * mm
    qr_x = (page_w - qr_size) / 2
    qr_y = 38 * mm
    img = _qr_image(share_url)
    c.drawImage(img, qr_x, qr_y, qr_size, qr_size, mask="auto")

    # URL beneath the QR
    c.setFillColor(MOSS)
    c.setFont("Helvetica", 7.5)
    url_text = display_url
    if c.stringWidth(url_text, "Helvetica", 7.5) > max_w:
        # Show only the path portion if the full URL is too wide.
        try:
            from urllib.parse import urlparse
            p = urlparse(display_url)
            url_text = (p.netloc + p.path).strip("/")
        except Exception:  # noqa: BLE001
            pass
    c.drawCentredString(page_w / 2, qr_y - 5 * mm, url_text)

    # Footer CTA
    c.setFillColor(TERRACOTTA)
    c.setFont("Helvetica-Bold", 8)
    c.drawCentredString(page_w / 2, 11 * mm, "SCAN TO SEE WHAT'S GROWING  →")

    c.showPage()
    c.save()
    return buf.getvalue()
