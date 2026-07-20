"""Iteration 53 — SEC-002 (Bearer header on API) + SEC-003 (vote hardening).

Covers:
  • SEC-002: `Authorization: Bearer <token>` accepted on `/api/ask/sessions`
    equivalently to `?access_token=` query. Query wins when both set.
  • SEC-002: No token → 402. Free asset (audio preview) still unauthed 200.
  • SEC-003: `/api/ask/popular/{slug}/vote` dedupes same-IP repeated votes
    via `ask_vote_ledger`; response now carries `duplicate: true` on repeats.
  • SEC-003: Legit brigade (>=8 distinct IPs, hits>=20, down>up*2) triggers
    `hidden: true, pending_review: true`.
  • REGRESSION: Old leaked admin token (`patchpot-admin-d3f8a2b9c4`) → 403.
"""
import os
import uuid
from datetime import datetime, timezone
from pathlib import Path

import pytest
import requests

# ── Config ────────────────────────────────────────────────────────
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL")
if not BASE_URL:
    env = Path("/app/frontend/.env").read_text()
    for line in env.splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip()
            break
BASE_URL = BASE_URL.rstrip("/")

PAID_TOKEN = "test-token-pdf-smoke"
LEAKED_ADMIN = "patchpot-admin-d3f8a2b9c4"


def _real_admin_token():
    env = Path("/app/backend/.env").read_text()
    for line in env.splitlines():
        if line.startswith("ADMIN_TOKEN="):
            return line.split("=", 1)[1].strip().strip('"').strip("'")
    return None


def _mongo():
    env = Path("/app/backend/.env").read_text()
    mongo_url, db_name = None, None
    for line in env.splitlines():
        if line.startswith("MONGO_URL="):
            mongo_url = line.split("=", 1)[1].strip().strip('"').strip("'")
        elif line.startswith("DB_NAME="):
            db_name = line.split("=", 1)[1].strip().strip('"').strip("'")
    from pymongo import MongoClient
    return MongoClient(mongo_url), db_name


# ─────────────────────── SEC-002 (Bearer header) ─────────────────────
class TestSec002BearerHeader:
    """Middleware in server.py should accept Authorization: Bearer <t> on
    any /api/* request, and inject into ?access_token= if not already set."""

    def test_query_token_accepted(self):
        r = requests.get(
            f"{BASE_URL}/api/ask/sessions",
            params={"access_token": PAID_TOKEN},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_bearer_header_accepted(self):
        r = requests.get(
            f"{BASE_URL}/api/ask/sessions",
            headers={"Authorization": f"Bearer {PAID_TOKEN}"},
            timeout=15,
        )
        assert r.status_code == 200, r.text
        assert isinstance(r.json(), list)

    def test_bearer_header_wrong_token_402(self):
        r = requests.get(
            f"{BASE_URL}/api/ask/sessions",
            headers={"Authorization": "Bearer definitely-not-a-real-token"},
            timeout=15,
        )
        assert r.status_code == 402

    def test_no_token_402(self):
        r = requests.get(f"{BASE_URL}/api/ask/sessions", timeout=15)
        assert r.status_code == 402

    def test_query_wins_when_both_set(self):
        # Good query + bad header → still 200 (query wins)
        r = requests.get(
            f"{BASE_URL}/api/ask/sessions",
            params={"access_token": PAID_TOKEN},
            headers={"Authorization": "Bearer bad-header-token"},
            timeout=15,
        )
        assert r.status_code == 200

        # Bad query + good header → 402 (query wins)
        r = requests.get(
            f"{BASE_URL}/api/ask/sessions",
            params={"access_token": "bad-query-token"},
            headers={"Authorization": f"Bearer {PAID_TOKEN}"},
            timeout=15,
        )
        assert r.status_code == 402

    def test_free_audio_preview_still_open(self):
        # /api/calm/march-nh-w1/audio.mp3 is a free preview — should not
        # be broken by the bearer middleware.
        r = requests.get(f"{BASE_URL}/api/calm/march-nh-w1/audio.mp3", timeout=30)
        assert r.status_code == 200
        assert r.headers.get("content-type", "").startswith("audio/")
        assert len(r.content) > 10_000  # real MP3 body


# ─────────────────────── SEC-003 (vote hardening) ────────────────────
def _make_popular_entry(hits=1, up=0, down=0):
    """Insert a fake popular Q&A into ask_cache. Returns (key, slug).
    slug format matches ask.question_slug(): first 3 words + '-' + key[:6]."""
    client, db_name = _mongo()
    db = client[db_name]
    key = f"TEST_seckey_{uuid.uuid4().hex[:10]}"
    q_norm = "test sec question about voting"
    # Mirror ask.question_slug() exactly.
    slug = "test-sec-question-about-voting-" + key[:6]
    db.ask_cache.insert_one({
        "key": key,
        "question_normalized": q_norm,
        "answer_md": "Test answer body.",
        "hits": hits,
        "up_votes": up,
        "down_votes": down,
        "prior_hash": None,
        "hidden": False,
        "pending_review": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "region": "GB",
    })
    client.close()
    return key, slug


def _cleanup_entry(key):
    client, db_name = _mongo()
    db = client[db_name]
    db.ask_cache.delete_many({"key": key})
    db.ask_vote_ledger.delete_many({"key": key})
    client.close()


class TestSec003VoteHardening:
    """Requires the slug format produced by ask.question_slug — we peek
    into ask_cache to find the actual slug. Uses the exposed
    /api/ask/popular/{slug}/vote endpoint."""

    def test_slug_lookup_via_backend(self):
        # Sanity: our synthetic slug needs to be discoverable by the
        # vote endpoint's `key_prefix = slug.rsplit("-", 1)[1]` logic.
        key, slug = _make_popular_entry(hits=1)
        try:
            r = requests.post(
                f"{BASE_URL}/api/ask/popular/{slug}/vote",
                json={"vote": "up"},
                timeout=15,
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["up_votes"] >= 1
            assert data["auto_flagged"] is False
        finally:
            _cleanup_entry(key)

    def test_ip_dedup_downvote(self):
        """3 downvotes from same IP → only 1 counts, subsequent responses
        carry duplicate: true. Not auto-flagged (needs 8 votes, 4 IPs, hits >= 20)."""
        key, slug = _make_popular_entry(hits=1)
        try:
            responses = []
            for _ in range(3):
                r = requests.post(
                    f"{BASE_URL}/api/ask/popular/{slug}/vote",
                    json={"vote": "down"},
                    timeout=15,
                )
                assert r.status_code == 200, r.text
                responses.append(r.json())

            # First one — real vote
            assert responses[0].get("duplicate", False) is False
            assert responses[0]["down_votes"] == 1
            assert responses[0]["auto_flagged"] is False

            # 2nd and 3rd — dupes
            for i in (1, 2):
                assert responses[i].get("duplicate") is True, responses[i]
                assert responses[i]["down_votes"] == 1
                assert responses[i]["auto_flagged"] is False

            # Verify the ledger has exactly ONE (key, ip, down) entry
            client, db_name = _mongo()
            db = client[db_name]
            n = db.ask_vote_ledger.count_documents({"key": key, "vote": "down"})
            client.close()
            assert n == 1, f"Expected 1 ledger row, got {n}"
        finally:
            _cleanup_entry(key)

    def test_up_then_down_same_ip_both_count(self):
        """Same IP voting UP and then DOWN should both count (different
        direction), neither should be flagged as duplicate."""
        key, slug = _make_popular_entry(hits=1)
        try:
            r_up = requests.post(
                f"{BASE_URL}/api/ask/popular/{slug}/vote",
                json={"vote": "up"}, timeout=15,
            )
            assert r_up.status_code == 200
            up_data = r_up.json()
            assert up_data.get("duplicate", False) is False
            assert up_data["up_votes"] == 1

            r_down = requests.post(
                f"{BASE_URL}/api/ask/popular/{slug}/vote",
                json={"vote": "down"}, timeout=15,
            )
            assert r_down.status_code == 200
            down_data = r_down.json()
            assert down_data.get("duplicate", False) is False
            assert down_data["up_votes"] == 1
            assert down_data["down_votes"] == 1
            assert down_data["auto_flagged"] is False
        finally:
            _cleanup_entry(key)

    def test_auto_flag_requires_full_criteria(self):
        """Seed 8 distinct IPs directly into ask_vote_ledger + set the
        counters on ask_cache, then trigger ONE more vote (9th unique IP)
        to run the auto-flag check. Confirm entry gets hidden."""
        key, slug = _make_popular_entry(hits=25, up=0, down=8)
        try:
            client, db_name = _mongo()
            db = client[db_name]
            # Seed 8 distinct IPs, all downvotes.
            now = datetime.now(timezone.utc).isoformat()
            for i in range(8):
                db.ask_vote_ledger.insert_one({
                    "key": key, "ip": f"10.0.0.{i+1}",
                    "vote": "down", "created_at": now,
                })
            client.close()

            # Now trigger a 9th downvote (our test IP, distinct from the
            # seeded 10.0.0.x ones — should be counted, running total 9,
            # distinct_down_ips 9 >= max(4, 9//2=4), down > up*2, hits >= 20.
            r = requests.post(
                f"{BASE_URL}/api/ask/popular/{slug}/vote",
                json={"vote": "down"}, timeout=15,
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["down_votes"] == 9
            assert data["auto_flagged"] is True

            # Verify DB got hidden + pending_review.
            client, db_name = _mongo()
            db = client[db_name]
            row = db.ask_cache.find_one({"key": key}, {"_id": 0})
            client.close()
            assert row.get("hidden") is True, row
            assert row.get("pending_review") is True, row
        finally:
            _cleanup_entry(key)

    def test_auto_flag_blocked_when_hits_low(self):
        """Even with 8 distinct downvote IPs, if hits < 20 the entry must
        NOT be auto-flagged (SEC-003 raised the bar)."""
        key, slug = _make_popular_entry(hits=5, up=0, down=8)
        try:
            client, db_name = _mongo()
            db = client[db_name]
            now = datetime.now(timezone.utc).isoformat()
            for i in range(8):
                db.ask_vote_ledger.insert_one({
                    "key": key, "ip": f"10.0.1.{i+1}",
                    "vote": "down", "created_at": now,
                })
            client.close()

            r = requests.post(
                f"{BASE_URL}/api/ask/popular/{slug}/vote",
                json={"vote": "down"}, timeout=15,
            )
            assert r.status_code == 200, r.text
            data = r.json()
            assert data["auto_flagged"] is False

            client, db_name = _mongo()
            db = client[db_name]
            row = db.ask_cache.find_one({"key": key}, {"_id": 0})
            client.close()
            assert row.get("hidden") is False
        finally:
            _cleanup_entry(key)


# ─────────────────────── SEC-001 regression ──────────────────────────
class TestSec001Regression:
    def test_leaked_admin_token_rejected(self):
        r = requests.get(
            f"{BASE_URL}/api/admin/ai-usage",
            params={"token": LEAKED_ADMIN, "days": 30},
            timeout=15,
        )
        assert r.status_code == 403

    def test_real_admin_token_accepted(self):
        admin = _real_admin_token()
        assert admin, "ADMIN_TOKEN missing from /app/backend/.env"
        r = requests.get(
            f"{BASE_URL}/api/admin/ai-usage",
            params={"token": admin, "days": 30},
            timeout=15,
        )
        assert r.status_code == 200
