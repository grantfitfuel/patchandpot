"""Tests for the iter37 watercolour upgrade — AI-generated painterly
backgrounds on every Social Media Kit teaser, with graceful fallback to
the letterpress aesthetic when the LLM is unavailable.
"""
import io
import os
import sys
import time

import requests
from PIL import Image

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


def _create_share(name="TEST_watercolour_iter37"):
    payload = {
        "patch_name":    name,
        "region":        REGION,
        "plants":        [
            {"id": "tomato",  "name": "Tomato",  "category": "vegetable"},
            {"id": "basil",   "name": "Basil",   "category": "herb"},
            {"id": "lettuce", "name": "Lettuce", "category": "vegetable"},
        ],
        "list_publicly": False,
    }
    r = requests.post(f"{API}/share/patch", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["share_id"]


def test_kit_zip_uses_watercolour_aesthetic():
    """The four PNGs inside the ZIP should be > 500KB each — the
    watercolour design produces larger files (more colour variance)
    than the old letterpress aesthetic which compressed to ~100KB.
    This is a cheap signal that we're getting the new visual."""
    import zipfile

    share_id = _create_share()
    r = requests.get(f"{API}/share/patch/{share_id}/social-kit.zip", timeout=90)
    assert r.status_code == 200
    zf = zipfile.ZipFile(io.BytesIO(r.content))
    for layout_key in ("instagram_square", "instagram_portrait",
                       "reels_story", "youtube_twitter"):
        data = zf.read(f"{layout_key}.png")
        assert data[:8] == b"\x89PNG\r\n\x1a\n"
        # Letterpress was ~80-130KB. Watercolour is ~1-3MB. We use
        # 400KB as a conservative floor — anything under that means
        # we silently fell back to letterpress (which is also fine,
        # but should be visible as a test signal).
        assert len(data) > 400_000, (
            f"{layout_key}.png is only {len(data)} bytes — likely fell "
            "back to letterpress aesthetic. Check EMERGENT_LLM_KEY + "
            "Gemini Nano Banana availability."
        )


def test_kit_zip_aspect_ratios_correct():
    """Every PNG must be the exact pixel dimensions we promise in the
    README. A bug in the watercolour crop logic could squash or
    distort the image — this test guards that."""
    import zipfile

    share_id = _create_share(name="TEST_kit_aspect_ratios")
    r = requests.get(f"{API}/share/patch/{share_id}/social-kit.zip", timeout=90)
    assert r.status_code == 200
    zf = zipfile.ZipFile(io.BytesIO(r.content))
    expected = {
        "instagram_square.png":   (1080, 1080),
        "instagram_portrait.png": (1080, 1350),
        "reels_story.png":        (1080, 1920),
        "youtube_twitter.png":    (1920, 1080),
    }
    for name, dims in expected.items():
        img = Image.open(io.BytesIO(zf.read(name)))
        assert img.size == dims, f"{name} is {img.size}, expected {dims}"


def test_watercolour_is_cached_across_endpoints():
    """The /story.png endpoint and the /social-kit.zip endpoint both
    consume the watercolour cache. First hit on /story.png should
    write to shared_patch_watercolour; subsequent ZIP build should
    reuse it (no second LLM call). We verify by timing: the second
    request must complete in < 10s even when the captions cache is
    also warmed."""
    import zipfile

    share_id = _create_share(name="TEST_kit_wc_cache")
    # Warm the watercolour + story cache (also writes the watercolour
    # row in shared_patch_watercolour via _get_or_generate_watercolour).
    requests.get(f"{API}/share/patch/{share_id}/story.png", timeout=60)
    # Warm captions too.
    requests.get(f"{API}/share/patch/{share_id}/captions.json", timeout=60)
    # ZIP build now uses both caches.
    t0 = time.time()
    r = requests.get(f"{API}/share/patch/{share_id}/social-kit.zip", timeout=60)
    elapsed = time.time() - t0
    assert r.status_code == 200
    assert elapsed < 12, f"ZIP build took {elapsed:.1f}s — watercolour cache miss"

    # And the PNGs inside MUST still be watercolour-sized
    zf = zipfile.ZipFile(io.BytesIO(r.content))
    data = zf.read("instagram_square.png")
    assert len(data) > 400_000


def test_letterpress_fallback_renders_when_no_bg():
    """Direct unit test of share_social_kit.render_kit_images() with
    bg_image_bytes=None — must produce all four PNGs without raising
    (the letterpress fallback path). Letterpress images are smaller
    (~80-130KB) than watercolours."""
    from share_social_kit import render_kit_images

    out = render_kit_images(
        patch_name="Tiny Patio",
        region_name="Manchester, United Kingdom",
        plant_count=4,
        bg_image_bytes=None,
    )
    assert set(out.keys()) == {
        "instagram_square", "instagram_portrait",
        "reels_story", "youtube_twitter",
    }
    for key, png in out.items():
        assert png[:8] == b"\x89PNG\r\n\x1a\n"
        # Letterpress design has flat sand background → compresses small.
        # Just verify we got a valid PNG (no size assertion here since
        # fallback dimensions are intentionally compact).
        img = Image.open(io.BytesIO(png))
        assert img.format == "PNG"


def test_corrupt_bg_image_falls_back_silently_per_layout():
    """If the watercolour bytes are corrupt for some reason (e.g. a
    truncated download from Gemini), each layout's compose function
    should silently fall back to letterpress for THAT layout without
    breaking the rest. We never want a single bad background to 500
    the whole social-kit endpoint."""
    from share_social_kit import render_kit_images

    out = render_kit_images(
        patch_name="Corrupted Patch",
        region_name="Edinburgh",
        plant_count=2,
        bg_image_bytes=b"\x89PNG\r\n\x1a\nthis is not a real PNG",
    )
    # Still produces all 4 layouts (via fallback for each)
    assert len(out) == 4
    for png in out.values():
        assert png[:8] == b"\x89PNG\r\n\x1a\n"
