"""Admin/maintenance endpoints — all token-gated.

Includes:
- `/admin/refresh-guidance` — manually trigger the monthly AI guidance refresh
- `/admin/cron-status`      — inspect the last cron run output
- `/admin/seed-deep-dives`  — idempotently re-seed staff masterclasses
- `/admin/prewarm`          — generate every flower-card image not already cached
"""
import logging
import os
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Body, HTTPException
from pydantic import BaseModel, Field

from cache_refresh import get_cron_status, refresh_monthly_guidance
from core import (
    FLOWER_PORTRAITS, PLANT_INDEX, PROMOTED_PLANT_IDS, Region,
    load_promoted_plants, make_cached_image, merge_promoted_plant,
    remove_promoted_plant,
)
from seed_deep_dives import seed_deep_dives
from services_guidance import make_generate_and_cache_guidance

logger = logging.getLogger(__name__)


class PromotePlantPayload(BaseModel):
    """Curated-plant fields the admin can edit in the promote modal before
    saving. `id` defaults to the AI slug stripped of its `ai-` prefix so
    the URL stays clean (e.g. `ai-yarrow` → `yarrow`). `source_slug` is the
    original AI slug — we keep it on the row for traceability + to flag the
    matching `ai_plant_stats` row as promoted."""
    id: str = Field(..., min_length=2, max_length=80)
    source_slug: str = Field(..., min_length=2, max_length=120)
    name: str = Field(..., min_length=1, max_length=120)
    botanical_name: str = ""
    category: str = "Other"
    difficulty: str = "Medium"
    sun: str = "Full to partial"
    water: str = "Moderate"
    soil: str = "Well-drained"
    edible_part: str = "Ornamental"
    summary: str = ""
    container: bool = True
    tags: list[str] = []


def _require_admin(token: str):
    admin_token = os.environ.get("ADMIN_TOKEN", "")
    if not admin_token:
        raise HTTPException(503, "ADMIN_TOKEN not configured")
    if token != admin_token:
        raise HTTPException(403, "Invalid token")


def make_router(db) -> APIRouter:
    router = APIRouter()
    _cached_image = make_cached_image(db)
    _generate_and_cache_guidance = make_generate_and_cache_guidance(db)

    @router.post("/admin/refresh-guidance")
    async def admin_refresh_guidance(token: str):
        """Manually trigger the monthly cache refresh. Requires ADMIN_TOKEN."""
        _require_admin(token)
        return await refresh_monthly_guidance(db, _generate_and_cache_guidance, Region)

    @router.get("/admin/cron-status")
    async def admin_cron_status(token: str):
        """Inspect the last-run output of the monthly refresh."""
        _require_admin(token)
        return await get_cron_status(db)

    @router.post("/admin/seed-deep-dives")
    async def admin_seed_deep_dives(token: str, overwrite: bool = False):
        """Manually (re-)seed the 6 staff-authored deep-dive masterclasses."""
        _require_admin(token)
        return await seed_deep_dives(db, overwrite=overwrite)

    @router.post("/admin/prune")
    async def admin_prune(token: str):
        """Manually trigger the stale-row pruner. Same logic the monthly cron runs."""
        from cache_refresh import _prune_stale
        _require_admin(token)
        return await _prune_stale(db)

    @router.post("/admin/prewarm")
    async def prewarm_image_cache():
        """One-shot endpoint: generate every flower-card image that isn't already cached."""
        generated, skipped, failed = 0, 0, []
        for slug, subject in FLOWER_PORTRAITS.items():
            key = f"masterclass-card:{slug}"
            existing = await db.image_cache.find_one({"key": key}, {"_id": 1})
            if existing:
                skipped += 1
                continue
            try:
                await _cached_image(
                    key=key,
                    prompt=f"A beautiful photograph of {subject}. natural daylight, soft focus, "
                           f"terracotta and cream palette, botanical editorial magazine style, "
                           f"shallow depth of field, no text, no people, no logos.",
                    session=f"prewarm-{slug}-{uuid.uuid4()}",
                )
                generated += 1
            except Exception as e:
                logger.warning("prewarm failed for %s: %s", slug, e)
                failed.append(slug)
        return {"generated": generated, "skipped_cached": skipped, "failed": failed,
                "total": len(FLOWER_PORTRAITS)}

    @router.get("/admin/ai-usage")
    async def admin_ai_usage(token: str, days: int = 30):
        """Estimate AI spend over the last `days`. We don't bill per token here —
        instead we count rows in each cache and apply rough cost factors per row
        (Sonnet base = 1 unit, Haiku translation = 0.25 unit, image = 0.15 unit).
        Use it as a relative budget signal, not a literal pound figure."""
        from datetime import datetime, timedelta, timezone
        from core import refresh_ai_budget_state, AI_MONTHLY_BUDGET_GBP

        _require_admin(token)
        days = max(1, min(int(days), 365))
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

        # Rough cost factors — proportional units, not currency.
        WEIGHT_SONNET = 1.0      # full guidance / plant-guide EN generation
        WEIGHT_HAIKU = 0.25      # ~4× cheaper per call
        WEIGHT_IMAGE = 0.15      # Nano Banana per image

        # `guidance-base` rows with language='en' are the expensive Sonnet calls.
        sonnet_base = await db.guidance_cache.count_documents({
            "kind": "guidance-base", "language": "en", "created_at": {"$gte": since},
        })
        # Non-EN `guidance-base` rows are Haiku translations.
        haiku_base_trans = await db.guidance_cache.count_documents({
            "kind": "guidance-base", "language": {"$ne": "en"}, "created_at": {"$gte": since},
        })
        # `guidance` rows with garden = small Haiku personalisation call.
        garden_personalised = await db.guidance_cache.count_documents({
            "kind": "guidance",
            "my_garden": {"$exists": True, "$not": {"$size": 0}},
            "created_at": {"$gte": since},
        })
        # Plant-guide AI rows: EN are Sonnet, others are Haiku translations.
        plant_guide_total = await db.guidance_cache.count_documents({
            "key": {"$regex": "^plant-guide:ai-"}, "created_at": {"$gte": since},
        })
        plant_guide_en = await db.guidance_cache.count_documents({
            "key": {"$regex": "^plant-guide:ai-.*:en$"}, "created_at": {"$gte": since},
        })
        plant_guide_other = plant_guide_total - plant_guide_en
        # Arrangement suggestions — Sonnet.
        arrangements = await db.arrangement_cache.count_documents({"created_at": {"$gte": since}})
        # Masterclasses — Sonnet (single big call each).
        masterclasses = await db.generated_masterclasses.count_documents({"created_at": {"$gte": since}})
        # Images — Nano Banana.
        images = await db.image_cache.count_documents({"created_at": {"$gte": since}})

        # Today's `/plant-guide` rate-limit usage — surfaces to the admin so
        # they can spot a viral day before the next 503 hits.
        from datetime import datetime as _dt, timezone as _tz
        today_key = _dt.now(_tz.utc).strftime("%Y-%m-%d")
        guide_today = await db.ai_plant_gen_log.count_documents({"day": today_key})
        guide_daily_limit = int(os.environ.get("AI_PLANT_GUIDE_DAILY_LIMIT", "25") or 25)

        sonnet_calls = sonnet_base + plant_guide_en + arrangements + masterclasses
        haiku_calls = haiku_base_trans + garden_personalised + plant_guide_other
        units = round(
            sonnet_calls * WEIGHT_SONNET
            + haiku_calls * WEIGHT_HAIKU
            + images * WEIGHT_IMAGE,
            1,
        )

        # Side-effect: refresh the budget circuit-breaker state from the same
        # data we just counted. Means hitting this endpoint also keeps the
        # cap accurate for any in-flight LLM calls.
        budget_state = await refresh_ai_budget_state(db)

        return {
            "window_days": days,
            "since": since,
            "calls": {
                "sonnet": {
                    "guidance_base_en": sonnet_base,
                    "plant_guide_en": plant_guide_en,
                    "arrangements": arrangements,
                    "masterclasses": masterclasses,
                    "total": sonnet_calls,
                },
                "haiku": {
                    "guidance_base_translations": haiku_base_trans,
                    "garden_personalisations": garden_personalised,
                    "plant_guide_translations": plant_guide_other,
                    "total": haiku_calls,
                },
                "images": images,
            },
            "relative_cost_units": units,
            "weights": {"sonnet": WEIGHT_SONNET, "haiku": WEIGHT_HAIKU, "image": WEIGHT_IMAGE},
            "budget": {
                "monthly_cap_gbp": AI_MONTHLY_BUDGET_GBP,
                "estimated_30d_gbp": budget_state.get("estimated_gbp"),
                "over_budget": budget_state.get("over_budget"),
                "enabled": AI_MONTHLY_BUDGET_GBP > 0,
            },
            "plant_guide_daily": {
                "used_today": guide_today,
                "limit": guide_daily_limit,
                "remaining": max(0, guide_daily_limit - guide_today),
                "day_key_utc": today_key,
            },
            "note": (
                "Units are proportional, not currency. Sonnet ≈ 4× Haiku per call. "
                "When `over_budget` is true, all new AI generation returns 503; "
                "cache hits still serve normally."
            ),
        }

    @router.get("/admin/referrals")
    async def admin_referrals(token: str, days: int = 30):
        """Aggregate paid checkouts by `ref` attribution token over the last
        `days`. Drives the /admin/referrals dashboard so you can see which
        embed/blog actually converted, not just which one drove pageviews."""
        from datetime import datetime, timedelta, timezone

        _require_admin(token)
        days = max(1, min(int(days), 365))
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

        # Pull paid txns in the window. We aggregate in Python (volumes are
        # tiny — at most a few thousand rows) so the shape is easy to evolve.
        cursor = db.payment_transactions.find(
            {
                "created_at": {"$gte": since},
                "payment_status": "paid",
                "access_granted": True,
            },
            {"_id": 0, "ref": 1, "amount": 1, "currency": 1, "package_id": 1, "created_at": 1},
        )
        rows = await cursor.to_list(length=5000)

        buckets = {}
        total_revenue = 0.0
        for r in rows:
            ref = (r.get("ref") or "").strip() or "(direct)"
            amount = float(r.get("amount") or 0)
            total_revenue += amount
            b = buckets.setdefault(ref, {
                "ref": ref,
                "purchases": 0,
                "revenue_gbp": 0.0,
                "by_package": {},
                "last_purchase_at": None,
            })
            b["purchases"] += 1
            b["revenue_gbp"] = round(b["revenue_gbp"] + amount, 2)
            pkg = r.get("package_id") or "unknown"
            b["by_package"][pkg] = b["by_package"].get(pkg, 0) + 1
            created = r.get("created_at")
            if created and (not b["last_purchase_at"] or created > b["last_purchase_at"]):
                b["last_purchase_at"] = created

        # Sort by revenue descending — most valuable sources surface first.
        ranked = sorted(buckets.values(), key=lambda x: (-x["revenue_gbp"], -x["purchases"]))

        return {
            "window_days": days,
            "since": since,
            "total_purchases": len(rows),
            "total_revenue_gbp": round(total_revenue, 2),
            "sources": ranked,
        }

    @router.get("/admin/ai-searches")
    async def admin_ai_searches(token: str, limit: int = 50, include_promoted: bool = False):
        """List the top AI-generated plant guides by 7-day views, joined with
        the cached EN guide JSON so the admin UI can preview the content
        before promoting. Powers `/admin/ai-searches`.

        Set `include_promoted=true` to also include already-promoted slugs
        (useful for the "Promoted" tab); otherwise they're filtered out so
        the queue stays focused on candidates.
        """
        _require_admin(token)
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
                "guide": data,  # full EN guide JSON for the review modal
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
        _require_admin(token)
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
        return {"ok": True, "plant": plant, "promoted_id": plant_id}

    @router.post("/admin/unpromote-plant")
    async def admin_unpromote_plant(token: str, plant_id: str):
        """Reverse a promotion: drop the row from `promoted_plants`, remove
        from the in-memory PLANTS list and re-open it as a candidate."""
        _require_admin(token)
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
        return {"ok": True, "removed": plant_id}

    @router.post("/admin/reload-promoted-plants")
    async def admin_reload_promoted_plants(token: str):
        """Re-read all promoted plants from Mongo. Useful if you edited the
        DB directly (e.g. shell mongosh) and want the running app to pick
        up the changes without a supervisor restart."""
        _require_admin(token)
        added = await load_promoted_plants(db)
        await db.guidance_cache.delete_many({"key": {"$regex": "^plants:"}})
        return {"ok": True, "promoted_plants_loaded": added}

    @router.post("/admin/clear-plant-guide-cache")
    async def admin_clear_plant_guide_cache(token: str, slug: str):
        """Drop every cached language variant of a single AI plant guide so
        the very next `/api/plant-guide` call regenerates from Claude. Used
        by the Promote-AI modal's "Regenerate" button when the admin isn't
        happy with the stored draft. Returns the number of rows removed.

        Only operates on `ai-*` slugs — refuses to nuke curated plants by
        accident."""
        _require_admin(token)
        slug = (slug or "").strip().lower()
        if not slug.startswith("ai-"):
            raise HTTPException(400, "Refusing to clear cache for non-AI slug.")
        result = await db.guidance_cache.delete_many(
            {"key": {"$regex": f"^plant-guide:{re.escape(slug)}:"}},
        )
        return {"ok": True, "removed": result.deleted_count, "slug": slug}

    @router.post("/admin/backfill-ai-plant-stats")
    async def admin_backfill_ai_plant_stats(token: str):
        """One-shot: seed `ai_plant_stats` from existing
        `guidance_cache:plant-guide:ai-*:en` rows so the Promote queue isn't
        empty for popular AI guides that were generated *before* view tracking
        was wired in (iteration 51). Each pre-existing guide gets a single
        synthetic view so it's surfaced for triage without being misleadingly
        ranked above genuinely popular new searches.

        Idempotent — rows that already have a `view_count` are skipped, so
        re-running won't double-seed."""
        _require_admin(token)
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
                "backfilled": True,  # so the admin can tell synthetic rows apart
            })
            seeded += 1
        return {"ok": True, "seeded": seeded, "skipped": skipped}

    @router.get("/admin/profit-margin")
    async def admin_profit_margin(token: str, days: int = 30):
        """Net-margin summary over the last `days`. Combines four data sources:

          1. Gross Stripe revenue (paid + access_granted txns in window).
          2. Stripe fees (estimated — Stripe doesn't expose actual fees via
             the Checkout Session API). Defaults to UK Standard pricing:
             1.5% + £0.20 per successful charge. Tweak via env vars
             STRIPE_FEE_PCT / STRIPE_FEE_FLAT_GBP if the user has a
             non-default Stripe plan.
          3. Affiliate earnings logged in `affiliate_earnings` whose
             `period_end` falls in the window. (We use period_end so a payout
             logged for "Jan" doesn't artificially boost "Feb" net.)
          4. Estimated AI spend from `guidance_cache` + `image_cache` row
             counts using the same per-row weights `refresh_ai_budget_state`
             uses (Sonnet £0.03, Haiku £0.008, image £0.03).

        Multi-currency note: every figure is normalised to GBP. Stripe txns
        report amount in pence so we divide; affiliate earnings rows are
        flagged with their own currency but we treat USD/EUR ≈ GBP at a
        flat 1:1 because the volumes are tiny — adding live FX would be
        overkill. Numbers are guidance, not accounting.
        """
        from datetime import datetime, timedelta, timezone
        from core import AI_COST_SONNET_GBP, AI_COST_HAIKU_GBP, AI_COST_IMAGE_GBP

        _require_admin(token)
        days = max(1, min(int(days), 365))
        since = (datetime.now(timezone.utc) - timedelta(days=days)).isoformat()

        # Stripe fees default to UK Standard pricing.
        fee_pct = float(os.environ.get("STRIPE_FEE_PCT", "0.015") or 0.015)
        fee_flat = float(os.environ.get("STRIPE_FEE_FLAT_GBP", "0.20") or 0.20)

        # 1. Gross Stripe revenue. We use the SAME query as the referrals
        #    endpoint so the two dashboards never disagree.
        cursor = db.payment_transactions.find(
            {
                "created_at": {"$gte": since},
                "payment_status": "paid",
                "access_granted": True,
            },
            {"_id": 0, "amount": 1, "package_id": 1, "currency": 1},
        )
        txns = await cursor.to_list(length=10000)
        gross_stripe = round(sum(float(r.get("amount") or 0) for r in txns), 2)
        # Tip-jar revenue is part of gross — it's still real money. We
        # report it as a separate line so the admin can see how much of
        # gross came from "thank-you" payments vs paid access grants.
        tip_revenue = round(
            sum(
                float(r.get("amount") or 0)
                for r in txns if r.get("package_id") == "tip"
            ),
            2,
        )
        # 2. Stripe fees: 1.5% + 20p per successful charge.
        stripe_fees = round(gross_stripe * fee_pct + fee_flat * len(txns), 2)

        # 3. Affiliate earnings whose `period_end` falls in the window.
        since_date = since[:10]  # YYYY-MM-DD
        aff_cursor = db.affiliate_earnings.find(
            {"period_end": {"$gte": since_date}},
            {"_id": 0, "amount": 1, "currency": 1},
        )
        aff_rows = await aff_cursor.to_list(length=5000)
        affiliate_earnings = round(sum(float(r.get("amount") or 0) for r in aff_rows), 2)

        # 4. AI spend — same per-row weights as the budget circuit breaker.
        sonnet_base = await db.guidance_cache.count_documents({
            "kind": "guidance-base", "language": "en", "created_at": {"$gte": since},
        })
        haiku_base = await db.guidance_cache.count_documents({
            "kind": "guidance-base", "language": {"$ne": "en"}, "created_at": {"$gte": since},
        })
        haiku_garden = await db.guidance_cache.count_documents({
            "kind": "guidance",
            "my_garden": {"$exists": True, "$not": {"$size": 0}},
            "created_at": {"$gte": since},
        })
        pg_total = await db.guidance_cache.count_documents({
            "key": {"$regex": "^plant-guide:ai-"}, "created_at": {"$gte": since},
        })
        pg_en = await db.guidance_cache.count_documents({
            "key": {"$regex": "^plant-guide:ai-.*:en$"}, "created_at": {"$gte": since},
        })
        arrangements = await db.arrangement_cache.count_documents({"created_at": {"$gte": since}})
        masterclasses = await db.generated_masterclasses.count_documents({"created_at": {"$gte": since}})
        images = await db.image_cache.count_documents({"created_at": {"$gte": since}})

        sonnet_total = sonnet_base + pg_en + arrangements + masterclasses
        haiku_total = haiku_base + haiku_garden + (pg_total - pg_en)
        ai_spend = round(
            sonnet_total * AI_COST_SONNET_GBP
            + haiku_total * AI_COST_HAIKU_GBP
            + images * AI_COST_IMAGE_GBP,
            2,
        )

        net_profit = round(gross_stripe + affiliate_earnings - stripe_fees - ai_spend, 2)
        gross_total = round(gross_stripe + affiliate_earnings, 2)
        margin_pct = round((net_profit / gross_total * 100), 1) if gross_total > 0 else None

        return {
            "window_days": days,
            "since": since,
            "stripe": {
                "gross_gbp": gross_stripe,
                "fees_gbp": stripe_fees,
                "transaction_count": len(txns),
                "tip_gbp": tip_revenue,
                "fee_pct": fee_pct,
                "fee_flat_gbp": fee_flat,
            },
            "affiliate_earnings_gbp": affiliate_earnings,
            "ai_spend_gbp": ai_spend,
            "ai_calls": {
                "sonnet": sonnet_total,
                "haiku": haiku_total,
                "images": images,
            },
            "gross_total_gbp": gross_total,
            "net_profit_gbp": net_profit,
            "margin_pct": margin_pct,
            "note": (
                "Stripe fees estimated from UK Standard pricing — set "
                "STRIPE_FEE_PCT / STRIPE_FEE_FLAT_GBP env vars to override. "
                "Affiliate earnings rolled up by period_end date. "
                "AI spend extrapolated from cache-row counts × per-row weights."
            ),
        }

    return router
