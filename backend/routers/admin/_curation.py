"""Promote-AI workflow endpoints — powers the `/admin/ai-searches` UI
where the admin reviews popular AI-generated plant guides and decides
which ones graduate to the permanent curated library.

Flow:
    GET  /admin/ai-searches             → list candidates (by 7d views)
    POST /admin/promote-plant           → save curated row + merge in-mem
    POST /admin/unpromote-plant         → reverse a promotion
    POST /admin/reload-promoted-plants  → re-sync in-mem from Mongo
    POST /admin/clear-plant-guide-cache → wipe a single AI guide's cache
    POST /admin/backfill-ai-plant-stats → seed stats from existing cache
"""
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Body, HTTPException

from core import (
    PLANT_INDEX, PROMOTED_PLANT_IDS, load_promoted_plants,
    merge_promoted_plant, remove_promoted_plant,
)
from eventlog import emit

from ._shared import PromotePlantPayload, require_admin


def register_curation_routes(router: APIRouter, db) -> None:
    @router.get("/admin/ai-searches")
    async def admin_ai_searches(token: str, limit: int = 50, include_promoted: bool = False):
        """List the top AI-generated plant guides by 7-day views, joined with
        the cached EN guide JSON so the admin UI can preview the content
        before promoting.

        Set `include_promoted=true` to also include already-promoted slugs
        (useful for the "Promoted" tab); otherwise they're filtered out so
        the queue stays focused on candidates.
        """
        require_admin(token)
        limit = max(1, min(int(limit or 50), 200))
        query: dict = {}
        if not include_promoted:
            query["promoted"] = {"$ne": True}
        cursor = (
            db.ai_plant_stats.find(query, {"_id": 0})
            .sort([("view_count_7d", -1), ("view_count", -1)])
            .limit(limit)
        )
        rows = await cursor.to_list(length=limit)
        items = []
        for row in rows:
            slug = row.get("slug")
            if not slug:
                continue
            guide = await db.guidance_cache.find_one(
                {"key": f"plant-guide:{slug}:en"},
                {"_id": 0, "data": 1, "created_at": 1},
            )
            data = (guide or {}).get("data") or {}
            items.append({
                "slug": slug,
                "query": row.get("query") or data.get("name") or slug,
                "view_count": int(row.get("view_count") or 0),
                "view_count_7d": int(row.get("view_count_7d") or 0),
                "last_viewed_at": row.get("last_viewed_at"),
                "first_viewed_at": row.get("first_viewed_at"),
                "promoted": bool(row.get("promoted")),
                "promoted_plant_id": row.get("promoted_plant_id"),
                "guide": data,
                "guide_cached_at": (guide or {}).get("created_at"),
            })
        return {"items": items, "count": len(items)}

    @router.post("/admin/promote-plant")
    async def admin_promote_plant(token: str, payload: PromotePlantPayload = Body(...)):
        """Promote an AI-generated plant guide into the permanent curated
        catalogue. Stores the (admin-edited) curated row in `promoted_plants`,
        merges it into the in-memory PLANTS list, flags the `ai_plant_stats`
        row as promoted, and invalidates the translated `plants:{lang}` cache
        so non-EN catalogues rebuild with the new plant included.
        """
        require_admin(token)
        plant_id = payload.id.strip().lower()
        if not plant_id:
            raise HTTPException(400, "Plant id required")
        # Guard against clobbering a hand-curated plant from plants_extra*.
        if plant_id in PLANT_INDEX and plant_id not in PROMOTED_PLANT_IDS:
            raise HTTPException(
                409,
                f"A curated plant with id '{plant_id}' already exists. "
                "Pick a different id (e.g. add a suffix).",
            )

        plant = {
            "id": plant_id,
            "name": payload.name.strip(),
            "category": payload.category,
            "difficulty": payload.difficulty,
            "sun": payload.sun,
            "water": payload.water,
            "soil": payload.soil,
            "container": bool(payload.container),
            "edible_part": payload.edible_part,
            "summary": payload.summary.strip(),
            "tags": [t.strip() for t in (payload.tags or []) if t and t.strip()],
        }
        if payload.botanical_name and payload.botanical_name.strip():
            plant["botanical_name"] = payload.botanical_name.strip()

        now = datetime.now(timezone.utc).isoformat()
        await db.promoted_plants.update_one(
            {"plant.id": plant_id},
            {
                "$set": {
                    "plant": plant,
                    "source_slug": payload.source_slug,
                    "updated_at": now,
                },
                "$setOnInsert": {"created_at": now},
            },
            upsert=True,
        )
        merge_promoted_plant(plant)

        # Flag the ai_plant_stats row so the admin UI can move it out of the
        # "candidates" queue without losing the historical view count.
        await db.ai_plant_stats.update_one(
            {"slug": payload.source_slug},
            {"$set": {"promoted": True, "promoted_plant_id": plant_id, "promoted_at": now}},
        )
        # Invalidate translated catalogues so the new plant shows up in every
        # language. Cheap — they regenerate lazily on the next /api/plants hit.
        await db.guidance_cache.delete_many({"key": {"$regex": "^plants:"}})
        emit(
            "admin.promote.ok",
            plant_id=plant_id,
            source_slug=payload.source_slug,
            name=plant["name"],
            category=plant["category"],
        )
        return {"ok": True, "plant": plant, "promoted_id": plant_id}

    @router.post("/admin/unpromote-plant")
    async def admin_unpromote_plant(token: str, plant_id: str):
        """Reverse a promotion: drop the row from `promoted_plants`, remove
        from the in-memory PLANTS list and re-open it as a candidate."""
        require_admin(token)
        plant_id = plant_id.strip().lower()
        if plant_id not in PROMOTED_PLANT_IDS:
            raise HTTPException(404, f"'{plant_id}' is not a promoted plant.")
        row = await db.promoted_plants.find_one({"plant.id": plant_id}, {"source_slug": 1})
        await db.promoted_plants.delete_one({"plant.id": plant_id})
        remove_promoted_plant(plant_id)
        if row and row.get("source_slug"):
            await db.ai_plant_stats.update_one(
                {"slug": row["source_slug"]},
                {"$set": {"promoted": False}, "$unset": {"promoted_plant_id": "", "promoted_at": ""}},
            )
        # Invalidate translated catalogues — the un-promoted plant should
        # disappear from non-EN /api/plants responses too.
        await db.guidance_cache.delete_many({"key": {"$regex": "^plants:"}})
        emit("admin.unpromote.ok", plant_id=plant_id,
             source_slug=(row or {}).get("source_slug"))
        return {"ok": True, "removed": plant_id}

    @router.post("/admin/reload-promoted-plants")
    async def admin_reload_promoted_plants(token: str):
        """Re-read all promoted plants from Mongo. Useful if you edited the
        DB directly (e.g. shell mongosh) and want the running app to pick
        up the changes without a supervisor restart."""
        require_admin(token)
        added = await load_promoted_plants(db)
        await db.guidance_cache.delete_many({"key": {"$regex": "^plants:"}})
        return {"ok": True, "promoted_plants_loaded": added}

    @router.post("/admin/clear-plant-guide-cache")
    async def admin_clear_plant_guide_cache(token: str, slug: str):
        """Drop every cached language variant of a single AI plant guide so
        the very next `/api/plant-guide` call regenerates from Claude. Used
        by the Promote-AI modal's "Regenerate" button. Returns the number
        of rows removed.

        Only operates on `ai-*` slugs — refuses to nuke curated plants by
        accident."""
        require_admin(token)
        slug = (slug or "").strip().lower()
        if not slug.startswith("ai-"):
            raise HTTPException(400, "Refusing to clear cache for non-AI slug.")
        result = await db.guidance_cache.delete_many(
            {"key": {"$regex": f"^plant-guide:{re.escape(slug)}:"}},
        )
        emit("admin.regenerate.cache_cleared", slug=slug, rows_removed=result.deleted_count)
        return {"ok": True, "removed": result.deleted_count, "slug": slug}

    @router.post("/admin/backfill-ai-plant-stats")
    async def admin_backfill_ai_plant_stats(token: str):
        """One-shot: seed `ai_plant_stats` from existing
        `guidance_cache:plant-guide:ai-*:en` rows so the Promote queue isn't
        empty for popular AI guides that were generated *before* view tracking
        was wired in. Each pre-existing guide gets a single synthetic view
        so it's surfaced for triage without being misleadingly ranked above
        genuinely popular new searches.

        Idempotent — rows that already have a `view_count` are skipped, so
        re-running won't double-seed."""
        require_admin(token)
        now = datetime.now(timezone.utc).isoformat()
        seeded = 0
        skipped = 0
        cursor = db.guidance_cache.find(
            {"key": {"$regex": "^plant-guide:ai-[^:]+:en$"}},
            {"key": 1, "data": 1, "created_at": 1},
        )
        async for row in cursor:
            key = row.get("key") or ""
            # plant-guide:ai-xxxxx:en  →  slug = ai-xxxxx
            try:
                slug = key.split(":", 2)[1]
            except IndexError:
                continue
            if not slug.startswith("ai-"):
                continue
            existing = await db.ai_plant_stats.find_one({"slug": slug}, {"_id": 1})
            if existing:
                skipped += 1
                continue
            data = row.get("data") or {}
            query = data.get("name") or slug.replace("ai-", "").replace("-", " ")
            await db.ai_plant_stats.insert_one({
                "slug": slug,
                "query": query,
                "view_count": 1,
                "view_count_7d": 1,
                "first_viewed_at": row.get("created_at") or now,
                "last_viewed_at": row.get("created_at") or now,
                "promoted": False,
                "backfilled": True,
            })
            seeded += 1
        emit("admin.backfill.ai_plant_stats", seeded=seeded, skipped=skipped)
        return {"ok": True, "seeded": seeded, "skipped": skipped}
