"""Iteration-23 follow-ups to test_share_patch.py.

Covers two scenarios that weren't in the original 13:
  1. OG card cache invalidates when the snapshot is edited (the underlying
     `shared_patch_og.version` field bumps to the new `updated_at`, so the
     served bytes change).
  2. The preview HTML's <meta property="og:image"> URL contains a `?v=`
     cache-buster derived from `updated_at`, and that token also changes
     after a successful update.
"""
import os
import re
import time

import requests

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


def _payload(name="TEST_iter23 patch", plants=None, **overrides):
    p = {
        "patch_name": name,
        "region": REGION,
        "plants": plants if plants is not None else [
            {"id": "basil", "name": "Basil", "category": "herb"},
        ],
    }
    p.update(overrides)
    return p


def test_og_png_cache_invalidates_on_snapshot_edit():
    """Create a share, fetch og.png, edit the snapshot (new patch_name +
    extra plant), fetch og.png again — bytes should differ because the
    cache key (version=updated_at) bumped."""
    r = requests.post(f"{API}/share/patch", json=_payload(name="TEST_iter23 v1"), timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    sid = body["share_id"]
    secret = body["owner_secret"]
    try:
        r1 = requests.get(f"{API}/share/patch/{sid}/og.png", timeout=30)
        assert r1.status_code == 200
        assert r1.content[:8] == b"\x89PNG\r\n\x1a\n"
        first_bytes = r1.content

        # Sleep briefly so updated_at definitely advances (ISO timestamps
        # are sub-second precision, but be safe across machines).
        time.sleep(1.1)

        upd = requests.post(
            f"{API}/share/patch",
            json=_payload(
                name="TEST_iter23 v2 renamed",
                share_id=sid, owner_secret=secret,
                plants=[
                    {"id": "basil", "name": "Basil", "category": "herb"},
                    {"id": "thyme", "name": "Thyme", "category": "herb"},
                    {"id": "mint",  "name": "Mint",  "category": "herb"},
                ],
            ),
            timeout=30,
        )
        assert upd.status_code == 200 and upd.json().get("updated") is True

        r2 = requests.get(f"{API}/share/patch/{sid}/og.png", timeout=30)
        assert r2.status_code == 200
        assert r2.content[:8] == b"\x89PNG\r\n\x1a\n"
        # Different rendered content => different bytes after cache bust
        assert r2.content != first_bytes, "OG card cache did not invalidate after snapshot edit"
    finally:
        requests.delete(
            f"{API}/share/patch/{sid}",
            params={"owner_secret": secret},
            timeout=30,
        )


def test_share_preview_og_image_has_cache_buster_and_points_at_og_png():
    """The HTML wrapper's og:image URL points at the og.png endpoint and
    carries a ?v= cache-buster derived from updated_at. The token must
    change after the snapshot is edited so social caches refetch."""
    r = requests.post(f"{API}/share/patch", json=_payload(name="TEST_iter23 preview v1"), timeout=30)
    assert r.status_code == 200
    body = r.json()
    sid = body["share_id"]
    secret = body["owner_secret"]
    try:
        h1 = requests.get(f"{API}/share/preview/{sid}", timeout=30)
        assert h1.status_code == 200
        m1 = re.search(r'property="og:image"\s+content="([^"]+)"', h1.text)
        assert m1, "og:image meta tag missing"
        og_img1 = m1.group(1)
        assert f"/api/share/patch/{sid}/og.png" in og_img1
        assert "?v=" in og_img1, f"expected ?v= cache-buster, got {og_img1!r}"

        # NOTE: preview's ?v= token is updated_at[:14] with separators
        # stripped, i.e. YYYYMMDDTHHMMS (10-second resolution). Sleep > 10s
        # to guarantee the token changes for this assertion.
        time.sleep(11)
        upd = requests.post(
            f"{API}/share/patch",
            json=_payload(
                name="TEST_iter23 preview v2",
                share_id=sid, owner_secret=secret,
            ),
            timeout=30,
        )
        assert upd.status_code == 200 and upd.json().get("updated") is True

        h2 = requests.get(f"{API}/share/preview/{sid}", timeout=30)
        m2 = re.search(r'property="og:image"\s+content="([^"]+)"', h2.text)
        og_img2 = m2.group(1)
        assert og_img2 != og_img1, "cache-buster ?v= did not change after snapshot edit"
    finally:
        requests.delete(
            f"{API}/share/patch/{sid}",
            params={"owner_secret": secret},
            timeout=30,
        )
