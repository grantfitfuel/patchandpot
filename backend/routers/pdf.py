"""PDF endpoints — proxies the static `/pdf/<slug>` guides hosted on
patchandpot.com, plus the paywalled per-region seasonal PDF generator."""
import logging
import re

import httpx
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from core import (
    LANG_NAMES, MONTHS, GuidanceRequest, SeasonalPdfRequest,
    _GUIDE_PDFS, make_grant_is_active,
)
from pdf_seasonal import build_seasonal_pdf
from services_guidance import make_generate_and_cache_guidance

logger = logging.getLogger(__name__)


def make_router(db) -> APIRouter:
    router = APIRouter()
    _grant_is_active = make_grant_is_active(db)
    _generate_and_cache_guidance = make_generate_and_cache_guidance(db)

    @router.get("/guide-pdf/{slug}")
    async def guide_pdf(slug: str):
        """Stream a guide PDF from patchandpot.com with attachment headers."""
        entry = _GUIDE_PDFS.get(slug)
        if not entry:
            raise HTTPException(404, "PDF not found")
        try:
            async with httpx.AsyncClient(timeout=20) as http:
                r = await http.get(entry["url"])
            if r.status_code != 200 or not r.content:
                raise HTTPException(502, "Upstream PDF unavailable")
        except httpx.HTTPError as e:
            logger.warning("guide_pdf fetch failed for %s: %s", slug, e)
            raise HTTPException(502, "Upstream PDF unavailable") from e
        return Response(
            content=r.content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'inline; filename="{entry["filename"]}"',
                "Cache-Control": "public, max-age=86400",
            },
        )

    @router.post("/seasonal-pdf")
    async def seasonal_pdf(req: SeasonalPdfRequest, request: Request):
        """Build a personalised A4 PDF of the current monthly guide. Paywalled."""
        token = (req.access_token or "").strip()
        if not await _grant_is_active(token):
            raise HTTPException(402, "Access required — pay to unlock.")

        if not (1 <= req.month <= 12):
            raise HTTPException(400, "month must be 1–12")

        guidance = await _generate_and_cache_guidance(GuidanceRequest(
            region=req.region,
            month=req.month,
            language=req.language,
            my_garden=req.my_garden,
        ))

        language = (req.language or "en").lower()
        if language not in LANG_NAMES:
            language = "en"
        month_label = MONTHS[req.month]
        region_label = req.region.name + (f", {req.region.country}" if req.region.country else "")

        fwd_host = request.headers.get("x-forwarded-host") or request.url.hostname or "patchandpot.com"
        fwd_proto = request.headers.get("x-forwarded-proto") or request.url.scheme or "https"
        qr_url = f"{fwd_proto}://{fwd_host.split(',')[0].strip()}/calendar"

        pdf_bytes = build_seasonal_pdf(
            guidance=guidance,
            region_name=region_label,
            month_label=month_label,
            language=language,
            orientation=(req.orientation or "portrait").lower(),
            qr_url=qr_url,
            month=req.month,
        )

        safe_region = re.sub(r"[^A-Za-z0-9_-]+", "-", req.region.name)[:40] or "region"
        filename = f"Patch-and-Pot-{month_label}-{safe_region}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'inline; filename="{filename}"',
                "Cache-Control": "private, max-age=300",
            },
        )

    return router
