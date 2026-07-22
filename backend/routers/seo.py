"""SEO endpoints — dynamic XML sitemap + robots.txt.

The sitemap pulls real URLs from the curated PLANT_INDEX and masterclass
registry so Google indexes every evergreen page we ship without us hand-
maintaining a list. New plant guides automatically appear in the sitemap
on the next Googlebot fetch.

robots.txt is also served here (rather than statically from
frontend/public/) so it can point at the dynamic sitemap URL using the
production host name that the ingress already forwards via
x-forwarded-host.
"""
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from io import BytesIO

from fastapi import APIRouter, Request
from fastapi.responses import PlainTextResponse, Response

from core import PLANTS
from routers.ask import question_slug


# Static "evergreen" routes that should appear in the sitemap. Everything
# under /admin, /checkout, /print, /patrons/manage and /embed is excluded
# — they're either gated, transient or designed to be iframed.
_STATIC_ROUTES = [
    ("/",                     "weekly",  1.0),
    ("/capabilities",         "weekly",  0.95),
    # Every dedicated marketing landing page — the crawler-first surface
    # for each product capability. Keep in sync with the CAPABILITIES
    # constant in frontend/src/data/capabilities.js.
    ("/capabilities/ask-nadar",      "weekly",  0.9),
    ("/capabilities/monthly-guide",  "weekly",  0.9),
    ("/capabilities/masterclasses",  "weekly",  0.9),
    ("/capabilities/calm",           "weekly",  0.9),
    ("/capabilities/plants",         "weekly",  0.9),
    ("/capabilities/grow-anywhere",  "weekly",  0.9),
    ("/capabilities/recipes",        "weekly",  0.9),
    ("/capabilities/bouquet",        "weekly",  0.9),
    ("/capabilities/journal",        "weekly",  0.9),
    ("/capabilities/topics",         "weekly",  0.9),
    ("/calendar",             "monthly", 0.9),
    ("/calendar/compare",     "monthly", 0.7),
    ("/plants",               "weekly",  0.9),
    ("/pests",                "monthly", 0.8),
    ("/wellbeing",            "monthly", 0.7),
    ("/garden",               "monthly", 0.6),
    ("/guides",               "weekly",  0.8),
    ("/masterclasses",        "weekly",  0.8),
    ("/grow-anywhere",        "weekly",  0.8),
    ("/recipes",              "weekly",  0.8),
    ("/bouquet",              "monthly", 0.6),
    ("/calm",                 "weekly",  0.8),
    ("/journal",              "monthly", 0.6),
    ("/ask",                  "weekly",  0.7),
    ("/ask/popular",          "daily",   0.7),
    ("/topics",               "weekly",  0.8),
    ("/patrons",              "monthly", 0.5),
    ("/privacy",              "yearly",  0.3),
    ("/terms",                "yearly",  0.3),
    ("/about",                "yearly",  0.4),
]


def _origin_from_request(request: Request) -> str:
    """Reconstruct the public origin honouring ingress x-forwarded-* headers."""
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme or "https"
    host = (
        request.headers.get("x-forwarded-host")
        or request.headers.get("host")
        or request.url.hostname
        or "patchandpot.app"
    )
    host = host.split(",")[0].strip()
    return f"{proto}://{host}"


def make_router(db=None) -> APIRouter:
    router = APIRouter(tags=["seo"])

    @router.get("/sitemap.xml")
    async def sitemap(request: Request):
        origin = _origin_from_request(request)
        today = datetime.now(timezone.utc).date().isoformat()

        urlset = ET.Element(
            "urlset", attrib={"xmlns": "http://www.sitemaps.org/schemas/sitemap/0.9"},
        )

        def add(path: str, priority: float, changefreq: str):
            url = ET.SubElement(urlset, "url")
            ET.SubElement(url, "loc").text = f"{origin}{path}"
            ET.SubElement(url, "lastmod").text = today
            ET.SubElement(url, "changefreq").text = changefreq
            ET.SubElement(url, "priority").text = f"{priority:.1f}"

        for path, freq, prio in _STATIC_ROUTES:
            add(path, prio, freq)

        # Per-plant evergreen pages — the biggest organic-traffic surface.
        # Curated to the top ~50 to keep the sitemap tight (Google honors
        # priority hints better on a compact list). Priority ranks by
        # 7-day view count when available, then pads with PLANT_INDEX
        # order so we always emit close to 50 URLs even on a fresh install.
        top_plant_ids: list[str] = []
        if db is not None:
            try:
                cursor = db.plant_stats.find(
                    {}, {"_id": 0, "plant_id": 1}
                ).sort("view_count_7d", -1).limit(50)
                top_plant_ids = [row["plant_id"] async for row in cursor]
            except Exception:  # noqa: BLE001
                top_plant_ids = []
        if len(top_plant_ids) < 50:
            seen = set(top_plant_ids)
            for p in PLANTS:
                pid = p.get("id")
                if pid and pid not in seen:
                    top_plant_ids.append(pid)
                    seen.add(pid)
                    if len(top_plant_ids) >= 50:
                        break
        for pid in top_plant_ids:
            add(f"/plants/{pid}", 0.8, "monthly")

        # Curated topic landing pages — hand-picked taxonomy, never
        # auto-generated. Adding a topic requires a code change so we
        # can't ship a dud landing page.
        try:
            from data.ask_topics import TOPICS
            for t in TOPICS:
                add(f"/topics/{t['id']}", 0.7, "weekly")
        except Exception:  # noqa: BLE001
            pass

        # Popular Q&A pages — the compounding SEO asset. Each entry that
        # has cleared the hits >= 2 threshold gets its own crawlable URL.
        # (The public /ask/popular page uses hits >= 1, but the sitemap
        # is intentionally more curated — three separate members asking
        # the same thing is a stronger signal to Google that this is
        # evergreen intent worth indexing.) Hidden entries are excluded.
        # This is deliberately NOT clustered into topic landing pages —
        # each question is its own atomic answer and we let Google decide
        # which are worth ranking. See PRD iter 66 note.
        if db is not None:
            try:
                cursor = db.ask_cache.find(
                    {"hits": {"$gte": 2}, "prior_hash": None, "hidden": {"$ne": True}},
                    {"_id": 0, "key": 1, "question_normalized": 1, "last_asked_at": 1},
                ).sort("hits", -1).limit(500)
                async for row in cursor:
                    slug = question_slug(row.get("question_normalized", ""), row.get("key", ""))
                    add(f"/ask/popular/{slug}", 0.6, "monthly")
            except Exception:  # noqa: BLE001 — sitemap must not fail if the collection is missing
                pass

        tree = ET.ElementTree(urlset)
        buf = BytesIO()
        tree.write(buf, encoding="utf-8", xml_declaration=True)
        return Response(content=buf.getvalue(), media_type="application/xml")

    @router.get("/robots.txt", response_class=PlainTextResponse)
    async def robots(request: Request):
        origin = _origin_from_request(request)
        body = (
            "# Patch & Pot — robots.txt\n"
            "User-agent: *\n"
            "Allow: /\n"
            "Disallow: /admin/\n"
            "Disallow: /checkout/\n"
            "Disallow: /print/\n"
            "Disallow: /patrons/manage\n"
            "Disallow: /embed/\n"
            "Disallow: /api/share/preview/\n"
            "Disallow: /api/plants/preview/\n"
            "\n"
            f"Sitemap: {origin}/api/sitemap.xml\n"
        )
        return PlainTextResponse(content=body, headers={"Cache-Control": "public, max-age=3600"})

    return router
