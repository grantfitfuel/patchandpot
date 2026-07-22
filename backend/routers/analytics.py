"""First-party analytics events.

Public route for conversion measurement:
  POST /api/track/event → append to `analytics_events` in Mongo. Never
    fails hard; a rejected write is silently dropped so a broken tracker
    never breaks a page navigation.

The sitemap is served by `routers/seo.py`; this file is intentionally
tracker-only.
"""
from __future__ import annotations

from datetime import datetime, timezone
from fastapi import APIRouter, Request
from pydantic import BaseModel


router = APIRouter()


class TrackPayload(BaseModel):
    event: str
    params: dict = {}
    sid: str = ""
    path: str = ""


def register_analytics_routes(app, db) -> None:
    """Attach /api/track/event to the FastAPI app.

    Split into a function so the endpoint can close over the shared `db`
    client without having to reach into globals.
    """

    @router.post("/track/event")
    async def track_event(body: TrackPayload, request: Request) -> dict:
        """First-party analytics beacon. Best-effort — never fail hard."""
        try:
            ip = request.headers.get("x-forwarded-for", "").split(",")[0].strip() \
                or (request.client.host if request.client else "")
            row = {
                "event": (body.event or "unknown")[:64],
                "params": body.params or {},
                "sid": (body.sid or "")[:64],
                "path": (body.path or "")[:256],
                # Hash the IP so we can dedupe visitors without storing PII.
                "ip_hash": (hash(ip) & 0xFFFFFFFF) if ip else 0,
                "ua": (request.headers.get("user-agent") or "")[:256],
                "ref": (request.headers.get("referer") or "")[:256],
                "at": datetime.now(timezone.utc),
            }
            await db.analytics_events.insert_one(row)
        except Exception:  # noqa: BLE001
            return {"ok": False}
        return {"ok": True}

    app.include_router(router, prefix="/api")
