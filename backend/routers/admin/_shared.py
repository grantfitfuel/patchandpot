"""Shared admin helpers — auth check + pydantic payloads. Kept tiny and
import-cycle-free so every sub-module can pull from here without dragging
in routes."""
import os

from fastapi import HTTPException
from pydantic import BaseModel, Field


def require_admin(token: str) -> None:
    """Raise 503 if `ADMIN_TOKEN` env isn't configured, 403 if the supplied
    token doesn't match. Used as a guard at the top of every admin route.
    """
    admin_token = os.environ.get("ADMIN_TOKEN", "")
    if not admin_token:
        raise HTTPException(503, "ADMIN_TOKEN not configured")
    if token != admin_token:
        raise HTTPException(403, "Invalid token")


class PromotePlantPayload(BaseModel):
    """Curated-plant fields the admin can edit in the promote modal before
    saving. `id` defaults to the AI slug stripped of its `ai-` prefix so
    the URL stays clean (e.g. `ai-yarrow` → `yarrow`). `source_slug` is the
    original AI slug — we keep it on the row for traceability + to flag
    the matching `ai_plant_stats` row as promoted."""
    id: str = Field(..., min_length=2, max_length=80)
    source_slug: str = Field(..., min_length=2, max_length=120)
    name: str = Field(..., min_length=1, max_length=120)
    botanical_name: str = ""
    category: str = "Other"
    difficulty: str = "Medium"
    sun: str = "Full to partial"
    water: str = "Moderate"
    soil: str = "Well-drained"
    edible_part: str = "Ornamental"
    summary: str = ""
    container: bool = True
    tags: list[str] = []
