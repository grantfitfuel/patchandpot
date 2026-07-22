"""Admin/maintenance endpoints — all token-gated.

This package replaces the old single-file `routers/admin.py` (~610 lines).
Routes are grouped by intent into thematic sub-modules; `make_router(db)`
builds the FastAPI router and registers each group in turn.

  • `_maintenance.py`   — operational ops: refresh, cron-status, seed,
                          prune, prewarm-images
  • `_observability.py` — read-only dashboards: ai-usage, referrals,
                          profit-margin
  • `_curation.py`      — Promote-AI workflow: ai-searches, promote,
                          unpromote, reload, clear-cache, backfill

`_shared.py` exposes `_require_admin` + `PromotePlantPayload` so the
sub-modules don't need a circular import on this package.

External imports (`from routers import admin as admin_router` →
`admin_router.make_router(db)`) keep working unchanged — converting the
single file to a package is a transparent refactor.
"""
from fastapi import APIRouter

from ._curation import register_curation_routes
from ._maintenance import register_maintenance_routes
from ._observability import register_observability_routes
from ._analytics import register_analytics_routes


def make_router(db) -> APIRouter:
    """Build the admin router. Each sub-group registers its endpoints on the
    same shared `router` so the URL prefixes stay flat (`/admin/foo` from
    every module)."""
    router = APIRouter()
    register_maintenance_routes(router, db)
    register_observability_routes(router, db)
    register_curation_routes(router, db)
    register_analytics_routes(router, db)
    return router
