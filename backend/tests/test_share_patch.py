"""Share-my-patch endpoint tests.

Covers create → fetch → update → delete and the main 4xx/404 paths. Cleans
up its own data (all snapshots created use a TEST_ prefix in patch_name so
they're easy to wipe).
"""
import os
import sys

import pytest
import requests

sys.path.insert(0, "/app/backend")

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://grow-by-season-1.preview.emergentagent.com",
).rstrip("/")

API = f"{BASE_URL}/api"

# Intentionally-bogus secret used to exercise the "mismatched owner_secret
# falls through to a fresh create" branch. Not a real credential — kept in
# one place so static-analysis tools don't flag inline literals as a
# possibly-hardcoded production secret on every test that exercises this
# negative path.
BOGUS_OWNER_SECRET = "bogus-secret-xx"  # noqa: S105  - test fixture, not a real secret

REGION = {
    "name": "London",
    "country": "United Kingdom",
    "latitude": 51.5074,
    "longitude": -0.1278,
    "climate_zone": "Temperate",
    "hemisphere": "northern",
}


def _payload(name="TEST_share patch", plants=None, **overrides):
    p = {
        "patch_name": name,
        "region": REGION,
        "plants": plants if plants is not None else [
            {"id": "basil", "name": "Basil", "category": "herb"},
            {"id": "tomato", "name": "Tomato", "category": "vegetable"},
        ],
    }
    p.update(overrides)
    return p


@pytest.fixture
def created():
    """Create a snapshot, return its identifiers, delete on teardown."""
    r = requests.post(f"{API}/share/patch", json=_payload(), timeout=30)
    assert r.status_code == 200, r.text
    body = r.json()
    assert "share_id" in body and "owner_secret" in body
    yield body
    # Cleanup
    requests.delete(
        f"{API}/share/patch/{body['share_id']}",
        params={"owner_secret": body["owner_secret"]},
        timeout=30,
    )


def test_create_then_fetch(created):
    sid = created["share_id"]
    r = requests.get(f"{API}/share/patch/{sid}", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data["patch_name"] == "TEST_share patch"
    assert data["region"]["name"] == "London"
    assert len(data["plants"]) == 2
    # Public view must NOT leak owner_secret.
    assert "owner_secret" not in data


def test_update_preserves_share_id(created):
    """Re-POST with the same share_id+owner_secret reuses the URL."""
    sid = created["share_id"]
    secret = created["owner_secret"]
    r = requests.post(
        f"{API}/share/patch",
        json=_payload(name="TEST_share renamed", share_id=sid, owner_secret=secret),
        timeout=30,
    )
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["share_id"] == sid
    assert body["updated"] is True
    r2 = requests.get(f"{API}/share/patch/{sid}", timeout=30)
    assert r2.json()["patch_name"] == "TEST_share renamed"


def test_update_with_bad_secret_creates_new(created):
    """Mismatched owner_secret falls through to a fresh create — old URL
    keeps its old contents."""
    sid = created["share_id"]
    r = requests.post(
        f"{API}/share/patch",
        json=_payload(name="TEST_share hijack", share_id=sid, owner_secret=BOGUS_OWNER_SECRET),
        timeout=30,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["share_id"] != sid
    # Cleanup the bonus snapshot we just minted.
    requests.delete(
        f"{API}/share/patch/{body['share_id']}",
        params={"owner_secret": body["owner_secret"]},
        timeout=30,
    )
    # Original URL unchanged.
    r2 = requests.get(f"{API}/share/patch/{sid}", timeout=30)
    assert r2.json()["patch_name"] == "TEST_share patch"


def test_fetch_missing_is_404():
    r = requests.get(f"{API}/share/patch/does-not-exist-zzzz", timeout=30)
    assert r.status_code == 404


def test_profanity_rejected():
    r = requests.post(f"{API}/share/patch", json=_payload(name="My fucking garden"), timeout=30)
    assert r.status_code == 422


def test_too_many_plants_rejected():
    plants = [{"id": f"p{i}", "name": f"Plant {i}", "category": "vegetable"} for i in range(101)]
    r = requests.post(f"{API}/share/patch", json=_payload(plants=plants), timeout=30)
    assert r.status_code == 422


def test_delete_requires_secret(created):
    sid = created["share_id"]
    r = requests.delete(f"{API}/share/patch/{sid}", params={"owner_secret": "wrong"}, timeout=30)
    assert r.status_code == 403


def test_delete_then_404():
    r = requests.post(f"{API}/share/patch", json=_payload(name="TEST_share to delete"), timeout=30)
    assert r.status_code == 200
    body = r.json()
    r2 = requests.delete(
        f"{API}/share/patch/{body['share_id']}",
        params={"owner_secret": body["owner_secret"]},
        timeout=30,
    )
    assert r2.status_code == 200
    r3 = requests.get(f"{API}/share/patch/{body['share_id']}", timeout=30)
    assert r3.status_code == 404


def test_og_png_renders(created):
    """The OG card endpoint should return a real PNG, not JSON / HTML."""
    sid = created["share_id"]
    r = requests.get(f"{API}/share/patch/{sid}/og.png", timeout=30)
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/png"
    # PNG magic header: 89 50 4E 47 0D 0A 1A 0A
    assert r.content[:8] == b"\x89PNG\r\n\x1a\n"
    # Standard OG dimensions
    assert len(r.content) > 5000  # non-trivial size


def test_og_png_is_cached(created):
    """Second hit should be served from the shared_patch_og cache fast-path
    (same bytes, fast). We just assert idempotency here — no perf claim."""
    sid = created["share_id"]
    r1 = requests.get(f"{API}/share/patch/{sid}/og.png", timeout=30)
    r2 = requests.get(f"{API}/share/patch/{sid}/og.png", timeout=30)
    assert r1.status_code == 200 and r2.status_code == 200
    assert r1.content == r2.content


def test_og_png_404_for_unknown_id():
    r = requests.get(f"{API}/share/patch/does-not-exist/og.png", timeout=30)
    assert r.status_code == 404


def test_share_preview_html_has_og_tags(created):
    """The HTML wrapper must include the four OG tags + twitter:card so
    chat-app crawlers can unfurl a real card."""
    sid = created["share_id"]
    r = requests.get(f"{API}/share/preview/{sid}", timeout=30)
    assert r.status_code == 200
    body = r.text
    assert 'property="og:title"' in body
    assert 'property="og:description"' in body
    assert 'property="og:image"' in body
    assert 'property="og:type"' in body
    assert 'name="twitter:card"' in body
    assert 'content="summary_large_image"' in body
    # Both meta-refresh and a JS replace() are wired for crawler-resilient
    # human redirects.
    assert 'http-equiv="refresh"' in body
    assert "window.location.replace" in body


def test_share_preview_404_for_unknown_id():
    r = requests.get(f"{API}/share/preview/does-not-exist", timeout=30)
    assert r.status_code == 404
