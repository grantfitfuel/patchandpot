"""iter41 — cache invalidation contract test

Verifies that the social-kit + story-png caches include render_version
in BOTH the find_one filter and the update_one $set, so any pre-iter37
cached row (without render_version) is bypassed and forced to regenerate.
"""
import io
import os
import re
import zipfile
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
OLD_SHARE_ID = "y997txhsnkmt"  # pre-iter37 share — should regenerate to watercolour


def _make_share():
    payload = {
        "patch_name": "TEST_iter41_cache",
        "region": {"name": "Bristol", "country": "United Kingdom"},
        "plants": [
            {"id": "tomato", "name": "Tomato", "category": "Vegetable"},
            {"id": "basil", "name": "Basil", "category": "Herb"},
        ],
    }
    r = requests.post(f"{BASE_URL}/api/share/patch", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()


# ── source-code level contract checks ──
def test_render_version_in_share_router_filter_and_set():
    """Both endpoints (social-kit + story-png) must include render_version in
    the find_one filter AND the update_one filter+$set."""
    with open("/app/backend/routers/share.py") as f:
        src = f.read()
    # social_media_kit endpoint
    sk_block = re.search(r"async def social_media_kit\(.*?\n    @router", src, flags=re.S)
    assert sk_block, "social_media_kit block not found"
    sk = sk_block.group(0)
    # Must reference RENDER_VERSION in find_one + update_one filter + $set
    assert sk.count("render_version") >= 3, (
        f"social_media_kit references render_version {sk.count('render_version')} times, "
        "expected >=3 (find_one filter + update_one filter + $set)"
    )

    # share_story_image endpoint
    st_block = re.search(r"async def share_story_image\(.*?return Response", src, flags=re.S)
    assert st_block, "share_story_image block not found"
    st = st_block.group(0)
    assert st.count("render_version") >= 3, (
        f"share_story_image references render_version {st.count('render_version')} times, "
        "expected >=3 (find_one filter + update_one filter + $set)"
    )


def test_render_version_constant_present():
    from share_social_kit import RENDER_VERSION
    assert RENDER_VERSION == "iter37-watercolour-v1"


# ── live endpoint contract checks ──
@pytest.fixture(scope="module")
def fresh_share():
    return _make_share()


def test_fresh_social_kit_watercolour_pngs(fresh_share):
    """Every PNG inside a fresh share's social-kit ZIP must be >400KB
    (watercolour aesthetic). Letterpress PNGs are ~100KB."""
    sid = fresh_share["share_id"]
    r = requests.get(f"{BASE_URL}/api/share/patch/{sid}/social-kit.zip", timeout=120)
    assert r.status_code == 200, r.text
    assert r.headers.get("content-type", "").startswith("application/zip")
    assert len(r.content) > 1_000_000, f"ZIP {len(r.content)} bytes <1MB — likely letterpress"

    zf = zipfile.ZipFile(io.BytesIO(r.content))
    png_names = [n for n in zf.namelist() if n.endswith(".png")]
    assert len(png_names) == 4, f"expected 4 PNGs, got {png_names}"
    for n in png_names:
        size = len(zf.read(n))
        assert size > 400_000, f"{n} is {size} bytes — letterpress fallback, not watercolour"


def test_old_share_regenerates_watercolour():
    """Pre-iter37 share OLD_SHARE_ID must now return watercolour ZIP
    because the cache lookup includes render_version that the old row
    doesn't have."""
    r = requests.get(f"{BASE_URL}/api/share/patch/{OLD_SHARE_ID}/social-kit.zip", timeout=120)
    if r.status_code == 404:
        pytest.skip(f"OLD_SHARE_ID {OLD_SHARE_ID} not present in this env")
    assert r.status_code == 200
    assert len(r.content) > 1_000_000, (
        f"OLD share ZIP is only {len(r.content)} bytes — cache still returning letterpress"
    )
    zf = zipfile.ZipFile(io.BytesIO(r.content))
    for n in [x for x in zf.namelist() if x.endswith(".png")]:
        size = len(zf.read(n))
        assert size > 400_000, (
            f"OLD share {n} is {size} bytes — stale letterpress cache still served"
        )


def test_cache_works_second_hit_byte_identical(fresh_share):
    """After first generation, second request must return byte-identical
    cached bytes."""
    sid = fresh_share["share_id"]
    r1 = requests.get(f"{BASE_URL}/api/share/patch/{sid}/social-kit.zip", timeout=120)
    r2 = requests.get(f"{BASE_URL}/api/share/patch/{sid}/social-kit.zip", timeout=120)
    assert r1.status_code == r2.status_code == 200
    assert r1.content == r2.content, (
        f"Second hit differs from first: {len(r1.content)} vs {len(r2.content)} bytes"
    )


def test_story_png_watercolour(fresh_share):
    sid = fresh_share["share_id"]
    r = requests.get(f"{BASE_URL}/api/share/patch/{sid}/story.png", timeout=120)
    assert r.status_code == 200
    assert r.headers.get("content-type", "").startswith("image/png")
    # Reels/story 1080×1920 watercolour should be >400KB
    assert len(r.content) > 400_000, (
        f"story.png is {len(r.content)} bytes — likely letterpress, not watercolour"
    )
