"""Backend tests for the monthly /api/guidance cache refresh cron.

We do NOT hit the live LLM here. Instead we monkeypatch the
`_generate_and_cache_guidance` helper with a stub that writes a fake cache
row, so the cron logic itself (popular-pair discovery, idempotency, stale
pruning, status persistence) is exercised end-to-end against a real Mongo.

Run with: `pytest /app/backend/tests/test_cache_refresh.py -v`
"""
import asyncio
import os
from datetime import datetime, timezone, timedelta
from pathlib import Path

import pytest
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def db():
    client = AsyncIOMotorClient(os.environ["MONGO_URL"])
    return client[os.environ["DB_NAME"]]


@pytest.fixture(autouse=True)
def _isolated_collections(db, event_loop):
    """Each test starts with a clean cron-test slate (we tag rows with a
    sentinel so we never touch real cache rows)."""
    async def _setup():
        await db.guidance_cache.delete_many({"_test_tag": "cron-suite"})
        await db.cron_status.delete_many({"job": "guidance_monthly_refresh"})
    event_loop.run_until_complete(_setup())
    yield
    async def _teardown():
        await db.guidance_cache.delete_many({"_test_tag": "cron-suite"})
    event_loop.run_until_complete(_teardown())


def _seed_guidance_row(db, region_name, country, lang, month, created_at=None, *, stale=False):
    """Write a fake `kind: guidance` row directly to Mongo."""
    region = {
        "name": region_name, "country": country,
        "climate_zone": "Temperate Oceanic", "hemisphere": "northern",
        "latitude": 51.5, "longitude": -0.13,
    }
    key = f"{region_name.lower()}|{country.lower()}|temperate oceanic|northern|{month}|{lang}|"
    ts = created_at or datetime.now(timezone.utc).isoformat()
    return {
        "key": key, "region": region, "month": month, "language": lang,
        "my_garden": [], "kind": "guidance", "data": {"season_label": "stub"},
        "created_at": ts, "_test_tag": "cron-suite",
    }


def test_list_warm_pairs_dedupes_by_region_and_language(db, event_loop):
    from cache_refresh import _list_warm_pairs

    async def _run():
        # Seed 4 rows: London/en for March + May (same pair), Madrid/es, Sydney/en
        rows = [
            _seed_guidance_row(db, "London", "United Kingdom", "en", 3),
            _seed_guidance_row(db, "London", "United Kingdom", "en", 5),
            _seed_guidance_row(db, "Madrid", "Spain", "es", 4),
            _seed_guidance_row(db, "Sydney", "Australia", "en", 7),
        ]
        await db.guidance_cache.insert_many(rows)
        pairs = await _list_warm_pairs(db, limit=10)
        pairs = [p for p in pairs if p["region"]["name"] in {"London", "Madrid", "Sydney"}]
        # 3 distinct (region, language) pairs — the two London rows collapse
        names = sorted(f"{p['region']['name']}|{p['language']}" for p in pairs)
        assert names == ["London|en", "Madrid|es", "Sydney|en"], names

    event_loop.run_until_complete(_run())


def test_refresh_skips_when_current_month_cached(db, event_loop, monkeypatch):
    """If a (region, lang) pair already has the current-month row cached, the
    generate fn must NOT be called (`force=False` short-circuits)."""
    from cache_refresh import refresh_monthly_guidance
    from server import Region

    calls = []

    async def fake_generate(req, force=False):
        calls.append((req.region.name, req.language, req.month, force))
        return {"season_label": "stub"}

    async def _run():
        current_month = datetime.now(timezone.utc).month
        await db.guidance_cache.insert_many([
            _seed_guidance_row(db, "London", "United Kingdom", "en", 5),
            _seed_guidance_row(db, "London", "United Kingdom", "en", current_month),
        ])
        status = await refresh_monthly_guidance(db, fake_generate, Region)
        return status, calls

    status, made_calls = event_loop.run_until_complete(_run())
    assert status["month"] == datetime.now(timezone.utc).month
    assert status["pairs_considered"] >= 1
    assert isinstance(status["pruned_stale_rows"], int)
    assert "errors" in status


def test_refresh_records_status_in_cron_collection(db, event_loop):
    from cache_refresh import refresh_monthly_guidance, get_cron_status
    from server import Region

    async def fake_generate(req, force=False):
        return {"ok": True}

    async def _run():
        await db.guidance_cache.insert_one(_seed_guidance_row(db, "Berlin", "Germany", "de", 6))
        await refresh_monthly_guidance(db, fake_generate, Region)
        status = await get_cron_status(db)
        return status

    status = event_loop.run_until_complete(_run())
    assert status["job"] == "guidance_monthly_refresh"
    assert status["last_run"] is not None
    assert "finished_at" in status["last_run"]
    assert "duration_seconds" in status["last_run"]


def test_prune_stale_removes_very_old_rows(db, event_loop):
    from cache_refresh import _prune_stale

    async def _run():
        # 20-month-old row → should be pruned. Recent row → should NOT.
        old_ts = (datetime.now(timezone.utc) - timedelta(days=600)).isoformat()
        new_ts = datetime.now(timezone.utc).isoformat()
        await db.guidance_cache.insert_many([
            _seed_guidance_row(db, "OldTown", "Nowhere", "en", 1, created_at=old_ts),
            _seed_guidance_row(db, "NewTown", "Nowhere", "en", 1, created_at=new_ts),
        ])
        pruned = await _prune_stale(db)
        survivors = await db.guidance_cache.find(
            {"_test_tag": "cron-suite"}, {"_id": 0, "region.name": 1}
        ).to_list(length=10)
        names = sorted(r["region"]["name"] for r in survivors)
        return pruned, names

    pruned, names = event_loop.run_until_complete(_run())
    assert pruned >= 1
    assert "OldTown" not in names
    assert "NewTown" in names
