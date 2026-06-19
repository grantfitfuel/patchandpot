"""Idempotent seeder for the 6 staff-authored deep-dive masterclasses.

The 6 deep dives were originally generated via the AI on-demand endpoint and
lived only in *preview* Mongo. When the user deployed to production, the
production database started empty and `DeepDiveSection` rendered nothing.

This module ships the same 6 rows as a committed JSON fixture so:
  - Every fresh deploy auto-seeds the deep dives on startup.
  - The seed is idempotent (upsert keyed on `cache_key` / `slug+language`).
  - Re-seeding is safe — it never overwrites a row that already has the same
    or richer content.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from pathlib import Path

logger = logging.getLogger(__name__)

SEED_FILE = Path(__file__).parent / "data" / "deep_dives_seed.json"


async def seed_deep_dives(db, *, overwrite: bool = False) -> dict:
    """Upsert the 6 deep-dive masterclasses into `generated_masterclasses`.

    overwrite=False (default): only writes rows that don't already exist for
    the same cache_key (slug+language). Safe to call on every boot.

    overwrite=True: replace existing rows with the bundled fixture content.
    Use via the admin endpoint when you intentionally want to roll back to
    the canonical staff copy (e.g. after a Mongo restore from an older backup).
    """
    if not SEED_FILE.exists():
        logger.warning("deep-dive seed file missing at %s — skipping", SEED_FILE)
        return {"seeded": 0, "skipped": 0, "overwritten": 0, "missing_file": True}

    with SEED_FILE.open("r", encoding="utf-8") as f:
        rows = json.load(f)

    seeded = skipped = overwritten = 0
    now = datetime.now(timezone.utc).isoformat()

    for row in rows:
        slug = row.get("slug")
        language = (row.get("language") or "en").lower()
        cache_key = row.get("cache_key") or f"{slug}|{language}"
        if not slug:
            continue

        existing = await db.generated_masterclasses.find_one(
            {"cache_key": cache_key}, {"_id": 0, "status": 1, "data.lessons": 1}
        )
        if existing and not overwrite:
            # If the existing row is partially generated (e.g. status='generating'
            # with no lessons), top it up with our canonical copy. Otherwise leave it.
            lessons_existing = ((existing.get("data") or {}).get("lessons") or [])
            if existing.get("status") == "ready" and lessons_existing:
                skipped += 1
                continue

        payload = dict(row)
        payload.setdefault("status", "ready")
        payload.setdefault("created_at", now)
        payload.setdefault("views", 1)
        payload["seeded_at"] = now

        await db.generated_masterclasses.update_one(
            {"cache_key": cache_key},
            {"$set": payload},
            upsert=True,
        )
        if existing:
            overwritten += 1
        else:
            seeded += 1

    status = {
        "seeded": seeded,
        "skipped": skipped,
        "overwritten": overwritten,
        "total_in_file": len(rows),
        "at": now,
    }
    logger.info("deep-dive seed complete: %s", status)
    return status
