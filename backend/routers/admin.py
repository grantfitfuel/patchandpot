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

    @router.post("/admin/prune")
    async def admin_prune(token: str):
        """Manually trigger the stale-row pruner. Same logic the monthly cron runs."""
        from cache_refresh import _prune_stale
        _require_admin(token)
        return await _prune_stale(db)

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

    @router.get("/admin/ai-usage")
    async def admin_ai_usage(token: str, days: int = 30):
        """Estimate AI spend over the last `days`. We don't bill per token here —
        instead we count rows in each cache and apply rough cost factors per row
        (Sonnet base = 1 unit, Haiku translation = 0.25 unit, image = 0.15 unit).
        Use it as a relative budget signal, not a literal pound figure."""
        from datetime import datetime, timedelta, timezone
        from core import refresh_ai_budget_state, AI_MONTHLY_BUDGET_GBP

        _require_admin(token)
        days = max(1, min(int(days), 365))
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

        # Rough cost factors — proportional units, not currency.
        WEIGHT_SONNET = 1.0      # full guidance / plant-guide EN generation
        WEIGHT_HAIKU = 0.25      # ~4× cheaper per call
        WEIGHT_IMAGE = 0.15      # Nano Banana per image

        # `guidance-base` rows with language='en' are the expensive Sonnet calls.
        sonnet_base = await db.guidance_cache.count_documents({
            "kind": "guidance-base", "language": "en", "created_at": {"$gte": since},
        })
        # Non-EN `guidance-base` rows are Haiku translations.
        haiku_base_trans = await db.guidance_cache.count_documents({
            "kind": "guidance-base", "language": {"$ne": "en"}, "created_at": {"$gte": since},
        })
        # `guidance` rows with garden = small Haiku personalisation call.
        garden_personalised = await db.guidance_cache.count_documents({
            "kind": "guidance",
            "my_garden": {"$exists": True, "$not": {"$size": 0}},
            "created_at": {"$gte": since},
        })
        # Plant-guide AI rows: EN are Sonnet, others are Haiku translations.
        plant_guide_total = await db.guidance_cache.count_documents({
            "key": {"$regex": "^plant-guide:ai-"}, "created_at": {"$gte": since},
        })
        plant_guide_en = await db.guidance_cache.count_documents({
            "key": {"$regex": "^plant-guide:ai-.*:en$"}, "created_at": {"$gte": since},
        })
        plant_guide_other = plant_guide_total - plant_guide_en
        # Arrangement suggestions — Sonnet.
        arrangements = await db.arrangement_cache.count_documents({"created_at": {"$gte": since}})
        # Masterclasses — Sonnet (single big call each).
        masterclasses = await db.generated_masterclasses.count_documents({"created_at": {"$gte": since}})
        # Images — Nano Banana.
        images = await db.image_cache.count_documents({"created_at": {"$gte": since}})

        sonnet_calls = sonnet_base + plant_guide_en + arrangements + masterclasses
        haiku_calls = haiku_base_trans + garden_personalised + plant_guide_other
        units = round(
            sonnet_calls * WEIGHT_SONNET
            + haiku_calls * WEIGHT_HAIKU
            + images * WEIGHT_IMAGE,
            1,
        )

        # Side-effect: refresh the budget circuit-breaker state from the same
        # data we just counted. Means hitting this endpoint also keeps the
        # cap accurate for any in-flight LLM calls.
        budget_state = await refresh_ai_budget_state(db)

        return {
            "window_days": days,
            "since": since,
            "calls": {
                "sonnet": {
                    "guidance_base_en": sonnet_base,
                    "plant_guide_en": plant_guide_en,
                    "arrangements": arrangements,
                    "masterclasses": masterclasses,
                    "total": sonnet_calls,
                },
                "haiku": {
                    "guidance_base_translations": haiku_base_trans,
                    "garden_personalisations": garden_personalised,
                    "plant_guide_translations": plant_guide_other,
                    "total": haiku_calls,
                },
                "images": images,
            },
            "relative_cost_units": units,
            "weights": {"sonnet": WEIGHT_SONNET, "haiku": WEIGHT_HAIKU, "image": WEIGHT_IMAGE},
            "budget": {
                "monthly_cap_gbp": AI_MONTHLY_BUDGET_GBP,
                "estimated_30d_gbp": budget_state.get("estimated_gbp"),
                "over_budget": budget_state.get("over_budget"),
                "enabled": AI_MONTHLY_BUDGET_GBP > 0,
            },
            "note": (
                "Units are proportional, not currency. Sonnet ≈ 4× Haiku per call. "
                "When `over_budget` is true, all new AI generation returns 503; "
                "cache hits still serve normally."
            ),
        }

    return router
