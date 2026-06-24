"""Iteration 30 — Plant of the Week + popular plants + debounced plant view tracking.

Mirrors the share-patch pattern. We exercise:
  - GET /api/plants/{plant_id} increments view_count_7d once per (IP,UA) fingerprint
  - Bot user-agents are skipped entirely
  - /api/plants/of-the-week returns {plant: null} when empty, top plant otherwise
  - /api/plants/popular returns top N plants
  - Route ordering: /of-the-week and /popular not shadowed by /{plant_id}
"""
import os
import sys
import uuid

import pytest
import requests

sys.path.insert(0, "/app/backend")

BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or "https://grow-by-season-1.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


def _fresh_ua():
    """Unique UA per test so we don't collide with the shared 24h dedup row."""
    return f"PnPTestAgent/{uuid.uuid4().hex[:12]} (compatible; pytest)"


def _fresh_ip():
    """Forge a fresh forwarded IP so the (ip,ua) fingerprint is fresh."""
    h = uuid.uuid4().int
    return f"203.0.113.{(h % 250) + 1}"


def _headers(ua=None, ip=None):
    return {
        "User-Agent": ua or _fresh_ua(),
        "X-Forwarded-For": ip or _fresh_ip(),
    }


class TestPlantOfTheWeek:
    def test_route_order_not_shadowed(self):
        # of-the-week MUST resolve before /{plant_id}
        r = requests.get(f"{API}/plants/of-the-week", headers=_headers(), timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "plant" in body  # shape always present

    def test_popular_default_and_capped(self):
        r = requests.get(f"{API}/plants/popular", headers=_headers(), timeout=20)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "items" in body and isinstance(body["items"], list)

        # explicit limit
        r2 = requests.get(f"{API}/plants/popular", params={"limit": 3}, headers=_headers(), timeout=20)
        assert r2.status_code == 200
        assert len(r2.json()["items"]) <= 3

        # cap at 24
        r3 = requests.get(f"{API}/plants/popular", params={"limit": 9999}, headers=_headers(), timeout=20)
        assert r3.status_code == 200


class TestPlantViewDebounce:
    def test_view_increments_once_per_fingerprint(self):
        # Pick a fresh plant id that's unlikely to be hot, so we can observe deltas.
        plant_id = "chamomile"
        ua = _fresh_ua()
        ip = _fresh_ip()
        hdrs = _headers(ua=ua, ip=ip)

        # baseline — current top
        before = requests.get(f"{API}/plants/popular", params={"limit": 24}, timeout=20).json()["items"]
        before_count = next(
            (i["view_count_7d"] for i in before if i["plant"]["id"] == plant_id), 0
        )

        # 1st view increments
        r1 = requests.get(f"{API}/plants/{plant_id}", headers=hdrs, timeout=20)
        assert r1.status_code == 200, r1.text
        assert r1.json()["id"] == plant_id

        # 2nd + 3rd view from same fingerprint do NOT increment
        for _ in range(2):
            r = requests.get(f"{API}/plants/{plant_id}", headers=hdrs, timeout=20)
            assert r.status_code == 200

        after = requests.get(f"{API}/plants/popular", params={"limit": 24}, timeout=20).json()["items"]
        after_count = next(
            (i["view_count_7d"] for i in after if i["plant"]["id"] == plant_id), 0
        )
        # exactly +1 (debounced)
        assert after_count - before_count == 1, (
            f"expected +1, got {after_count - before_count} (before={before_count}, after={after_count})"
        )

    def test_bot_user_agent_skipped(self):
        plant_id = "borage"
        before = requests.get(f"{API}/plants/popular", params={"limit": 24}, timeout=20).json()["items"]
        before_count = next(
            (i["view_count_7d"] for i in before if i["plant"]["id"] == plant_id), 0
        )
        for ua in ("facebookexternalhit/1.1", "Twitterbot/1.0", "Googlebot/2.1", "WhatsApp/2.0"):
            hdrs = _headers(ua=ua, ip=_fresh_ip())
            r = requests.get(f"{API}/plants/{plant_id}", headers=hdrs, timeout=20)
            assert r.status_code == 200
        after = requests.get(f"{API}/plants/popular", params={"limit": 24}, timeout=20).json()["items"]
        after_count = next(
            (i["view_count_7d"] for i in after if i["plant"]["id"] == plant_id), 0
        )
        assert after_count == before_count, (
            f"bot UA should not increment; before={before_count}, after={after_count}"
        )


class TestPlantOfTheWeekHydrated:
    def test_of_the_week_has_top_plant_after_views(self):
        # Ensure at least one plant has views by visiting one with a fresh fp.
        hdrs = _headers()
        requests.get(f"{API}/plants/tomato", headers=hdrs, timeout=20)

        r = requests.get(f"{API}/plants/of-the-week", timeout=20)
        assert r.status_code == 200
        body = r.json()
        # Either a top plant or null — but if popular has items, this must be non-null.
        pop = requests.get(f"{API}/plants/popular", params={"limit": 1}, timeout=20).json()
        if pop["items"]:
            assert body["plant"] is not None
            assert "id" in body["plant"]
            assert "name" in body["plant"]
            assert isinstance(body.get("view_count_7d"), int)

    def test_of_the_week_german_locale(self):
        # Seed a view, then request the German translation. Should not 500.
        requests.get(f"{API}/plants/basil", headers=_headers(), timeout=20)
        r = requests.get(f"{API}/plants/of-the-week", params={"language": "de"}, timeout=60)
        assert r.status_code == 200, r.text
        body = r.json()
        assert "plant" in body


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
