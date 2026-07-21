"""Ask Nàdar Journal — pinned-answer PDF export.

Builds a keepsake PDF of every Q&A the member has pinned from Ask Nàdar.
Reuses `pdf_seasonal.py`'s design language (Forest/Terracotta/Sand) so
the two exports feel like the same product.

Public entry point: `build_pinned_pdf(entries, member_label, *, generated_at)`.
Each `entry` is a dict with:
    {
      "question": str,
      "answer": str,
      "asked_at": str  (ISO),
      "tag": str | None,
      "session_title": str | None,
    }
"""

from io import BytesIO
from typing import Iterable

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (
    BaseDocTemplate, Frame, KeepTogether, PageBreak,
    PageTemplate, Paragraph, Spacer,
)

FOREST = colors.HexColor("#21372A")
TERRACOTTA = colors.HexColor("#C2553A")
INK = colors.HexColor("#2B2A26")
MOSS = colors.HexColor("#5C6B57")
BORDER = colors.HexColor("#D6D2C4")


def _styles():
    base = getSampleStyleSheet()
    return {
        "eyebrow": ParagraphStyle(
            "eyebrow", parent=base["BodyText"],
            fontName="Helvetica", fontSize=8, textColor=MOSS, spaceAfter=4,
        ),
        "h1": ParagraphStyle(
            "h1", parent=base["Title"],
            fontName="Times-Roman", fontSize=26, leading=30,
            textColor=FOREST, spaceAfter=12,
        ),
        "h2": ParagraphStyle(
            "h2", parent=base["Heading2"],
            fontName="Times-Roman", fontSize=14, leading=18, textColor=FOREST,
            spaceBefore=12, spaceAfter=4,
        ),
        "q": ParagraphStyle(
            "q", parent=base["Heading3"],
            fontName="Helvetica-Bold", fontSize=11, leading=14, textColor=TERRACOTTA,
            spaceBefore=8, spaceAfter=4,
        ),
        "a": ParagraphStyle(
            "a", parent=base["BodyText"],
            fontName="Helvetica", fontSize=10, leading=14, textColor=INK, spaceAfter=4,
        ),
        "small": ParagraphStyle(
            "small", parent=base["BodyText"],
            fontName="Helvetica", fontSize=8.5, leading=11.5, textColor=MOSS,
            spaceAfter=10,
        ),
        "body": ParagraphStyle(
            "body", parent=base["BodyText"],
            fontName="Helvetica", fontSize=10, leading=14, textColor=INK, spaceAfter=6,
        ),
    }


def _esc(text) -> str:
    return (
        str(text or "")
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
    )


def _para(text, style):
    if not text:
        return None
    return Paragraph(_esc(text), style)


def _rich(markup, style):
    if not markup:
        return None
    return Paragraph(markup, style)


def _answer_paragraphs(text: str, style) -> list:
    """Split a long answer into paragraphs (blank-line separated) so page
    breaks fall between paragraphs instead of mid-sentence."""
    if not text:
        return []
    chunks = [c.strip() for c in text.split("\n\n") if c.strip()]
    out = []
    for chunk in chunks:
        # Preserve inline soft-breaks (Markdown-y) as line breaks.
        html = _esc(chunk).replace("\n", "<br/>")
        out.append(Paragraph(html, style))
    return out


def _doc(buf, *, pagesize=A4):
    doc = BaseDocTemplate(
        buf, pagesize=pagesize,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=18 * mm, bottomMargin=18 * mm,
        title="Patch & Pot — Ask Nàdar Journal",
    )
    frame = Frame(
        doc.leftMargin, doc.bottomMargin,
        doc.width, doc.height, id="body",
    )

    def _on_page(canvas, _doc):
        canvas.saveState()
        canvas.setFillColor(MOSS)
        canvas.setFont("Helvetica", 8)
        canvas.drawString(doc.leftMargin, 13 * mm,
                          "PATCH & POT  ·  ASK NÀDAR  ·  PINNED JOURNAL")
        canvas.drawRightString(
            pagesize[0] - doc.rightMargin, 13 * mm, f"Page {_doc.page}",
        )
        canvas.setStrokeColor(BORDER)
        canvas.line(doc.leftMargin, 16 * mm,
                    pagesize[0] - doc.rightMargin, 16 * mm)
        canvas.line(doc.leftMargin, pagesize[1] - 13 * mm,
                    pagesize[0] - doc.rightMargin, pagesize[1] - 13 * mm)
        canvas.restoreState()

    doc.addPageTemplates([PageTemplate(id="default", frames=[frame], onPage=_on_page)])
    return doc


def _fmt_date(iso: str) -> str:
    """`2026-02-19T10:32:11+00:00` → `19 Feb 2026`. Falls back to raw string."""
    if not iso:
        return ""
    try:
        from datetime import datetime
        # tolerate trailing Z
        d = datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return d.strftime("%d %b %Y")
    except Exception:  # noqa: BLE001
        return iso[:10]


def build_pinned_pdf(
    entries: Iterable[dict],
    *,
    member_label: str = "your patch",
    generated_at: str = "",
) -> bytes:
    """Render every pinned Q&A into a printable A4 PDF. Returns raw bytes."""
    entries = list(entries)
    buf = BytesIO()
    doc = _doc(buf)
    styles = _styles()
    story: list = []

    # ── Cover ──────────────────────────────────────────────────────────
    story += [
        _para("ASK NÀDAR · PINNED JOURNAL", styles["eyebrow"]),
        _para("Your pinned answers", styles["h1"]),
        _para(
            f"Every question you've pinned from Ask Nàdar, gathered "
            f"for {member_label}. Print it, tuck it into your "
            f"seed binder, or keep it on the potting-shed shelf.",
            styles["body"],
        ),
        _para(
            f"{len(entries)} pinned "
            f"{'answer' if len(entries) == 1 else 'answers'}"
            + (f"  ·  Generated {generated_at}" if generated_at else ""),
            styles["small"],
        ),
        Spacer(1, 4 * mm),
    ]

    if not entries:
        story.append(_para(
            "You haven't pinned anything yet. Head to /ask to have a "
            "chat with Nàdar, then tap the pin icon on any answer you'd "
            "like to keep — they'll all show up here next time.",
            styles["body"],
        ))
        doc.build(story)
        return buf.getvalue()

    # ── Group by tag (untagged first, then alphabetical tags) ──────────
    by_tag: dict[str, list[dict]] = {"": []}
    for e in entries:
        tag = (e.get("tag") or "").strip()
        by_tag.setdefault(tag, []).append(e)
    ordered_tags = [""] + sorted(t for t in by_tag if t)

    for tag in ordered_tags:
        rows = by_tag.get(tag) or []
        if not rows:
            continue
        header = tag if tag else "Untagged"
        story.append(PageBreak())
        story.append(_para(header, styles["h2"]))
        for row in rows:
            block: list = []
            meta_bits = []
            asked = _fmt_date(row.get("asked_at", ""))
            if asked:
                meta_bits.append(asked)
            if row.get("session_title"):
                meta_bits.append(row["session_title"])
            if meta_bits:
                block.append(_para(" · ".join(meta_bits), styles["small"]))
            q = row.get("question") or ""
            block.append(_rich(f"<b>Q.</b> {_esc(q)}", styles["q"]))
            block += _answer_paragraphs(row.get("answer") or "", styles["a"])
            block.append(Spacer(1, 3 * mm))
            # Keep question + first answer paragraph glued so an isolated
            # question never dangles at the bottom of a page.
            keep_head = [b for b in block[: (2 if not meta_bits else 3)] if b]
            rest = [b for b in block[(2 if not meta_bits else 3):] if b]
            story.append(KeepTogether(keep_head))
            story.extend(rest)

    doc.build(story)
    return buf.getvalue()
