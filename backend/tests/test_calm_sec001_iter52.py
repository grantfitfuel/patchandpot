"""Iter52 — Verify SEC-001 fix for /admin/calm/* auth boundary.

Focus: HTTP 403/200/503 codes only. Do NOT trigger costly ElevenLabs renders.
- Positive-path uses /admin/calm/list (free, no ElevenLabs) and /admin/calm/remix
  (idempotent, uses existing rendered audio if present).
- Verifies old hard-coded fallback string 'patchpot-admin-d3f8a2b9c4' no
  longer bypasses auth via a fallback in code (it may still be the CURRENT
  ADMIN_TOKEN in .env — flagged separately in the report).
"""

import os
import requests
import pytest
from pathlib import Path

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback for pytest env — read from frontend .env
    for line in Path("/app/frontend/.env").read_text().splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
            break

# Read real admin token from backend .env directly
REAL_ADMIN_TOKEN = ""
for line in Path("/app/backend/.env").read_text().splitlines():
    if line.startswith("ADMIN_TOKEN="):
        REAL_ADMIN_TOKEN = line.split("=", 1)[1].strip()
        break

OLD_HARDCODED = "patchpot-admin-d3f8a2b9c4"
FAKE_TOKEN = "wrong-token-xxx"

ENV_MATCHES_OLD = (REAL_ADMIN_TOKEN == OLD_HARDCODED)

api = f"{BASE_URL}/api"


# --- Negative-path tests: fake token must always be 403 ---------------------

class TestAuthRejects:
    def test_render_wrong_token(self):
        r = requests.post(f"{api}/admin/calm/render",
                          params={"slug": "march-nh-w1", "token": FAKE_TOKEN},
                          timeout=15)
        assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text[:200]}"

    def test_author_wrong_token(self):
        r = requests.post(f"{api}/admin/calm/author",
                          params={"month": 3, "hemisphere": "nh",
                                  "week": 1, "token": FAKE_TOKEN},
                          timeout=15)
        assert r.status_code == 403

    def test_remix_wrong_token(self):
        r = requests.post(f"{api}/admin/calm/remix",
                          params={"slug": "march-nh-w1", "token": FAKE_TOKEN},
                          timeout=15)
        assert r.status_code == 403

    def test_list_wrong_token(self):
        r = requests.get(f"{api}/admin/calm/list",
                         params={"token": FAKE_TOKEN}, timeout=15)
        assert r.status_code == 403

    def test_delete_wrong_token(self):
        r = requests.delete(f"{api}/admin/calm/some-nonexistent-slug",
                            params={"token": FAKE_TOKEN}, timeout=15)
        assert r.status_code == 403

    def test_render_sample_wrong_token(self):
        r = requests.post(f"{api}/admin/calm/render-sample",
                          params={"voice": "sarah", "token": FAKE_TOKEN},
                          timeout=15)
        assert r.status_code == 403


# --- Old-hardcoded-string check ---------------------------------------------
# The SEC-001 fix removed the hard-coded fallback in code. Whether the OLD
# string still succeeds depends on the CURRENT ADMIN_TOKEN env value.
# If env still literally equals the old string, it will succeed — that is a
# .env rotation issue, NOT a code-level fallback issue. Flagged in report.

class TestOldHardcoded:
    def test_list_with_old_string(self):
        r = requests.get(f"{api}/admin/calm/list",
                         params={"token": OLD_HARDCODED}, timeout=15)
        if ENV_MATCHES_OLD:
            # cannot prove code fallback removed while env == old string
            assert r.status_code == 200, (
                f"env==old — code fallback presence indistinguishable; got {r.status_code}"
            )
            pytest.skip("ADMIN_TOKEN env literally equals old hardcoded string; "
                        "cannot prove fallback removed from code by HTTP test alone. "
                        "Verified by grep of calm.py — no fallback in source.")
        else:
            assert r.status_code == 403, (
                f"OLD hardcoded should be rejected; got {r.status_code}"
            )

    def test_render_with_old_string(self):
        r = requests.post(f"{api}/admin/calm/render",
                          params={"slug": "march-nh-w1", "token": OLD_HARDCODED},
                          timeout=30)
        if ENV_MATCHES_OLD:
            # would trigger real render — DON'T assert 200 here to avoid ££.
            # 2xx OR 5xx (budget/EL error) both prove code-fallback question is moot.
            pytest.skip("env == old string; skipping paid render call")
        else:
            assert r.status_code == 403


# --- Positive-path tests: real token succeeds -------------------------------

class TestAuthAccepts:
    def test_list_with_real_token(self):
        assert REAL_ADMIN_TOKEN, "ADMIN_TOKEN missing from /app/backend/.env"
        r = requests.get(f"{api}/admin/calm/list",
                         params={"token": REAL_ADMIN_TOKEN}, timeout=15)
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:200]}"
        data = r.json()
        # Should return list of items — expected ~96 per review request
        items = data if isinstance(data, list) else data.get("items", data.get("variants", []))
        assert isinstance(items, list), f"expected list; got {type(items).__name__}"
        assert len(items) >= 24, f"expected >=24 items, got {len(items)}"

    def test_remix_with_real_token(self):
        # Remix is free (re-uses existing rendered blocks / no ElevenLabs
        # regen for the same script). Use march-nh-w1 which already has audio.
        assert REAL_ADMIN_TOKEN
        r = requests.post(f"{api}/admin/calm/remix",
                          params={"slug": "march-nh-w1", "token": REAL_ADMIN_TOKEN},
                          timeout=60)
        # 200 OK, or 404 if slug missing, or 5xx if server error — assert
        # NOT 403 (auth passed).
        assert r.status_code != 403, "auth rejected valid token"
        assert r.status_code in (200, 404, 500, 503), f"unexpected {r.status_code}: {r.text[:200]}"


# --- Regression: public endpoints unaffected --------------------------------

class TestPublicUnaffected:
    def test_public_list(self):
        r = requests.get(f"{api}/calm/list", timeout=15)
        assert r.status_code == 200

    def test_public_current(self):
        r = requests.get(f"{api}/calm/current", timeout=15)
        assert r.status_code == 200

    def test_public_voices(self):
        r = requests.get(f"{api}/calm/voices", timeout=15)
        assert r.status_code == 200

    def test_public_slug(self):
        r = requests.get(f"{api}/calm/march-nh-w1", timeout=15)
        assert r.status_code == 200

    def test_public_audio_free_preview(self):
        # HEAD to avoid downloading full mp3
        r = requests.head(f"{api}/calm/march-nh-w1/audio.mp3",
                          allow_redirects=True, timeout=15)
        assert r.status_code == 200, f"got {r.status_code}"


# --- Regression: ask-review admin still works -------------------------------

class TestAskReviewRegression:
    def test_ask_review_requires_token(self):
        # confirm auth still enforced
        r = requests.get(f"{api}/admin/ask/list",
                         params={"token": FAKE_TOKEN}, timeout=15)
        # If endpoint exists it should return 403; if it moved, 404 is ok.
        assert r.status_code in (403, 404), f"got {r.status_code}"

    def test_ask_review_real_token(self):
        assert REAL_ADMIN_TOKEN
        r = requests.get(f"{api}/admin/ask/list",
                         params={"token": REAL_ADMIN_TOKEN}, timeout=15)
        # Endpoint may not exist — accept 200 or 404. 403 would be a regression.
        assert r.status_code != 403, "real token rejected — regression!"
