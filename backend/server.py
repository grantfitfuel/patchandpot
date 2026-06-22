"""Patch & Pot — FastAPI app assembly.

This file is intentionally thin. All endpoint logic lives in `/routers/*`,
shared models / helpers / data in `core.py`, and the guidance generation
pipeline in `services_guidance.py`. The 2,500+ line god-file is gone.

Wiring order:
  1. Build Mongo client + db handle.
  2. Build the public APIRouter with `/api` prefix.
  3. Include every per-feature router (each one is `make_router(db)`).
  4. Wire monthly cron + startup seeding.
"""
import logging
import os
import traceback
from collections import deque
from datetime import datetime, timezone
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, Request
from fastapi.responses import JSONResponse
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.middleware.cors import CORSMiddleware

from cache_refresh import schedule_monthly_refresh
from core import Region, refresh_ai_budget_state
from seed_deep_dives import seed_deep_dives
from sentry_init import init_sentry
from services_guidance import make_generate_and_cache_guidance

from routers import (
    admin as admin_router,
    affiliate as affiliate_router,
    arrangement as arrangement_router,
    checkout as checkout_router,
    feedback as feedback_router,
    guidance as guidance_router,
    images as images_router,
    lesson as lesson_router,
    masterclass as masterclass_router,
    patrons as patrons_router,
    pdf as pdf_router,
    plants as plants_router,
    regions as regions_router,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Initialise Sentry as early as possible — silently no-op if SENTRY_DSN is
# unset, so the app keeps running until the user pastes a real DSN.
init_sentry()

# ───────────────────────── Mongo ─────────────────────────
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

# ───────────────────────── FastAPI app ─────────────────────────
app = FastAPI(title="Patch & Pot API")
api_router = APIRouter(prefix="/api")


@api_router.get("/")
async def root():
    return {"app": "Patch & Pot", "status": "ok"}


# Mount the in-file root endpoint under /api…
app.include_router(api_router)

# …then mount every per-feature router under the same /api prefix.
app.include_router(regions_router.router, prefix="/api")
app.include_router(feedback_router.make_router(db), prefix="/api")
app.include_router(affiliate_router.make_router(db), prefix="/api")
app.include_router(checkout_router.make_router(db), prefix="/api")
app.include_router(plants_router.make_router(db), prefix="/api")
app.include_router(guidance_router.make_router(db), prefix="/api")
app.include_router(arrangement_router.make_router(db), prefix="/api")
app.include_router(pdf_router.make_router(db), prefix="/api")
app.include_router(masterclass_router.make_router(db), prefix="/api")
app.include_router(images_router.make_router(db), prefix="/api")
app.include_router(lesson_router.make_router(db), prefix="/api")
app.include_router(admin_router.make_router(db), prefix="/api")
app.include_router(patrons_router.make_router(db))

# ───────────────────────── Middleware ─────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────── Recent-errors ring buffer ───────────────────
# Captures the last 50 unhandled backend exceptions so the admin can curl
# /api/admin/recent-errors from anywhere (their phone, a screenshot) and
# see exactly what failed on a request — without needing log access.
# Lives in-process; lost on restart, which is fine for ad-hoc debugging.
RECENT_ERRORS = deque(maxlen=50)


@app.exception_handler(Exception)
async def _capture_unhandled(request: Request, exc: Exception):
    """Catch anything our route-level try/except missed (CORS edge cases,
    Pydantic surprises, dependency failures) and record the full type +
    traceback + request context for later inspection."""
    entry = {
        "at": datetime.now(timezone.utc).isoformat(),
        "method": request.method,
        "path": str(request.url.path),
        "type": type(exc).__name__,
        "message": str(exc)[:500],
        "ua": request.headers.get("user-agent", "")[:200],
        "origin": request.headers.get("origin", ""),
        "traceback": traceback.format_exc()[-2000:],  # tail to keep payload small
    }
    RECENT_ERRORS.appendleft(entry)
    logger.exception("Unhandled %s on %s %s", entry["type"], request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"Server error: {entry['type']}",
            "type": entry["type"],
        },
    )


@app.get("/api/admin/recent-errors")
async def recent_errors(token: str, limit: int = 20):
    """Token-gated curl-friendly view of the most recent unhandled errors.
    Curl from anywhere: `curl '<host>/api/admin/recent-errors?token=…'`."""
    expected = os.environ.get("ADMIN_TOKEN")
    if not expected:
        from fastapi import HTTPException
        raise HTTPException(503, "ADMIN_TOKEN not configured")
    if token != expected:
        from fastapi import HTTPException
        raise HTTPException(403, "Forbidden")
    limit = max(1, min(int(limit), 50))
    return {"count": len(RECENT_ERRORS), "errors": list(RECENT_ERRORS)[:limit]}


# ───────────────────────── Background tasks ─────────────────────────
scheduler = AsyncIOScheduler()
_generate_and_cache_guidance = make_generate_and_cache_guidance(db)


@app.on_event("startup")
async def start_scheduler():
    """Schedule the monthly AI guidance refresher and idempotently seed the
    staff-authored deep dives. Both are safe to run on every boot."""
    schedule_monthly_refresh(scheduler, db, _generate_and_cache_guidance, Region)
    scheduler.start()
    logger.info(
        "APScheduler started — next monthly guidance refresh: %s",
        scheduler.get_job("guidance_monthly_refresh").next_run_time,
    )
    try:
        result = await seed_deep_dives(db, overwrite=False)
        logger.info("deep-dive auto-seed: %s", result)
    except Exception as e:  # noqa: BLE001
        logger.exception("deep-dive auto-seed failed: %s", e)
    try:
        state = await refresh_ai_budget_state(db)
        logger.info("AI budget initial state: %s", state)
    except Exception as e:  # noqa: BLE001
        logger.warning("AI budget refresh failed at startup: %s", e)


@app.on_event("shutdown")
async def shutdown_db_client():
    try:
        scheduler.shutdown(wait=False)
    except Exception as e:  # noqa: BLE001
        logger.warning("scheduler shutdown failed: %s", e)
    client.close()
