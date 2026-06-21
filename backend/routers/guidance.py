"""Public AI gardening guidance endpoint — async with cache fast-path.

Cold AI generation can take 20-40 seconds, which routinely exceeds Cloudflare
and edge-proxy timeouts. To make this resilient:

  • Cache hit → return the cached guidance dict immediately (sync, unchanged).
  • Cache miss → kick off a background job, return {status: "pending", job_id}
    with HTTP 202 and let the client poll `/guidance/job/{job_id}`.

The polling endpoint surfaces {status, data?, error?}. The frontend wrapper in
lib/api.js hides this from callers so existing components keep their simple
`fetchGuidance(...).then(data => ...)` shape.
"""
import logging
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, HTTPException
from fastapi.responses import JSONResponse

from core import GuidanceRequest, LANG_NAMES, _guidance_cache_key
from services_guidance import make_generate_and_cache_guidance

logger = logging.getLogger(__name__)


def make_router(db) -> APIRouter:
    router = APIRouter()
    _generate_and_cache_guidance = make_generate_and_cache_guidance(db)

    async def _run_guidance_job(job_id: str, req: GuidanceRequest):
        """Background worker — generate guidance, store both the job result and
        the canonical cache row. Multiple jobs racing on the same cache_key are
        safe because the inner generator does an upsert by `key`."""
        try:
            data = await _generate_and_cache_guidance(req, force=False)
            await db.guidance_jobs.update_one(
                {"job_id": job_id},
                {"$set": {
                    "status": "done",
                    "data": data,
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
        except HTTPException as e:
            await db.guidance_jobs.update_one(
                {"job_id": job_id},
                {"$set": {
                    "status": "error",
                    "error": (e.detail if isinstance(e.detail, str) else "AI generation failed")[:300],
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }},
            )
        except Exception as e:  # noqa: BLE001
            logger.exception("guidance-gen job %s failed: %s", job_id, e)
            await db.guidance_jobs.update_one(
                {"job_id": job_id},
                {"$set": {
                    "status": "error",
                    "error": str(e)[:300] or "AI generation failed",
                    "completed_at": datetime.now(timezone.utc).isoformat(),
                }},
            )

    @router.post("/guidance")
    async def get_guidance(req: GuidanceRequest, background: BackgroundTasks):
        """Cache hit → guidance dict (sync). Cache miss → {status: pending, job_id} 202."""
        language = (req.language or "en").lower()
        if language not in LANG_NAMES:
            language = "en"

        # Same key the generator would write to — peek synchronously first so
        # cache hits stay instant.
        garden = [(p or "").strip() for p in (req.my_garden or []) if (p or "").strip()]
        garden = sorted({p.lower(): p for p in garden}.values())
        garden_key = "garden:" + ",".join(p.lower() for p in garden) if garden else ""
        cache_key = _guidance_cache_key(req.region, req.month, language, garden_key)

        cached = await db.guidance_cache.find_one({"key": cache_key}, {"_id": 0})
        if cached:
            return cached["data"]

        # Cache miss — schedule a background job and tell the client to poll.
        job_id = uuid.uuid4().hex
        await db.guidance_jobs.insert_one({
            "job_id": job_id,
            "cache_key": cache_key,
            "status": "pending",
            "month": req.month,
            "language": language,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        background.add_task(_run_guidance_job, job_id, req)
        return JSONResponse(
            status_code=202,
            content={"status": "pending", "job_id": job_id, "kind": "guidance-job"},
        )

    @router.get("/guidance/job/{job_id}")
    async def poll_guidance_job(job_id: str):
        """Poll a guidance generation job. Returns {status, data?, error?}."""
        job = await db.guidance_jobs.find_one({"job_id": job_id}, {"_id": 0})
        if not job:
            raise HTTPException(404, "Job not found")
        status = job.get("status", "pending")
        if status == "done":
            return {"status": "done", "data": job.get("data")}
        if status == "error":
            return {"status": "error", "error": job.get("error") or "AI generation failed"}
        return {"status": "pending"}

    return router
