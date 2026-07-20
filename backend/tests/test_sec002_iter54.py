"""Iteration 54 — SEC-002 header-based auth verification (member Bearer,
admin X-Admin-Token) + backwards compat via legacy query params.

Covers the review_request items:
  1. Member paywall/auth on /api/ask/usage
     - Bearer header → 200 with usage payload
     - No auth → 402
     - Legacy ?access_token=... → 200 (backwards compat)
  2. Admin auth via header on /api/admin/ai-usage?days=7
     - X-Admin-Token header → 200
     - No auth → 422 (validation)
     - Wrong X-Admin-Token → 403
     - Legacy ?token=... → 200 (backwards compat)
  3. Admin clear-usage POST body flow (/api/admin/ask/clear-usage)
     - Header + JSON body → 200 with rows_removed
     - No header → 403
     - Wrong header → 403
  4. Admin geo endpoint (/api/admin/geo?days=7) w/ X-Admin-Token → 200
  5. Admin ask-review pending queue w/ X-Admin-Token → 200 with entries
  6. Admin calm list w/ X-Admin-Token → 200 with items

Prereq: db.access_grants has {token: 'test-token-pdf-smoke', package_id: 'lifetime'}.
"""
from __future__ import annotations

import os
from pathlib import Path

import pytest
import requests

# ── Config ────────────────────────────────────────────────────────────
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    env = Path("/app/frontend/.env").read_text()
    for line in env.splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip()
            break
BASE_URL = (BASE_URL or "").rstrip("/")

PAID_TOKEN = "test-token-pdf-smoke"


def _real_admin_token() -> str:
    env = Path("/app/backend/.env").read_text()
    for line in env.splitlines():
        if line.startswith("ADMIN_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return ""


ADMIN_TOKEN = _real_admin_token()


@pytest.fixture(scope="module", autouse=True)
def _seed_paid_grant():
    """Ensure test-token-pdf-smoke exists in access_grants (per
    /app/memory/test_credentials.md)."""
    from pymongo import MongoClient
    env = Path("/app/backend/.env").read_text()
    mongo_url = None
    db_name = None
    for line in env.splitlines():
        if line.startswith("MONGO_URL="):
            mongo_url = line.split("=", 1)[1].strip().strip('"').strip("'")
        elif line.startswith("DB_NAME="):
            db_name = line.split("=", 1)[1].strip().strip('"').strip("'")
    c = MongoClient(mongo_url)
    c[db_name].access_grants.update_one(
        {"token": PAID_TOKEN},
        {"$set": {
            "token": PAID_TOKEN,
            "email": "test@test.com",
            "package_id": "lifetime",
            "active": True,
        }},
        upsert=True,
    )
    c.close()
    yield


# ────────────────── 1. Member /api/ask/usage ────────────────────────
class TestMemberAskUsage:
    """SEC-002: Bearer header and legacy access_token= both work; no-auth 402."""

    def test_bearer_header_200(self):
        r = requests.get(
            f"{BASE_URL}/api/ask/usage",
            headers={"Authorization": f"Bearer {PAID_TOKEN}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # Response shape: {date, used, limit, remaining} or similar usage payload
        assert isinstance(data, dict)
        # sanity: must include at least one usage-related key
        assert any(k in data for k in ("used", "count", "remaining", "limit", "date")), data

    def test_no_auth_402_or_403(self):
        r = requests.get(f"{BASE_URL}/api/ask/usage", timeout=15)
        assert r.status_code in (402, 403), (
            f"Expected 402 or 403 for missing auth, got {r.status_code}: {r.text}"
        )

    def test_legacy_query_param_200(self):
        r = requests.get(
            f"{BASE_URL}/api/ask/usage",
            params={"access_token": PAID_TOKEN},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), dict)

    def test_bearer_wrong_token_402(self):
        r = requests.get(
            f"{BASE_URL}/api/ask/usage",
            headers={"Authorization": "Bearer not-a-real-token-xxx"},
            timeout=15,
        )
        assert r.status_code in (402, 403), r.text


# ────────────────── 2. Admin /api/admin/ai-usage ─────────────────────
class TestAdminAiUsage:
    def test_x_admin_token_header_200(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/ai-usage",
            headers={"X-Admin-Token": ADMIN_TOKEN},
            params={"days": 7},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, dict)
        # Should contain typical usage-board keys
        assert any(k in data for k in ("providers", "total", "summary", "days", "series", "budget")), data

    def test_no_auth_422(self):
        # Endpoint declares `token: str` as required Query — missing → 422.
        r = requests.get(f"{BASE_URL}/api/admin/ai-usage?days=7", timeout=15)
        assert r.status_code == 422, r.text

    def test_wrong_x_admin_token_403(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/ai-usage",
            headers={"X-Admin-Token": "wrong-admin-token-value"},
            params={"days": 7},
            timeout=15,
        )
        assert r.status_code == 403, r.text

    def test_legacy_query_token_200(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/ai-usage",
            params={"token": ADMIN_TOKEN, "days": 7},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), dict)


# ────────────────── 3. Admin clear-usage POST body ───────────────────
class TestAdminClearUsage:
    def test_header_plus_body_200(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/ask/clear-usage",
            headers={"X-Admin-Token": ADMIN_TOKEN},
            json={"access_token": "TEST_nonexistent_target_token", "date": "2026-01-01"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert "rows_removed" in data, data
        assert isinstance(data["rows_removed"], int)
        # Nothing to remove for this synthetic token → 0.
        assert data["rows_removed"] == 0

    def test_no_header_403(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/ask/clear-usage",
            json={"access_token": "TEST_nonexistent", "date": "2026-01-01"},
            timeout=15,
        )
        assert r.status_code == 403, r.text

    def test_wrong_header_403(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/ask/clear-usage",
            headers={"X-Admin-Token": "not-the-real-admin"},
            json={"access_token": "TEST_nonexistent", "date": "2026-01-01"},
            timeout=15,
        )
        assert r.status_code == 403, r.text

    def test_header_but_empty_access_token_400(self):
        r = requests.post(
            f"{BASE_URL}/api/admin/ask/clear-usage",
            headers={"X-Admin-Token": ADMIN_TOKEN},
            json={"access_token": "", "date": ""},
            timeout=15,
        )
        # Empty target member token → 400 (per _maintenance.py)
        assert r.status_code == 400, r.text


# ────────────────── 4. Admin geo ─────────────────────────────────────
class TestAdminGeo:
    def test_x_admin_header_200(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/geo",
            headers={"X-Admin-Token": ADMIN_TOKEN},
            params={"days": 7},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, dict)


# ────────────────── 5. Admin ask/pending-review ──────────────────────
class TestAdminAskPendingReview:
    def test_x_admin_header_200(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/ask/pending-review",
            headers={"X-Admin-Token": ADMIN_TOKEN},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        # Endpoint returns either a list or {entries: [...]} — both OK.
        assert isinstance(data, (list, dict))


# ────────────────── 6. Admin calm/list ───────────────────────────────
class TestAdminCalmList:
    def test_x_admin_header_200(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/calm/list",
            headers={"X-Admin-Token": ADMIN_TOKEN},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        data = r.json()
        assert isinstance(data, (list, dict))


# ────────────────── URL leak sanity check ────────────────────────────
class TestNoTokenInUrl:
    """Meta-check: when the frontend uses api.js helpers with header-only
    auth, the server must accept the request with NO query token. These
    tests ensure the middleware still injects the header into query
    correctly, so downstream `token: str = Query(...)` sees a value."""

    def test_admin_ai_usage_header_only_no_query_token(self):
        # No `token=` in the URL — only the header. Middleware injects it.
        r = requests.get(
            f"{BASE_URL}/api/admin/ai-usage?days=7",
            headers={"X-Admin-Token": ADMIN_TOKEN},
            timeout=15,
        )
        assert r.status_code == 200, r.text

    def test_ask_usage_header_only_no_query_access_token(self):
        r = requests.get(
            f"{BASE_URL}/api/ask/usage",
            headers={"Authorization": f"Bearer {PAID_TOKEN}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
