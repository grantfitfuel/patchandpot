"""Affiliate-click logging + aggregated stats.

Privacy-friendly: clicks are logged without IP, just vendor/region/plant tags.
Lets you see which outbound links convert before any affiliate codes are wired.
"""
import logging
import os
from datetime import datetime, timezone, timedelta
from typing import Optional

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

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

    return router
