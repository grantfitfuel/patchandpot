"""Backend regression tests for Patch & Pot API."""
import os
import time

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    return requests.Session()


# ---------- Health ----------
def test_root_status(s):
    r = s.get(f"{API}/", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["app"] == "Patch & Pot"
    assert data["status"] == "ok"


# ---------- Plants ----------
def test_plants_list(s):
    r = s.get(f"{API}/plants", timeout=15)
    assert r.status_code == 200
    plants = r.json()
    assert isinstance(plants, list)
    assert len(plants) >= 32, f"Expected >=32 plants, got {len(plants)}"


def test_plants_flowers(s):
    r = s.get(f"{API}/plants", timeout=15)
    plants = r.json()
    flowers = [p for p in plants if p.get("category") == "Flower"]
    assert len(flowers) >= 12, f"Expected >=12 flowers, got {len(flowers)}"

    expected = {"Nasturtium", "Calendula", "Sunflower", "Marigold", "Lavender",
                "Cosmos", "Viola / Pansy", "Sweet Pea", "Zinnia", "Borage",
                "Scented Geranium", "Chamomile"}
    flower_names = {p["name"] for p in flowers}
    missing = expected - flower_names
    assert not missing, f"Missing flowers: {missing}"


def test_plant_by_id(s):
    r = s.get(f"{API}/plants/lavender", timeout=15)
    assert r.status_code == 200
    assert r.json()["name"] == "Lavender"


def test_plant_404(s):
    r = s.get(f"{API}/plants/does-not-exist", timeout=15)
    assert r.status_code == 404


# ---------- Regions ----------
def test_regions_search(s):
    r = s.get(f"{API}/regions/search", params={"q": "London"}, timeout=20)
    assert r.status_code == 200
    results = r.json()["results"]
    assert len(results) > 0
    assert any("London" in (item.get("name") or "") for item in results)


def test_regions_reverse(s):
    r = s.get(f"{API}/regions/reverse", params={"lat": 51.5, "lon": -0.13}, timeout=20)
    assert r.status_code == 200
    data = r.json()
    assert data["hemisphere"] == "northern"
    assert data["climate_zone"] == "Temperate"
    assert "name" in data


def test_regions_reverse_southern(s):
    r = s.get(f"{API}/regions/reverse", params={"lat": -33.86, "lon": 151.2}, timeout=20)
    data = r.json()
    assert data["hemisphere"] == "southern"


# ---------- Guidance (AI) ----------
GUIDANCE_PAYLOAD = {
    "region": {
        "name": "London", "country": "United Kingdom",
        "latitude": 51.5, "longitude": -0.13,
        "hemisphere": "northern", "climate_zone": "Temperate",
    },
    "month": 6,
}


def test_guidance_generation(s):
    t0 = time.time()
    r = s.post(f"{API}/guidance", json=GUIDANCE_PAYLOAD, timeout=120)
    elapsed = time.time() - t0
    assert r.status_code == 200, f"Got {r.status_code}: {r.text[:300]}"
    data = r.json()
    for key in ("summary", "season_label", "plant_now", "harvest_now", "tasks", "pests", "tip"):
        assert key in data, f"missing key: {key}"
    assert len(data["plant_now"]) >= 2
    assert len(data["tasks"]) >= 1
    # 'kind' field required on plant_now items
    kinds = {item.get("kind") for item in data["plant_now"]}
    assert kinds & {"food", "flower"}, f"plant_now items missing kind food/flower: {data['plant_now']}"
    # harvest_now also should have kind
    h_kinds = {item.get("kind") for item in data["harvest_now"]}
    assert h_kinds & {"food", "flower"}, f"harvest_now missing kind: {data['harvest_now']}"
    print(f"Guidance generation took {elapsed:.1f}s")


def test_guidance_caching(s):
    # First call (may be cached from previous)
    s.post(f"{API}/guidance", json=GUIDANCE_PAYLOAD, timeout=120)
    t0 = time.time()
    r = s.post(f"{API}/guidance", json=GUIDANCE_PAYLOAD, timeout=30)
    elapsed = time.time() - t0
    assert r.status_code == 200
    assert elapsed < 5, f"Cached call too slow: {elapsed:.1f}s"


# ---------- Plant image (AI) ----------
def test_plant_image_generation(s):
    payload = {"plant_id": "lavender", "plant_name": "Lavender"}
    r = s.post(f"{API}/plant-image", json=payload, timeout=120)
    assert r.status_code == 200, f"Got {r.status_code}: {r.text[:300]}"
    data = r.json()
    assert data["image"].startswith("data:"), "Expected data URL"
    assert ";base64," in data["image"]


def test_plant_image_cache(s):
    payload = {"plant_id": "lavender", "plant_name": "Lavender"}
    r = s.post(f"{API}/plant-image", json=payload, timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data.get("cached") is True


# ---------- Companions (iteration 2) ----------
def test_companions_tomato(s):
    r = s.get(f"{API}/plants/tomato/companions", timeout=15)
    assert r.status_code == 200
    data = r.json()
    assert data["plant_id"] == "tomato"
    names = {c["name"] for c in data["companions"]}
    assert {"Basil", "Marigold", "Nasturtium", "Chives", "Borage"}.issubset(names), names
    # at least one curated reason exists for tomato pairings
    reasons = [c.get("reason") for c in data["companions"] if c.get("reason")]
    assert len(reasons) >= 3


def test_companions_lavender(s):
    r = s.get(f"{API}/plants/lavender/companions", timeout=15)
    assert r.status_code == 200
    names = {c["name"] for c in r.json()["companions"]}
    assert "Rosemary" in names and "Thyme" in names


def test_companions_mint_empty(s):
    r = s.get(f"{API}/plants/mint/companions", timeout=15)
    assert r.status_code == 200
    assert r.json()["companions"] == []


def test_companions_sweet_pea_empty(s):
    r = s.get(f"{API}/plants/sweet-pea/companions", timeout=15)
    assert r.status_code == 200
    assert r.json()["companions"] == []


def test_companions_invalid_404(s):
    r = s.get(f"{API}/plants/does-not-exist/companions", timeout=15)
    assert r.status_code == 404


# ---------- Pest image (iteration 2) ----------
def test_pest_image_generation(s):
    r = s.post(f"{API}/pest-image", json={"name": "Aphids"}, timeout=120)
    assert r.status_code == 200, f"Got {r.status_code}: {r.text[:300]}"
    data = r.json()
    assert data["image"].startswith("data:")
    assert ";base64," in data["image"]


def test_pest_image_cache(s):
    r = s.post(f"{API}/pest-image", json={"name": "Aphids"}, timeout=30)
    assert r.status_code == 200
    assert r.json().get("cached") is True


# ---------- Multi-language guidance (iteration 2) ----------
def _lang_payload(lang):
    return {**GUIDANCE_PAYLOAD, "language": lang}


def test_guidance_french(s):
    r = s.post(f"{API}/guidance", json=_lang_payload("fr"), timeout=180)
    assert r.status_code == 200
    data = r.json()
    # kind field stays English
    kinds = {item.get("kind") for item in data["plant_now"]}
    assert kinds.issubset({"food", "flower"}), f"kind should stay English: {kinds}"
    # heuristic: French summary contains French accents or common French words
    summary = (data.get("summary") or "").lower()
    french_markers = ["é", "è", "à", "ê", "ç", " le ", " la ", " les ", " des ", " et ", " est ", "jardin", "plant"]
    assert any(m in summary for m in french_markers), f"Not French-looking: {summary[:200]}"


def test_guidance_german(s):
    r = s.post(f"{API}/guidance", json=_lang_payload("de"), timeout=180)
    assert r.status_code == 200
    summary = (r.json().get("summary") or "").lower()
    german_markers = ["ä", "ö", "ü", "ß", " der ", " die ", " das ", " und ", " ist ", "garten", "pflanz"]
    assert any(m in summary for m in german_markers), f"Not German-looking: {summary[:200]}"


def test_guidance_japanese(s):
    r = s.post(f"{API}/guidance", json=_lang_payload("ja"), timeout=180)
    assert r.status_code == 200
    summary = r.json().get("summary") or ""
    # Check at least one Hiragana/Katakana/CJK character
    has_cjk = any("\u3040" <= c <= "\u9fff" for c in summary)
    assert has_cjk, f"Expected Japanese chars: {summary[:200]}"


def test_guidance_chinese(s):
    r = s.post(f"{API}/guidance", json=_lang_payload("zh"), timeout=180)
    assert r.status_code == 200
    summary = r.json().get("summary") or ""
    has_cjk = any("\u4e00" <= c <= "\u9fff" for c in summary)
    assert has_cjk, f"Expected Chinese chars: {summary[:200]}"


def test_guidance_invalid_language_defaults_en(s):
    # Use a fresh region/month combo to avoid cache hit on existing 'en'
    payload = {**GUIDANCE_PAYLOAD, "month": 7, "language": "xx-invalid"}
    r = s.post(f"{API}/guidance", json=payload, timeout=180)
    assert r.status_code == 200
    summary = (r.json().get("summary") or "").lower()
    # English heuristic
    en_markers = [" the ", " and ", " is ", " a ", " in ", "garden", "plant"]
    assert any(m in summary for m in en_markers), f"Not English: {summary[:200]}"


def test_guidance_language_cache_separation(s):
    # FR should be cached from earlier call -> fast second call
    t0 = time.time()
    r = s.post(f"{API}/guidance", json=_lang_payload("fr"), timeout=30)
    elapsed = time.time() - t0
    assert r.status_code == 200
    assert elapsed < 5, f"FR cache miss? Took {elapsed:.1f}s"
