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


def _record_error(*, request, status, type_name, message, exc=None):
    """Shared helper so route handlers can record structured 5xx failures
    into the same ring buffer as unhandled exceptions. Without this, our
    own try/except routes would swallow Stripe/Mongo failures into clean
    HTTPExceptions but never leave a debugging trace."""
    entry = {
        "at": datetime.now(timezone.utc).isoformat(),
        "method": getattr(request, "method", "?"),
        "path": str(getattr(getattr(request, "url", None), "path", "?")),
        "status": status,
        "type": type_name,
        "message": (message or "")[:500],
        "ua": (request.headers.get("user-agent", "") if request else "")[:200],
        "origin": request.headers.get("origin", "") if request else "",
        "traceback": (traceback.format_exc()[-2000:] if exc else ""),
    }
    RECENT_ERRORS.appendleft(entry)


# Make the helper importable from routers without circular-import gymnastics.
import core as _core  # noqa: E402
_core.record_error = _record_error  # type: ignore[attr-defined]


@app.exception_handler(Exception)
async def _capture_unhandled(request: Request, exc: Exception):
    """Catch anything our route-level try/except missed (CORS edge cases,
    Pydantic surprises, dependency failures) and record the full type +
    traceback + request context for later inspection."""
    _record_error(
        request=request,
        status=500,
        type_name=type(exc).__name__,
        message=str(exc),
        exc=exc,
    )
    logger.exception("Unhandled %s on %s %s", type(exc).__name__, request.method, request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "detail": f"Server error: {type(exc).__name__}",
            "type": type(exc).__name__,
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


@app.get("/api/admin/config-check")
async def config_check(token: str):
    """Confirm which env vars are configured on this deployment (redacted).
    Helps diagnose 'why is checkout failing' without exposing secrets —
    each value is shown only as 'missing', 'set (len=N, …last4=XXXX)'
    or 'set (len=N)'.

    Safe to share screenshots of: no full secrets ever surface here.
    """
    expected = os.environ.get("ADMIN_TOKEN")
    if not expected:
        from fastapi import HTTPException
        raise HTTPException(503, "ADMIN_TOKEN not configured")
    if token != expected:
        from fastapi import HTTPException
        raise HTTPException(403, "Forbidden")

    def fingerprint(val, key):
        if not val:
            return "MISSING"
        last4 = val[-4:] if len(val) >= 8 else "(short)"
        # For Stripe keys also reveal the prefix (sk_live_ vs sk_test_) since
        # that's the most common misconfiguration — and the prefix itself
        # is not a secret.
        if key.startswith("STRIPE"):
            prefix = val[:8] if len(val) > 8 else val[:4]
            return f"set (len={len(val)} prefix={prefix!r} last4={last4!r})"
        return f"set (len={len(val)} last4={last4!r})"

    keys_to_check = [
        "STRIPE_API_KEY",
        "MONGO_URL",
        "DB_NAME",
        "EMERGENT_LLM_KEY",
        "ADMIN_TOKEN",
        "CORS_ORIGINS",
        "SENTRY_DSN",
        "AI_MONTHLY_BUDGET_GBP",
    ]
    return {
        "vars": {k: fingerprint(os.environ.get(k), k) for k in keys_to_check},
        "note": "Prefixes/last4 are intentionally exposed; no full values leak.",
    }


@app.get("/api/admin/test-stripe")
async def test_stripe(token: str):
    """Attempt to create a minimal Stripe Checkout session and return the
    raw outcome — successful URL on happy path, otherwise the FULL Stripe
    error message + class + traceback tail. Lets us diagnose live-key /
    account-activation problems in one URL visit, without going through
    the modal flow."""
    expected = os.environ.get("ADMIN_TOKEN")
    if not expected:
        from fastapi import HTTPException
        raise HTTPException(503, "ADMIN_TOKEN not configured")
    if token != expected:
        from fastapi import HTTPException
        raise HTTPException(403, "Forbidden")

    # Import lazily so a broken Stripe client doesn't crash this endpoint
    # itself — we want it to ALWAYS return diagnostic info.
    from emergentintegrations.payments.stripe.checkout import (
        CheckoutSessionRequest, StripeCheckout,
    )
    from core import STRIPE_API_KEY

    result = {
        "stripe_key_set": bool(STRIPE_API_KEY),
        "stripe_key_prefix": (STRIPE_API_KEY[:8] if STRIPE_API_KEY else None),
        "stripe_key_len": (len(STRIPE_API_KEY) if STRIPE_API_KEY else 0),
    }
    try:
        sc = StripeCheckout(
            api_key=STRIPE_API_KEY,
            webhook_url="https://patchandpot.app/api/webhook/stripe",
        )
    except Exception as e:  # noqa: BLE001
        result["step"] = "StripeCheckout init"
        result["error_type"] = type(e).__name__
        result["error_message"] = str(e)[:1000]
        result["traceback"] = traceback.format_exc()[-1500:]
        return result

    try:
        session = await sc.create_checkout_session(CheckoutSessionRequest(
            amount=35.0,
            currency="gbp",
            success_url="https://patchandpot.app/checkout/success?session_id={CHECKOUT_SESSION_ID}",
            cancel_url="https://patchandpot.app/checkout/cancel",
            metadata={"package_id": "lifetime_founding", "source": "admin_test"},
        ))
        result["step"] = "create_checkout_session"
        result["ok"] = True
        result["session_id"] = session.session_id
        result["url_prefix"] = (session.url or "")[:50]
        return result
    except Exception as e:  # noqa: BLE001
        result["step"] = "create_checkout_session"
        result["ok"] = False
        result["error_type"] = type(e).__name__
        result["error_message"] = str(e)[:1500]
        result["traceback"] = traceback.format_exc()[-1500:]
        return result


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
