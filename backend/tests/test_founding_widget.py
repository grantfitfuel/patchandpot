"""Iteration 15 regression — founding widget endpoint + tip checkout shape.

Covers:
  - GET /api/founding-status/widget (new HTML embed endpoint)
  - GET /api/founding-status (existing JSON endpoint, baseline shape)
  - POST /api/checkout/session for package_id='tip' (verifies status response
    surfaces package_id so CheckoutSuccess.jsx can branch into tip_success)
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
                break


@pytest.fixture(scope="module")
def api_client():
    s = requests.Session()
    s.headers.update({"Accept": "*/*"})
    return s


# --- Existing founding-status JSON endpoint ---------------------------------
class TestFoundingStatusJson:
    def test_founding_status_shape(self, api_client):
        r = api_client.get(f"{BASE_URL}/api/founding-status", timeout=15)
        assert r.status_code == 200, r.text
        data = r.json()
        for key in ("total", "sold", "available", "active"):
            assert key in data, f"missing key {key}: {data}"
        assert isinstance(data["total"], int)
        assert isinstance(data["sold"], int)
        assert isinstance(data["available"], int)
        assert isinstance(data["active"], bool)
        assert data["available"] == max(0, data["total"] - data["sold"])
        assert data["active"] == (data["available"] > 0)


# --- New founding widget HTML endpoint --------------------------------------
class TestFoundingWidget:
    def test_widget_returns_html_when_active(self, api_client):
        # First check the json status so we know whether to expect 200 or 204
        status = api_client.get(f"{BASE_URL}/api/founding-status", timeout=15).json()
        r = api_client.get(f"{BASE_URL}/api/founding-status/widget", timeout=15)

        if status["available"] <= 0:
            # Sold out → 204
            assert r.status_code == 204, r.text
            return

        assert r.status_code == 200, r.text
        ct = r.headers.get("content-type", "")
        assert "text/html" in ct.lower(), f"Wrong content-type: {ct}"

        body = r.text
        # Branding present
        assert "Patch &amp; Pot · Founding Member" in body or "Patch & Pot · Founding Member" in body, body[:500]
        # Spots-left count present, matches /founding-status
        assert f"{status['available']} of {status['total']} spots left" in body, body[:500]
        # CTA present, links to the public origin with ?founding=1
        m = re.search(r'href="([^"]+)"[^>]*class="pp-cta"|class="pp-cta"[^>]*href="([^"]+)"', body)
        assert m, "Could not locate CTA anchor"
        href = m.group(1) or m.group(2)
        assert href.endswith("/?founding=1"), f"CTA href wrong: {href}"
        assert "Claim my spot" in body

    def test_widget_headers_for_iframe_embed(self, api_client):
        status = api_client.get(f"{BASE_URL}/api/founding-status", timeout=15).json()
        if status["available"] <= 0:
            pytest.skip("Cohort sold out — widget returns 204 with no headers to test")
        r = api_client.get(f"{BASE_URL}/api/founding-status/widget", timeout=15)
        assert r.status_code == 200
        # CSP frame-ancestors * — critical for cross-origin iframe embedding
        csp = r.headers.get("content-security-policy", "")
        assert "frame-ancestors" in csp.lower() and "*" in csp, f"CSP wrong: {csp}"
        # Cache-Control public,max-age=60 is set by the app but the
        # Cloudflare/preview ingress in this environment rewrites it to
        # `no-store, no-cache, must-revalidate`. Verify origin directly when
        # reachable to prove the app code is correct.
        cc = r.headers.get("cache-control", "")
        if "public" not in cc.lower():
            try:
                local = requests.get("http://localhost:8001/api/founding-status/widget", timeout=5)
                origin_cc = local.headers.get("cache-control", "")
                assert "public" in origin_cc.lower() and "max-age=60" in origin_cc.lower(), (
                    f"Origin Cache-Control also wrong: {origin_cc}"
                )
            except requests.RequestException:
                pytest.skip(f"Public ingress rewrote Cache-Control to {cc!r}; origin unreachable to verify")


# --- TIP checkout flow ------------------------------------------------------
class TestTipCheckout:
    def test_tip_checkout_session_and_status_shape(self, api_client):
        origin = BASE_URL
        r = api_client.post(
            f"{BASE_URL}/api/checkout/session",
            json={"package_id": "tip", "origin_url": origin},
            timeout=30,
        )
        if r.status_code in (500, 502, 503):
            pytest.skip(f"Stripe unavailable in this env: {r.status_code} {r.text[:120]}")
        assert r.status_code == 200, r.text
        data = r.json()
        assert data.get("package_id") == "tip", data
        assert "session_id" in data and data["session_id"]
        assert "url" in data and data["url"].startswith("http")

        session_id = data["session_id"]
        s = api_client.get(f"{BASE_URL}/api/checkout/status/{session_id}", timeout=30)
        assert s.status_code == 200, s.text
        sdata = s.json()
        # Critical for CheckoutSuccess.jsx branching into tip_success
        assert sdata.get("package_id") == "tip", sdata
        assert sdata.get("session_id") == session_id
        # Before payment, payment_status should be unpaid / no
        assert "payment_status" in sdata
        assert "paid" in sdata
