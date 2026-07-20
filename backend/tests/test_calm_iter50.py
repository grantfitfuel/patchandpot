"""Iteration 50 — 2-Minute Calm backend tests.

Verifies:
  - Public read endpoints (/calm/current, /calm/list, /calm/{slug})
  - Free preview (march-nh) vs. paywalled (june-nh) audio access
  - Admin authoring endpoints and 403 gating
"""
import os
from datetime import datetime, timezone

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # Fallback: read from frontend .env
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

ADMIN_TOKEN = "patchpot-admin-d3f8a2b9c4"
PAID_TOKEN = "test-token-pdf-smoke"

MONTHS = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
]


# ─── Fixtures ────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session", autouse=True)
def ensure_paid_grant():
    """Ensure the test-token-pdf-smoke grant exists in db.access_grants."""
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
    db_name = os.environ.get("DB_NAME", "test_database")
    client = MongoClient(mongo_url)
    db = client[db_name]
    db.access_grants.update_one(
        {"token": PAID_TOKEN},
        {"$set": {
            "token": PAID_TOKEN,
            "email": "test@test.com",
            "package_id": "lifetime",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }},
        upsert=True,
    )
    yield
    client.close()


# ─── Public read endpoints ───────────────────────────────────────────
class TestCalmPublic:
    def test_current_nh_july_locked_for_anon(self, api):
        r = api.get(f"{BASE_URL}/api/calm/current", params={"hemisphere": "nh"})
        assert r.status_code == 200
        data = r.json()
        # Whichever month is current, an anonymous, non-free-preview
        # month should be locked.
        current_month = datetime.now(timezone.utc).month
        expected_month_name = MONTHS[current_month - 1]
        assert data["slug"] == f"{expected_month_name}-nh"
        if not data.get("is_free_preview"):
            assert data.get("locked") is True
            assert data.get("blocks") == []
            assert data.get("transcript_display") == ""

    def test_current_sh_mirrors_nh(self, api):
        r = api.get(f"{BASE_URL}/api/calm/current", params={"hemisphere": "sh"})
        assert r.status_code == 200
        data = r.json()
        # SH mirror: month shifted by 6.
        current_month = datetime.now(timezone.utc).month
        mirrored = ((current_month - 1 + 6) % 12) + 1
        expected_month_name = MONTHS[mirrored - 1]
        assert data["slug"] == f"{expected_month_name}-nh"

    def test_current_invalid_hemisphere_400(self, api):
        r = api.get(f"{BASE_URL}/api/calm/current", params={"hemisphere": "xx"})
        assert r.status_code == 400

    def test_list_nh_returns_all_12(self, api):
        r = api.get(f"{BASE_URL}/api/calm/list", params={"hemisphere": "nh"})
        assert r.status_code == 200
        data = r.json()
        assert data["count"] == 12
        items = data["items"]
        assert len(items) == 12
        # Sorted by month ascending.
        months = [it["month"] for it in items]
        assert months == sorted(months)
        assert months == list(range(1, 13))
        # Each item has required fields, audio_generated is True.
        for it in items:
            assert it["slug"].endswith("-nh")
            assert isinstance(it["title"], str) and it["title"]
            assert isinstance(it["season_label"], str)
            assert it["audio_generated"] is True
            assert isinstance(it["duration_s"], (int, float))
            assert it["duration_s"] > 0
            assert isinstance(it["is_free_preview"], bool)

    def test_march_nh_free_preview_unlocked_anon(self, api):
        r = api.get(f"{BASE_URL}/api/calm/march-nh")
        assert r.status_code == 200
        data = r.json()
        assert data["is_free_preview"] is True
        assert data.get("locked") in (False, None)
        assert isinstance(data["blocks"], list) and len(data["blocks"]) > 0
        assert isinstance(data["transcript_display"], str)
        assert len(data["transcript_display"]) > 0

    def test_june_nh_locked_anon(self, api):
        r = api.get(f"{BASE_URL}/api/calm/june-nh")
        assert r.status_code == 200
        data = r.json()
        assert data.get("is_free_preview") is False
        assert data.get("locked") is True
        assert data["blocks"] == []
        assert data["transcript_display"] == ""

    def test_june_nh_unlocked_with_paid_token(self, api):
        r = api.get(
            f"{BASE_URL}/api/calm/june-nh",
            params={"access_token": PAID_TOKEN},
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("locked") in (False, None)
        assert len(data["blocks"]) > 0
        assert len(data["transcript_display"]) > 0


# ─── Audio serving ───────────────────────────────────────────────────
class TestCalmAudio:
    def test_march_nh_audio_free(self, api):
        r = api.get(f"{BASE_URL}/api/calm/march-nh/audio.mp3", stream=True)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("audio/mpeg")
        cl = int(r.headers.get("content-length", 0))
        # Expect ~1.5-2.5 MB; allow generous 0.5–5 MB tolerance.
        assert 500_000 < cl < 5_000_000, f"content-length={cl}"

    def test_june_nh_audio_paywall_anon(self, api):
        r = api.get(f"{BASE_URL}/api/calm/june-nh/audio.mp3")
        assert r.status_code == 402

    def test_june_nh_audio_with_paid_token(self, api):
        r = api.get(
            f"{BASE_URL}/api/calm/june-nh/audio.mp3",
            params={"access_token": PAID_TOKEN},
            stream=True,
        )
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("audio/mpeg")

    def test_bad_slug_404(self, api):
        r = api.get(f"{BASE_URL}/api/calm/nonexistent-nh/audio.mp3")
        assert r.status_code == 404


# ─── Admin endpoints ─────────────────────────────────────────────────
class TestCalmAdmin:
    def test_author_already_exists(self, api):
        r = api.post(
            f"{BASE_URL}/api/admin/calm/author",
            params={
                "month": 6,
                "hemisphere": "nh",
                "token": ADMIN_TOKEN,
                "force_reauthor": False,
            },
        )
        assert r.status_code == 200
        data = r.json()
        assert data.get("ok") is True
        assert data.get("already_exists") is True
        assert data.get("slug") == "june-nh"

    def test_admin_wrong_token_403(self, api):
        r = api.post(
            f"{BASE_URL}/api/admin/calm/author",
            params={
                "month": 6, "hemisphere": "nh", "token": "wrong",
                "force_reauthor": False,
            },
        )
        assert r.status_code == 403

    def test_admin_list_wrong_token_403(self, api):
        r = api.get(
            f"{BASE_URL}/api/admin/calm/list",
            params={"token": "wrong"},
        )
        assert r.status_code == 403

    def test_admin_list_full_detail(self, api):
        r = api.get(
            f"{BASE_URL}/api/admin/calm/list",
            params={"token": ADMIN_TOKEN},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["count"] == 12
        assert len(data["items"]) == 12
        for it in data["items"]:
            assert "blocks" in it
            assert "transcript_display" in it
            assert it.get("audio_generated") is True
            # voice_id is set after render
            assert "voice_id" in it
