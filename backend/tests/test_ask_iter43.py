"""
Iter43 — Ask the Garden tests.
- Validates DAILY_QUESTION_CAP=7 and Claude Haiku 4.5 wiring.
- Covers: usage gate, paywall guard, send + threading + image,
  cap enforcement (429), session list/delete, size & length limits.
"""
import io
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import pytest
import requests
from dotenv import load_dotenv

# Load backend env so MONGO_URL is available for direct seeding/cleanup.
load_dotenv("/app/backend/.env")
load_dotenv("/app/frontend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"
TOKEN = "test-token-pdf-smoke"


# --- Mongo helpers (sync via pymongo, so test fixtures are simple) ---
@pytest.fixture(scope="module")
def db():
    from pymongo import MongoClient
    client = MongoClient(os.environ["MONGO_URL"])
    yield client[os.environ["DB_NAME"]]
    client.close()


def _today_key():
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


@pytest.fixture(autouse=True)
def _reset_usage(db):
    """Each test starts with a known-small usage count so caps don't poison runs."""
    db.ask_usage.update_one(
        {"access_token": TOKEN, "date": _today_key()},
        {"$set": {"count": 0, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )
    yield
    # Reset after each so subsequent tests have headroom.
    db.ask_usage.update_one(
        {"access_token": TOKEN, "date": _today_key()},
        {"$set": {"count": 0}},
        upsert=True,
    )


# --- Usage / paywall guard --------------------------------------------------
class TestUsageAndGuard:
    def test_usage_cap_is_7(self):
        r = requests.get(f"{API}/ask/usage", params={"access_token": TOKEN}, timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["cap"] == 7, body
        assert body["used"] == 0
        assert body["remaining"] == 7

    def test_usage_paywall_blocks_invalid_token(self):
        r = requests.get(f"{API}/ask/usage", params={"access_token": "not-a-real-token"}, timeout=20)
        assert r.status_code == 402, r.text

    def test_usage_paywall_blocks_empty_token(self):
        r = requests.get(f"{API}/ask/usage", params={"access_token": ""}, timeout=20)
        assert r.status_code == 402, r.text


# --- Send + threading + GET messages ---------------------------------------
class TestSendAndThread:
    def test_send_single_message_returns_answer_and_decrements(self, db):
        # Clean a fresh start for this test
        db.ask_usage.update_one({"access_token": TOKEN, "date": _today_key()},
                                {"$set": {"count": 0}}, upsert=True)
        r = requests.post(
            f"{API}/ask/message",
            data={"access_token": TOKEN, "message": "When do I sow tomatoes in UK?"},
            timeout=90,
        )
        assert r.status_code == 200, r.text
        body = r.json()
        for k in ("session_id", "user_message_id", "assistant_message_id", "answer", "usage"):
            assert k in body, body
        assert isinstance(body["answer"], str) and len(body["answer"].strip()) > 0
        assert body["usage"]["cap"] == 7
        assert body["usage"]["used"] == 1
        assert body["usage"]["remaining"] == 6

    def test_multi_turn_threading_same_session(self, db):
        db.ask_usage.update_one({"access_token": TOKEN, "date": _today_key()},
                                {"$set": {"count": 0}}, upsert=True)
        # Turn 1
        r1 = requests.post(
            f"{API}/ask/message",
            data={"access_token": TOKEN, "message": "When do I sow tomatoes in UK?"},
            timeout=90,
        )
        assert r1.status_code == 200, r1.text
        sid = r1.json()["session_id"]
        # Turn 2 (follow-up references prior context)
        r2 = requests.post(
            f"{API}/ask/message",
            data={"access_token": TOKEN, "message": "And what about courgettes?", "session_id": sid},
            timeout=90,
        )
        assert r2.status_code == 200, r2.text
        assert r2.json()["session_id"] == sid

        # GET messages — 4 in chronological order: user, assistant, user, assistant
        rm = requests.get(
            f"{API}/ask/sessions/{sid}/messages",
            params={"access_token": TOKEN}, timeout=20,
        )
        assert rm.status_code == 200, rm.text
        msgs = rm.json()
        assert len(msgs) == 4, msgs
        roles = [m["role"] for m in msgs]
        assert roles == ["user", "assistant", "user", "assistant"], roles
        # Chronological
        times = [m["created_at"] for m in msgs]
        assert times == sorted(times), times

        # cleanup
        requests.delete(f"{API}/ask/sessions/{sid}", params={"access_token": TOKEN}, timeout=20)

    def test_image_upload_marks_has_image_true(self, db):
        db.ask_usage.update_one({"access_token": TOKEN, "date": _today_key()},
                                {"$set": {"count": 0}}, upsert=True)
        # Build a small but Anthropic-acceptable JPEG via Pillow (≥ a few hundred bytes,
        # solid colour). A 1x1 PNG gets rejected by the Anthropic API with
        # "Could not process image", so we synthesise a 64x64 green JPEG.
        try:
            from PIL import Image
        except ImportError:
            pytest.skip("Pillow not installed; skipping image-upload test")
        buf = io.BytesIO()
        Image.new("RGB", (64, 64), color=(60, 140, 70)).save(buf, format="JPEG", quality=85)
        buf.seek(0)
        files = {"image": ("leaf.jpg", buf, "image/jpeg")}
        data = {"access_token": TOKEN, "message": "What colour is this swatch?"}
        r = requests.post(f"{API}/ask/message", data=data, files=files, timeout=120)
        assert r.status_code == 200, r.text
        sid = r.json()["session_id"]
        rm = requests.get(f"{API}/ask/sessions/{sid}/messages",
                          params={"access_token": TOKEN}, timeout=20)
        assert rm.status_code == 200
        msgs = rm.json()
        user_msg = next(m for m in msgs if m["role"] == "user")
        assert user_msg["has_image"] is True
        # cleanup
        requests.delete(f"{API}/ask/sessions/{sid}", params={"access_token": TOKEN}, timeout=20)


# --- Cap enforcement --------------------------------------------------------
class TestCapEnforcement:
    def test_429_when_cap_reached(self, db):
        # Seed count=7 directly
        db.ask_usage.update_one(
            {"access_token": TOKEN, "date": _today_key()},
            {"$set": {"count": 7, "updated_at": datetime.now(timezone.utc).isoformat()}},
            upsert=True,
        )
        r = requests.post(
            f"{API}/ask/message",
            data={"access_token": TOKEN, "message": "Should fail with 429"},
            timeout=30,
        )
        assert r.status_code == 429, r.text
        detail = (r.json() or {}).get("detail", "")
        assert "Daily limit of 7" in detail, detail
        # Reset (autouse fixture also resets at teardown but be explicit)
        db.ask_usage.update_one(
            {"access_token": TOKEN, "date": _today_key()},
            {"$set": {"count": 0}}, upsert=True,
        )


# --- Sessions list / delete -------------------------------------------------
class TestSessionsCrud:
    def test_list_sessions_sorted_desc(self, db):
        db.ask_usage.update_one({"access_token": TOKEN, "date": _today_key()},
                                {"$set": {"count": 0}}, upsert=True)
        # Create 2 sessions
        r1 = requests.post(f"{API}/ask/message",
                           data={"access_token": TOKEN, "message": "first session q"},
                           timeout=90)
        assert r1.status_code == 200
        sid1 = r1.json()["session_id"]
        time.sleep(1)
        r2 = requests.post(f"{API}/ask/message",
                           data={"access_token": TOKEN, "message": "second session q"},
                           timeout=90)
        assert r2.status_code == 200
        sid2 = r2.json()["session_id"]

        rl = requests.get(f"{API}/ask/sessions",
                          params={"access_token": TOKEN}, timeout=20)
        assert rl.status_code == 200
        sessions = rl.json()
        ids = [s["id"] for s in sessions]
        # newest (sid2) before older (sid1)
        assert sid2 in ids and sid1 in ids
        assert ids.index(sid2) < ids.index(sid1)
        for s in sessions:
            assert {"id", "title", "created_at", "last_message_at"} <= set(s.keys())

        # cleanup
        for sid in (sid1, sid2):
            requests.delete(f"{API}/ask/sessions/{sid}", params={"access_token": TOKEN}, timeout=20)

    def test_delete_session_removes_session_and_messages(self, db):
        db.ask_usage.update_one({"access_token": TOKEN, "date": _today_key()},
                                {"$set": {"count": 0}}, upsert=True)
        r = requests.post(f"{API}/ask/message",
                         data={"access_token": TOKEN, "message": "will be deleted"},
                         timeout=90)
        sid = r.json()["session_id"]
        d = requests.delete(f"{API}/ask/sessions/{sid}",
                            params={"access_token": TOKEN}, timeout=20)
        assert d.status_code == 200
        assert d.json() == {"deleted": True}
        # Session should be gone (404 on messages)
        g = requests.get(f"{API}/ask/sessions/{sid}/messages",
                        params={"access_token": TOKEN}, timeout=20)
        assert g.status_code == 404
        # DB direct check
        assert db.ask_sessions.find_one({"id": sid}) is None
        assert db.ask_messages.count_documents({"session_id": sid}) == 0


# --- Validation -------------------------------------------------------------
class TestValidation:
    def test_image_too_large_returns_400(self):
        big = b"\x89PNG\r\n\x1a\n" + (b"\x00" * (5 * 1024 * 1024 + 100))
        files = {"image": ("big.png", io.BytesIO(big), "image/png")}
        data = {"access_token": TOKEN, "message": "huge"}
        r = requests.post(f"{API}/ask/message", data=data, files=files, timeout=30)
        assert r.status_code == 400, r.text
        assert "too large" in (r.json().get("detail") or "").lower()

    def test_message_too_long_returns_400(self):
        long_msg = "a" * 4001
        r = requests.post(f"{API}/ask/message",
                          data={"access_token": TOKEN, "message": long_msg},
                          timeout=20)
        assert r.status_code == 400, r.text

    def test_empty_submission_returns_400(self):
        r = requests.post(f"{API}/ask/message",
                          data={"access_token": TOKEN, "message": "   "},
                          timeout=20)
        assert r.status_code == 400, r.text
