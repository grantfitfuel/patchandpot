"""Iteration 49 — Admin Ask Review Queue + Journal pin/tag metadata.

Covers:
  • GET  /api/admin/ask/pending-review        (list queue, admin-gated)
  • POST /api/admin/ask/review/{key}          (unhide / hide / bogus decision)
  • GET  /api/ask/journal/meta                (paywalled list)
  • POST /api/ask/journal/meta                (upsert pin/tag, ownership check)
  • DELETE /api/ask/sessions/{session_id}     (cascades ask_journal_meta)

Uses paid `test-token-pdf-smoke` (seeded in access_grants) and creates
its own throw-away session + user message so we can drive the meta
endpoints without touching real data. Cleans up after itself.
"""
import os
import asyncio
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

ADMIN_TOKEN = "patchpot-admin-d3f8a2b9c4"
PAID_TOKEN = "test-token-pdf-smoke"


def _mongo():
    """Return (sync pymongo client, db_name). Sync avoids event-loop
    lifecycle bugs when pytest re-enters asyncio.run() across tests."""
    env = Path("/app/backend/.env").read_text()
    mongo_url, db_name = None, None
    for line in env.splitlines():
        if line.startswith("MONGO_URL="):
            mongo_url = line.split("=", 1)[1].strip().strip('"').strip("'")
        elif line.startswith("DB_NAME="):
            db_name = line.split("=", 1)[1].strip().strip('"').strip("'")
    from pymongo import MongoClient
    return MongoClient(mongo_url), db_name


# ── Session seed (create a paid grant + a session + a user message) ─
@pytest.fixture(scope="module")
def seeded_session():
    """Ensure paid grant exists, seed one ask_session + one user ask_message.
    Yield (session_id, user_message_id). Teardown wipes everything created."""
    client, db_name = _mongo()
    db = client[db_name]
    session_id = f"TEST_sess_{uuid.uuid4().hex[:12]}"
    msg_id = f"TEST_msg_{uuid.uuid4().hex[:12]}"

    db.access_grants.update_one(
        {"token": PAID_TOKEN},
        {"$set": {"token": PAID_TOKEN, "email": "test@test.com", "package_id": "lifetime"}},
        upsert=True,
    )
    now = datetime.now(timezone.utc).isoformat()
    db.ask_sessions.insert_one({
        "id": session_id,
        "access_token": PAID_TOKEN,
        "title": "TEST session",
        "created_at": now,
        "last_message_at": now,
    })
    db.ask_messages.insert_one({
        "id": msg_id,
        "session_id": session_id,
        "role": "user",
        "content": "TEST question",
        "created_at": now,
    })

    yield session_id, msg_id

    db.ask_messages.delete_many({"session_id": session_id})
    db.ask_sessions.delete_many({"id": session_id})
    db.ask_journal_meta.delete_many({"access_token": PAID_TOKEN, "session_id": session_id})
    client.close()


# ═══════════════════════════════════════════════════════════════════
# Admin Ask Review Queue
# ═══════════════════════════════════════════════════════════════════
class TestAdminPendingReview:
    def test_valid_admin_token_returns_200_with_shape(self):
        r = requests.get(f"{BASE_URL}/api/admin/ask/pending-review",
                         params={"token": ADMIN_TOKEN}, timeout=15)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert "count" in body and "entries" in body
        assert isinstance(body["entries"], list)
        assert body["count"] == len(body["entries"])
        if body["entries"]:
            e = body["entries"][0]
            for field in ("key", "question_normalized", "answer", "hits",
                          "hidden", "up_votes", "down_votes",
                          "first_asked_at", "last_asked_at"):
                assert field in e, f"Missing field '{field}' in entry"

    def test_wrong_token_returns_403(self):
        r = requests.get(f"{BASE_URL}/api/admin/ask/pending-review",
                         params={"token": "not-the-real-token"}, timeout=15)
        assert r.status_code == 403, r.text[:300]

    def test_missing_token_returns_422(self):
        r = requests.get(f"{BASE_URL}/api/admin/ask/pending-review", timeout=15)
        assert r.status_code == 422, r.text[:300]


class TestAdminReviewDecision:
    def test_invalid_decision_returns_400(self):
        r = requests.post(f"{BASE_URL}/api/admin/ask/review/some-key",
                          params={"token": ADMIN_TOKEN, "decision": "xyz"}, timeout=15)
        assert r.status_code == 400, r.text[:300]

    def test_nonexistent_key_returns_ok_false(self):
        r = requests.post(f"{BASE_URL}/api/admin/ask/review/definitely-not-a-real-key-9999",
                          params={"token": ADMIN_TOKEN, "decision": "hide"}, timeout=15)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert body.get("ok") is False
        assert "not found" in (body.get("reason") or "").lower()

    def test_wrong_token_on_decision_returns_403(self):
        r = requests.post(f"{BASE_URL}/api/admin/ask/review/anykey",
                          params={"token": "bad", "decision": "hide"}, timeout=15)
        assert r.status_code == 403, r.text[:300]

    def test_decision_hide_then_unhide_cycles_flags(self):
        """End-to-end using a seeded cache entry so we don't tamper with
        the real pending-review row. Verifies the endpoint actually
        writes hidden + pending_review as documented."""
        client, db_name = _mongo()
        db = client[db_name]
        test_key = f"TEST_key_{uuid.uuid4().hex[:12]}"

        try:
            db.ask_cache.insert_one({
                "key": test_key,
                "question_normalized": "TEST question for review",
                "answer": "TEST answer",
                "hits": 1,
                "hidden": False,
                "pending_review": True,
                "up_votes": 0,
                "down_votes": 0,
                "first_asked_at": datetime.now(timezone.utc).isoformat(),
                "last_asked_at": datetime.now(timezone.utc).isoformat(),
            })

            # ── HIDE decision ───
            r = requests.post(f"{BASE_URL}/api/admin/ask/review/{test_key}",
                              params={"token": ADMIN_TOKEN, "decision": "hide"}, timeout=15)
            assert r.status_code == 200, r.text[:300]
            body = r.json()
            assert body["ok"] is True
            assert body["row"]["hidden"] is True
            assert body["row"]["pending_review"] is False

            row = db.ask_cache.find_one({"key": test_key}, {"_id": 0})
            assert row["hidden"] is True
            assert row["pending_review"] is False

            # After hiding, entry must NOT appear in pending-review list.
            list_r = requests.get(f"{BASE_URL}/api/admin/ask/pending-review",
                                  params={"token": ADMIN_TOKEN}, timeout=15)
            keys_after = {e["key"] for e in list_r.json()["entries"]}
            assert test_key not in keys_after

            # ── UNHIDE decision ───
            r = requests.post(f"{BASE_URL}/api/admin/ask/review/{test_key}",
                              params={"token": ADMIN_TOKEN, "decision": "unhide"}, timeout=15)
            assert r.status_code == 200, r.text[:300]
            body = r.json()
            assert body["ok"] is True
            assert body["row"]["hidden"] is False
            assert body["row"]["pending_review"] is False
        finally:
            db.ask_cache.delete_many({"key": test_key})
            client.close()


# ═══════════════════════════════════════════════════════════════════
# Journal metadata (paywall)
# ═══════════════════════════════════════════════════════════════════
class TestJournalMeta:
    def test_get_meta_paid_returns_shape(self, seeded_session):
        r = requests.get(f"{BASE_URL}/api/ask/journal/meta",
                         params={"access_token": PAID_TOKEN}, timeout=15)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        assert "count" in body and "meta" in body
        assert isinstance(body["meta"], list)

    def test_get_meta_no_token_returns_402(self):
        r = requests.get(f"{BASE_URL}/api/ask/journal/meta", timeout=15)
        assert r.status_code == 402, r.text[:300]

    def test_get_meta_bogus_token_returns_402(self):
        r = requests.get(f"{BASE_URL}/api/ask/journal/meta",
                         params={"access_token": "not-a-real-token-xxxx"}, timeout=15)
        assert r.status_code == 402, r.text[:300]

    def test_upsert_pin_then_tag_partial_update(self, seeded_session):
        session_id, msg_id = seeded_session
        # First write: pin only
        r = requests.post(f"{BASE_URL}/api/ask/journal/meta",
                          params={"access_token": PAID_TOKEN},
                          json={"user_message_id": msg_id, "session_id": session_id,
                                "pinned": True},
                          timeout=15)
        assert r.status_code == 200, r.text[:300]
        row = r.json()["row"]
        assert row["pinned"] is True

        # Verify persisted via GET
        r2 = requests.get(f"{BASE_URL}/api/ask/journal/meta",
                          params={"access_token": PAID_TOKEN}, timeout=15)
        entries = r2.json()["meta"]
        mine = [m for m in entries if m["user_message_id"] == msg_id]
        assert len(mine) == 1
        assert mine[0]["pinned"] is True

        # Partial update: only tag — pinned should stay True
        r3 = requests.post(f"{BASE_URL}/api/ask/journal/meta",
                           params={"access_token": PAID_TOKEN},
                           json={"user_message_id": msg_id, "session_id": session_id,
                                 "tag": "Tomato"},
                           timeout=15)
        assert r3.status_code == 200, r3.text[:300]
        row3 = r3.json()["row"]
        assert row3["tag"] == "Tomato"
        assert row3["pinned"] is True, "pinned should be preserved through partial update"

    def test_upsert_wrong_ownership_returns_404(self, seeded_session):
        session_id, _msg_id = seeded_session
        r = requests.post(f"{BASE_URL}/api/ask/journal/meta",
                          params={"access_token": PAID_TOKEN},
                          json={"user_message_id": "not-a-real-message-id",
                                "session_id": session_id,
                                "pinned": True},
                          timeout=15)
        assert r.status_code == 404, r.text[:300]
        assert "not found" in r.json().get("detail", "").lower()


# ═══════════════════════════════════════════════════════════════════
# Cascading delete: /api/ask/sessions/{id} → wipes ask_journal_meta
# ═══════════════════════════════════════════════════════════════════
class TestSessionDeleteCascade:
    def test_delete_session_wipes_journal_meta(self):
        """Create isolated session + message + journal meta row, then delete
        session and confirm the journal_meta row is gone."""
        client, db_name = _mongo()
        db = client[db_name]
        session_id = f"TEST_cascade_sess_{uuid.uuid4().hex[:8]}"
        msg_id = f"TEST_cascade_msg_{uuid.uuid4().hex[:8]}"

        try:
            now = datetime.now(timezone.utc).isoformat()
            db.ask_sessions.insert_one({
                "id": session_id, "access_token": PAID_TOKEN, "title": "TEST",
                "created_at": now, "last_message_at": now,
            })
            db.ask_messages.insert_one({
                "id": msg_id, "session_id": session_id, "role": "user",
                "content": "TEST", "created_at": now,
            })

            # Create a journal meta row via the API
            r = requests.post(f"{BASE_URL}/api/ask/journal/meta",
                              params={"access_token": PAID_TOKEN},
                              json={"user_message_id": msg_id, "session_id": session_id,
                                    "pinned": True, "tag": "Cascade"},
                              timeout=15)
            assert r.status_code == 200, r.text[:300]

            before = db.ask_journal_meta.count_documents(
                {"access_token": PAID_TOKEN, "session_id": session_id}
            )
            assert before == 1

            # Delete session
            r = requests.delete(f"{BASE_URL}/api/ask/sessions/{session_id}",
                                params={"access_token": PAID_TOKEN}, timeout=15)
            assert r.status_code == 200, r.text[:300]
            assert r.json().get("deleted") is True

            after = db.ask_journal_meta.count_documents(
                {"access_token": PAID_TOKEN, "session_id": session_id}
            )
            assert after == 0, "ask_journal_meta row was NOT cascaded on session delete"
        finally:
            db.ask_sessions.delete_many({"id": session_id})
            db.ask_messages.delete_many({"session_id": session_id})
            db.ask_journal_meta.delete_many({"session_id": session_id})
            client.close()


# ═══════════════════════════════════════════════════════════════════
# Regression — Ask Nàdar / popular still up
# ═══════════════════════════════════════════════════════════════════
class TestRegression:
    def test_ask_popular_still_lists(self):
        r = requests.get(f"{BASE_URL}/api/ask/popular", timeout=15)
        assert r.status_code == 200, r.text[:300]
        body = r.json()
        # tolerate shape variations
        assert isinstance(body, (list, dict))
