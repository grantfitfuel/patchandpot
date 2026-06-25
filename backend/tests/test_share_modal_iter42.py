"""iter42 — review request coverage for SharePatchModal refactor + cache.

Verifies all the explicit acceptance criteria from the review request:
  1. POST /api/share/patch → share_id + owner_secret
  2. GET /api/share/patch/{id} → public, no auth required
  3. GET /api/share/patch/{id}/captions.json → captions + hashtags
  4. GET /api/share/patch/{id}/story.png → image/png, non-empty, cached on 2nd hit,
     render_version=iter37-watercolour-v1 stored in shared_patch_story_png
  5. GET /api/share/patch/{id}/social-kit.zip → valid ZIP, render_version stored
     in shared_patch_social_kit
  6. Cache invalidation: delete the cache doc → next request regenerates a new doc
"""
import io
import os
import time
import zipfile
import requests
import pytest
from pymongo import MongoClient

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

EXPECTED_RENDER_VERSION = "iter37-watercolour-v1"


@pytest.fixture(scope="module")
def mongo_db():
    client = MongoClient(MONGO_URL, serverSelectionTimeoutMS=5000)
    return client[DB_NAME]


@pytest.fixture(scope="module")
def share():
    payload = {
        "patch_name": "TEST_iter42_modal",
        "region": {"name": "London", "country": "United Kingdom",
                   "latitude": 51.5, "longitude": -0.12, "hemisphere": "N"},
        "plants": [
            {"id": "tomato", "name": "Tomato", "category": "Vegetable"},
            {"id": "basil", "name": "Basil", "category": "Herb"},
        ],
    }
    r = requests.post(f"{BASE_URL}/api/share/patch", json=payload, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "share_id" in data and isinstance(data["share_id"], str) and len(data["share_id"]) > 0
    assert "owner_secret" in data and isinstance(data["owner_secret"], str) and len(data["owner_secret"]) > 0
    return data


# 1. POST creates share
def test_create_share(share):
    assert share["share_id"]
    assert share["owner_secret"]


# 2. Public GET
def test_get_share_no_auth(share):
    sid = share["share_id"]
    r = requests.get(f"{BASE_URL}/api/share/patch/{sid}", timeout=20)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body.get("patch_name") == "TEST_iter42_modal"
    plant_names = [p.get("name") for p in body.get("plants", [])]
    assert "Tomato" in plant_names and "Basil" in plant_names


# 3. captions.json — actual shape: {captions: {instagram_square, instagram_portrait,
#    reels_story, youtube_twitter}}. Hashtags are embedded inline within the long captions.
def test_captions_json(share):
    sid = share["share_id"]
    r = requests.get(f"{BASE_URL}/api/share/patch/{sid}/captions.json", timeout=60)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "captions" in body, f"missing captions wrapper in {list(body.keys())}"
    caps = body["captions"]
    # Short caption variant (Twitter/YouTube) and a long caption variant (Instagram)
    short_key = next((k for k in ("youtube_twitter", "reels_story") if k in caps), None)
    long_key = next((k for k in ("instagram_square", "instagram_portrait") if k in caps), None)
    assert short_key, f"no short-form caption in {list(caps.keys())}"
    assert long_key, f"no long-form caption in {list(caps.keys())}"
    assert isinstance(caps[short_key], str) and len(caps[short_key]) > 0
    assert isinstance(caps[long_key], str) and len(caps[long_key]) > 0
    # Hashtags should appear at least somewhere in the captions
    all_text = " ".join(v for v in caps.values() if isinstance(v, str))
    assert "#" in all_text, "no hashtags in any caption"


# 4a. story.png returns PNG
def test_story_png(share):
    sid = share["share_id"]
    r = requests.get(f"{BASE_URL}/api/share/patch/{sid}/story.png", timeout=180)
    assert r.status_code == 200, r.text
    assert r.headers.get("content-type", "").startswith("image/png")
    assert len(r.content) > 50_000, f"PNG too small: {len(r.content)} bytes"
    assert r.content[:8] == b"\x89PNG\r\n\x1a\n", "not a real PNG file"


# 4b. story.png cached on 2nd hit + render_version stored
def test_story_png_cached_and_render_version(share, mongo_db):
    sid = share["share_id"]
    t0 = time.time()
    r1 = requests.get(f"{BASE_URL}/api/share/patch/{sid}/story.png", timeout=180)
    d1 = time.time() - t0
    assert r1.status_code == 200

    t1 = time.time()
    r2 = requests.get(f"{BASE_URL}/api/share/patch/{sid}/story.png", timeout=60)
    d2 = time.time() - t1
    assert r2.status_code == 200
    # Second hit must be byte-identical (served from cache)
    assert r1.content == r2.content
    # Second should be measurably faster on cache hit, but tolerate jitter
    assert d2 <= max(d1, 10.0)

    doc = mongo_db["shared_patch_story_png"].find_one({"share_id": sid})
    assert doc is not None, "no cache doc in shared_patch_story_png"
    assert doc.get("render_version") == EXPECTED_RENDER_VERSION, (
        f"render_version={doc.get('render_version')!r}, expected {EXPECTED_RENDER_VERSION!r}"
    )


# 5. social-kit.zip + render_version stored
def test_social_kit_zip(share, mongo_db):
    sid = share["share_id"]
    r = requests.get(f"{BASE_URL}/api/share/patch/{sid}/social-kit.zip", timeout=180)
    assert r.status_code == 200, r.text
    assert r.headers.get("content-type", "").startswith("application/zip")
    zf = zipfile.ZipFile(io.BytesIO(r.content))
    # Should contain at least the captions + a few PNGs
    names = zf.namelist()
    assert any(n.endswith(".png") for n in names), f"no PNG in zip: {names}"

    doc = mongo_db["shared_patch_social_kit"].find_one({"share_id": sid})
    assert doc is not None, "no cache doc in shared_patch_social_kit"
    assert doc.get("render_version") == EXPECTED_RENDER_VERSION


# 6. cache invalidation — delete cache doc → next request regenerates
def test_cache_invalidation_regenerates(share, mongo_db):
    sid = share["share_id"]
    # Ensure something is cached
    r0 = requests.get(f"{BASE_URL}/api/share/patch/{sid}/story.png", timeout=180)
    assert r0.status_code == 200
    doc_before = mongo_db["shared_patch_story_png"].find_one({"share_id": sid})
    assert doc_before is not None
    id_before = doc_before.get("_id")

    # Wipe the cache row
    mongo_db["shared_patch_story_png"].delete_one({"share_id": sid})
    assert mongo_db["shared_patch_story_png"].find_one({"share_id": sid}) is None

    # Next call should regenerate
    r1 = requests.get(f"{BASE_URL}/api/share/patch/{sid}/story.png", timeout=180)
    assert r1.status_code == 200
    assert r1.content[:8] == b"\x89PNG\r\n\x1a\n"

    doc_after = mongo_db["shared_patch_story_png"].find_one({"share_id": sid})
    assert doc_after is not None, "cache was not re-populated"
    assert doc_after.get("render_version") == EXPECTED_RENDER_VERSION
    # Document was actually recreated (different _id)
    assert doc_after.get("_id") != id_before
