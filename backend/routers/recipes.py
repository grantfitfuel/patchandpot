"""Recipes router.

Currently exposes a single endpoint: `POST /api/recipes/{recipe_id}/image`
which generates (or returns a cached) Nano-Banana AI food-photo image for
one recipe. The recipe id + title + ingredient list are sent in the body
so we don't have to maintain a Python-side copy of the recipe corpus —
the frontend is the source of truth for /src/data/recipes.js.

The response shape mirrors PlantImage / PestImage:
    {"image": "data:image/png;base64,...", "cached": true|false}
"""
import logging
import re
import uuid

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from core import make_cached_image

logger = logging.getLogger(__name__)


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

    return router
