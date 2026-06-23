"""Iteration 16 — Admin AI Usage endpoint regression."""
import os
import requests
import pytest

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://grow-by-season-1.preview.emergentagent.com").rstrip("/")
# Pull from env so the token is not committed to source. Tests that need it
# skip cleanly when not configured (CI without the secret, fork agents etc).
ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN")
pytestmark = pytest.mark.skipif(not ADMIN_TOKEN, reason="ADMIN_TOKEN env var not set")


@pytest.fixture
def s():
    sess = requests.Session()
    return sess


@pytest.mark.parametrize("days", [7, 30, 90])
def test_admin_ai_usage_valid(s, days):
    r = s.get(f"{BASE_URL}/api/admin/ai-usage", params={"token": ADMIN_TOKEN, "days": days}, timeout=30)
    assert r.status_code == 200, r.text
    data = r.json()
    # Shape
    assert data["window_days"] == days
    assert "since" in data
    assert "calls" in data
    assert "sonnet" in data["calls"]
    assert "total" in data["calls"]["sonnet"]
    assert "haiku" in data["calls"]
    assert "total" in data["calls"]["haiku"]
    assert "images" in data["calls"]
    assert "relative_cost_units" in data
    assert "weights" in data
    assert "budget" in data
    for k in ("monthly_cap_gbp", "estimated_30d_gbp", "over_budget", "enabled"):
        assert k in data["budget"], f"missing budget.{k}"
    assert "note" in data


def test_admin_ai_usage_no_token(s):
    r = s.get(f"{BASE_URL}/api/admin/ai-usage", timeout=15)
    assert r.status_code == 422, f"expected 422 got {r.status_code}: {r.text}"


def test_admin_ai_usage_invalid_token(s):
    r = s.get(f"{BASE_URL}/api/admin/ai-usage", params={"token": "nope"}, timeout=15)
    assert r.status_code == 403, f"expected 403 got {r.status_code}: {r.text}"
