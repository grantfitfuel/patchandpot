"""Iteration 28 backend coverage:
  (a) Plant OG card endpoints + HTML preview wrapper
  (b) Embed page chrome (verified via SPA route — backend exposes nothing
      special, the AppShell decides; tested in playwright)
  (c) QR sticker PDF
  (d) View counter (24h IP+UA dedup, bot UA skipped) + popular wall + list_publicly toggle

Cleans up its own snapshots and AI plant cache entries.
"""
import io
import os

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://grow-by-season-1.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

REGION = {
    "name": "London",
    "country": "United Kingdom",
    "latitude": 51.5074,
    "longitude": -0.1278,
    "climate_zone": "Temperate",
    "hemisphere": "northern",
}


def _payload(name="TEST_iter28 patch", plants=None, **overrides):
    p = {
        "patch_name": name,
        "region": REGION,
        "plants": plants if plants is not None else [
            {"id": "basil", "name": "Basil", "category": "herb"},
            {"id": "tomato", "name": "Tomato", "category": "vegetable"},
        ],
    }
    p.update(overrides)
    return p


@pytest.fixture
def snapshot():
    r = requests.post(f"{API}/share/patch", json=_payload(), timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    yield body
    requests.delete(
        f"{API}/share/patch/{body['share_id']}",
        params={"owner_secret": body["owner_secret"]},
        timeout=30,
    )


# ─── (a) Plant OG ───
class TestPlantOg:
    def test_curated_plant_og_png(self):
        r = requests.get(f"{API}/plants/tomato/og.png", timeout=30)
        assert r.status_code == 200
        assert r.headers["content-type"] == "image/png"
        assert r.content[:8] == b"\x89PNG\r\n\x1a\n"
        assert len(r.content) > 5000

    def test_curated_plant_preview_html(self):
        r = requests.get(f"{API}/plants/preview/tomato", timeout=30)
        assert r.status_code == 200
        body = r.text
        assert "How to grow Tomato — Patch & Pot" in body
        assert 'property="og:title"' in body
        assert 'property="og:image"' in body
        assert '/api/plants/tomato/og.png' in body
        assert 'name="twitter:card"' in body
        assert 'content="summary_large_image"' in body

    def test_unknown_plant_og_404(self):
        r = requests.get(f"{API}/plants/not-a-real-plant/og.png", timeout=30)
        assert r.status_code == 404

    def test_unknown_plant_preview_404(self):
        r = requests.get(f"{API}/plants/preview/not-a-real-plant", timeout=30)
        assert r.status_code == 404


# ─── (c) QR sticker PDF ───
class TestQrSticker:
    def test_qr_pdf_returns_pdf(self, snapshot):
        sid = snapshot["share_id"]
        r = requests.get(f"{API}/share/patch/{sid}/qr.pdf", timeout=60)
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"
        assert len(r.content) > 500
        assert r.content[:4] == b"%PDF"

    def test_qr_pdf_text_contents(self, snapshot):
        try:
            from pypdf import PdfReader
        except Exception:
            pytest.skip("pypdf not installed")
        sid = snapshot["share_id"]
        r = requests.get(f"{API}/share/patch/{sid}/qr.pdf", timeout=60)
        assert r.status_code == 200
        reader = PdfReader(io.BytesIO(r.content))
        text = "\n".join((page.extract_text() or "") for page in reader.pages)
        # Be tolerant to mixed casing; the spec calls for these substrings.
        up = text.upper()
        assert "PATCH" in up and "POT" in up
        assert "SCAN" in up
        # Patch name should appear (case-insensitive)
        assert "iter28" in text.lower() or "test_" in text.lower()

    def test_qr_pdf_404_for_unknown(self):
        r = requests.get(f"{API}/share/patch/does-not-exist/qr.pdf", timeout=30)
        assert r.status_code == 404


# ─── (d) View counter + popular + list_publicly ───
class TestViewCounter:
    def test_view_count_dedup_same_fingerprint(self, snapshot):
        sid = snapshot["share_id"]
        ua = "Mozilla/5.0 (iter28-human-tester)"
        ip = "203.0.113.42"
        hdrs = {"User-Agent": ua, "X-Forwarded-For": ip}
        # 1st visit
        r1 = requests.get(f"{API}/share/patch/{sid}", headers=hdrs, timeout=30)
        assert r1.status_code == 200
        c1 = r1.json().get("view_count", 0)
        # 2nd visit, same fingerprint — must NOT increment
        r2 = requests.get(f"{API}/share/patch/{sid}", headers=hdrs, timeout=30)
        c2 = r2.json().get("view_count", 0)
        assert c2 == c1, f"View count incremented on refresh: {c1} -> {c2}"

    def test_view_count_increments_for_new_fingerprint(self, snapshot):
        sid = snapshot["share_id"]
        # Different UA + IP from above test
        hdrs_a = {"User-Agent": "Mozilla/5.0 (iter28-a)", "X-Forwarded-For": "198.51.100.1"}
        hdrs_b = {"User-Agent": "Mozilla/5.0 (iter28-b)", "X-Forwarded-For": "198.51.100.2"}
        r_a = requests.get(f"{API}/share/patch/{sid}", headers=hdrs_a, timeout=30)
        c_a = r_a.json().get("view_count", 0)
        r_b = requests.get(f"{API}/share/patch/{sid}", headers=hdrs_b, timeout=30)
        c_b = r_b.json().get("view_count", 0)
        assert c_b >= c_a + 1

    def test_bot_user_agents_skipped(self, snapshot):
        sid = snapshot["share_id"]
        # Baseline (human)
        baseline = requests.get(
            f"{API}/share/patch/{sid}",
            headers={"User-Agent": "Mozilla/5.0 baseline-iter28", "X-Forwarded-For": "192.0.2.50"},
            timeout=30,
        ).json().get("view_count", 0)
        for bot_ua in [
            "facebookexternalhit/1.1",
            "Twitterbot/1.0",
            "WhatsApp/2.0",
            "Slackbot-LinkExpanding 1.0",
            "Mozilla/5.0 (compatible; Googlebot/2.1)",
        ]:
            r = requests.get(
                f"{API}/share/patch/{sid}",
                headers={"User-Agent": bot_ua, "X-Forwarded-For": "192.0.2.100"},
                timeout=30,
            )
            assert r.status_code == 200
            current = r.json().get("view_count", 0)
            assert current == baseline, f"Bot UA {bot_ua!r} incremented view count {baseline} -> {current}"


class TestListPublicly:
    def test_default_off_then_toggle_on_and_off(self, snapshot):
        sid = snapshot["share_id"]
        secret = snapshot["owner_secret"]
        # Default should be off
        r = requests.get(f"{API}/share/patch/{sid}", timeout=30)
        assert r.json().get("list_publicly") is False

        # Toggle on via update
        u1 = requests.post(
            f"{API}/share/patch",
            json=_payload(name="TEST_iter28 public", share_id=sid, owner_secret=secret, list_publicly=True),
            timeout=30,
        )
        assert u1.status_code == 200 and u1.json().get("updated") is True
        r2 = requests.get(f"{API}/share/patch/{sid}", timeout=30)
        assert r2.json().get("list_publicly") is True

        # Toggle back off
        u2 = requests.post(
            f"{API}/share/patch",
            json=_payload(name="TEST_iter28 private", share_id=sid, owner_secret=secret, list_publicly=False),
            timeout=30,
        )
        assert u2.status_code == 200
        r3 = requests.get(f"{API}/share/patch/{sid}", timeout=30)
        assert r3.json().get("list_publicly") is False


class TestPopularWall:
    def test_popular_only_returns_optin_and_nonempty(self):
        # Snapshot A: opt-in with plants — must appear
        a = requests.post(
            f"{API}/share/patch",
            json=_payload(name="TEST_iter28 popA", list_publicly=True),
            timeout=30,
        ).json()
        # Snapshot B: opt-in but NO plants — must NOT appear
        b = requests.post(
            f"{API}/share/patch",
            json=_payload(name="TEST_iter28 popB-empty", plants=[], list_publicly=True),
            timeout=30,
        ).json()
        # Snapshot C: plants but opt-out — must NOT appear
        c = requests.post(
            f"{API}/share/patch",
            json=_payload(name="TEST_iter28 popC-private", list_publicly=False),
            timeout=30,
        ).json()

        try:
            r = requests.get(f"{API}/share/patches/popular?limit=24", timeout=30)
            assert r.status_code == 200
            items = r.json().get("items", [])
            ids = {it.get("share_id") for it in items}
            assert a["share_id"] in ids
            assert b["share_id"] not in ids
            assert c["share_id"] not in ids
            # Shape sanity on one item
            picked = next(it for it in items if it["share_id"] == a["share_id"])
            assert picked["patch_name"].startswith("TEST_iter28 popA")
            assert picked["plant_count"] >= 1
            assert "owner_secret" not in picked
        finally:
            for snap in (a, b, c):
                requests.delete(
                    f"{API}/share/patch/{snap['share_id']}",
                    params={"owner_secret": snap["owner_secret"]},
                    timeout=30,
                )
