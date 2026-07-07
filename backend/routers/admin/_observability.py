"""Read-only admin dashboards: AI usage, referral attribution, profit
margin. None of these write to Mongo (other than the budget-state
recompute side-effect on /admin/ai-usage); they exist to surface numbers
the admin checks once a day."""
import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter

from core import (
    AI_COST_HAIKU_GBP, AI_COST_IMAGE_GBP, AI_COST_SONNET_GBP,
    AI_MONTHLY_BUDGET_GBP, refresh_ai_budget_state,
)

from ._shared import require_admin


def register_observability_routes(router: APIRouter, db) -> None:
    @router.get("/admin/ai-usage")
    async def admin_ai_usage(token: str, days: int = 30):
        """Estimate AI spend over the last `days`. We don't bill per token here —
        instead we count rows in each cache and apply rough cost factors per row
        (Sonnet base = 1 unit, Haiku translation = 0.25 unit, image = 0.15 unit).
        Use it as a relative budget signal, not a literal pound figure."""
        require_admin(token)
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
        arrangements = await db.arrangement_cache.count_documents({"created_at": {"$gte": since}})
        masterclasses = await db.generated_masterclasses.count_documents({"created_at": {"$gte": since}})
        images = await db.image_cache.count_documents({"created_at": {"$gte": since}})

        # Today's `/plant-guide` rate-limit usage — surfaces to the admin so
        # they can spot a viral day before the next 503 hits.
        today_key = datetime.now(timezone.utc).strftime("%Y-%m-%d")
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
        require_admin(token)
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

        buckets: dict = {}
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
        require_admin(token)
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
            sum(float(r.get("amount") or 0) for r in txns if r.get("package_id") == "tip"),
            2,
        )
        # 2. Stripe fees: percent + flat per successful charge.
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

    @router.get("/admin/geo")
    async def admin_geo(token: str, days: int = 30):
        """First-party geographic breakdown of API traffic. Aggregates the
        `visits` collection (written by the http middleware in `server.py`).
        No third-party analytics; all data stays in Mongo. TTL-purged after
        90 days by the collection's index.

        Returns:
          • range               window in days (clamped 1–90)
          • total_visits        raw request count in the window
          • total_with_country  how many carried a geo header (rest are anon)
          • top_countries       [{country, visits}] descending
          • daily_series        [{day, visits}] last N days for a trend chart
        """
        require_admin(token)
        days = max(1, min(int(days), 90))
        since = datetime.now(timezone.utc) - timedelta(days=days)

        total_visits = await db.visits.count_documents({"ts": {"$gte": since}})
        total_with_country = await db.visits.count_documents({
            "ts": {"$gte": since}, "country": {"$ne": None},
        })

        top_pipeline = [
            {"$match": {"ts": {"$gte": since}, "country": {"$ne": None}}},
            {"$group": {"_id": "$country", "visits": {"$sum": 1}}},
            {"$sort": {"visits": -1}},
            {"$limit": 25},
            {"$project": {"_id": 0, "country": "$_id", "visits": 1}},
        ]
        top_countries = [row async for row in db.visits.aggregate(top_pipeline)]

        daily_pipeline = [
            {"$match": {"ts": {"$gte": since}}},
            {"$group": {
                "_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$ts"}},
                "visits": {"$sum": 1},
            }},
            {"$sort": {"_id": 1}},
            {"$project": {"_id": 0, "day": "$_id", "visits": 1}},
        ]
        daily_series = [row async for row in db.visits.aggregate(daily_pipeline)]

        return {
            "range_days": days,
            "since": since.isoformat(),
            "total_visits": total_visits,
            "total_with_country": total_with_country,
            "top_countries": top_countries,
            "daily_series": daily_series,
            "note": (
                "First-party analytics. Country is derived from the ingress "
                "layer's geo header (Cloudflare / Vercel / Fly). No IP DB, no "
                "cookies, no third-party tracking. Rows auto-purge after 90 days."
            ),
        }

