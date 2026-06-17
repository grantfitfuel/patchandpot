"""Tests for /api/seasonal-pdf (paywalled) and regression on /api/guidance + /api/plants."""
import os
import asyncio
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else None
if not BASE_URL:
    # Fall back to frontend/.env
    from pathlib import Path
    env = Path("/app/frontend/.env").read_text()
    for line in env.splitlines():
        if line.startswith("REACT_APP_BACKEND_URL="):
            BASE_URL = line.split("=", 1)[1].strip().rstrip("/")
            break

TOKEN = "test-token-pdf-smoke"


@pytest.fixture(scope="session", autouse=True)
def seed_access_grant():
    """Seed the access_grants collection with our test token."""
    from motor.motor_asyncio import AsyncIOMotorClient
    from pathlib import Path
    env = Path("/app/backend/.env").read_text()
    mongo_url, db_name = None, None
    for line in env.splitlines():
        if line.startswith("MONGO_URL="):
            mongo_url = line.split("=", 1)[1].strip().strip('"').strip("'")
        elif line.startswith("DB_NAME="):
            db_name = line.split("=", 1)[1].strip().strip('"').strip("'")

    async def _seed():
        client = AsyncIOMotorClient(mongo_url)
        db = client[db_name]
        await db.access_grants.update_one(
            {"token": TOKEN},
            {"$set": {"token": TOKEN, "email": "test@test.com", "package_id": "lifetime"}},
            upsert=True,
        )
        client.close()

    asyncio.run(_seed())
    yield
    # No teardown - leave seed token for frontend tests


# ───── Seasonal PDF: happy paths ─────
class TestSeasonalPdf:
    def test_pdf_london_march_en_portrait(self):
        payload = {
            "region": {"name": "London", "country": "UK", "climate_zone": "Temperate", "hemisphere": "northern"},
            "month": 3,
            "language": "en",
            "orientation": "portrait",
            "my_garden": [],
            "access_token": TOKEN,
        }
        r = requests.post(f"{BASE_URL}/api/seasonal-pdf", json=payload, timeout=120)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:5] == b"%PDF-", f"Not a PDF: first bytes={r.content[:10]!r}"
        assert len(r.content) >= 4096, f"PDF too small: {len(r.content)} bytes"

    def test_pdf_paris_april_fr_landscape(self):
        payload = {
            "region": {"name": "Paris", "country": "FR", "climate_zone": "Temperate", "hemisphere": "northern"},
            "month": 4,
            "language": "fr",
            "orientation": "landscape",
            "my_garden": [],
            "access_token": TOKEN,
        }
        r = requests.post(f"{BASE_URL}/api/seasonal-pdf", json=payload, timeout=120)
        assert r.status_code == 200, f"Expected 200, got {r.status_code}: {r.text[:300]}"
        assert r.headers.get("content-type", "").startswith("application/pdf")
        assert r.content[:5] == b"%PDF-"
        assert len(r.content) >= 4096

    def test_pdf_contains_expected_sections(self):
        """Extract text and verify section headings."""
        payload = {
            "region": {"name": "London", "country": "UK", "climate_zone": "Temperate", "hemisphere": "northern"},
            "month": 3,
            "language": "en",
            "orientation": "portrait",
            "my_garden": [],
            "access_token": TOKEN,
        }
        r = requests.post(f"{BASE_URL}/api/seasonal-pdf", json=payload, timeout=120)
        assert r.status_code == 200
        try:
            from pypdf import PdfReader
        except ImportError:
            from PyPDF2 import PdfReader  # type: ignore
        from io import BytesIO
        reader = PdfReader(BytesIO(r.content))
        text = "\n".join((p.extract_text() or "") for p in reader.pages)
        assert "Sow" in text and "plant this month" in text, f"Missing 'Sow & plant this month': {text[:500]}"
        assert "Harvest now" in text, "Missing 'Harvest now'"
        assert "Tasks" in text, "Missing 'Tasks'"
        assert "Pest watch" in text, "Missing 'Pest watch'"


# ───── Paywall & validation ─────
class TestPaywall:
    def test_no_token_returns_402(self):
        payload = {
            "region": {"name": "London", "country": "UK", "hemisphere": "northern"},
            "month": 3,
            "language": "en",
            "access_token": "",
        }
        r = requests.post(f"{BASE_URL}/api/seasonal-pdf", json=payload, timeout=30)
        assert r.status_code == 402
        assert "Access required" in r.json().get("detail", "")

    def test_bogus_token_returns_402(self):
        payload = {
            "region": {"name": "London", "country": "UK", "hemisphere": "northern"},
            "month": 3,
            "language": "en",
            "access_token": "totally-bogus-not-in-db",
        }
        r = requests.post(f"{BASE_URL}/api/seasonal-pdf", json=payload, timeout=30)
        assert r.status_code == 402
        assert "Access required" in r.json().get("detail", "")

    def test_invalid_month_returns_400(self):
        payload = {
            "region": {"name": "London", "country": "UK", "hemisphere": "northern"},
            "month": 13,
            "language": "en",
            "access_token": TOKEN,
        }
        r = requests.post(f"{BASE_URL}/api/seasonal-pdf", json=payload, timeout=30)
        assert r.status_code == 400


# ───── Regression ─────
class TestRegression:
    def test_guidance_london_march_en(self):
        payload = {
            "region": {"name": "London", "country": "UK", "climate_zone": "Temperate", "hemisphere": "northern"},
            "month": 3,
            "language": "en",
        }
        r = requests.post(f"{BASE_URL}/api/guidance", json=payload, timeout=120)
        assert r.status_code == 200
        data = r.json()
        for k in ("plant_now", "harvest_now", "tasks", "pests"):
            assert k in data and isinstance(data[k], list), f"Missing/bad key: {k}"

    def test_plants_en(self):
        r = requests.get(f"{BASE_URL}/api/plants?language=en", timeout=30)
        assert r.status_code == 200
        data = r.json()
        assert isinstance(data, list)
        assert len(data) >= 20
        ids = {p["id"] for p in data}
        assert "tomato" in ids
