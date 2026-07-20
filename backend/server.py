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
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger
from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI
from motor.motor_asyncio import AsyncIOMotorClient
from starlette.middleware.cors import CORSMiddleware

from cache_refresh import schedule_monthly_refresh
from core import Region, load_promoted_plants, refresh_ai_budget_state
from seed_deep_dives import seed_deep_dives
from sentry_init import init_sentry
from services_guidance import make_generate_and_cache_guidance

from routers import (
    admin as admin_router,
    affiliate as affiliate_router,
    arrangement as arrangement_router,
    ask as ask_router,
    calm as calm_router,
    checkout as checkout_router,
    feedback as feedback_router,
    guidance as guidance_router,
    images as images_router,
    lesson as lesson_router,
    masterclass as masterclass_router,
    patrons as patrons_router,
    pdf as pdf_router,
    plants as plants_router,
    recipes as recipes_router,
    bouquet as bouquet_router,
    regions as regions_router,
    seo as seo_router,
    share as share_router,
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

# ───────────────────────── Background tasks ─────────────────────────
# Scheduler + cached guidance generator are created at module scope so the
# admin endpoints (which import this module) can introspect job state, but
# they're started/stopped from inside the lifespan context below.
scheduler = AsyncIOScheduler()
_generate_and_cache_guidance = make_generate_and_cache_guidance(db)


async def _ensure_db_indexes() -> None:
    """Idempotent index creation. Called once at startup."""
    await db.shared_patch_views.create_index("expires_at", expireAfterSeconds=0)
    await db.plant_views.create_index("expires_at", expireAfterSeconds=0)
    await db.ai_plant_views.create_index("expires_at", expireAfterSeconds=0)
    # Rate-limit ledger for `/plant-guide` Sonnet generations. We keep 7
    # days of history so the admin can spot trends; the in-route count
    # only ever looks at today's day_key.
    await db.ai_plant_gen_log.create_index([("day", 1)])
    await db.ai_plant_gen_log.create_index(
        "created_at", expireAfterSeconds=7 * 24 * 3600,
    )
    await db.shared_patches.create_index([("list_publicly", 1), ("view_count_7d", -1)])
    await db.plant_stats.create_index([("view_count_7d", -1)])
    await db.plant_stats.create_index([("plant_id", 1)], unique=True)
    await db.ai_plant_stats.create_index([("view_count_7d", -1)])
    await db.ai_plant_stats.create_index([("slug", 1)], unique=True)
    await db.promoted_plants.create_index([("plant.id", 1)], unique=True)
    # First-party geo analytics — 90-day TTL so the collection never grows
    # unboundedly. `ts` is a real BSON date so the TTL monitor honours it.
    await db.visits.create_index("ts", expireAfterSeconds=90 * 24 * 3600)
    await db.visits.create_index([("country", 1)])
    # Ask-Nàdar Q&A cache — unique-key index for O(1) lookups and a
    # secondary `hits` index for admin observability ("top asked").
    await db.ask_cache.create_index([("key", 1)], unique=True)
    await db.ask_cache.create_index([("hits", -1)])


async def _decay_weekly_views() -> None:
    """Weekly Monday-03:00-UTC reset of `view_count_7d` so the homepage
    'Most-loved patches THIS WEEK' wall and 'Plant of the week' rail reflect
    recent traffic rather than cumulative all-time views."""
    try:
        r1 = await db.shared_patches.update_many(
            {"view_count_7d": {"$gt": 0}}, {"$set": {"view_count_7d": 0}},
        )
        r2 = await db.plant_stats.update_many(
            {"view_count_7d": {"$gt": 0}}, {"$set": {"view_count_7d": 0}},
        )
        r3 = await db.ai_plant_stats.update_many(
            {"view_count_7d": {"$gt": 0}}, {"$set": {"view_count_7d": 0}},
        )
        logger.info(
            "weekly view_count_7d decay reset %d patches, %d plants, %d ai-plants",
            r1.modified_count, r2.modified_count, r3.modified_count,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("weekly view decay failed: %s", e)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Startup + shutdown in a single context manager — the modern FastAPI
    pattern, replacing the deprecated `@app.on_event("startup"|"shutdown")`
    decorators. Yielding hands control back to FastAPI; code after the
    yield runs on shutdown.

    Failure of any individual init step never aborts boot — every block is
    wrapped so a missing optional dependency (e.g. deep-dive seed) can't
    take the API offline.
    """
    # ── startup ──────────────────────────────────────────────────────────
    schedule_monthly_refresh(scheduler, db, _generate_and_cache_guidance, Region)
    scheduler.add_job(
        _decay_weekly_views,
        CronTrigger(day_of_week="mon", hour=3, minute=0),
        id="shared_patch_weekly_view_decay",
        replace_existing=True,
    )
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

    try:
        added = await load_promoted_plants(db)
        logger.info("Loaded %d promoted plant(s) from Mongo into PLANTS", added)
    except Exception as e:  # noqa: BLE001
        logger.warning("load_promoted_plants failed at startup: %s", e)

    try:
        await _ensure_db_indexes()
        logger.info("share/plant view TTL + popular-wall indexes ensured")
    except Exception as e:  # noqa: BLE001
        logger.warning("DB indexes setup failed: %s", e)

    yield

    # ── shutdown ─────────────────────────────────────────────────────────
    try:
        scheduler.shutdown(wait=False)
    except Exception as e:  # noqa: BLE001
        logger.warning("scheduler shutdown failed: %s", e)
    client.close()


# ───────────────────────── FastAPI app ─────────────────────────
app = FastAPI(title="Patch & Pot API", lifespan=lifespan)
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
app.include_router(recipes_router.make_router(db), prefix="/api")
app.include_router(bouquet_router.make_router(db), prefix="/api")
app.include_router(guidance_router.make_router(db), prefix="/api")
app.include_router(arrangement_router.make_router(db), prefix="/api")
app.include_router(pdf_router.make_router(db), prefix="/api")
app.include_router(masterclass_router.make_router(db), prefix="/api")
app.include_router(images_router.make_router(db), prefix="/api")
app.include_router(lesson_router.make_router(db), prefix="/api")
app.include_router(admin_router.make_router(db), prefix="/api")
app.include_router(share_router.make_router(db), prefix="/api")
app.include_router(ask_router.make_router(db), prefix="/api")
app.include_router(calm_router.make_router(db), prefix="/api")
app.include_router(seo_router.make_router(db), prefix="/api")
# Patrons router self-prefixes with /api (see routers/patrons.py).
app.include_router(patrons_router.make_router(db))

# ───────────────────────── Middleware ─────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── First-party visit tracking (no third party) ────────────────
# Logs one lightweight record per /api/* request to the `visits` collection:
#   { ts: datetime (UTC), country: "GB" | null, path: "/api/…" }
# Country is derived from whichever geo-header the ingress layer already
# forwards (Cloudflare / Fly / Vercel / generic). No server-side IP DB, no
# personal data, no cookies. A TTL index in cache_refresh strips rows over
# 90 days so this can never balloon.
_GEO_HEADERS = (
    "cf-ipcountry",
    "x-vercel-ip-country",
    "x-country",
    "x-appengine-country",
)
_TRACK_PREFIXES = ("/api/",)
_TRACK_SKIP_SUBSTR = ("/admin/", "/healthz", "/share/og/", "/plant-image/")


@app.middleware("http")
async def _log_visit(request, call_next):
    resp = await call_next(request)
    try:
        path = request.url.path
        if any(path.startswith(p) for p in _TRACK_PREFIXES) and not any(
            s in path for s in _TRACK_SKIP_SUBSTR
        ):
            country = None
            for h in _GEO_HEADERS:
                v = request.headers.get(h)
                if v:
                    country = v.upper()[:2]
                    break
            if country == "XX":  # some CDNs use XX for unknown
                country = None
            await db.visits.insert_one({
                "ts": datetime.now(timezone.utc),
                "country": country,
                "path": path[:80],
            })
    except Exception:  # noqa: BLE001
        # Analytics MUST NEVER break a request path.
        pass
    return resp
