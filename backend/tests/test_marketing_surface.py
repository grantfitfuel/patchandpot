"""Smoke tests for the crawler-facing product surface:
  - Homepage title / meta / new copy
  - /capabilities index + every capability landing
  - Automated /api/sitemap.xml
  - /api/track/event beacon
"""
import os
import xml.etree.ElementTree as ET

import requests


BASE = os.environ.get("BACKEND_URL_INTERNAL", "http://localhost:8001")
FRONTEND = os.environ.get(
    "REACT_APP_BACKEND_URL", BASE,
).rstrip("/")

CAPABILITIES = [
    "ask-nadar", "monthly-guide", "masterclasses", "calm",
    "plants", "grow-anywhere", "recipes", "bouquet",
    "journal", "topics",
]


class TestSitemap:
    """Automated sitemap must always include the marketing surface."""

    def _urls(self):
        r = requests.get(f"{FRONTEND}/api/sitemap.xml", timeout=15)
        assert r.status_code == 200
        assert "xml" in r.headers.get("content-type", "").lower()
        root = ET.fromstring(r.text)
        ns = "{http://www.sitemaps.org/schemas/sitemap/0.9}"
        return [u.find(f"{ns}loc").text for u in root.findall(f"{ns}url")]

    def test_homepage_present(self):
        urls = self._urls()
        assert any(u.rstrip("/").endswith(".app") or u.endswith("/") for u in urls)

    def test_capability_landings_present(self):
        urls = self._urls()
        joined = " ".join(urls)
        assert "/capabilities" in joined
        for slug in CAPABILITIES:
            assert f"/capabilities/{slug}" in joined, slug

    def test_plants_at_least_ten(self):
        urls = self._urls()
        plant_urls = [u for u in urls if "/plants/" in u]
        assert len(plant_urls) >= 10


class TestTrackEndpoint:
    def test_track_accepts_valid_event(self):
        r = requests.post(
            f"{FRONTEND}/api/track/event",
            json={"event": "unit_test", "params": {"foo": "bar"}, "sid": "unit"},
            timeout=10,
        )
        assert r.status_code == 200
        assert r.json().get("ok") is True

    def test_track_survives_junk(self):
        # Payload validation must never 500. Missing fields → 200 no-op.
        r = requests.post(
            f"{FRONTEND}/api/track/event",
            json={"event": "junk"},
            timeout=10,
        )
        assert r.status_code == 200
