"""Live HTTP tests for the admin cron endpoints and /api/guidance regression."""
import os
import time
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")

# Use the public URL (REACT_APP_BACKEND_URL) — k8s ingress routes /api → :8001
FRONTEND_ENV = BACKEND_DIR.parent / "frontend" / ".env"
load_dotenv(FRONTEND_ENV)
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
TOKEN = os.environ["ADMIN_TOKEN"]


# ------------------- /api/admin/cron-status -------------------

def test_cron_status_with_valid_token():
    r = requests.get(f"{BASE_URL}/api/admin/cron-status", params={"token": TOKEN}, timeout=20)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data.get("job") == "guidance_monthly_refresh"
    assert "last_run" in data  # may be null on fresh boot


def test_cron_status_missing_token_returns_422():
    r = requests.get(f"{BASE_URL}/api/admin/cron-status", timeout=20)
    assert r.status_code == 422, r.text


def test_cron_status_wrong_token_returns_403():
    r = requests.get(f"{BASE_URL}/api/admin/cron-status", params={"token": "wrong"}, timeout=20)
    assert r.status_code == 403, r.text


# ------------------- /api/admin/refresh-guidance -------------------

def test_refresh_guidance_wrong_token_returns_403():
    r = requests.post(f"{BASE_URL}/api/admin/refresh-guidance", params={"token": "nope"}, timeout=20)
    assert r.status_code == 403, r.text


def test_refresh_guidance_returns_shape_and_is_idempotent():
    # First call
    r1 = requests.post(
        f"{BASE_URL}/api/admin/refresh-guidance",
        params={"token": TOKEN},
        timeout=120,
    )
    assert r1.status_code == 200, r1.text
    d1 = r1.json()
    for key in [
        "started_at", "finished_at", "duration_seconds", "month",
        "pairs_considered", "refreshed", "errors", "pruned",
    ]:
        assert key in d1, f"missing {key} in {d1}"
    assert isinstance(d1["errors"], list)
    assert isinstance(d1["pairs_considered"], int)
    assert isinstance(d1["refreshed"], int)

    # Second call: must be fast (<2s) — current month rows are now cached,
    # generate_fn short-circuits.
    t0 = time.time()
    r2 = requests.post(
        f"{BASE_URL}/api/admin/refresh-guidance",
        params={"token": TOKEN},
        timeout=120,
    )
    elapsed = time.time() - t0
    assert r2.status_code == 200, r2.text
    d2 = r2.json()
    assert d2["refreshed"] == d1["refreshed"], (d1, d2)
    assert d2["duration_seconds"] < 2.0, f"idempotent re-run too slow: {d2['duration_seconds']}s"
    assert elapsed < 5.0, f"HTTP round-trip too slow: {elapsed}s"


# ------------------- /api/guidance regression -------------------

def test_guidance_endpoint_still_returns_standard_shape_and_writes_region_kind():
    payload = {
        "region": {
            "name": "London",
            "country": "United Kingdom",
            "climate_zone": "Temperate Oceanic",
            "hemisphere": "northern",
            "latitude": 51.5,
            "longitude": -0.13,
        },
        "month": 1,
        "language": "en",
        "my_garden": None,
    }
    r = requests.post(f"{BASE_URL}/api/guidance", json=payload, timeout=120)
    assert r.status_code == 200, r.text
    data = r.json()
    for key in ["summary", "season_label", "plant_now", "harvest_now", "tasks", "pests", "tip"]:
        assert key in data, f"missing {key} in guidance response: {list(data.keys())}"

    # Now inspect Mongo directly for the cache row.
    async def _check():
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = client[os.environ["DB_NAME"]]
        row = await db.guidance_cache.find_one(
            {"kind": "guidance", "region.name": "London", "language": "en", "month": 1},
            {"_id": 0},
        )
        client.close()
        return row

    row = asyncio.run(_check())
    assert row is not None, "guidance_cache row not written for London/en/1"
    assert row.get("kind") == "guidance"
    assert "region" in row and isinstance(row["region"], dict)
    assert row["region"].get("name") == "London"
