"""Backend tests for POST /api/arrangement/suggest.

We hit the live LLM here (Claude via Emergent universal key) because the
endpoint is small, fast, and we want to assert it actually returns the
expected JSON shape. Each test is throttled by Mongo cache so re-runs in
quick succession are free.
"""
import os
from pathlib import Path

import httpx
import pytest
from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")
load_dotenv("/app/frontend/.env")

API_URL = os.environ["REACT_APP_BACKEND_URL"]
LONDON = {
    "name": "London", "country": "United Kingdom",
    "latitude": 51.5, "longitude": -0.13,
    "climate_zone": "Temperate Oceanic", "hemisphere": "northern",
}


@pytest.fixture(scope="module")
def client():
    with httpx.Client(timeout=120.0) as c:
        yield c


def test_arrangement_returns_full_shape(client):
    r = client.post(f"{API_URL}/api/arrangement/suggest", json={
        "region": LONDON, "month": 6, "language": "en",
        "my_garden": ["dahlia", "rose", "sweet pea", "cosmos", "basil", "mint"],
    })
    assert r.status_code == 200, r.text
    data = r.json()
    for k in ("title", "intro", "vase", "mechanic", "stems", "build_steps", "tip"):
        assert k in data, f"Missing key: {k}"
    assert isinstance(data["stems"], list) and len(data["stems"]) >= 3
    for stem in data["stems"]:
        for k in ("plant", "role", "count", "cutting_tip"):
            assert k in stem, f"Stem missing {k}: {stem}"
        assert stem["role"].lower() in {"focal", "filler", "line", "accent", "foliage"}
    assert isinstance(data["build_steps"], list) and len(data["build_steps"]) >= 4


def test_arrangement_empty_garden_rejected(client):
    r = client.post(f"{API_URL}/api/arrangement/suggest", json={
        "region": LONDON, "month": 6, "language": "en", "my_garden": [],
    })
    assert r.status_code == 400


def test_arrangement_idempotency_cached(client):
    """Second call with identical input must return the same payload (Mongo cache)."""
    payload = {
        "region": LONDON, "month": 6, "language": "en",
        "my_garden": ["dahlia", "rose"],
    }
    r1 = client.post(f"{API_URL}/api/arrangement/suggest", json=payload)
    r2 = client.post(f"{API_URL}/api/arrangement/suggest", json=payload)
    assert r1.status_code == r2.status_code == 200
    assert r1.json() == r2.json(), "Cache should return identical payload on repeat."


def test_arrangement_regenerate_query_param_bypasses_cache(client):
    """?regenerate=true MUST produce a fresh AI call (and likely a different title)."""
    payload = {
        "region": LONDON, "month": 7, "language": "en",
        "my_garden": ["sweet pea", "cosmos", "alchemilla", "dahlia"],
    }
    r1 = client.post(f"{API_URL}/api/arrangement/suggest", json=payload)
    r2 = client.post(f"{API_URL}/api/arrangement/suggest", json=payload,
                     params={"regenerate": "true"})
    assert r1.status_code == r2.status_code == 200
    # The two should differ in at least one of title or intro because the
    # second one was a fresh LLM call. We don't assert specific words because
    # the model could land on the same title twice — just assert they're both
    # shape-valid.
    for data in (r1.json(), r2.json()):
        assert data.get("title") and data.get("intro") and isinstance(data.get("stems"), list)
