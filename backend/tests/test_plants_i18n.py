"""Backend tests for /api/plants i18n + companions translation (iteration 10)."""
import os
import time
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
if not BASE_URL:
    # fallback to frontend env
    try:
        with open("/app/frontend/.env") as f:
            for line in f:
                if line.startswith("REACT_APP_BACKEND_URL="):
                    BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
    except Exception:
        pass

TIMEOUT = 90  # First Claude call can take 15-30s for 32 plants


def _get(path, **params):
    return requests.get(f"{BASE_URL}{path}", params=params, timeout=TIMEOUT)


def test_plants_english_default():
    r = _get("/api/plants")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    tomato = next((p for p in data if p["id"] == "tomato"), None)
    assert tomato is not None
    assert tomato["name"] == "Tomato"
    assert tomato["category"] == "Vegetable"
    assert tomato["container"] is True


def test_plants_german_translates():
    # First call (may be slow / cached from previous runs)
    t0 = time.time()
    r = _get("/api/plants", language="de")
    elapsed = time.time() - t0
    assert r.status_code == 200, r.text
    data = r.json()
    tomato = next((p for p in data if p["id"] == "tomato"), None)
    assert tomato is not None
    # ID + container must NOT be translated
    assert tomato["id"] == "tomato"
    assert tomato["container"] is True
    # Translatable fields should NOT match the English originals
    assert tomato["name"] != "Tomato" or tomato["category"] != "Vegetable"
    # Should look like German (contain at least one non-ASCII letter OR clearly differ)
    assert tomato["summary"] != "Sun-loving fruit that thrives in pots with stakes or cages."
    print(f"DE plants first/cached call took {elapsed:.2f}s; tomato name={tomato['name']!r}")


def test_plants_german_cached_fast():
    # Second call should be cached and fast (<3s)
    t0 = time.time()
    r = _get("/api/plants", language="de")
    elapsed = time.time() - t0
    assert r.status_code == 200
    assert elapsed < 5.0, f"Cached DE call took {elapsed:.2f}s (expected <5s)"


def test_plant_detail_french():
    r = _get("/api/plants/tomato", language="fr")
    assert r.status_code == 200
    p = r.json()
    assert p["id"] == "tomato"
    assert p["container"] is True
    assert p["name"] != "Tomato"
    assert p["summary"] != "Sun-loving fruit that thrives in pots with stakes or cages."


def test_plant_detail_japanese():
    r = _get("/api/plants/tomato", language="ja")
    assert r.status_code == 200
    p = r.json()
    # JA name should contain non-ASCII characters
    assert any(ord(c) > 127 for c in p["name"]), f"Expected non-ASCII JA name, got {p['name']!r}"


def test_plant_detail_english_untouched():
    r = _get("/api/plants/tomato")
    assert r.status_code == 200
    p = r.json()
    assert p["name"] == "Tomato"
    assert p["summary"] == "Sun-loving fruit that thrives in pots with stakes or cages."


def test_companions_tomato_german_translated():
    r = _get("/api/plants/tomato/companions", language="de")
    assert r.status_code == 200
    data = r.json()
    assert data["plant_id"] == "tomato"
    assert len(data["companions"]) > 0
    # Reasons should be translated (not the original English text)
    for c in data["companions"]:
        if c.get("reason"):
            assert "Classic pairing" not in c["reason"]
            assert "Marigolds pull in pollinators" not in c["reason"]


def test_plant_unknown_language_falls_back_to_english():
    r = _get("/api/plants", language="xx")
    assert r.status_code == 200
    data = r.json()
    tomato = next(p for p in data if p["id"] == "tomato")
    assert tomato["name"] == "Tomato"  # fallback


def test_plant_not_found_404():
    r = _get("/api/plants/does-not-exist", language="en")
    assert r.status_code == 404
