"""Tests for the patch_limit field on POST /api/access/check.

Verifies the server-authoritative cap that gates the multi-patch feature:
- No / bogus token  → patch_limit = 5 (FREE_PATCH_LIMIT)
- Valid lifetime grant → patch_limit = 25 (PAID_PATCH_LIMIT)
- Expired grant → paid=false, patch_limit = 5
Cleans up its own seeded grant after the run.
"""
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, "/app/backend")
from core import FREE_PATCH_LIMIT, PAID_PATCH_LIMIT  # noqa: E402

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://grow-by-season-1.preview.emergentagent.com",
).rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

TOKEN_PAID = f"TEST_patchlimit_paid_{uuid.uuid4().hex[:8]}"
TOKEN_EXPIRED = f"TEST_patchlimit_expired_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module", autouse=True)
def seed_and_cleanup():
    """Seed one active lifetime grant + one expired annual grant."""
    import asyncio

    async def seed():
        cli = AsyncIOMotorClient(MONGO_URL)
        db = cli[DB_NAME]
        now = datetime.now(timezone.utc)
        await db.access_grants.update_one(
            {"token": TOKEN_PAID},
            {"$set": {
                "token": TOKEN_PAID,
                "package_id": "lifetime",
                "granted_at": now.isoformat(),
                "expires_at": None,
            }},
            upsert=True,
        )
        await db.access_grants.update_one(
            {"token": TOKEN_EXPIRED},
            {"$set": {
                "token": TOKEN_EXPIRED,
                "package_id": "annual",
                "granted_at": (now - timedelta(days=400)).isoformat(),
                "expires_at": (now - timedelta(days=1)).isoformat(),
            }},
            upsert=True,
        )
        cli.close()

    async def cleanup():
        cli = AsyncIOMotorClient(MONGO_URL)
        db = cli[DB_NAME]
        await db.access_grants.delete_many({"token": {"$in": [TOKEN_PAID, TOKEN_EXPIRED]}})
        cli.close()

    asyncio.get_event_loop().run_until_complete(seed())
    yield
    asyncio.get_event_loop().run_until_complete(cleanup())


def _post(token):
    r = requests.post(
        f"{BASE_URL}/api/access/check",
        json={"token": token},
        timeout=10,
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_empty_token_free_limit():
    body = _post("")
    assert body["paid"] is False
    assert body["patch_limit"] == FREE_PATCH_LIMIT


def test_bogus_token_free_limit():
    body = _post(f"no_such_token_{uuid.uuid4().hex}")
    assert body["paid"] is False
    assert body["patch_limit"] == FREE_PATCH_LIMIT


def test_paid_lifetime_gets_paid_limit():
    body = _post(TOKEN_PAID)
    assert body["paid"] is True
    assert body["package_id"] == "lifetime"
    assert body["patch_limit"] == PAID_PATCH_LIMIT


def test_expired_grant_falls_back_to_free_limit():
    body = _post(TOKEN_EXPIRED)
    assert body["paid"] is False
    assert body["expired"] is True
    # Expired = no longer entitled, so cap drops back to free tier.
    assert body["patch_limit"] == FREE_PATCH_LIMIT


def test_constants_sane():
    assert FREE_PATCH_LIMIT == 5
    assert PAID_PATCH_LIMIT == 25
    assert PAID_PATCH_LIMIT > FREE_PATCH_LIMIT
