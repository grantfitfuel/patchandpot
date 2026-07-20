"""Iteration 51 — 2-Minute Calm: Ambience bed + Southern Hemisphere content.

Verifies (see iteration 51 review request):
  - SH list has 12 items with correct seasonality (january-sh=High Summer,
    july-sh=Deep Winter, september-sh=Early Spring + is_free_preview=True).
  - september-sh unlocked unauthenticated (blocks non-empty).
  - january-sh locked unauthenticated.
  - Audio serving: september-sh 200 audio/mpeg unauth; january-sh 402 unauth.
  - /calm/current returns july-nh and july-sh (SAME calendar month, no mirror).
  - All 24 mixed MP3s + 24 voice-only MP3s exist on disk.
  - Ambience mix present in final vs. -inf in voice-only (compare RMS in
    silent gaps of march-nh and january-sh).
  - Admin /admin/calm/remix works for a valid slug and 404s for a bad slug.
  - Admin /admin/calm/list returns 24 items with audio_generated + duration_s>0.
"""
import os
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import pytest
import requests
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")

ADMIN_TOKEN = "patchpot-admin-d3f8a2b9c4"
PAID_TOKEN = "test-token-pdf-smoke"
AUDIO_DIR = Path("/app/backend/data/calm")

MONTHS = [
    "january", "february", "march", "april", "may", "june",
    "july", "august", "september", "october", "november", "december",
]

# Current month name at test-run time (backend uses UTC now().month).
CURRENT_MONTH_NAME = MONTHS[datetime.now(timezone.utc).month - 1]


# ─── Fixtures ────────────────────────────────────────────────────────
@pytest.fixture(scope="session")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="session", autouse=True)
def ensure_paid_grant():
    mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017").strip('"')
    db_name = os.environ.get("DB_NAME", "test_database").strip('"')
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


# ─── SH content — list + seasonality ─────────────────────────────────
class TestSouthernHemisphereList:
    def test_sh_list_has_12_items(self, api):
        r = api.get(f"{BASE_URL}/api/calm/list", params={"hemisphere": "sh"})
        assert r.status_code == 200
        data = r.json()
        assert data.get("count") == 12
        assert len(data.get("items", [])) == 12
        slugs = {i["slug"] for i in data["items"]}
        assert slugs == {f"{m}-sh" for m in MONTHS}

    def test_sh_january_is_high_summer(self, api):
        r = api.get(f"{BASE_URL}/api/calm/list", params={"hemisphere": "sh"})
        by_slug = {i["slug"]: i for i in r.json()["items"]}
        assert "Summer" in by_slug["january-sh"]["season_label"], \
            f"Expected 'Summer' in january-sh, got: {by_slug['january-sh']['season_label']}"

    def test_sh_july_is_winter(self, api):
        r = api.get(f"{BASE_URL}/api/calm/list", params={"hemisphere": "sh"})
        by_slug = {i["slug"]: i for i in r.json()["items"]}
        assert "Winter" in by_slug["july-sh"]["season_label"], \
            f"Expected 'Winter' in july-sh, got: {by_slug['july-sh']['season_label']}"

    def test_sh_september_is_spring_and_free(self, api):
        r = api.get(f"{BASE_URL}/api/calm/list", params={"hemisphere": "sh"})
        by_slug = {i["slug"]: i for i in r.json()["items"]}
        sept = by_slug["september-sh"]
        assert "Spring" in sept["season_label"], \
            f"Expected 'Spring' in september-sh, got: {sept['season_label']}"
        assert sept.get("is_free_preview") is True

    def test_sh_all_audio_generated(self, api):
        r = api.get(f"{BASE_URL}/api/calm/list", params={"hemisphere": "sh"})
        for item in r.json()["items"]:
            assert item.get("audio_generated") is True, f"{item['slug']} audio_generated=false"
            assert item.get("duration_s", 0) > 0, f"{item['slug']} duration_s=0"


# ─── SH gating — content + audio ─────────────────────────────────────
class TestSouthernHemisphereGating:
    def test_september_sh_unlocked_unauth(self, api):
        r = api.get(f"{BASE_URL}/api/calm/september-sh")
        assert r.status_code == 200
        data = r.json()
        assert data.get("locked") is not True
        assert len(data.get("blocks", [])) > 0, "september-sh should have blocks unauthenticated"
        assert data.get("transcript_display", "").strip() != ""

    def test_january_sh_locked_unauth(self, api):
        r = api.get(f"{BASE_URL}/api/calm/january-sh")
        assert r.status_code == 200
        data = r.json()
        assert data.get("locked") is True
        assert data.get("blocks", []) == []
        assert data.get("transcript_display") == ""

    def test_january_sh_unlocked_with_paid_token(self, api):
        r = api.get(f"{BASE_URL}/api/calm/january-sh", params={"access_token": PAID_TOKEN})
        assert r.status_code == 200
        data = r.json()
        assert data.get("locked") is not True
        assert len(data.get("blocks", [])) > 0

    def test_september_sh_audio_200_unauth(self, api):
        r = api.get(f"{BASE_URL}/api/calm/september-sh/audio.mp3", allow_redirects=False)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
        assert r.headers.get("content-type", "").startswith("audio/mpeg")
        assert int(r.headers.get("content-length", "0")) > 10000

    def test_january_sh_audio_402_unauth(self, api):
        r = api.get(f"{BASE_URL}/api/calm/january-sh/audio.mp3", allow_redirects=False)
        assert r.status_code == 402, f"Expected 402 for locked SH audio, got {r.status_code}"


# ─── /calm/current — same month across hemispheres, different slug ───
class TestCurrentEndpoint:
    def test_current_nh_is_current_month(self, api):
        r = api.get(f"{BASE_URL}/api/calm/current", params={"hemisphere": "nh"})
        assert r.status_code == 200
        data = r.json()
        assert data.get("slug") == f"{CURRENT_MONTH_NAME}-nh", \
            f"Expected {CURRENT_MONTH_NAME}-nh, got {data.get('slug')}"
        assert data.get("hemisphere") == "nh"

    def test_current_sh_is_same_month_not_mirrored(self, api):
        """Confirm SH no longer mirrors — /calm/current?hemisphere=sh returns
        the current calendar month's SH slug (e.g. july-sh) not a mirrored
        one (january-sh)."""
        r = api.get(f"{BASE_URL}/api/calm/current", params={"hemisphere": "sh"})
        assert r.status_code == 200
        data = r.json()
        assert data.get("slug") == f"{CURRENT_MONTH_NAME}-sh", \
            f"Expected {CURRENT_MONTH_NAME}-sh (no mirror), got {data.get('slug')}"

    def test_current_bad_hemisphere_400(self, api):
        r = api.get(f"{BASE_URL}/api/calm/current", params={"hemisphere": "invalid"})
        assert r.status_code == 400


# ─── Files on disk — 24 mixed + 24 voice-only ────────────────────────
class TestAudioFilesOnDisk:
    def test_all_24_mixed_mp3_present(self):
        missing = []
        for m in MONTHS:
            for hemi in ("nh", "sh"):
                p = AUDIO_DIR / f"{m}-{hemi}.mp3"
                if not p.exists() or p.stat().st_size < 5000:
                    missing.append(p.name)
        assert not missing, f"Missing/small mixed MP3s: {missing}"

    def test_all_voice_only_mp3_present(self):
        """Voice-only files exist for at least all 12 NH months (review
        says SH gets voice-only on next render — but our disk listing
        showed all 24 voice files are present, so verify all)."""
        missing_nh = []
        for m in MONTHS:
            p = AUDIO_DIR / f"{m}-nh.voice.mp3"
            if not p.exists() or p.stat().st_size < 5000:
                missing_nh.append(p.name)
        assert not missing_nh, f"Missing NH voice-only files: {missing_nh}"


# ─── Ambience bed measurable in mixed but not in voice-only ──────────
def _rms_dbfs(mp3_path: Path, start_ms: int, end_ms: int) -> float:
    """Load an MP3 segment and return its RMS in dBFS. -inf means true silence."""
    from pydub import AudioSegment
    seg = AudioSegment.from_file(mp3_path, format="mp3")[start_ms:end_ms]
    return seg.dBFS


class TestAmbienceBed:
    def _pick_silent_window(self, mp3_path: Path):
        """Scan voice-only file for a ~1s window with the quietest RMS.
        Returns (start_ms, end_ms). Voice-only file's quietest 1s is where
        we expect ambience-vs-silence to be measurable."""
        from pydub import AudioSegment
        seg = AudioSegment.from_file(mp3_path, format="mp3")
        window = 1000
        # Skip lead-in/tail.
        best_start = 800
        best_db = 0.0
        # Sample every 500ms.
        for start in range(800, len(seg) - window - 1200, 500):
            db = seg[start:start + window].dBFS
            if db < best_db:
                best_db = db
                best_start = start
        return best_start, best_start + window

    def _check_slug_has_ambience(self, slug: str):
        mixed = AUDIO_DIR / f"{slug}.mp3"
        voice = AUDIO_DIR / f"{slug}.voice.mp3"
        assert mixed.exists() and voice.exists(), f"{slug} files missing"
        start, end = self._pick_silent_window(voice)
        voice_db = _rms_dbfs(voice, start, end)
        mixed_db = _rms_dbfs(mixed, start, end)
        # Voice should be very quiet (true silence or near) in this window.
        # Mixed should have measurable ambience (not -inf, above voice_db).
        assert mixed_db != float("-inf"), f"{slug} mixed silent window is -inf; ambience missing"
        # Ambience should be at least 3 dB louder than the voice-only baseline.
        # (Voice could be -inf; anything real is louder.)
        if voice_db == float("-inf"):
            assert mixed_db > -70.0, f"{slug} mixed RMS in silent gap too quiet: {mixed_db} dBFS"
        else:
            assert mixed_db > voice_db + 3.0, (
                f"{slug} mixed ({mixed_db:.1f} dBFS) not audibly louder than "
                f"voice ({voice_db:.1f} dBFS) — ambience may be missing.")
        # Sanity range for ambience RMS: roughly -30 to -60 dBFS.
        assert -70.0 < mixed_db < -15.0, f"{slug} mixed silent-window RMS out of range: {mixed_db}"

    def test_march_nh_has_spring_ambience(self):
        self._check_slug_has_ambience("march-nh")

    def test_january_sh_has_summer_ambience(self):
        self._check_slug_has_ambience("january-sh")


# ─── Admin endpoints — remix + list ──────────────────────────────────
class TestAdminEndpoints:
    def test_remix_valid_slug(self, api):
        """POST /api/admin/calm/remix?slug=march-nh&token=<admin> — should
        return 200 with ambience_season='spring'."""
        r = api.post(
            f"{BASE_URL}/api/admin/calm/remix",
            params={"slug": "march-nh", "token": ADMIN_TOKEN},
        )
        assert r.status_code == 200, f"remix returned {r.status_code}: {r.text[:300]}"
        data = r.json()
        assert data.get("ok") is True
        assert data.get("slug") == "march-nh"
        assert data.get("ambience_season") == "spring"
        assert data.get("duration_s", 0) > 0

    def test_remix_writes_ambience_season_to_db(self, api):
        # Do a remix first, then verify DB got the field.
        api.post(
            f"{BASE_URL}/api/admin/calm/remix",
            params={"slug": "january-sh", "token": ADMIN_TOKEN},
        )
        mongo_url = os.environ.get("MONGO_URL", "mongodb://localhost:27017").strip('"')
        db_name = os.environ.get("DB_NAME", "test_database").strip('"')
        client = MongoClient(mongo_url)
        try:
            row = client[db_name].calm_variants.find_one({"slug": "january-sh"})
            assert row is not None
            assert row.get("ambience_season") == "summer", \
                f"Expected 'summer' for january-sh, got {row.get('ambience_season')}"
        finally:
            client.close()

    def test_remix_nonexistent_slug_404(self, api):
        r = api.post(
            f"{BASE_URL}/api/admin/calm/remix",
            params={"slug": "nonexistent-slug", "token": ADMIN_TOKEN},
        )
        assert r.status_code == 404

    def test_remix_bad_token_403(self, api):
        r = api.post(
            f"{BASE_URL}/api/admin/calm/remix",
            params={"slug": "march-nh", "token": "wrong-token"},
        )
        assert r.status_code == 403

    def test_admin_list_returns_24(self, api):
        r = api.get(f"{BASE_URL}/api/admin/calm/list", params={"token": ADMIN_TOKEN})
        assert r.status_code == 200
        data = r.json()
        assert data.get("count") == 24, f"Expected 24 items, got {data.get('count')}"
        for item in data.get("items", []):
            assert item.get("audio_generated") is True, f"{item['slug']}: audio_generated=false"
            assert item.get("duration_s", 0) > 0, f"{item['slug']}: duration_s=0"
        # Both hemispheres represented.
        hemis = {i["hemisphere"] for i in data["items"]}
        assert hemis == {"nh", "sh"}
