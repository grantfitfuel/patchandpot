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
import html
import os
import re
import secrets
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel, Field

from share_og import render_share_og_png


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
        # Drop any cached OG card too — the snapshot is gone.
        await db.shared_patch_og.delete_one({"share_id": share_id})
        return {"ok": True}

    # ─────────────────── OG card + crawler HTML wrapper ───────────────────
    # Social-media crawlers (Twitter, WhatsApp, iMessage, Facebook, classic
    # Slack) DON'T execute JavaScript, so meta tags injected by React's
    # useEffect are invisible to them. We work around that with a tiny
    # FastAPI-rendered HTML page at /api/share/preview/{id} that serves
    # proper <meta> tags up-front and then meta-refreshes humans into the
    # SPA at /p/{id}. The Share modal shares this preview URL so every
    # chat / DM / social post gets a real card.
    @router.get("/share/patch/{share_id}/og.png")
    async def og_card(share_id: str):
        """Render (and cache) the 1200×630 OG share card for a snapshot."""
        if not share_id or len(share_id) > 40:
            raise HTTPException(404, "Snapshot not found.")
        doc = await db.shared_patches.find_one({"share_id": share_id})
        if not doc:
            raise HTTPException(404, "Snapshot not found.")

        # Cache invalidates on snapshot edit — version key is the updated_at
        # string itself, which we bumped on every successful update.
        version = doc.get("updated_at") or doc.get("created_at") or ""
        cached = await db.shared_patch_og.find_one(
            {"share_id": share_id, "version": version},
            {"_id": 0, "png": 1},
        )
        if cached and cached.get("png"):
            png_bytes = cached["png"]
        else:
            region_name = (doc.get("region") or {}).get("name") or ""
            country = (doc.get("region") or {}).get("country") or ""
            full_region = region_name + (f", {country}" if country and country not in region_name else "")
            png_bytes = render_share_og_png(
                patch_name=doc.get("patch_name") or "A garden",
                region_name=full_region.strip(", "),
                plant_count=len(doc.get("plants") or []),
            )
            # Upsert keyed by (share_id, version). Old versions get pushed
            # out automatically by the upsert; we keep only the current one.
            await db.shared_patch_og.update_one(
                {"share_id": share_id},
                {"$set": {
                    "share_id": share_id,
                    "version": version,
                    "png": png_bytes,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )

        return Response(
            content=png_bytes,
            media_type="image/png",
            headers={
                # Allow CDNs / social caches to keep the card for a day.
                # Cache busts naturally because the URL changes via the
                # snapshot's updated_at value once we wire that in below
                # (?v=…). For now snapshot edits + redeploys are rare so a
                # 1d cache is fine.
                "Cache-Control": "public, max-age=86400",
            },
        )

    @router.get("/share/preview/{share_id}", response_class=HTMLResponse)
    async def share_preview(share_id: str, request: Request):
        """Bot-friendly HTML wrapper.

        Serves a tiny standalone page with proper og:title / og:description /
        og:image / twitter:card meta tags. For humans, an immediate JS +
        meta-refresh redirect carries them to the SPA at `/p/{share_id}`.
        We deliberately keep the HTML simple (no JS bundle, no external
        deps) so the page is parseable by the most paranoid crawlers.
        """
        if not share_id or len(share_id) > 40:
            raise HTTPException(404, "Snapshot not found.")
        doc = await db.shared_patches.find_one({"share_id": share_id})
        if not doc:
            raise HTTPException(404, "Snapshot not found.")

        # Reconstruct the public site origin so the redirect lands on the
        # SPA's clean URL rather than this /api/... path.
        public_origin = (
            os.environ.get("PUBLIC_APP_URL", "").rstrip("/")
            or _origin_from_request(request)
        )
        clean_url = f"{public_origin}/p/{share_id}"

        # OG image points at our PNG endpoint. Append ?v= so any later edit
        # of the snapshot triggers a fresh fetch from social caches.
        version_token = (doc.get("updated_at") or doc.get("created_at") or "").replace(":", "").replace("-", "")[:14]
        og_image_url = f"{public_origin}/api/share/patch/{share_id}/og.png" + (
            f"?v={version_token}" if version_token else ""
        )

        patch_name = doc.get("patch_name") or "A garden"
        region = (doc.get("region") or {}).get("name") or ""
        country = (doc.get("region") or {}).get("country") or ""
        region_full = region + (f", {country}" if country and country not in region else "")
        plants = doc.get("plants") or []
        plant_count = len(plants)
        plant_label = "plant" if plant_count == 1 else "plants"
        first_names = ", ".join((p.get("name") or "") for p in plants[:5])

        title = f"{patch_name} · {region_full} — Patch & Pot" if region_full else f"{patch_name} — Patch & Pot"
        if first_names:
            desc = (
                f"{patch_name} is growing {plant_count} {plant_label} in {region_full or 'their patch'}: "
                f"{first_names}{'…' if plant_count > 5 else ''}. See what they're sowing, harvesting and "
                f"watching for this month on Patch & Pot."
            )
        else:
            desc = (
                f"A shared garden on Patch & Pot — {patch_name}"
                f"{' in ' + region_full if region_full else ''}. See what's growing this month."
            )

        body_html = _render_preview_html(
            title=title, desc=desc, og_image_url=og_image_url, clean_url=clean_url,
            patch_name=patch_name, region_full=region_full,
        )
        return HTMLResponse(
            content=body_html,
            headers={
                # Short cache only — social crawlers honour 1-day OG images
                # via the og.png Cache-Control above, but the HTML itself
                # should refresh quickly if the gardener tweaks the name.
                "Cache-Control": "public, max-age=300",
            },
        )

    return router


def _origin_from_request(request: Request) -> str:
    """Recover the public origin (scheme://host) the user hit. Honours the
    x-forwarded-* headers our ingress sets in production."""
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme or "https"
    host = (
        request.headers.get("x-forwarded-host")
        or request.headers.get("host")
        or request.url.hostname
        or "patchandpot.app"
    )
    host = host.split(",")[0].strip()
    return f"{proto}://{host}"


def _render_preview_html(*, title, desc, og_image_url, clean_url, patch_name, region_full) -> str:
    """Plain, dependency-free HTML for social crawlers + a JS + meta-refresh
    redirect for humans. Kept deliberately tiny."""
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="{html.escape(clean_url)}">
<meta property="og:type" content="article">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:url" content="{html.escape(clean_url)}">
<meta property="og:image" content="{html.escape(og_image_url)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="{html.escape(patch_name)}{' — ' + html.escape(region_full) if region_full else ''}">
<meta property="og:site_name" content="Patch & Pot">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{html.escape(title)}">
<meta name="twitter:description" content="{html.escape(desc)}">
<meta name="twitter:image" content="{html.escape(og_image_url)}">
<meta http-equiv="refresh" content="0; url={html.escape(clean_url)}">
<style>
  html, body {{ margin: 0; padding: 0; background: #F7F5F0; color: #1C231A;
    font-family: ui-serif, Georgia, "Times New Roman", serif; height: 100%; }}
  .wrap {{ display: flex; flex-direction: column; align-items: center;
    justify-content: center; height: 100%; padding: 0 24px; text-align: center; }}
  h1 {{ font-style: italic; font-weight: 700; font-size: 2.2rem; color: #2D4A22;
    margin: 0 0 12px; letter-spacing: -0.01em; }}
  p {{ color: #5C6B52; margin: 0 0 20px; font-family: ui-sans-serif, system-ui, sans-serif; }}
  a {{ color: #C65D47; text-decoration: none; border-bottom: 1px solid #C65D47;
    padding-bottom: 2px; font-family: ui-sans-serif, system-ui, sans-serif; }}
</style>
</head>
<body>
<div class="wrap">
  <h1>Opening this patch…</h1>
  <p>If you're not redirected automatically:</p>
  <a href="{html.escape(clean_url)}">Continue to {html.escape(patch_name)} →</a>
</div>
<script>
  // Belt + braces over the meta-refresh — fires the redirect even on
  // browsers that disable meta-refresh for privacy.
  window.location.replace({_js_string(clean_url)});
</script>
</body>
</html>
"""


def _js_string(value: str) -> str:
    """Safely embed a string into a JS literal — escape backslashes, quotes
    and line terminators."""
    safe = (
        value.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\u2028", "\\u2028")
        .replace("\u2029", "\\u2029")
    )
    return f'"{safe}"'
