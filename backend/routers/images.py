"""General-purpose AI image endpoints: `/topic-image` (used by masterclass
cards, lesson heroes, flower portraits) and `/share-image` (bloom backdrop
for the 'masterclass complete' share card)."""
import re
import uuid

from fastapi import APIRouter

from core import (
    SHARE_MOTIFS,
    ShareImageRequest, TopicImageRequest,
    make_cached_image,
)


def make_router(db) -> APIRouter:
    router = APIRouter()
    _cached_image = make_cached_image(db)

    @router.post("/topic-image")
    async def generate_topic_image(req: TopicImageRequest):
        """General-purpose AI image for masterclass cards, lesson heroes, flowers etc."""
        key = req.cache_key or "topic:" + re.sub(r"[^a-z0-9]+", "-", req.subject.lower()).strip("-")
        style = req.style or (
            "natural daylight, soft focus, terracotta and cream palette, botanical editorial "
            "magazine style, shallow depth of field, no text, no people, no logos"
        )
        prompt = f"A beautiful photograph of {req.subject}. {style}."
        return await _cached_image(key, prompt, session=f"topic-{key}-{uuid.uuid4()}")

    @router.post("/share-image")
    async def generate_share_image(req: ShareImageRequest):
        """Bloom-motif backdrop for the 'masterclass complete' share card."""
        safe = re.sub(r"[^a-z0-9]+", "-", req.masterclass_slug.lower()).strip("-")
        key = f"share-bg:{safe}"
        motif = SHARE_MOTIFS.get(req.masterclass_slug, "single beautiful flower bloom on cream linen background")
        prompt = (
            f"A serene square portrait composition for a social share card. {motif}. "
            f"Botanical editorial style, soft cream/sand background with plenty of negative space "
            f"on the lower third for text. Painterly natural daylight. No text, no people, no logos. "
            f"Highly aesthetic, Instagram-ready."
        )
        return await _cached_image(key, prompt, session=f"share-{safe}-{uuid.uuid4()}")

    return router
