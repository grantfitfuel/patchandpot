"""Public "Share my Patch" snapshot endpoints.

A user clicks "Share my patch" in My Garden and we persist a tiny read-only
snapshot of their patch (name, region, plant list) under a short share_id.
Anyone with the share link can then view it at `/p/{share_id}` on the front-
end — no login, no email collected, no PII other than what they typed.

Design notes
------------
* Snapshots are intentionally lightweight — patch name (≤30 chars), region,
  and the plant list (capped at 100 entries). We do NOT store task state or
  wellbeing entries on the public snapshot.
* The owner gets back an `owner_secret` on create which they can use later
  to update or delete the snapshot. We use a random token rather than tying
  to a user account because the rest of the app is passwordless.
* Profanity check is reused (loosely) from patrons.py so the public URL
  can't be weaponised as a billboard.
* `share_id` is short (12 chars, base32) so the URL stays human-friendly
  and shareable on chat / SMS. Collision probability at 12 chars of base32
  is negligible for our scale; we still loop-retry on the (extremely
  unlikely) duplicate.
"""
import re
import secrets
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field


_PROFANITY = [
    "fuck", "shit", "cunt", "bitch", "bastard", "asshole", "dick",
    "nazi", "hitler", "kkk", "slut", "whore", "faggot", "retard",
]
_PROFANITY_RE = re.compile(
    r"\b(?:" + "|".join(re.escape(w) for w in _PROFANITY) + r")",
    flags=re.IGNORECASE,
)

_PATCH_NAME_MAX = 30
_PLANT_NAME_MAX = 80
_PLANT_CATEGORY_MAX = 40
_PLANT_ID_MAX = 80
_MAX_PLANTS = 100
_SHARE_ID_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"  # no l,o,0,1 to dodge confusion
_SHARE_ID_LEN = 12
_OWNER_SECRET_LEN = 32


class SharedPatchPlant(BaseModel):
    id: str = Field(..., min_length=1, max_length=_PLANT_ID_MAX)
    name: str = Field(..., min_length=1, max_length=_PLANT_NAME_MAX)
    category: Optional[str] = Field(None, max_length=_PLANT_CATEGORY_MAX)
    ai_generated: Optional[bool] = False


class SharedPatchRegion(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    country: Optional[str] = Field(None, max_length=120)
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    climate_zone: Optional[str] = Field(None, max_length=60)
    hemisphere: Optional[str] = Field(None, max_length=20)


class SharePatchCreate(BaseModel):
    patch_name: str = Field(..., min_length=1, max_length=_PATCH_NAME_MAX)
    region: SharedPatchRegion
    plants: List[SharedPatchPlant] = Field(default_factory=list)
    # Optional — if supplied we treat this as an update on an existing
    # snapshot rather than a fresh create. Lets a user re-share the same
    # URL after adding a plant without piling up dead snapshots.
    share_id: Optional[str] = Field(None, min_length=4, max_length=40)
    owner_secret: Optional[str] = Field(None, min_length=8, max_length=80)


def _sanitize_name(raw: str, *, field: str, max_len: int) -> str:
    name = " ".join((raw or "").split())  # collapse whitespace
    if not name:
        raise HTTPException(422, f"{field} is required.")
    if len(name) > max_len:
        raise HTTPException(422, f"{field} must be {max_len} characters or fewer.")
    if _PROFANITY_RE.search(name):
        raise HTTPException(422, f"Please choose a different {field}.")
    return name


def _new_share_id() -> str:
    return "".join(secrets.choice(_SHARE_ID_ALPHABET) for _ in range(_SHARE_ID_LEN))


def _public_view(doc: dict) -> dict:
    """Strip the owner_secret before returning to the public."""
    return {
        "share_id": doc["share_id"],
        "patch_name": doc["patch_name"],
        "region": doc["region"],
        "plants": doc["plants"],
        "created_at": doc["created_at"],
        "updated_at": doc.get("updated_at") or doc["created_at"],
    }


def make_router(db) -> APIRouter:
    router = APIRouter(tags=["share"])

    @router.post("/share/patch")
    async def create_share(payload: SharePatchCreate):
        """Create or update a shareable patch snapshot.

        Returns `{share_id, owner_secret, share_path}`. The caller must store
        the `owner_secret` (we hand it back exactly once for an update flow).
        """
        patch_name = _sanitize_name(
            payload.patch_name, field="patch_name", max_len=_PATCH_NAME_MAX,
        )

        if len(payload.plants) > _MAX_PLANTS:
            raise HTTPException(422, f"A shared patch may have at most {_MAX_PLANTS} plants.")

        plants = []
        seen_ids = set()
        for p in payload.plants:
            pid = (p.id or "").strip()
            if not pid or pid in seen_ids:
                # Silently drop duplicates / blanks rather than 422 — keeps
                # the client trivially simple to write.
                continue
            seen_ids.add(pid)
            plants.append({
                "id": pid[:_PLANT_ID_MAX],
                "name": _sanitize_name(p.name, field="plant name", max_len=_PLANT_NAME_MAX),
                "category": (p.category or "").strip()[:_PLANT_CATEGORY_MAX] or None,
                "ai_generated": bool(p.ai_generated),
            })

        region = payload.region.dict()
        region["name"] = _sanitize_name(region["name"], field="region", max_len=120)

        now_iso = datetime.now(timezone.utc).isoformat()

        # Update path — only if the caller can prove they own the snapshot.
        if payload.share_id and payload.owner_secret:
            existing = await db.shared_patches.find_one({"share_id": payload.share_id})
            if existing and secrets.compare_digest(
                existing.get("owner_secret", ""), payload.owner_secret,
            ):
                await db.shared_patches.update_one(
                    {"share_id": payload.share_id},
                    {"$set": {
                        "patch_name": patch_name,
                        "region": region,
                        "plants": plants,
                        "updated_at": now_iso,
                    }},
                )
                return {
                    "share_id": payload.share_id,
                    "owner_secret": payload.owner_secret,
                    "share_path": f"/p/{payload.share_id}",
                    "updated": True,
                }
            # Mismatched / missing → fall through to a fresh create. The
            # caller learns the old link is stale via the new share_id.

        # Fresh create. Retry on the astronomically unlikely id collision.
        owner_secret = secrets.token_urlsafe(_OWNER_SECRET_LEN)
        for _ in range(5):
            share_id = _new_share_id()
            doc = {
                "share_id": share_id,
                "owner_secret": owner_secret,
                "patch_name": patch_name,
                "region": region,
                "plants": plants,
                "created_at": now_iso,
                "updated_at": now_iso,
            }
            try:
                await db.shared_patches.insert_one(doc)
                return {
                    "share_id": share_id,
                    "owner_secret": owner_secret,
                    "share_path": f"/p/{share_id}",
                    "updated": False,
                }
            except Exception:  # noqa: BLE001 — only realistic case is dup key
                continue

        raise HTTPException(500, "Could not allocate a share id. Please try again.")

    @router.get("/share/patch/{share_id}")
    async def get_share(share_id: str):
        """Public read — no auth. Returns 404 for unknown / deleted snapshots."""
        if not share_id or len(share_id) > 40:
            raise HTTPException(404, "Snapshot not found.")
        doc = await db.shared_patches.find_one({"share_id": share_id})
        if not doc:
            raise HTTPException(404, "Snapshot not found.")
        return _public_view(doc)

    @router.delete("/share/patch/{share_id}")
    async def delete_share(share_id: str, owner_secret: str):
        """Owner-initiated delete. We require the secret as a query param so
        a stray share-link click can't accidentally nuke a snapshot."""
        if not share_id or not owner_secret:
            raise HTTPException(422, "share_id and owner_secret are required.")
        doc = await db.shared_patches.find_one({"share_id": share_id})
        if not doc:
            # Same "always-succeed" posture as patrons.opt-out — friendlier
            # UX and avoids leaking which ids exist.
            return {"ok": True}
        if not secrets.compare_digest(doc.get("owner_secret", ""), owner_secret):
            raise HTTPException(403, "Invalid owner secret for this snapshot.")
        await db.shared_patches.delete_one({"share_id": share_id})
        return {"ok": True}

    return router
