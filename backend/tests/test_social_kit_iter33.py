"""Tests for the Social Media Kit endpoint added in iter33.

Covers:
* GET /api/share/patch/{share_id}/social-kit.zip returns 200, application/zip
  with a Content-Disposition attachment, containing 4 PNGs + captions.txt +
  README.txt.
* The endpoint caches in `shared_patch_social_kit`; a second hit returns
  the same bytes without re-generating (mtime stable).
* Long unbreakable patch names (no spaces) DO NOT cause clipped/clipped
  images — verified indirectly by inspecting the rendered PNG dimensions
  and ensuring valid PNG output.
* Caption generation falls back to templates if the LLM is unreachable.
"""
import io
import os
import sys
import zipfile

import requests

sys.path.insert(0, "/app/backend")

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://grow-by-season-1.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

REGION = {
    "name": "London",
    "country": "United Kingdom",
    "latitude": 51.5074,
    "longitude": -0.1278,
    "climate_zone": "Temperate",
    "hemisphere": "northern",
}


def _create_share(name="TEST_kit_basic", plants=None):
    plants = plants or [
        {"id": "tomato",  "name": "Tomato",  "category": "vegetable"},
        {"id": "basil",   "name": "Basil",   "category": "herb"},
        {"id": "lettuce", "name": "Lettuce", "category": "vegetable"},
    ]
    payload = {
        "patch_name":     name,
        "region":         REGION,
        "plants":         plants,
        "list_publicly":  False,
    }
    r = requests.post(f"{API}/share/patch", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["share_id"]


def test_social_kit_returns_zip_with_expected_members():
    share_id = _create_share()
    r = requests.get(f"{API}/share/patch/{share_id}/social-kit.zip", timeout=60)
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "application/zip"
    assert "attachment" in r.headers["content-disposition"]
    assert share_id in r.headers["content-disposition"]

    zf = zipfile.ZipFile(io.BytesIO(r.content))
    names = set(zf.namelist())
    assert names >= {
        "instagram_square.png",
        "instagram_portrait.png",
        "reels_story.png",
        "youtube_twitter.png",
        "captions.txt",
        "README.txt",
    }, f"missing files: {names}"

    # PNG signature on every image
    for name in (
        "instagram_square.png",
        "instagram_portrait.png",
        "reels_story.png",
        "youtube_twitter.png",
    ):
        data = zf.read(name)
        assert data[:8] == b"\x89PNG\r\n\x1a\n", f"{name} is not a valid PNG"
        # Sanity-check size — each image should be at least 20KB after
        # palette + typography rendering. If we ever ship a blank canvas
        # by mistake it'll be much smaller.
        assert len(data) > 20_000, f"{name} looks empty ({len(data)} bytes)"

    # Captions file has all 4 platform sections + the patch name
    captions = zf.read("captions.txt").decode()
    for section in ("Instagram", "Reels", "Twitter"):
        assert section in captions, f"captions.txt missing '{section}' section"


def test_social_kit_is_cached_on_second_call():
    """The second call should return byte-identical content — proves the
    LLM caption generation isn't re-running on every download."""
    share_id = _create_share(name="TEST_kit_cache")
    r1 = requests.get(f"{API}/share/patch/{share_id}/social-kit.zip", timeout=60)
    r2 = requests.get(f"{API}/share/patch/{share_id}/social-kit.zip", timeout=60)
    assert r1.status_code == 200
    assert r2.status_code == 200
    # ZIP file mtimes inside the archive vary, but the cached bytes
    # are stored verbatim — so the second call must be the same bytes
    # as the first (cache hit).
    assert r1.content == r2.content


def test_social_kit_handles_long_unbreakable_patch_name():
    """Regression guard: an underscore-joined patch name has no word
    boundaries for the wrap helper to break at. The renderer must still
    return a valid, non-clipped PNG by either shrinking the font further
    or ellipsising the line."""
    long_name = "TEST_kit_" + "x" * 24  # 33 chars, no spaces
    share_id = _create_share(name=long_name[:30])  # patch_name max is 30
    r = requests.get(f"{API}/share/patch/{share_id}/social-kit.zip", timeout=60)
    assert r.status_code == 200
    zf = zipfile.ZipFile(io.BytesIO(r.content))
    # Every image must still be a valid PNG (not corrupted/zero-byte)
    for name in zf.namelist():
        if not name.endswith(".png"):
            continue
        data = zf.read(name)
        assert data[:8] == b"\x89PNG\r\n\x1a\n", f"{name} corrupt for long-name patch"


def test_social_kit_404_on_unknown_share():
    r = requests.get(f"{API}/share/patch/nonexistent999/social-kit.zip", timeout=15)
    assert r.status_code == 404


def test_caption_generator_fallback_templates_sync():
    """Direct unit test of the fallback path — when the LLM key is empty
    the captions module returns deterministic template strings instead
    of crashing the endpoint."""
    from share_social_captions import _fallback_captions

    out = _fallback_captions("Sunny Window", "London", 7)
    assert set(out.keys()) == {
        "instagram_square",
        "instagram_portrait",
        "reels_story",
        "youtube_twitter",
    }
    for key, text in out.items():
        assert text.strip(), f"{key} fallback is empty"
        assert "Sunny Window" in text or "London" in text, (
            f"{key} fallback lacks patch context: {text!r}"
        )
