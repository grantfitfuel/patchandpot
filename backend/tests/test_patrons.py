"""Patrons opt-in / opt-out / list endpoint tests.

Seeds 4 paid txns across tiers, opts in 3, opts out 1, verifies
GET /api/patrons groups correctly and excludes opt-outs.
CLEANS UP all seeded test data at the end (TEST_ session_id prefix).
"""
import os
import sys
import uuid
import asyncio
import pytest
import requests

# Allow importing motor client from backend
sys.path.insert(0, "/app/backend")
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://grow-by-season-1.preview.emergentagent.com").rstrip("/")
MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "test_database")

PREFIX = "TEST_patron_"


def _sid(suffix):
    return f"{PREFIX}{suffix}_{uuid.uuid4().hex[:8]}"


@pytest.fixture(scope="module")
def seeded():
    """Seed 4 paid transactions across tiers and return their session_ids."""
    sids = {
        "lifetime_founding": _sid("founding"),
        "annual": _sid("annual"),
        "one_month": _sid("monthly"),
        "tip": _sid("tip"),
    }

    async def _seed():
        # Load env if not already set
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        mongo = os.environ["MONGO_URL"]
        dbn = os.environ["DB_NAME"]
        client = AsyncIOMotorClient(mongo)
        db = client[dbn]
        docs = [
            {"session_id": sids["lifetime_founding"], "package_id": "lifetime_founding",
             "payment_status": "paid", "amount": 35.0, "currency": "gbp"},
            {"session_id": sids["annual"], "package_id": "annual",
             "payment_status": "paid", "amount": 15.0, "currency": "gbp"},
            {"session_id": sids["one_month"], "package_id": "one_month",
             "payment_status": "paid", "amount": 3.0, "currency": "gbp"},
            {"session_id": sids["tip"], "package_id": "tip",
             "payment_status": "paid", "amount": 3.0, "currency": "gbp"},
        ]
        await db.payment_transactions.insert_many(docs)
        client.close()

    asyncio.get_event_loop().run_until_complete(_seed())
    yield sids

    async def _cleanup():
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = client[os.environ["DB_NAME"]]
        await db.payment_transactions.delete_many({"session_id": {"$regex": f"^{PREFIX}"}})
        client.close()

    asyncio.get_event_loop().run_until_complete(_cleanup())


# ───────────── GET /api/patrons empty state ─────────────
def test_patrons_empty_state_before_optin():
    """Before any opt-ins exist, GET /api/patrons returns total=0 / groups=[]."""
    r = requests.get(f"{BASE_URL}/api/patrons", timeout=15)
    assert r.status_code == 200, r.text
    data = r.json()
    assert "total" in data and "groups" in data
    assert isinstance(data["groups"], list)
    # NOTE: not asserting total==0 here because earlier test runs may leave data;
    # we assert via name absence below in the opt-in flow tests.


# ───────────── Opt-in validation tests ─────────────
def test_opt_in_rejects_missing_consent(seeded):
    r = requests.post(
        f"{BASE_URL}/api/patrons/opt-in",
        json={"session_id": seeded["annual"], "display_name": "Test Annual", "consent": False},
        timeout=15,
    )
    assert r.status_code == 422, r.text
    assert "Consent must be explicitly granted" in r.json().get("detail", "")


def test_opt_in_rejects_profanity(seeded):
    r = requests.post(
        f"{BASE_URL}/api/patrons/opt-in",
        json={"session_id": seeded["annual"], "display_name": "fuckface", "consent": True},
        timeout=15,
    )
    assert r.status_code == 422, r.text
    assert "different display name" in r.json().get("detail", "")


def test_opt_in_rejects_name_over_30_chars(seeded):
    long_name = "A" * 31
    r = requests.post(
        f"{BASE_URL}/api/patrons/opt-in",
        json={"session_id": seeded["annual"], "display_name": long_name, "consent": True},
        timeout=15,
    )
    # Could be 422 either from pydantic (max_length=60 → passes pydantic) or sanitiser
    assert r.status_code == 422, r.text
    detail = r.json().get("detail", "")
    assert "30" in str(detail) or "characters" in str(detail).lower()


def test_opt_in_rejects_nonexistent_session():
    r = requests.post(
        f"{BASE_URL}/api/patrons/opt-in",
        json={"session_id": "TEST_patron_nonexistent_xxxxxx", "display_name": "Ghost", "consent": True},
        timeout=15,
    )
    assert r.status_code == 404, r.text
    assert "No paid session found" in r.json().get("detail", "")


# ───────────── Happy-path opt-in / list / opt-out ─────────────
def test_opt_in_and_list_and_opt_out(seeded):
    # Opt-in 3 distinct patrons across tiers
    cases = [
        (seeded["lifetime_founding"], "TEST Founder Alice"),
        (seeded["annual"], "TEST Annual Bob"),
        (seeded["tip"], "TEST Tipper Carol"),
    ]
    for sid, name in cases:
        r = requests.post(
            f"{BASE_URL}/api/patrons/opt-in",
            json={"session_id": sid, "display_name": name, "consent": True},
            timeout=15,
        )
        assert r.status_code == 200, f"{name}: {r.text}"
        body = r.json()
        assert body["ok"] is True
        assert body["display_name"] == name

    # GET /api/patrons should include all three, grouped by tier
    r = requests.get(f"{BASE_URL}/api/patrons", timeout=15)
    assert r.status_code == 200
    data = r.json()
    all_names = [n for g in data["groups"] for n in g["names"]]
    for _, n in cases:
        assert n in all_names, f"Missing patron {n} in {all_names}"

    # Verify tier ordering: founding before annual before tip
    tiers_present = [g["tier"] for g in data["groups"]]
    if "lifetime_founding" in tiers_present and "annual" in tiers_present:
        assert tiers_present.index("lifetime_founding") < tiers_present.index("annual")
    if "annual" in tiers_present and "tip" in tiers_present:
        assert tiers_present.index("annual") < tiers_present.index("tip")

    # Opt-out one (the annual one)
    r = requests.post(
        f"{BASE_URL}/api/patrons/opt-out",
        json={"session_id": seeded["annual"]},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True}

    # Confirm opted-out name no longer appears
    r = requests.get(f"{BASE_URL}/api/patrons", timeout=15)
    all_names = [n for g in r.json()["groups"] for n in g["names"]]
    assert "TEST Annual Bob" not in all_names
    # Others still listed
    assert "TEST Founder Alice" in all_names
    assert "TEST Tipper Carol" in all_names


def test_opt_out_is_idempotent_for_nonexistent_session():
    """Opt-out should always 200 even for unknown sessions (friendlier UX)."""
    r = requests.post(
        f"{BASE_URL}/api/patrons/opt-out",
        json={"session_id": "TEST_patron_does_not_exist_zzzz"},
        timeout=15,
    )
    assert r.status_code == 200, r.text
    assert r.json() == {"ok": True}


def test_db_persistence_of_consent_fields(seeded):
    """After opt-in, the txn doc should have display_name/display_consent set."""
    sid = seeded["lifetime_founding"]

    async def _check():
        from dotenv import load_dotenv
        load_dotenv("/app/backend/.env")
        client = AsyncIOMotorClient(os.environ["MONGO_URL"])
        db = client[os.environ["DB_NAME"]]
        doc = await db.payment_transactions.find_one({"session_id": sid})
        client.close()
        return doc

    doc = asyncio.get_event_loop().run_until_complete(_check())
    assert doc is not None
    # opt-in for founding happened in test_opt_in_and_list_and_opt_out
    assert doc.get("display_consent") is True
    assert doc.get("display_name") == "TEST Founder Alice"
    assert "display_consented_at" in doc
