"""Operational admin endpoints — manual triggers for jobs that the monthly
cron also runs, plus the one-shot image prewarmer."""
import logging
import uuid

from fastapi import APIRouter

from cache_refresh import get_cron_status, refresh_monthly_guidance
from core import FLOWER_PORTRAITS, Region, make_cached_image
from seed_deep_dives import seed_deep_dives
from services_guidance import make_generate_and_cache_guidance

from ._shared import require_admin

logger = logging.getLogger(__name__)


def register_maintenance_routes(router: APIRouter, db) -> None:
    _cached_image = make_cached_image(db)
    _generate_and_cache_guidance = make_generate_and_cache_guidance(db)

    @router.post("/admin/refresh-guidance")
    async def admin_refresh_guidance(token: str):
        """Manually trigger the monthly cache refresh. Requires ADMIN_TOKEN."""
        require_admin(token)
        return await refresh_monthly_guidance(db, _generate_and_cache_guidance, Region)

    @router.get("/admin/cron-status")
    async def admin_cron_status(token: str):
        """Inspect the last-run output of the monthly refresh."""
        require_admin(token)
        return await get_cron_status(db)

    @router.post("/admin/seed-deep-dives")
    async def admin_seed_deep_dives(token: str, overwrite: bool = False):
        """Manually (re-)seed the 6 staff-authored deep-dive masterclasses."""
        require_admin(token)
        return await seed_deep_dives(db, overwrite=overwrite)

    @router.post("/admin/prune")
    async def admin_prune(token: str):
        """Manually trigger the stale-row pruner. Same logic the monthly cron runs."""
        from cache_refresh import _prune_stale
        require_admin(token)
        return await _prune_stale(db)

    @router.post("/admin/prewarm")
    async def prewarm_image_cache():
        """One-shot endpoint: generate every flower-card image that isn't
        already cached. Note: deliberately UN-gated — it's idempotent (skips
        cached rows) so the cost of running it is bounded by the catalogue
        size, and at one-time setup it's convenient not to need a token."""
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
            except Exception as e:  # noqa: BLE001
                logger.warning("prewarm failed for %s: %s", slug, e)
                failed.append(slug)
        return {"generated": generated, "skipped_cached": skipped, "failed": failed,
                "total": len(FLOWER_PORTRAITS)}

    @router.post("/admin/ask/clear-usage")
    async def admin_clear_ask_usage(token: str, access_token: str, date: str = ""):
        """Wipe one or all daily-usage rows for a given member's access_token.
        Admin-gated (requires ADMIN_TOKEN) so only the operator can call it.
        If `date` is supplied (YYYY-MM-DD), only that one row is removed;
        otherwise every row for that token is wiped (full reset). Returns the
        rows removed and the remaining usage history for verification."""
        require_admin(token)
        query: dict = {"access_token": access_token}
        if date:
            query["date"] = date
        result = await db.ask_usage.delete_many(query)
        remaining_cursor = db.ask_usage.find(
            {"access_token": access_token},
            {"_id": 0, "date": 1, "count": 1, "updated_at": 1},
        ).sort("date", -1).limit(14)
        remaining = [r async for r in remaining_cursor]
        return {
            "rows_removed": result.deleted_count,
            "scope": "single_date" if date else "all_dates",
            "date": date or None,
            "remaining_rows": remaining,
        }

    @router.get("/admin/ask/cache-stats")
    async def admin_ask_cache_stats(token: str):
        """Q&A cache observability — total entries, total reuses (hits) and
        the top 20 most-asked questions by hit count. A row's `hits` is 0
        the first time it's asked; each subsequent reuse increments it
        AND represents one LLM call we avoided."""
        require_admin(token)
        total = await db.ask_cache.count_documents({})
        agg_cursor = db.ask_cache.aggregate([
            {"$group": {"_id": None, "hits": {"$sum": "$hits"}}}
        ])
        agg = [r async for r in agg_cursor]
        total_hits = int(agg[0]["hits"]) if agg else 0
        top_cursor = db.ask_cache.find(
            {"hits": {"$gt": 0}},
            {"_id": 0, "question_normalized": 1, "hits": 1, "last_asked_at": 1},
        ).sort("hits", -1).limit(20)
        top = [r async for r in top_cursor]
        return {
            "total_entries": total,
            "total_llm_calls_avoided": total_hits,
            "top_reused_questions": top,
        }

    @router.post("/admin/ask/clear-cache")
    async def admin_clear_ask_cache(token: str):
        """Nuke the global Q&A cache. Use sparingly — every entry is a
        real LLM call we won't need to spend again. Kept for cases where
        the model gets swapped or an answer needs to be regenerated."""
        require_admin(token)
        result = await db.ask_cache.delete_many({})
        return {"rows_removed": result.deleted_count}

