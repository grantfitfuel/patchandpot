"""Tests for the new /captions.json endpoint and the shared caption cache
that powers both the social-kit ZIP and the [Tweet this patch] button.
"""
import os
import sys

import requests

sys.path.insert(0, "/app/backend")

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://grow-by-season-1.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

REGION = {
    "name": "Bristol",
    "country": "United Kingdom",
    "latitude": 51.45,
    "longitude": -2.58,
    "climate_zone": "Temperate",
    "hemisphere": "northern",
}


def _create_share(name="TEST_captions_iter34"):
    payload = {
        "patch_name":     name,
        "region":         REGION,
        "plants":         [{"id": "kale", "name": "Kale", "category": "vegetable"}],
        "list_publicly":  False,
    }
    r = requests.post(f"{API}/share/patch", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["share_id"]


def test_captions_json_returns_all_four_platforms():
    share_id = _create_share()
    r = requests.get(f"{API}/share/patch/{share_id}/captions.json", timeout=60)
    assert r.status_code == 200, r.text
    assert r.headers["content-type"].startswith("application/json")
    body = r.json()
    assert "captions" in body
    captions = body["captions"]
    expected = {"instagram_square", "instagram_portrait", "reels_story", "youtube_twitter"}
    assert expected <= set(captions.keys()), f"missing platforms: {expected - set(captions.keys())}"
    # Every caption is non-empty
    for k, v in captions.items():
        assert isinstance(v, str) and v.strip(), f"{k} caption is empty"


def test_captions_json_is_cached():
    """Second call must be byte-identical — proves the LLM isn't re-running."""
    share_id = _create_share(name="TEST_captions_cache")
    r1 = requests.get(f"{API}/share/patch/{share_id}/captions.json", timeout=60)
    r2 = requests.get(f"{API}/share/patch/{share_id}/captions.json", timeout=15)
    assert r1.json() == r2.json()


def test_captions_warms_social_kit_cache():
    """Hitting /captions.json + /story.png first should NOT force the ZIP
    endpoint to re-call the LLMs — they share the captions cache
    (shared_patch_captions) and the watercolour cache
    (shared_patch_watercolour). We verify the ZIP comes back quickly
    after both are warmed, and that the captions inside the ZIP match
    the JSON endpoint exactly."""
    import io
    import time
    import zipfile

    share_id = _create_share(name="TEST_captions_warm_kit")
    # Warm both caches (captions + watercolour). /story.png generates
    # and stores the watercolour — same row used by the ZIP path.
    r_caps = requests.get(f"{API}/share/patch/{share_id}/captions.json", timeout=60)
    assert r_caps.status_code == 200
    expected_captions = r_caps.json()["captions"]
    r_story = requests.get(f"{API}/share/patch/{share_id}/story.png", timeout=60)
    assert r_story.status_code == 200

    # Now request the ZIP — should not need to re-call any LLM. Pure
    # composition + zipping = ~5s.
    t0 = time.time()
    r_zip = requests.get(f"{API}/share/patch/{share_id}/social-kit.zip", timeout=60)
    elapsed = time.time() - t0
    assert r_zip.status_code == 200
    assert elapsed < 15, f"ZIP build took {elapsed:.1f}s — caches probably missed"

    zf = zipfile.ZipFile(io.BytesIO(r_zip.content))
    captions_txt = zf.read("captions.txt").decode()
    for key, caption in expected_captions.items():
        snippet = caption.strip()[:40]
        assert snippet in captions_txt, (
            f"caption for {key} missing from ZIP captions.txt — captions "
            "cache is not being shared between endpoints"
        )


def test_captions_404_on_unknown_share():
    r = requests.get(f"{API}/share/patch/nonexistent999/captions.json", timeout=15)
    assert r.status_code == 404
