"""Tests for the standalone /story.png endpoint (iter35).

The same 9:16 image is also packaged inside the /social-kit.zip ZIP, but
the frontend's [Share to Stories / Reels] button needs to fetch it as a
single PNG so it can pass it through navigator.share({ files: [...] }) —
fetching the whole ZIP would be wasteful (and would require zip parsing
in the browser).
"""
import io
import os
import sys

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


def _create_share(name="TEST_story_iter35"):
    payload = {
        "patch_name":     name,
        "region":         REGION,
        "plants":         [
            {"id": "tomato", "name": "Tomato", "category": "vegetable"},
            {"id": "basil",  "name": "Basil",  "category": "herb"},
        ],
        "list_publicly":  False,
    }
    r = requests.post(f"{API}/share/patch", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    return r.json()["share_id"]


def test_story_png_returns_a_valid_9x16_image():
    share_id = _create_share()
    r = requests.get(f"{API}/share/patch/{share_id}/story.png", timeout=30)
    assert r.status_code == 200, r.text
    assert r.headers["content-type"] == "image/png"
    # Cache-Control note: we set "public, max-age=86400" server-side but
    # the preview ingress (Cloudflare) overrides it with no-store on this
    # tunnel. The server-side cache is verified separately in
    # test_story_png_is_cached. No assertion on the response header.

    # PNG signature
    assert r.content[:8] == b"\x89PNG\r\n\x1a\n"

    # Decode to verify the aspect ratio + minimum size
    img = Image.open(io.BytesIO(r.content))
    assert img.format == "PNG"
    # 1080×1920 is what render_kit_images returns for the reels_story layout
    assert img.size == (1080, 1920), f"unexpected story dimensions: {img.size}"


def test_story_png_is_cached():
    """Second hit should return byte-identical content from the
    shared_patch_story_png collection — proves we're not re-rendering."""
    share_id = _create_share(name="TEST_story_cache")
    r1 = requests.get(f"{API}/share/patch/{share_id}/story.png", timeout=30)
    r2 = requests.get(f"{API}/share/patch/{share_id}/story.png", timeout=10)
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.content == r2.content, "story.png is not being cached"


def test_story_png_404_on_unknown_share():
    r = requests.get(f"{API}/share/patch/nonexistent999/story.png", timeout=15)
    assert r.status_code == 404


def test_story_png_matches_kit_zip_reels_image():
    """The standalone /story.png MUST be byte-identical to the
    `reels_story.png` member inside /social-kit.zip — otherwise the
    Tweet/Story sharing surfaces would post slightly different images
    than the ZIP a user downloads, which is confusing and looks broken
    in an A/B comparison."""
    import zipfile

    share_id = _create_share(name="TEST_story_match_kit")
    story_resp = requests.get(f"{API}/share/patch/{share_id}/story.png", timeout=30)
    kit_resp = requests.get(f"{API}/share/patch/{share_id}/social-kit.zip", timeout=60)
    assert story_resp.status_code == 200
    assert kit_resp.status_code == 200

    zf = zipfile.ZipFile(io.BytesIO(kit_resp.content))
    reels_inside_zip = zf.read("reels_story.png")
    assert reels_inside_zip == story_resp.content, (
        "standalone /story.png and ZIP /reels_story.png diverge — both "
        "must come from the same render call"
    )
