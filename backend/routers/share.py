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
from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, JSONResponse, Response
from pydantic import BaseModel, Field

from share_og import render_share_og_png
from share_qr import render_qr_sticker_pdf
from share_social_kit import build_kit_zip
from share_social_captions import generate_captions
from core import is_visit_bot, viewer_fingerprint


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
    # Opt-in: whether the owner wants this patch listed on the public
    # "Most-loved patches this week" homepage wall. Off by default —
    # users shouldn't be surprised by their patch appearing on the
    # homepage just because they clicked Share once.
    list_publicly: Optional[bool] = False
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
        "list_publicly": bool(doc.get("list_publicly", False)),
        "view_count": int(doc.get("view_count", 0)),
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
                        "list_publicly": bool(payload.list_publicly),
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
                "list_publicly": bool(payload.list_publicly),
                "view_count": 0,
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
    async def get_share(share_id: str, request: Request):
        """Public read — no auth. Returns 404 for unknown / deleted snapshots.

        Side-effect: records a debounced visit for the view counter (24h
        window per viewer fingerprint, bots skipped).
        """
        if not share_id or len(share_id) > 40:
            raise HTTPException(404, "Snapshot not found.")
        doc = await db.shared_patches.find_one({"share_id": share_id})
        if not doc:
            raise HTTPException(404, "Snapshot not found.")

        # ─── debounced view counter ───
        if not is_visit_bot(request):
            fp = viewer_fingerprint(request)
            # 24h dedup key: collection has a TTL index on `expires_at` so
            # rows auto-evict; the insert fails on duplicate so we only
            # increment view_count for fresh fingerprints.
            now = datetime.now(timezone.utc)
            expires_at = now + timedelta(hours=24)
            try:
                await db.shared_patch_views.insert_one({
                    "_id": f"{share_id}:{fp}",  # unique compound key
                    "share_id": share_id,
                    "viewed_at": now.isoformat(),
                    "expires_at": expires_at,
                })
                await db.shared_patches.update_one(
                    {"share_id": share_id},
                    {"$inc": {"view_count": 1, "view_count_7d": 1}},
                )
                # Refresh doc so the response includes the freshly-incremented count
                doc = await db.shared_patches.find_one({"share_id": share_id})
            except Exception:  # noqa: BLE001 — DuplicateKeyError on revisit
                pass

        return _public_view(doc)

    @router.get("/share/patches/popular")
    async def list_popular(limit: int = 12):
        """Public discovery wall — top OPT-IN snapshots by recent views.

        Only returns snapshots where the owner set `list_publicly: true`.
        Excludes empty / placeholder snapshots so the homepage wall always
        looks alive.
        """
        limit = max(1, min(int(limit or 12), 24))
        cursor = (
            db.shared_patches
              .find(
                  {
                      "list_publicly": True,
                      "plants.0": {"$exists": True},  # at least 1 plant
                  },
                  {
                      "_id": 0, "owner_secret": 0, "view_count_7d": 0,
                  },
              )
              .sort([("view_count_7d", -1), ("view_count", -1), ("updated_at", -1)])
              .limit(limit)
        )
        items = []
        async for row in cursor:
            items.append({
                "share_id": row.get("share_id"),
                "patch_name": row.get("patch_name"),
                "region": row.get("region", {}),
                "plant_count": len(row.get("plants") or []),
                "first_plants": [
                    {"name": p.get("name"), "category": p.get("category")}
                    for p in (row.get("plants") or [])[:3]
                ],
                "view_count": int(row.get("view_count", 0)),
                "updated_at": row.get("updated_at"),
            })
        return {"items": items}

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
    @router.get("/share/patch/{share_id}/qr.pdf")
    async def qr_sticker(share_id: str, request: Request):
        """Generate a printable A6 garden-gate QR sticker PDF for this snapshot."""
        if not share_id or len(share_id) > 40:
            raise HTTPException(404, "Snapshot not found.")
        doc = await db.shared_patches.find_one({"share_id": share_id})
        if not doc:
            raise HTTPException(404, "Snapshot not found.")

        public_origin = (
            os.environ.get("PUBLIC_APP_URL", "").rstrip("/")
            or _origin_from_request(request)
        )
        # Use the clean /p/{id} URL on the sticker — humans scanning a QR
        # from a garden gate are best served by going directly into the SPA
        # without the rich-preview wrapper redirect blip.
        share_url   = f"{public_origin}/p/{share_id}"
        display_url = share_url.replace("https://", "").replace("http://", "")

        region = (doc.get("region") or {})
        region_text = region.get("name") or ""
        if region.get("country") and region["country"] not in region_text:
            region_text = f"{region_text}, {region['country']}"

        pdf_bytes = render_qr_sticker_pdf(
            patch_name=doc.get("patch_name") or "My patch",
            region_name=region_text,
            share_url=share_url,
            display_url=display_url,
        )
        filename = f"patch-and-pot-{share_id}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'inline; filename="{filename}"',
                "Cache-Control": "public, max-age=86400",
            },
        )

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
            png_bytes = render_share_og_png(
                patch_name=doc.get("patch_name") or "A garden",
                region_name=_format_region(doc.get("region") or {}),
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

    def _format_region(region: dict) -> str:
        """Render a region dict as a single human-readable line like
        'London, United Kingdom'. Empty country is dropped silently; a
        country already embedded in the name (e.g. 'Wales') is not
        duplicated. Used by both the captions helper and the ZIP builder
        so they always stamp the same region label on the assets."""
        name = (region or {}).get("name") or ""
        country = (region or {}).get("country") or ""
        if country and country not in name:
            return f"{name}, {country}".strip(", ")
        return name.strip(", ")

    async def _get_or_generate_captions(share_id: str, request: Request) -> tuple[dict, dict]:
        """Resolve the snapshot + captions for `share_id`, generating &
        caching the captions if we haven't seen this `version` before.

        Returns `(snapshot_doc, captions_dict)`. Raises 404 if the share
        doesn't exist. Used by both the ZIP endpoint and the lighter
        captions-only endpoint that powers the [Tweet this patch] button —
        sharing the cache means the ZIP download warms the tweet button
        and vice-versa.
        """
        if not share_id or len(share_id) > 40:
            raise HTTPException(404, "Snapshot not found.")
        doc = await db.shared_patches.find_one({"share_id": share_id})
        if not doc:
            raise HTTPException(404, "Snapshot not found.")

        version = doc.get("updated_at") or doc.get("created_at") or ""
        cached = await db.shared_patch_captions.find_one(
            {"share_id": share_id, "version": version},
            {"_id": 0, "captions": 1},
        )
        if cached and cached.get("captions"):
            return doc, cached["captions"]

        region = doc.get("region") or {}
        public_origin = (
            os.environ.get("PUBLIC_APP_URL", "").rstrip("/")
            or _origin_from_request(request)
        )
        share_url = f"{public_origin}/p/{share_id}"

        captions = await generate_captions(
            patch_name=doc.get("patch_name") or "My patch",
            region_name=_format_region(region),
            plant_count=len(doc.get("plants") or []),
            share_url=share_url,
        )
        await db.shared_patch_captions.update_one(
            {"share_id": share_id},
            {"$set": {
                "share_id": share_id,
                "version": version,
                "captions": captions,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }},
            upsert=True,
        )
        return doc, captions

    @router.get("/share/patch/{share_id}/captions.json")
    async def share_captions(share_id: str, request: Request):
        """Return the four AI-generated platform captions for this share as
        JSON, generating + caching them if necessary. Used by the frontend
        `[Tweet this patch]` quick-action so the button can pre-fill an X
        intent URL with the Twitter-tuned caption without forcing the
        owner to download the full ZIP first.
        """
        _, captions = await _get_or_generate_captions(share_id, request)
        return JSONResponse(
            content={"captions": captions},
            headers={"Cache-Control": "public, max-age=86400"},
        )

    @router.get("/share/patch/{share_id}/social-kit.zip")
    async def social_media_kit(share_id: str, request: Request):
        """Bundle 4 aspect-ratio teaser images + AI captions + README into a
        single downloadable ZIP for the patch owner's social marketing.

        Cache strategy mirrors og.png: keyed on `(share_id, version)` where
        version = the snapshot's `updated_at`. Every snapshot edit busts the
        cache automatically. Caption generation is the expensive step
        (~$0.003 in LLM credits) so the cache is real money-saving, not
        just latency-saving.
        """
        if not share_id or len(share_id) > 40:
            raise HTTPException(404, "Snapshot not found.")
        doc = await db.shared_patches.find_one({"share_id": share_id})
        if not doc:
            raise HTTPException(404, "Snapshot not found.")

        version = doc.get("updated_at") or doc.get("created_at") or ""
        cached = await db.shared_patch_social_kit.find_one(
            {"share_id": share_id, "version": version},
            {"_id": 0, "zip": 1},
        )
        if cached and cached.get("zip"):
            zip_bytes = cached["zip"]
        else:
            # Reuse the shared caption cache — clicking the [Tweet] button
            # earlier (or another ZIP download) will already have populated
            # this for free.
            _, captions = await _get_or_generate_captions(share_id, request)
            zip_bytes = build_kit_zip(
                patch_name=doc.get("patch_name") or "My patch",
                region_name=_format_region(doc.get("region") or {}),
                plant_count=len(doc.get("plants") or []),
                captions=captions,
            )
            await db.shared_patch_social_kit.update_one(
                {"share_id": share_id},
                {"$set": {
                    "share_id": share_id,
                    "version": version,
                    "zip": zip_bytes,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )

        filename = f"patch-and-pot-{share_id}-social-kit.zip"
        return Response(
            content=zip_bytes,
            media_type="application/zip",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"',
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
        # of the snapshot triggers a fresh fetch from social-media caches.
        # We use a hash of the full ISO timestamp (rather than a slice of it)
        # so two snapshot edits within the same 10s window still produce a
        # distinct cache-buster token.
        full_version = doc.get("updated_at") or doc.get("created_at") or ""
        if full_version:
            import hashlib
            version_token = hashlib.sha1(full_version.encode()).hexdigest()[:12]
        else:
            version_token = ""
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

        # JSON-LD Schema.org — surfaces shared-patch pages as rich results in
        # Google search. WebPage + a CreativeWork About for the patch itself.
        import json as _json
        jsonld = _json.dumps({
            "@context": "https://schema.org",
            "@type": "WebPage",
            "name": title,
            "description": desc,
            "url": clean_url,
            "image": og_image_url,
            "author": {"@type": "Person", "name": "A Patch & Pot gardener"},
            "publisher": {
                "@type": "Organization",
                "name": "Patch & Pot",
                "logo": {
                    "@type": "ImageObject",
                    "url": f"{public_origin}/logo192.png",
                },
            },
            "datePublished": doc.get("created_at"),
            "dateModified": doc.get("updated_at") or doc.get("created_at"),
            "isPartOf": {"@type": "WebSite", "name": "Patch & Pot", "url": public_origin},
            "primaryImageOfPage": og_image_url,
        }, ensure_ascii=False)

        body_html = _render_preview_html(
            title=title, desc=desc, og_image_url=og_image_url, clean_url=clean_url,
            patch_name=patch_name, region_full=region_full, jsonld=jsonld,
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


def _render_preview_html(*, title, desc, og_image_url, clean_url, patch_name, region_full, jsonld="") -> str:
    """Plain, dependency-free HTML for social crawlers + a JS + meta-refresh
    redirect for humans. Kept deliberately tiny."""
    schema_block = f'<script type="application/ld+json">{jsonld}</script>' if jsonld else ""
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
{schema_block}
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
