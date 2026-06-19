"""Monthly cache refresh for /api/guidance.

The /api/guidance endpoint caches AI-generated monthly gardening advice in
`guidance_cache`, keyed by `name|country|climate|hemisphere|month|language|garden`.

On the 1st of every month (02:00 UTC), this job:
  1. Identifies popular (region, language) pairs already in the cache —
     ignoring per-user `my_garden` permutations, which regenerate lazily.
  2. For each, generates the *current* calendar month's guidance in advance,
     so the first visitor of the month gets an instant response.
  3. Optionally prunes very stale guidance rows (default: > 18 months old).

The job is idempotent: it skips pairs that already have current-month
guidance, so re-running it (e.g. through the admin endpoint) is safe.
"""
from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# How many distinct (region, language) pairs to refresh per run. Caps the
# Claude bill on the 1st of every month while still covering everyone who
# actually returns to the app regularly.
MAX_PAIRS_PER_RUN = 40

# Prune any guidance row whose `created_at` is older than this many days.
# 18 months: covers users returning seasonally without losing the "this time
# last year" historical view.
STALE_DAYS = 18 * 30


async def _list_warm_pairs(db, limit: int = MAX_PAIRS_PER_RUN) -> list[dict]:
    """Return the most recently-used (region, language) pairs from guidance_cache,
    deduplicated. We rely on the `region` payload written by
    `_generate_and_cache_guidance` (added when we extended the cache writer).
    """
    pipeline = [
        {"$match": {"kind": "guidance", "region": {"$exists": True}}},
        # Group by region+language (ignore per-user garden permutations).
        {"$sort": {"created_at": -1}},
        {"$group": {
            "_id": {
                "name": "$region.name",
                "country": "$region.country",
                "climate_zone": "$region.climate_zone",
                "hemisphere": "$region.hemisphere",
                "latitude": "$region.latitude",
                "longitude": "$region.longitude",
                "language": "$language",
            },
            "last_seen": {"$first": "$created_at"},
        }},
        {"$sort": {"last_seen": -1}},
        {"$limit": int(limit)},
    ]
    cursor = db.guidance_cache.aggregate(pipeline)
    out = []
    async for row in cursor:
        g = row.get("_id") or {}
        if not g.get("name"):
            continue
        out.append({
            "region": {
                "name": g.get("name"),
                "country": g.get("country"),
                "climate_zone": g.get("climate_zone"),
                "hemisphere": g.get("hemisphere") or "northern",
                "latitude": g.get("latitude"),
                "longitude": g.get("longitude"),
            },
            "language": (g.get("language") or "en").lower(),
        })
    return out


async def _prune_stale(db) -> int:
    """Delete guidance rows older than STALE_DAYS. Returns the number removed."""
    cutoff = datetime.now(timezone.utc).timestamp() - STALE_DAYS * 86400
    cutoff_iso = datetime.fromtimestamp(cutoff, tz=timezone.utc).isoformat()
    res = await db.guidance_cache.delete_many({
        "kind": "guidance",
        "created_at": {"$lt": cutoff_iso},
    })
    return int(res.deleted_count)


async def refresh_monthly_guidance(db, generate_fn, region_model) -> dict:
    """Pre-warm the current-month guidance cache for popular regions+languages.

    Parameters
    ----------
    db: motor AsyncIOMotorDatabase
    generate_fn: callable matching `_generate_and_cache_guidance(req, force=False)`
    region_model: pydantic model class (`Region`) used to build requests

    Returns a small status dict suitable for an admin endpoint.
    """
    started_at = datetime.now(timezone.utc)
    month = started_at.month
    pairs = await _list_warm_pairs(db)
    refreshed: list[str] = []
    skipped: list[str] = []
    errors: list[dict] = []

    # Import lazily — we need the GuidanceRequest schema from server.py at call
    # time so the module stays cycle-free at import.
    from server import GuidanceRequest  # type: ignore

    for pair in pairs:
        region = region_model(**pair["region"])
        lang = pair["language"]
        req = GuidanceRequest(region=region, month=month, language=lang, my_garden=None)
        try:
            # `force=False` short-circuits to the existing cached row if it's
            # already there — making this whole job a no-op on a fresh deploy
            # mid-month, and only doing real work on the 1st (when the new
            # month's key has never been generated yet).
            await generate_fn(req, force=False)
            refreshed.append(f"{region.name}|{lang}")
        except Exception as e:  # noqa: BLE001 — log & continue
            logger.exception("monthly cache refresh failed for %s/%s: %s", region.name, lang, e)
            errors.append({"key": f"{region.name}|{lang}", "error": str(e)[:200]})

    pruned = await _prune_stale(db)
    finished_at = datetime.now(timezone.utc)

    status = {
        "started_at": started_at.isoformat(),
        "finished_at": finished_at.isoformat(),
        "duration_seconds": round((finished_at - started_at).total_seconds(), 2),
        "month": month,
        "pairs_considered": len(pairs),
        "refreshed": len(refreshed),
        "skipped": len(skipped),
        "errors": errors,
        "pruned_stale_rows": pruned,
    }
    await db.cron_status.update_one(
        {"job": "guidance_monthly_refresh"},
        {"$set": {"job": "guidance_monthly_refresh", "last_run": status}},
        upsert=True,
    )
    return status


async def get_cron_status(db) -> dict:
    """Return the last-run snapshot for the admin endpoint."""
    row = await db.cron_status.find_one({"job": "guidance_monthly_refresh"}, {"_id": 0})
    return row or {"job": "guidance_monthly_refresh", "last_run": None}


def schedule_monthly_refresh(scheduler, db, generate_fn, region_model) -> None:
    """Register the monthly cron with the running AsyncIOScheduler."""
    from apscheduler.triggers.cron import CronTrigger

    async def _job():
        try:
            res = await refresh_monthly_guidance(db, generate_fn, region_model)
            logger.info("monthly guidance refresh complete: %s", res)
        except Exception as e:  # noqa: BLE001
            logger.exception("monthly guidance refresh crashed: %s", e)

    def _trampoline():
        # APScheduler's AsyncIOScheduler dispatches synchronously; wrap into
        # the running loop so we can await.
        try:
            asyncio.get_running_loop().create_task(_job())
        except RuntimeError:
            asyncio.run(_job())

    scheduler.add_job(
        _trampoline,
        CronTrigger(day=1, hour=2, minute=0, timezone="UTC"),
        id="guidance_monthly_refresh",
        name="Refresh /api/guidance cache for popular regions on the 1st of every month",
        replace_existing=True,
    )
