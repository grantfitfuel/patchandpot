"""Affiliate-click logging + aggregated stats + manual earnings ledger.

Privacy-friendly: clicks are logged without IP, just vendor/region/plant tags.
Lets you see which outbound links convert before any affiliate codes are wired.

Earnings are entered manually (Amazon Associates / Awin / Sovrn don't expose
realtime APIs without per-network credentials we don't store). The dashboard
combines clicks + earnings to compute EPC per network.
"""
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


def make_router(db) -> APIRouter:
    router = APIRouter()

    class AffiliateClick(BaseModel):
        vendor_id: str
        vendor_name: Optional[str] = None
        plant_name: Optional[str] = None
        country: Optional[str] = None
        language: Optional[str] = None
        slot: Optional[str] = None  # "seeds" | "pots" | "tools"

    class EarningsEntry(BaseModel):
        # Network code: "amazon-uk", "amazon-us", "sovrn", "awin-crocus", etc.
        network: str = Field(..., min_length=1, max_length=64)
        amount: float = Field(..., ge=0)
        currency: str = Field("GBP", min_length=3, max_length=3)
        period_start: str  # ISO date e.g. "2026-02-01"
        period_end: str    # ISO date e.g. "2026-02-28"
        note: Optional[str] = Field(None, max_length=200)

    @router.post("/affiliate/click")
    async def affiliate_click(click: AffiliateClick):
        """Fire-and-forget log of an outbound vendor click. Returns 204
        so navigator.sendBeacon is happy."""
        doc = {**click.dict(), "ts": datetime.now(timezone.utc).isoformat()}
        try:
            await db.affiliate_clicks.insert_one(doc)
        except Exception as e:  # noqa: BLE001 — never let logging fail the click
            logger.warning("affiliate_click insert failed: %s", e)
        return Response(status_code=204)

    @router.get("/affiliate/stats")
    async def affiliate_stats(days: int = 30, token: Optional[str] = None):
        admin_token = os.environ.get("ADMIN_TOKEN")
        if admin_token and token != admin_token:
            raise HTTPException(status_code=401, detail="invalid token")

        since = (datetime.now(timezone.utc) - timedelta(days=max(1, int(days)))).isoformat()
        base_match = {"$match": {"ts": {"$gte": since}}}

        async def top_by(field: str, limit: int = 10):
            cursor = db.affiliate_clicks.aggregate([
                base_match,
                {"$group": {"_id": f"${field}", "count": {"$sum": 1}}},
                {"$sort": {"count": -1}},
                {"$limit": limit},
            ])
            return [{"key": doc["_id"] or "(unknown)", "count": doc["count"]} async for doc in cursor]

        total = await db.affiliate_clicks.count_documents({"ts": {"$gte": since}})
        return {
            "since": since, "days": days, "total_clicks": total,
            "top_vendors": await top_by("vendor_id"),
            "top_countries": await top_by("country"),
            "top_plants": await top_by("plant_name"),
            "top_languages": await top_by("language"),
            "top_slots": await top_by("slot"),
        }

    def _check_admin(token: Optional[str]):
        admin_token = os.environ.get("ADMIN_TOKEN")
        if admin_token and token != admin_token:
            raise HTTPException(status_code=401, detail="invalid token")

    @router.post("/affiliate/earnings")
    async def record_earnings(entry: EarningsEntry, token: Optional[str] = None):
        """Manually log a payout received from an affiliate network."""
        _check_admin(token)
        doc = {**entry.dict(), "logged_at": datetime.now(timezone.utc).isoformat()}
        result = await db.affiliate_earnings.insert_one(doc)
        return {"id": str(result.inserted_id), "ok": True}

    @router.delete("/affiliate/earnings/{entry_id}")
    async def delete_earnings(entry_id: str, token: Optional[str] = None):
        """Remove a mis-entered payout row."""
        _check_admin(token)
        from bson import ObjectId
        try:
            oid = ObjectId(entry_id)
        except Exception:
            raise HTTPException(status_code=400, detail="invalid id")
        result = await db.affiliate_earnings.delete_one({"_id": oid})
        return {"deleted": result.deleted_count}

    @router.get("/affiliate/revenue")
    async def affiliate_revenue(days: int = 90, token: Optional[str] = None):
        """Combined dashboard data: clicks + earnings + per-network EPC.

        Returns a snapshot for the last `days` days plus the full earnings
        ledger so the dashboard can render history rows.
        """
        _check_admin(token)

        since = (datetime.now(timezone.utc) - timedelta(days=max(1, int(days)))).isoformat()

        # Click counts grouped by vendor_id (last `days` days)
        cursor = db.affiliate_clicks.aggregate([
            {"$match": {"ts": {"$gte": since}}},
            {"$group": {"_id": "$vendor_id", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
        ])
        clicks_by_vendor = {doc["_id"] or "(unknown)": doc["count"] async for doc in cursor}

        # Earnings ledger — all rows, most recent first.
        ledger_cursor = db.affiliate_earnings.find({}).sort("period_end", -1)
        ledger = []
        earnings_by_network: dict = {}
        async for row in ledger_cursor:
            ledger.append({
                "id": str(row.get("_id")),
                "network": row.get("network"),
                "amount": row.get("amount"),
                "currency": row.get("currency"),
                "period_start": row.get("period_start"),
                "period_end": row.get("period_end"),
                "note": row.get("note"),
                "logged_at": row.get("logged_at"),
            })
            key = row.get("network") or "(unknown)"
            earnings_by_network[key] = earnings_by_network.get(key, 0) + (row.get("amount") or 0)

        # Per-network rollup: clicks + earnings + EPC.
        # Routing matches the Sovrn exclude config in index.html — only
        # amazon-uk and amazon-us are direct (full 100% commission).
        # Every other outbound click (all other Amazon storefronts +
        # every non-Amazon retailer) is auto-monetised by the Sovrn JS
        # snippet at ~75% commission.
        def to_network(vendor_id: str) -> str:
            if vendor_id == "amazon-uk":
                return "amazon-uk"
            if vendor_id == "amazon-us":
                return "amazon-us"
            return "sovrn"

        clicks_by_network: dict = {}
        for vendor_id, count in clicks_by_vendor.items():
            net = to_network(vendor_id)
            clicks_by_network[net] = clicks_by_network.get(net, 0) + count

        all_networks = sorted(set(clicks_by_network) | set(earnings_by_network))
        rollup = []
        for net in all_networks:
            clicks = clicks_by_network.get(net, 0)
            earnings = earnings_by_network.get(net, 0)
            epc = (earnings / clicks) if clicks else 0
            rollup.append({
                "network": net,
                "clicks": clicks,
                "earnings": round(earnings, 2),
                "epc": round(epc, 4),
            })

        return {
            "since": since,
            "days": days,
            "clicks_by_vendor": clicks_by_vendor,
            "rollup": rollup,
            "ledger": ledger,
        }

    return router
