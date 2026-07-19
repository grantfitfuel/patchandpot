"""Recipes router.

Two endpoints, working as a pair:

    POST /api/recipes/{id}/image
        body: { id, title, ingredients, method?, plating? }
        → { image: "data:image/...", cached: true|false }

    GET  /api/recipes/{id}/image.jpg
        → raw image/jpeg with `Cache-Control: public, max-age=2592000, immutable`
        → 404 if the image hasn't been generated yet (POST first)

The GET endpoint is the one used by the browser `<img>` tag on `/recipes`,
so once an image has been generated (cached in Mongo) the SAME url stays
stable and every subsequent refresh hits the browser's HTTP cache —
zero bandwidth AND zero Gemini cost on repeat visits.

Recipe body is only required for the POST-warm call. That warm call is
made once by the frontend when the GET 404s; after that it's pure GET.
"""
import base64
import logging
import re
import uuid

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from core import make_cached_image

logger = logging.getLogger(__name__)

# One month — the recipe corpus is hand-curated + rarely changes, and if
# we ever want to invalidate we can bump the recipe id or add a `?v=`
# query param.
_IMAGE_CACHE_CONTROL = "public, max-age=2592000, immutable"


class RecipeImageRequest(BaseModel):
    id: str = Field(..., min_length=1, max_length=80)
    title: str = Field(..., min_length=1, max_length=140)
    ingredients: list[str] = Field(..., min_items=1, max_items=25)
    # Optional: the recipe's method steps. When provided, we distill the
    # first step (usually the plating/knife instruction) into the prompt
    # so Gemini renders the dish *the way the recipe tells you to make
    # it* — e.g. thin sliced rounds vs. rough wedges.
    method: list[str] | None = None
    # Optional short one-liner overriding auto-derived plating (e.g.
    # "arranged as thin round slices from a mandolin"). Kept short so the
    # prompt stays focussed.
    plating: str | None = Field(default=None, max_length=280)


def make_router(db) -> APIRouter:
    router = APIRouter(prefix="/recipes", tags=["recipes"])
    _cached_image = make_cached_image(db)

    @router.post("/{recipe_id}/image")
    async def generate_recipe_image(recipe_id: str, req: RecipeImageRequest):
        # Basic sanity: URL id and body id must match — stops trivial spoofing.
        safe_id = re.sub(r"[^a-z0-9-]+", "", recipe_id.lower())
        if safe_id != recipe_id or safe_id != req.id:
            raise HTTPException(400, "Invalid recipe id")
        if not safe_id:
            raise HTTPException(400, "Missing recipe id")

        cache_key = f"recipe-image:{safe_id}"
        # Build a food-photo prompt from title + ingredients. Kept short so
        # Gemini has enough context but doesn't get overwhelmed. We hint
        # at the plating style (rustic, natural light) so the whole recipe
        # library shares one coherent editorial look.
        top_ingredients = ", ".join(
            i.split(",")[0].split("(")[0].strip()
            for i in req.ingredients[:8]
            if i.strip()
        )
        # Distil a plating hint from the recipe. Explicit `plating` wins;
        # otherwise the first sentence of the first method step (usually
        # "slice thin", "roast", "fry" etc.) gives Gemini the right shape.
        plating = (req.plating or "").strip()
        if not plating and req.method:
            first = (req.method[0] or "").strip()
            plating = first.split(".")[0][:160]
        plating_line = (
            f" Preparation cue: {plating}." if plating else ""
        )
        prompt = (
            f"An overhead food-photography photo of \"{req.title}\", plated on a "
            f"rustic ceramic plate on a weathered wooden table. Key ingredients "
            f"visible: {top_ingredients}.{plating_line} Soft natural window "
            f"light, shallow depth of field, a few sprigs of fresh herbs and a "
            f"linen napkin in frame. Editorial cookery magazine style. No "
            f"text, no cutlery labels, no people, no logos."
        )
        return await _cached_image(
            cache_key, prompt, session=f"recipe-img-{safe_id}-{uuid.uuid4()}"
        )

    @router.get("/{recipe_id}/image.jpg")
    async def get_recipe_image(recipe_id: str):
        """Serve the cached recipe image as raw bytes with a strong
        Cache-Control header so browsers store it across refreshes.

        Returns 404 if the image hasn't been generated yet — the frontend
        will then POST to warm the cache and retry."""
        safe_id = re.sub(r"[^a-z0-9-]+", "", recipe_id.lower())
        if not safe_id or safe_id != recipe_id:
            raise HTTPException(400, "Invalid recipe id")

        cached = await db.image_cache.find_one(
            {"key": f"recipe-image:{safe_id}"}, {"_id": 0, "image": 1}
        )
        if not cached:
            raise HTTPException(404, "Image not yet generated")

        # `image` is a data-URL: "data:image/jpeg;base64,....". Split into
        # mime + payload, decode, return the raw bytes.
        data_url = cached["image"]
        try:
            header, b64 = data_url.split(",", 1)
            mime = header.split(":", 1)[1].split(";", 1)[0] or "image/jpeg"
            body = base64.b64decode(b64)
        except Exception as e:  # noqa: BLE001
            logger.error("recipe image decode failed for %s: %s", safe_id, e)
            raise HTTPException(500, "Cached image corrupt")

        return Response(
            content=body,
            media_type=mime,
            headers={"Cache-Control": _IMAGE_CACHE_CONTROL},
        )

    return router
