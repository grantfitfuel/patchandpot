"""Extra iter33 checks beyond the supplied pytest file:
* cache invalidation on patch_name edit (PUT with owner_secret)
* regression on sitemap/robots/og.png/qr.pdf endpoints
"""
import io
import os
import zipfile

import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://grow-by-season-1.preview.emergentagent.com",
).rstrip("/")
API = f"{BASE_URL}/api"

REGION = {
    "name": "London", "country": "United Kingdom",
    "latitude": 51.5074, "longitude": -0.1278,
    "climate_zone": "Temperate", "hemisphere": "northern",
}


def test_cache_busts_on_patch_name_edit():
    payload = {
        "patch_name": "TEST_kit_old_name",
        "region": REGION,
        "plants": [{"id": "tomato", "name": "Tomato", "category": "vegetable"}],
        "list_publicly": False,
    }
    r = requests.post(f"{API}/share/patch", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    share = r.json()
    share_id = share["share_id"]
    owner_secret = share["owner_secret"]

    r1 = requests.get(f"{API}/share/patch/{share_id}/social-kit.zip", timeout=60)
    assert r1.status_code == 200
    zf1 = zipfile.ZipFile(io.BytesIO(r1.content))
    # Render the PNG which has the patch_name baked in deterministically
    png1 = zf1.read("instagram_square.png")

    # Update patch name (via POST with share_id + owner_secret — see routers/share.py line 160)
    new_name = "TEST_kit_brand_new"
    r_put = requests.post(
        f"{API}/share/patch",
        json={
            "share_id": share_id,
            "owner_secret": owner_secret,
            "patch_name": new_name,
            "region": REGION,
            "plants": [{"id": "tomato", "name": "Tomato", "category": "vegetable"}],
            "list_publicly": False,
        },
        timeout=30,
    )
    assert r_put.status_code == 200, r_put.text

    r2 = requests.get(f"{API}/share/patch/{share_id}/social-kit.zip", timeout=60)
    assert r2.status_code == 200
    zf2 = zipfile.ZipFile(io.BytesIO(r2.content))
    png2 = zf2.read("instagram_square.png")
    # The rendered PNG with the patch name baked in MUST differ — proves
    # the cache was busted by the updated_at version key change.
    assert png1 != png2, "cache should bust on patch_name change (PNG identical)"
    assert r1.content != r2.content, "ZIP should differ after patch_name edit"


def test_sitemap_regression():
    r = requests.get(f"{API}/sitemap.xml", timeout=15)
    assert r.status_code == 200
    assert "xml" in r.headers["content-type"].lower()


def test_robots_regression():
    r = requests.get(f"{API}/robots.txt", timeout=15)
    assert r.status_code == 200
    assert r.headers["content-type"].lower().startswith("text/plain")


def test_og_png_and_qr_pdf_regression():
    payload = {
        "patch_name": "TEST_regression_og",
        "region": REGION,
        "plants": [{"id": "tomato", "name": "Tomato", "category": "vegetable"}],
        "list_publicly": False,
    }
    r = requests.post(f"{API}/share/patch", json=payload, timeout=30)
    assert r.status_code == 200
    share_id = r.json()["share_id"]

    r_og = requests.get(f"{API}/share/patch/{share_id}/og.png", timeout=30)
    assert r_og.status_code == 200
    assert r_og.headers["content-type"] == "image/png"
    assert r_og.content[:8] == b"\x89PNG\r\n\x1a\n"

    r_qr = requests.get(f"{API}/share/patch/{share_id}/qr.pdf", timeout=30)
    assert r_qr.status_code == 200
    assert r_qr.headers["content-type"] == "application/pdf"
    assert r_qr.content[:4] == b"%PDF"
