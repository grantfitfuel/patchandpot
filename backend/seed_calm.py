"""Idempotent Calm-variants seeder.

The 96 monthly × hemisphere × week Calm scripts (`calm_variants` docs) are
authored via Claude + rendered via ElevenLabs — expensive to regenerate.
They're captured as `/app/backend/data/calm_seed/variants.json` (a
git-tracked snapshot exported from the preview MongoDB) and this seeder
imports them on startup.

Behaviour (idempotent + additive — safe on every deploy):
  - If a slug is missing from the DB → insert the full row.
  - If a slug is present → patch in any voice entries the DB doesn't yet
    have (e.g. new narrators shipped after the previous deploy) without
    touching existing voice entries or user-editable fields.

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
    """Merge `calm_variants` rows from the JSON snapshot into the DB.

    Two-phase merge:
      1. Missing slugs → insert full document.
      2. Existing slugs → union the `voices` map so new narrators show up
         without wiping any voice a user already has (e.g. if they've
         re-rendered a track).
    """
    if not _SEED_PATH.exists():
        return {"skipped": True, "reason": "no seed file"}

    with _SEED_PATH.open() as f:
        rows = json.load(f)
    if not rows:
        return {"skipped": True, "reason": "empty seed file"}

    inserted = 0
    voice_patched = 0
    slugs_touched: list[str] = []

    for row in rows:
        slug = row.get("slug")
        if not slug:
            continue
        existing = await db.calm_variants.find_one({"slug": slug}, {"voices": 1})
        if not existing:
            await db.calm_variants.insert_one(row)
            inserted += 1
            slugs_touched.append(slug)
            continue

        existing_voices = existing.get("voices") or {}
        seed_voices = row.get("voices") or {}
        missing = {vk: vd for vk, vd in seed_voices.items() if vk not in existing_voices}
        if not missing:
            continue

        # Nested field updates so we NEVER clobber a voice the DB already has.
        set_ops = {f"voices.{vk}": vd for vk, vd in missing.items()}
        await db.calm_variants.update_one({"slug": slug}, {"$set": set_ops})
        voice_patched += 1
        slugs_touched.append(slug)

    result = {
        "inserted": inserted,
        "voice_patched": voice_patched,
        "unchanged": len(rows) - inserted - voice_patched,
    }
    if slugs_touched:
        # Log a small sample so ops can spot-check without spamming.
        result["sample_slugs"] = slugs_touched[:5]
    return result
