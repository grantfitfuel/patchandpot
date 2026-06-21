"""Admin/maintenance endpoints — all token-gated.

Includes:
- `/admin/refresh-guidance` — manually trigger the monthly AI guidance refresh
- `/admin/cron-status`      — inspect the last cron run output
- `/admin/seed-deep-dives`  — idempotently re-seed staff masterclasses
- `/admin/prewarm`          — generate every flower-card image not already cached
"""
import logging
import os
import uuid

from fastapi import APIRouter, HTTPException

from cache_refresh import get_cron_status, refresh_monthly_guidance
from core import FLOWER_PORTRAITS, Region, make_cached_image
from seed_deep_dives import seed_deep_dives
from services_guidance import make_generate_and_cache_guidance

logger = logging.getLogger(__name__)


def _require_admin(token: str):
    admin_token = os.environ.get("ADMIN_TOKEN", "")
    if not admin_token:
        raise HTTPException(503, "ADMIN_TOKEN not configured")
    if token != admin_token:
        raise HTTPException(403, "Invalid token")


def make_router(db) -> APIRouter:
    router = APIRouter()
    _cached_image = make_cached_image(db)
    _generate_and_cache_guidance = make_generate_and_cache_guidance(db)

    @router.post("/admin/refresh-guidance")
    async def admin_refresh_guidance(token: str):
        """Manually trigger the monthly cache refresh. Requires ADMIN_TOKEN."""
        _require_admin(token)
        return await refresh_monthly_guidance(db, _generate_and_cache_guidance, Region)

    @router.get("/admin/cron-status")
    async def admin_cron_status(token: str):
        """Inspect the last-run output of the monthly refresh."""
        _require_admin(token)
        return await get_cron_status(db)

    @router.post("/admin/seed-deep-dives")
    async def admin_seed_deep_dives(token: str, overwrite: bool = False):
        """Manually (re-)seed the 6 staff-authored deep-dive masterclasses."""
        _require_admin(token)
        return await seed_deep_dives(db, overwrite=overwrite)

    @router.post("/admin/prewarm")
    async def prewarm_image_cache():
        """One-shot endpoint: generate every flower-card image that isn't already cached."""
        generated, skipped, failed = 0, 0, []
        for slug, subject in FLOWER_PORTRAITS.items():
            key = f"masterclass-card:{slug}"
            existing = await db.image_cache.find_one({"key": key}, {"_id": 1})
            if existing:
                skipped += 1
                continue
            try:
                await _cached_image(
                    key=key,
                    prompt=f"A beautiful photograph of {subject}. natural daylight, soft focus, "
                           f"terracotta and cream palette, botanical editorial magazine style, "
                           f"shallow depth of field, no text, no people, no logos.",
                    session=f"prewarm-{slug}-{uuid.uuid4()}",
                )
                generated += 1
            except Exception as e:
                logger.warning("prewarm failed for %s: %s", slug, e)
                failed.append(slug)
        return {"generated": generated, "skipped_cached": skipped, "failed": failed,
                "total": len(FLOWER_PORTRAITS)}

    return router
