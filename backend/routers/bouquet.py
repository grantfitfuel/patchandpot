"""Bouquet router — image generation for /bouquet flow.

The heavy lifting for the *arrangement copy* (title, intro, stems, build
steps) is done by `/api/arrangement/suggest` in routers/arrangement.py,
which we reuse verbatim by passing the user's confirmed-in-bloom plants
as `my_garden`. This router only adds a Nano-Banana watercolor image
endpoint so the /bouquet page can render a shareable watercolor card of
whatever the user is actually cutting today.

Endpoint:
    POST /api/bouquet/image
        body: { plants: [id_or_name, ...] }
        → { image: "data:image/...", cached: true|false }

Cache key is a hash of the sorted plant list so identical bouquets from
different users share one image.
"""
import hashlib
import logging
import re
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from core import make_cached_image

logger = logging.getLogger(__name__)


class BouquetImageRequest(BaseModel):
    plants: list[str] = Field(..., min_items=1, max_items=20)


def make_router(db) -> APIRouter:
    router = APIRouter(prefix="/bouquet", tags=["bouquet"])
    _cached_image = make_cached_image(db)

    @router.post("/image")
    async def generate_bouquet_image(req: BouquetImageRequest):
        # Normalise + de-dup + sort so the cache key is stable regardless
        # of the order the user tapped the pickers in.
        cleaned = sorted({
            re.sub(r"\s+", " ", (p or "").strip().lower())
            for p in req.plants
            if (p or "").strip()
        })
        if not cleaned:
            raise HTTPException(400, "No plants supplied")
        digest = hashlib.sha1("|".join(cleaned).encode("utf-8")).hexdigest()[:16]
        cache_key = f"bouquet-image:{digest}"

        # Build a plain-English list — trimming to 8 for the prompt so we
        # don't overwhelm Gemini with a long bill of materials.
        display = cleaned[:8]
        joined = ", ".join(display)
        more = f" plus a few sprigs of {', '.join(cleaned[8:12])}" if len(cleaned) > 8 else ""

        prompt = (
            f"A soft, loose watercolour illustration of a hand-tied garden "
            f"bouquet arranged in a low stoneware jug on cream linen. The "
            f"bouquet is made from: {joined}{more}. Painted with visible "
            f"brush strokes and gentle wet-on-wet bleeding. Muted botanical "
            f"palette — sage, terracotta, dusty pink, ivory, moss. Cream "
            f"paper background with a hint of pencil under-drawing. No "
            f"text, no labels, no people, no vase logo. Editorial garden "
            f"journal illustration style."
        )
        return await _cached_image(
            cache_key, prompt, session=f"bouquet-img-{digest}-{uuid.uuid4()}"
        )

    return router
