"""Idempotent Calm-variants seeder.

The 96 monthly × hemisphere × week Calm scripts (`calm_variants` docs) are
authored via Claude + rendered via ElevenLabs — expensive to regenerate.
They're captured as `/app/backend/data/calm_seed/variants.json` (a
git-tracked snapshot exported from the preview MongoDB) and this seeder
imports them on startup when the target DB is empty.

Runs at every startup but is idempotent:
  - If `calm_variants` already has any documents → no-op.
  - Otherwise → bulk-insert every row from the JSON snapshot.

The MP3 audio files live under `/app/backend/data/calm/*.mp3` and are
already tracked in git, so the seeded DB rows will line up with real
audio on disk after every deploy.
"""
import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

_SEED_PATH = Path(__file__).parent / "data" / "calm_seed" / "variants.json"


async def seed_calm_variants(db) -> dict:
    """Insert `calm_variants` rows from the JSON snapshot iff collection is empty."""
    if not _SEED_PATH.exists():
        return {"skipped": True, "reason": "no seed file"}

    existing = await db.calm_variants.count_documents({})
    if existing > 0:
        return {"skipped": True, "reason": f"already has {existing} rows"}

    with _SEED_PATH.open() as f:
        rows = json.load(f)
    if not rows:
        return {"skipped": True, "reason": "empty seed file"}

    await db.calm_variants.insert_many(rows)
    return {"inserted": len(rows)}
