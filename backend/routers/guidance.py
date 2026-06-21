"""Public AI gardening guidance endpoint.

The heavy lifting lives in `services_guidance.make_generate_and_cache_guidance`
so the PDF + admin refresh routes can reuse the same cache + prompt code.
"""
from fastapi import APIRouter

from core import GuidanceRequest
from services_guidance import make_generate_and_cache_guidance


def make_router(db) -> APIRouter:
    router = APIRouter()
    _generate_and_cache_guidance = make_generate_and_cache_guidance(db)

    @router.post("/guidance")
    async def get_guidance(req: GuidanceRequest):
        """Region + month + language -> AI-generated monthly gardening guidance."""
        return await _generate_and_cache_guidance(req, force=False)

    return router
