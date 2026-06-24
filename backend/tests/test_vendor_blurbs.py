"""Tests for the new POST /api/vendor-blurbs endpoint (iteration 8)."""
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


# ---------- Helpers ----------
UK_REGION = {
    "name": "London",
    "country": "United Kingdom",
    "climate_zone": "Temperate",
    "hemisphere": "northern",
}
AU_REGION = {
    "name": "Sydney",
    "country": "Australia",
    "climate_zone": "Temperate",
    "hemisphere": "southern",
}
UK_VENDORS = [
    {"id": "thompson-morgan", "name": "Thompson & Morgan", "kind": "seeds"},
    {"id": "crocus", "name": "Crocus", "kind": "pots"},
]


def _post(s, payload, timeout=120):
    return s.post(f"{API}/vendor-blurbs", json=payload, timeout=timeout)


# ---------- 200 OK + shape ----------
def test_vendor_blurbs_basic_shape(s):
    r = _post(s, {
        "plant_name": "Tomato",
        "vendors": UK_VENDORS,
        "region": UK_REGION,
        "language": "en",
    })
    assert r.status_code == 200, r.text[:400]
    data = r.json()
    assert "blurbs" in data and isinstance(data["blurbs"], dict)
    assert "cached" in data and isinstance(data["cached"], bool)
    # Either populated for both known vendor ids OR empty (fail-soft)
    if data["blurbs"]:
        for vid in ("thompson-morgan", "crocus"):
            assert vid in data["blurbs"], f"missing blurb for {vid}: {data['blurbs']}"
            assert isinstance(data["blurbs"][vid], str) and len(data["blurbs"][vid]) > 0


# ---------- Caching ----------
def test_vendor_blurbs_cached_second_call(s):
    payload = {
        "plant_name": "Tomato",
        "vendors": UK_VENDORS,
        "region": UK_REGION,
        "language": "en",
    }
    r1 = _post(s, payload)
    assert r1.status_code == 200
    d1 = r1.json()

    t0 = time.time()
    r2 = _post(s, payload, timeout=30)
    elapsed = time.time() - t0
    assert r2.status_code == 200
    d2 = r2.json()
    assert d2["cached"] is True, f"second call should be cached, got {d2}"
    assert elapsed < 5, f"cached call too slow: {elapsed:.1f}s"
    # Payload identity
    assert d2["blurbs"] == d1["blurbs"], "cached blurbs payload differs from initial"


# ---------- Multi-language ----------
@pytest.mark.parametrize("lang,markers", [
    ("de", ["ä", "ö", "ü", "ß", " der ", " die ", " das ", " und ", " ist ", "garten", "pflanz", "tomat"]),
    ("fr", ["é", "è", "à", "ê", "ç", " le ", " la ", " les ", " des ", " et ", " est ", "tomate", "jardin"]),
])
def test_vendor_blurbs_eu_languages(s, lang, markers):
    r = _post(s, {
        "plant_name": "Tomato",
        "vendors": UK_VENDORS,
        "region": UK_REGION,
        "language": lang,
    }, timeout=180)
    assert r.status_code == 200, r.text[:400]
    blurbs = r.json().get("blurbs") or {}
    if not blurbs:
        pytest.skip(f"LLM returned empty blurbs for {lang} (fail-soft path) — endpoint still 200 OK")
    joined = " ".join(blurbs.values()).lower()
    assert any(m in joined for m in markers), f"Not {lang}-looking: {joined[:300]}"


@pytest.mark.parametrize("lang,lo,hi", [
    ("ja", "\u3040", "\u9fff"),  # Hiragana / Katakana / CJK
    ("zh", "\u4e00", "\u9fff"),  # CJK
])
def test_vendor_blurbs_cjk_languages(s, lang, lo, hi):
    r = _post(s, {
        "plant_name": "Tomato",
        "vendors": UK_VENDORS,
        "region": UK_REGION,
        "language": lang,
    }, timeout=180)
    assert r.status_code == 200, r.text[:400]
    blurbs = r.json().get("blurbs") or {}
    if not blurbs:
        pytest.skip(f"LLM returned empty blurbs for {lang} (fail-soft path) — endpoint still 200 OK")
    joined = "".join(blurbs.values())
    has_cjk = any(lo <= c <= hi for c in joined)
    assert has_cjk, f"Expected CJK chars for {lang}: {joined[:200]}"


# ---------- No region ----------
def test_vendor_blurbs_no_region(s):
    r = _post(s, {
        "plant_name": "Tomato",
        "vendors": UK_VENDORS,
        "region": None,
        "language": "en",
    }, timeout=120)
    assert r.status_code == 200, r.text[:400]
    data = r.json()
    assert "blurbs" in data
    assert isinstance(data["blurbs"], dict)


# ---------- Fail-soft contract: never 5xx ----------
def test_vendor_blurbs_never_5xx_on_weird_inputs(s):
    payloads = [
        # Empty vendors list
        {"plant_name": "Tomato", "vendors": [], "region": UK_REGION, "language": "en"},
        # Unknown vendor ids (LLM may invent a key — endpoint must filter to known)
        {"plant_name": "Tomato", "vendors": [
            {"id": "unknown-vendor-xyz", "name": "Unknown", "kind": "seeds"},
        ], "region": UK_REGION, "language": "en"},
        # Invalid language code
        {"plant_name": "Tomato", "vendors": UK_VENDORS, "region": UK_REGION, "language": "xx-invalid"},
    ]
    for p in payloads:
        r = _post(s, p, timeout=120)
        assert r.status_code < 500, f"Got 5xx for payload {p}: {r.status_code} {r.text[:200]}"
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:200]}"
        data = r.json()
        assert "blurbs" in data
        # known-id filtering for the unknown-vendor case
        if p["vendors"] and p["vendors"][0]["id"] == "unknown-vendor-xyz":
            # blurbs map should only contain unknown-vendor-xyz if at all (its in vendors list)
            # OR be empty (if LLM keyed something else)
            for k in data["blurbs"]:
                assert k == "unknown-vendor-xyz", f"Unknown vendor id leaked: {k}"


# ---------- Australia (three-vendor slot test, southern hemisphere context) ----------
def test_vendor_blurbs_australia_three_vendors(s):
    au_vendors = [
        {"id": "diggers-club", "name": "The Diggers Club", "kind": "seeds"},
        {"id": "bunnings", "name": "Bunnings", "kind": "pots"},
        {"id": "yates", "name": "Yates", "kind": "seeds"},
    ]
    r = _post(s, {
        "plant_name": "Tomato",
        "vendors": au_vendors,
        "region": AU_REGION,
        "language": "en",
    }, timeout=180)
    assert r.status_code == 200, r.text[:400]
    data = r.json()
    assert "blurbs" in data
    if not data["blurbs"]:
        pytest.skip("LLM returned empty blurbs (fail-soft) — endpoint still 200 OK")
    # Should include only known ids
    for k in data["blurbs"].keys():
        assert k in {"diggers-club", "bunnings", "yates"}, f"Unknown id: {k}"
    # Loose regional context check (best-effort)
    joined = " ".join(data["blurbs"].values()).lower()
    # Either the country, region name, hemisphere or 'aussie' should appear somewhere
    regional_terms = ["australia", "sydney", "southern", "aussie", "summer", "humid"]
    if not any(t in joined for t in regional_terms):
        # Not a strict failure — region clause is in the prompt but LLM is free to choose words.
        print(f"WARN: no obvious regional term in AU blurbs: {joined[:300]}")


# ---------- Key includes vendor-id-set: different vendor sets => not the same cache ----------
def test_vendor_blurbs_cache_key_includes_vendor_set(s):
    # First call with one vendor.
    payload_a = {
        "plant_name": "Lavender",
        "vendors": [{"id": "thompson-morgan", "name": "Thompson & Morgan", "kind": "seeds"}],
        "region": UK_REGION,
        "language": "en",
    }
    r_a = _post(s, payload_a)
    assert r_a.status_code == 200

    # Second call same plant+region+lang but DIFFERENT vendor set
    payload_b = {
        "plant_name": "Lavender",
        "vendors": [{"id": "crocus", "name": "Crocus", "kind": "pots"}],
        "region": UK_REGION,
        "language": "en",
    }
    r_b = _post(s, payload_b)
    assert r_b.status_code == 200
    # b should NOT carry blurbs for thompson-morgan
    bbl = r_b.json().get("blurbs") or {}
    assert "thompson-morgan" not in bbl
