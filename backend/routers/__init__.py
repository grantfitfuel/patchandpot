"""Routers package — per-feature FastAPI routers split out of server.py.

Each module exports either:
  - `router` (no-state router, e.g. regions.py), or
  - `make_router(db, ...)` factory if it needs runtime dependencies.

server.py wires them in via `api_router.include_router(...)` so they all
inherit the `/api` prefix.
"""
