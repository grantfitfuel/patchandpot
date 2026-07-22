"""Admin analytics summary — reads `analytics_events` and returns per-
capability funnel numbers (page views → CTA clicks → CTR).

Kept in its own router file so we don't muddle the public `track_event`
POST endpoint with admin logic.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from fastapi import HTTPException

from routers.admin._shared import require_admin


def register_analytics_routes(router, db) -> None:
    """Attach admin analytics roll-up endpoints to the shared /admin router."""

    @router.get("/admin/analytics/summary")
    async def admin_analytics_summary(token: str = "", days: int = 30):
        """Roll up `analytics_events` into a per-capability funnel.

        The frontend already emits three well-known event shapes:
          * `page_view` with `params.capability` = "<slug>" on capability
            landings; `params.path` on all other routes.
          * `cta_click` with `params.capability` = "<slug>" from
            /capabilities pages, or `params.where` + `target` on the home
            hero.
          * anything else is bucketed under "other".

        Returns:
            {
              "range_days": 30,
              "totals": {"page_view": …, "cta_click": …, "events": …},
              "capabilities": [
                { slug, page_views, cta_clicks, ctr_pct,
                  cta_targets: {"/ask": 3, "/calendar": 1, …} },
                …
              ],
              "top_paths": [{"path": "/", "views": 42}, …],
              "recent": [{event, path, at, params}, …]  # 20 rows
            }
        """
        require_admin(token)
        if days < 1 or days > 365:
            raise HTTPException(400, "days must be between 1 and 365")

        since = datetime.now(timezone.utc) - timedelta(days=days)

        # ── Totals ───────────────────────────────────────────────────
        pipeline_totals = [
            {"$match": {"at": {"$gte": since}}},
            {"$group": {"_id": "$event", "n": {"$sum": 1}}},
        ]
        totals: dict[str, int] = {}
        async for row in db.analytics_events.aggregate(pipeline_totals):
            totals[row["_id"] or "unknown"] = row["n"]

        # ── Per-capability funnel ────────────────────────────────────
        # We only match events where `params.capability` is set (both
        # page_view and cta_click emit it on /capabilities/* pages).
        pipeline_cap = [
            {"$match": {
                "at": {"$gte": since},
                "params.capability": {"$exists": True, "$ne": ""},
            }},
            {"$group": {
                "_id": {"cap": "$params.capability", "event": "$event"},
                "n": {"$sum": 1},
            }},
        ]
        buckets: dict[str, dict[str, int]] = {}
        async for row in db.analytics_events.aggregate(pipeline_cap):
            slug = row["_id"]["cap"]
            ev = row["_id"]["event"]
            buckets.setdefault(slug, {})[ev] = row["n"]

        # CTA target breakdown — where do people click when on a
        # capability page? Useful for spotting weak CTAs.
        pipeline_targets = [
            {"$match": {
                "at": {"$gte": since},
                "event": "cta_click",
                "params.capability": {"$exists": True, "$ne": ""},
                "params.target": {"$exists": True, "$ne": ""},
            }},
            {"$group": {
                "_id": {"cap": "$params.capability", "target": "$params.target"},
                "n": {"$sum": 1},
            }},
        ]
        targets: dict[str, dict[str, int]] = {}
        async for row in db.analytics_events.aggregate(pipeline_targets):
            slug = row["_id"]["cap"]
            tgt = row["_id"]["target"]
            targets.setdefault(slug, {})[tgt] = row["n"]

        capabilities = []
        all_slugs = set(buckets) | set(targets)
        for slug in sorted(all_slugs):
            b = buckets.get(slug, {})
            views = int(b.get("page_view", 0))
            clicks = int(b.get("cta_click", 0))
            ctr = (clicks / views * 100.0) if views else 0.0
            capabilities.append({
                "slug": slug,
                "page_views": views,
                "cta_clicks": clicks,
                "ctr_pct": round(ctr, 1),
                "cta_targets": targets.get(slug, {}),
            })
        # Best-performing capability first.
        capabilities.sort(key=lambda c: (-c["page_views"], -c["ctr_pct"]))

        # ── Top paths (regardless of capability) ─────────────────────
        pipeline_paths = [
            {"$match": {"at": {"$gte": since}, "event": "page_view"}},
            {"$group": {"_id": "$path", "n": {"$sum": 1}}},
            {"$sort": {"n": -1}},
            {"$limit": 20},
        ]
        top_paths = []
        async for row in db.analytics_events.aggregate(pipeline_paths):
            top_paths.append({"path": row["_id"] or "(none)", "views": row["n"]})

        # ── Recent raw events (debug / smoke check) ──────────────────
        recent_cursor = db.analytics_events.find(
            {"at": {"$gte": since}},
            {"_id": 0, "event": 1, "path": 1, "at": 1, "params": 1},
        ).sort("at", -1).limit(20)
        recent = []
        async for row in recent_cursor:
            row["at"] = row["at"].isoformat() if isinstance(row.get("at"), datetime) else str(row.get("at"))
            recent.append(row)

        return {
            "range_days": days,
            "totals": {
                "events": sum(totals.values()),
                "page_view": totals.get("page_view", 0),
                "cta_click": totals.get("cta_click", 0),
                "other": sum(v for k, v in totals.items()
                             if k not in ("page_view", "cta_click")),
            },
            "capabilities": capabilities,
            "top_paths": top_paths,
            "recent": recent,
        }
