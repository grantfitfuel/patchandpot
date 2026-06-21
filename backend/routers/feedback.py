"""User feedback on AI-generated content + admin readout."""
import logging
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

logger = logging.getLogger(__name__)


def make_router(db) -> APIRouter:
    """Factory: caller injects the Mongo `db` handle from server.py."""
    router = APIRouter()

    class FeedbackRequest(BaseModel):
        target_type: str       # "plant-guide" | "lesson" | "guidance"
        target_id: str         # e.g. "ai-okra"
        rating: str            # "up" | "down"
        comment: Optional[str] = None

    @router.get("/admin/feedback")
    async def list_feedback(token: str, target_type: Optional[str] = None, limit: int = 100):
        admin_token = os.environ.get("ADMIN_TOKEN", "")
        if not admin_token:
            raise HTTPException(503, "ADMIN_TOKEN not configured")
        if token != admin_token:
            raise HTTPException(401, "Bad token")
        query: dict = {}
        if target_type:
            query["target_type"] = target_type
        limit = max(1, min(limit, 500))
        rows = []
        cursor = db.feedback.find(query, {"_id": 0}).sort("created_at", -1).limit(limit)
        async for row in cursor:
            rows.append(row)
        counts = {"up": 0, "down": 0}
        for r in rows:
            if r.get("rating") in counts:
                counts[r["rating"]] += 1
        return {"items": rows, "counts": counts, "total": len(rows)}

    @router.post("/feedback")
    async def submit_feedback(req: FeedbackRequest):
        if req.rating not in ("up", "down"):
            raise HTTPException(400, "rating must be 'up' or 'down'")
        if req.target_type not in ("plant-guide", "lesson", "guidance"):
            raise HTTPException(400, "unknown target_type")
        doc = {
            "target_type": req.target_type,
            "target_id": req.target_id[:128],
            "rating": req.rating,
            "comment": (req.comment or "")[:500] or None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.feedback.insert_one(doc)
        return {"ok": True}

    return router
