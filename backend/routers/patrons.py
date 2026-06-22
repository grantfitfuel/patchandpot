"""Public Patrons page — opt-in display of supporters who agreed to be listed.

GDPR posture (lawful basis = explicit consent):
  * Default OFF — nobody appears unless they actively submit the opt-in form
    on /checkout/success after paying.
  * Display name only — never email, country, exact amount, or session_id.
  * One-click removal via POST /api/patrons/opt-out using the session_id
    they already have (no separate login required).
  * Consent is logged with a timestamp so we can prove it was given.

All consent state lives on `payment_transactions` so a single endpoint covers
both access-granting tiers AND the tip jar (tips also generate gratitude but
no access grant).
"""
import re
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field


# Very small, intentionally conservative profanity list. We're not trying
# to win a censorship war — just block the obvious offenders before they
# land on a public page. A determined troll will get past it; that's why
# we also expose a one-click remove endpoint and check the page manually.
#
# Matched at *word-start* (\b<word>) — this still catches "fuck", "fuckface",
# "fuckboy" but lets through legitimate names like "Scunthorpe" (UK town
# containing 'cunt' mid-word) and "Mitsushita" (contains 'shit' mid-word).
# Important for a gardening site with international supporters.
_PROFANITY = [
    "fuck", "shit", "cunt", "bitch", "bastard", "asshole", "dick",
    "nazi", "hitler", "kkk", "slut", "whore", "faggot", "retard",
]
_PROFANITY_RE = re.compile(
    r"\b(?:" + "|".join(re.escape(w) for w in _PROFANITY) + r")",
    flags=re.IGNORECASE,
)
_NAME_RE = re.compile(r"^[A-Za-zÀ-ÿ0-9 .,'\-&]+$")
_MAX_NAME_LEN = 30

# Display ordering — most "permanent" supporters surface first so the page
# rewards the deepest commitment.
_TIER_ORDER = [
    "lifetime_founding",
    "lifetime",
    "annual",
    "six_months",
    "three_months",
    "one_month",
    "tip",
]
_TIER_LABELS = {
    "lifetime_founding": "Founding Members",
    "lifetime": "Lifetime Patrons",
    "annual": "Annual Supporters",
    "six_months": "Six-Month Supporters",
    "three_months": "Three-Month Supporters",
    "one_month": "Monthly Supporters",
    "tip": "Tippers",
}


def _sanitize_display_name(raw):
    """Return a clean display name or raise HTTPException(422).

    Rules: 1-30 chars, only letters/digits/space/.,'-&, no profanity words.
    Multiple whitespace runs collapse to one space. Empty after strip → reject.
    """
    if not raw or not isinstance(raw, str):
        raise HTTPException(422, "display_name is required.")
    name = " ".join(raw.split())  # collapse whitespace
    if not name:
        raise HTTPException(422, "display_name is required.")
    if len(name) > _MAX_NAME_LEN:
        raise HTTPException(422, f"display_name must be {_MAX_NAME_LEN} characters or fewer.")
    if not _NAME_RE.match(name):
        raise HTTPException(422, "display_name contains unsupported characters.")
    if _PROFANITY_RE.search(name):
        raise HTTPException(422, "Please choose a different display name.")
    return name


class PatronOptInRequest(BaseModel):
    session_id: str = Field(..., min_length=4, max_length=200)
    display_name: str = Field(..., min_length=1, max_length=60)
    # Belt-and-braces: the frontend MUST set consent=true. We refuse the
    # request otherwise so we never store a name without explicit consent.
    consent: bool


class PatronOptOutRequest(BaseModel):
    session_id: str = Field(..., min_length=4, max_length=200)


def make_router(db):
    router = APIRouter(prefix="/api", tags=["patrons"])

    @router.post("/patrons/opt-in")
    async def opt_in(payload: PatronOptInRequest):
        if not payload.consent:
            raise HTTPException(422, "Consent must be explicitly granted.")
        name = _sanitize_display_name(payload.display_name)

        # Verify the session is paid. We don't trust the client — anyone can
        # POST anything; we only allow opt-in if the txn actually exists and
        # was paid. Tips count (no access grant, but a real payment).
        txn = await db.payment_transactions.find_one(
            {"session_id": payload.session_id, "payment_status": "paid"},
            {"_id": 0, "session_id": 1, "package_id": 1},
        )
        if not txn:
            raise HTTPException(404, "No paid session found for that id.")

        await db.payment_transactions.update_one(
            {"session_id": payload.session_id},
            {"$set": {
                "display_name": name,
                "display_consent": True,
                "display_consented_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return {"ok": True, "display_name": name}

    @router.post("/patrons/opt-out")
    async def opt_out(payload: PatronOptOutRequest):
        # No 404 here: opting out should always feel like it worked, even
        # if the caller's name was never listed — friendlier UX and avoids
        # leaking which session_ids exist in the DB.
        await db.payment_transactions.update_one(
            {"session_id": payload.session_id},
            {"$set": {
                "display_consent": False,
                "display_name": None,
                "display_consent_revoked_at": datetime.now(timezone.utc).isoformat(),
            }},
        )
        return {"ok": True}

    @router.get("/patrons")
    async def list_patrons(limit_per_tier: int = 500):
        """Public list of opted-in supporters grouped by tier.
        Returns only display names and tier — no PII, no amounts."""
        limit_per_tier = max(1, min(int(limit_per_tier), 2000))

        cursor = db.payment_transactions.find(
            {
                "display_consent": True,
                "display_name": {"$ne": None},
                "payment_status": "paid",
            },
            {
                "_id": 0,
                "display_name": 1,
                "package_id": 1,
                "display_consented_at": 1,
            },
        ).sort("display_consented_at", 1)
        # Cap at 5k absolute to keep the response bounded.
        rows = await cursor.to_list(length=5000)

        # Bucket by package_id, dedupe names within a tier (same person
        # paying twice for the same tier shouldn't appear twice).
        buckets = {tier: [] for tier in _TIER_ORDER}
        seen = {tier: set() for tier in _TIER_ORDER}
        for r in rows:
            tier = r.get("package_id")
            if tier not in buckets:
                continue
            name = r.get("display_name")
            if not name:
                continue
            key = name.casefold()
            if key in seen[tier]:
                continue
            seen[tier].add(key)
            buckets[tier].append(name)

        groups = []
        total = 0
        for tier in _TIER_ORDER:
            names = buckets[tier][:limit_per_tier]
            if not names:
                continue
            # Light alphabetical sort within a tier so the list looks tidy
            # and doesn't reveal exact join order (slight privacy bonus).
            names_sorted = sorted(names, key=lambda n: n.casefold())
            groups.append({
                "tier": tier,
                "label": _TIER_LABELS[tier],
                "count": len(names_sorted),
                "names": names_sorted,
            })
            total += len(names_sorted)

        return {"total": total, "groups": groups}

    return router
