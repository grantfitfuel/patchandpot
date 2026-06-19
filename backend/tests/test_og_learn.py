"""Tests for GET /api/og/learn/{topic} SEO landing-page metadata endpoint."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://grow-by-season-1.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ---- Static masterclass OG metadata ----
class TestStaticOg:
    def test_propagation(self, client):
        r = client.get(f"{BASE_URL}/api/og/learn/propagation", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["source"] == "static"
        assert d["title"] == "Propagation Masterclass"
        assert d["tagline"] and isinstance(d["tagline"], str)
        assert d["description"] and isinstance(d["description"], str)
        assert isinstance(d["intro_paragraphs"], list) and len(d["intro_paragraphs"]) >= 1
        assert d["image_subject"]
        assert d["url_path"] == "/learn/propagation"

    def test_pest_control_description_trim(self, client):
        r = client.get(f"{BASE_URL}/api/og/learn/pest-control", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["source"] == "static"
        # _first_paragraph trims to ~280 chars + ellipsis. Spec says <290.
        assert len(d["description"]) < 290, f"description too long: {len(d['description'])}"

    def test_plant_care(self, client):
        r = client.get(f"{BASE_URL}/api/og/learn/plant-care", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["source"] == "static"
        assert d["title"] == "Plant Care Masterclass"

    def test_seasonal_planting(self, client):
        r = client.get(f"{BASE_URL}/api/og/learn/seasonal-planting", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["source"] == "static"
        assert d["title"] == "Seasonal Planting Masterclass"


# ---- AI-cached masterclass OG metadata ----
class TestAiOg:
    def test_container_tomatoes_ai_cache(self, client):
        r = client.get(f"{BASE_URL}/api/og/learn/container-tomatoes", timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["source"] == "ai"
        assert d["title"]
        assert isinstance(d["title"], str) and len(d["title"]) > 0
        assert d["tagline"] is not None
        assert d["lesson_count"] and d["lesson_count"] > 0
        assert isinstance(d["intro_paragraphs"], list)
        assert len(d["intro_paragraphs"]) <= 3

    def test_language_fallback_to_en(self, client):
        r = client.get(f"{BASE_URL}/api/og/learn/container-tomatoes", params={"language": "fr"}, timeout=15)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["source"] == "ai"
        assert d["title"]


# ---- Negative case ----
class TestOgNotFound:
    def test_nonexistent_topic_returns_404(self, client):
        r = client.get(f"{BASE_URL}/api/og/learn/this-topic-definitely-does-not-exist-xyz", timeout=15)
        assert r.status_code == 404, r.text
