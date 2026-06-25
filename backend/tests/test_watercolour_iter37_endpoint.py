"""iter37 end-to-end endpoint sanity checks for the watercolour social
kit: direct HTTP call, aspect ratios, cache sharing, and version-based
cache invalidation (PUT-update bumps updated_at → cache regenerates)."""
import io
import os
import time
import zipfile

import requests
from PIL import Image

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://grow-by-season-1.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

REGION = {
    "name": "London",
    "country": "United Kingdom",
    "latitude": 51.50,
    "longitude": -0.12,
    "climate_zone": "Temperate",
    "hemisphere": "northern",
}


def _create_share(name="TEST_iter37_endpoint"):
    payload = {
        "patch_name": name,
        "region": REGION,
        "plants": [
            {"id": "tomato", "name": "Tomato", "category": "vegetable"},
            {"id": "basil", "name": "Basil", "category": "herb"},
        ],
        "list_publicly": False,
    }
    r = requests.post(f"{API}/share/patch", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["share_id"], r.json()["owner_secret"]


def test_direct_kit_endpoint_returns_zip_with_six_members_all_watercolour():
    """Fresh share → /social-kit.zip returns 200 application/zip with
    6 members and PNGs >400KB (watercolour aesthetic)."""
    share_id, _ = _create_share(name="TEST_iter37_direct_endpoint")
    r = requests.get(f"{API}/share/patch/{share_id}/social-kit.zip", timeout=120)
    assert r.status_code == 200
    assert r.headers["content-type"] == "application/zip"
    zf = zipfile.ZipFile(io.BytesIO(r.content))
    names = sorted(zf.namelist())
    assert len(names) == 6, f"expected 6 members, got {names}"
    # Expected: 4 PNGs + captions.txt + README.txt
    assert "captions.txt" in names
    assert "README.txt" in names
    expected_pngs = {
        "instagram_square.png": (1080, 1080),
        "instagram_portrait.png": (1080, 1350),
        "reels_story.png": (1080, 1920),
        "youtube_twitter.png": (1920, 1080),
    }
    for png_name, dims in expected_pngs.items():
        data = zf.read(png_name)
        assert data[:8] == b"\x89PNG\r\n\x1a\n", f"{png_name} not valid PNG"
        assert len(data) > 400_000, (
            f"{png_name} only {len(data)} bytes — likely letterpress fallback"
        )
        img = Image.open(io.BytesIO(data))
        assert img.size == dims, f"{png_name}={img.size}, expected {dims}"


def test_cache_invalidation_on_patch_update():
    """After GET kit → PUT-update patch → next /social-kit.zip must
    regenerate (cache key includes version=updated_at). Verify the
    second build takes noticeably longer (cold cache > 10s)."""
    share_id, owner_secret = _create_share(name="TEST_iter37_cache_invalidation")

    # Cold build #1
    t0 = time.time()
    r1 = requests.get(f"{API}/share/patch/{share_id}/social-kit.zip", timeout=120)
    cold1 = time.time() - t0
    assert r1.status_code == 200

    # Warm hit — should be fast
    t0 = time.time()
    r_warm = requests.get(f"{API}/share/patch/{share_id}/social-kit.zip", timeout=60)
    warm = time.time() - t0
    assert r_warm.status_code == 200
    assert warm < 5, f"expected warm cache <5s, got {warm:.1f}s"

    # Update the patch — bump updated_at by adding a plant
    update_payload = {
        "patch_name": "TEST_iter37_cache_invalidation",
        "region": REGION,
        "plants": [
            {"id": "tomato", "name": "Tomato", "category": "vegetable"},
            {"id": "basil", "name": "Basil", "category": "herb"},
            {"id": "chard", "name": "Swiss Chard", "category": "vegetable"},
        ],
        "list_publicly": False,
        "share_id": share_id,
        "owner_secret": owner_secret,
    }
    upd = requests.post(f"{API}/share/patch", json=update_payload, timeout=30)
    assert upd.status_code == 200
    assert upd.json().get("updated") is True

    # New cold build (after invalidation) — must take >=10s (LLM regen)
    t0 = time.time()
    r2 = requests.get(f"{API}/share/patch/{share_id}/social-kit.zip", timeout=120)
    cold2 = time.time() - t0
    assert r2.status_code == 200
    # ZIP bytes must differ (new watercolour + new captions)
    assert r1.content != r2.content, "cache wasn't invalidated"
    # Cold rebuild after update should be substantially slower than warm
    assert cold2 > 8, (
        f"expected cold regen >8s after update, got {cold2:.1f}s "
        f"(warm was {warm:.1f}s, cold1 was {cold1:.1f}s)"
    )


def test_story_warms_kit_cache():
    """GET /story.png on a fresh share should warm the watercolour cache;
    the subsequent /social-kit.zip should complete faster than a cold-cache
    request would (<15s)."""
    share_id, _ = _create_share(name="TEST_iter37_warm_via_story")
    # Warm watercolour via story
    t0 = time.time()
    r_story = requests.get(f"{API}/share/patch/{share_id}/story.png", timeout=120)
    t_story = time.time() - t0
    assert r_story.status_code == 200
    assert r_story.headers["content-type"] == "image/png"

    # Now hit /social-kit.zip — watercolour is cached; only captions LLM call left
    t0 = time.time()
    r_kit = requests.get(f"{API}/share/patch/{share_id}/social-kit.zip", timeout=60)
    t_kit = time.time() - t0
    assert r_kit.status_code == 200
    assert t_kit < 15, (
        f"kit build after story-warm took {t_kit:.1f}s "
        f"(story warm took {t_story:.1f}s) — cache likely not shared"
    )
