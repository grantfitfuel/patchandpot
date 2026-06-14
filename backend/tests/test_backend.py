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
