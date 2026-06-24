"""Plant catalogue, single-plant lookup, companion plants, and the
AI-driven plant-image / pest-image endpoints. Also exposes the AI-generated
'any plant' guide endpoints (`/plant-guide`, `/recent-plants`) and the
public OG card + HTML preview wrapper for `/plants/{id}` so shared plant
links unfurl as rich social-media cards."""
import hashlib
import html
import json
import logging
import os
import re
import uuid
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import HTMLResponse, Response

from core import (
    LANG_NAMES, PLANTS, PLANT_INDEX, COMPANIONS, COMPANION_REASONS,
    PlantImageRequest, PestImageRequest, PlantGuideRequest,
    _llm_json, _llm_json_cheap, _plant_slug,
    is_visit_bot, viewer_fingerprint,
    make_cached_image, make_plants_in_language, make_translate_companion_reasons,
)
from share_og import render_plant_og_png

logger = logging.getLogger(__name__)


async def _translate_plant_guide(en_data: dict, language: str) -> dict:
    """Cheap Haiku translation of a cached EN plant guide. Preserves JSON shape;
    falls back to the EN content on any error so the UI never crashes."""
    if language == "en" or language not in LANG_NAMES:
        return en_data
    language_name = LANG_NAMES[language]
    system = (
        "You translate plant care guide JSON. Keep keys in English. Translate every string "
        "value to the target language using natural, idiomatic phrasing. Use locally-common "
        "plant names. Preserve numbers, units (cm, °C, L) and the JSON shape. Return JSON only."
    )
    user = (
        f"Translate every string value in this plant care guide into {language_name}. "
        f"Keep the JSON shape exactly the same. Return JSON only.\n\n"
        f"Source (English):\n{json.dumps(en_data, ensure_ascii=False, indent=2)}"
    )
    try:
        translated = await _llm_json_cheap(system, user, session_id=f"plant-guide-trans-{language}")
        # Preserve fields that must NOT change between languages
        for k in ("id", "container", "ai_generated", "curated"):
            if k in en_data:
                translated[k] = en_data[k]
        return translated
    except Exception as e:  # noqa: BLE001
        logger.warning("plant-guide translation to %s failed (%s) — using EN fallback", language, e)
        return en_data


def make_router(db) -> APIRouter:
    router = APIRouter()
    _plants_in_language = make_plants_in_language(db)
    _translate_companion_reasons = make_translate_companion_reasons(db)
    _cached_image = make_cached_image(db)

    @router.get("/plants")
    async def list_plants(language: str = "en"):
        return await _plants_in_language(language)

    @router.get("/plants/of-the-week")
    async def plant_of_the_week(language: str = "en"):
        """Single most-viewed plant in the last 7 days, hydrated with the
        same locale-aware data the regular /plants/{id} GET returns.

        Returns `{plant: null}` when nobody has viewed any plant guide yet
        (keeps the homepage rail tidy in the first days after launch).
        """
        top = await db.plant_stats.find_one(
            {"view_count_7d": {"$gt": 0}},
            sort=[("view_count_7d", -1), ("view_count", -1)],
            projection={"_id": 0, "plant_id": 1, "view_count_7d": 1, "view_count": 1},
        )
        if not top:
            return {"plant": None}
        plants = await _plants_in_language(language)
        by_id = {p["id"]: p for p in plants}
        plant = by_id.get(top["plant_id"])
        if not plant:
            # plant_stats row points at something no longer in PLANT_INDEX
            # (e.g. it was renamed) — silently skip rather than 500.
            return {"plant": None}
        return {
            "plant": plant,
            "view_count_7d": int(top.get("view_count_7d", 0)),
            "view_count": int(top.get("view_count", 0)),
        }

    @router.get("/plants/popular")
    async def list_popular_plants(limit: int = 6, language: str = "en"):
        """Top N curated plants by 7-day views. Used for SEO rails / sidebars
        that want more than just the hero card."""
        limit = max(1, min(int(limit or 6), 24))
        cursor = (
            db.plant_stats.find(
                {"view_count_7d": {"$gt": 0}},
                {"_id": 0, "plant_id": 1, "view_count_7d": 1, "view_count": 1},
            )
            .sort([("view_count_7d", -1), ("view_count", -1)])
            .limit(limit)
        )
        plants = await _plants_in_language(language)
        by_id = {p["id"]: p for p in plants}
        items = []
        async for row in cursor:
            p = by_id.get(row["plant_id"])
            if not p:
                continue
            items.append({
                "plant": p,
                "view_count_7d": int(row.get("view_count_7d", 0)),
                "view_count": int(row.get("view_count", 0)),
            })
        return {"items": items}

    @router.get("/plants/{plant_id}")
    async def get_plant(plant_id: str, request: Request, language: str = "en"):
        plants = await _plants_in_language(language)
        by_id = {p["id"]: p for p in plants}
        plant = by_id.get(plant_id)
        if not plant:
            raise HTTPException(404, "Plant not found")
        # Debounced view tracking for the homepage "Plant of the week" rail.
        # Mirrors the shared_patch_views pattern: 24h dedup per fingerprint,
        # bot UAs skipped, errors silently swallowed (we never want a view
        # counter to take down a plant page).
        if not is_visit_bot(request):
            await _record_plant_view(db, plant_id, viewer_fingerprint(request))
        return plant

    @router.get("/plants/{plant_id}/companions")
    async def get_companions(plant_id: str, language: str = "en"):
        """Return curated companion plants for a given plant id."""
        if plant_id not in PLANT_INDEX:
            raise HTTPException(404, "Plant not found")
        plants = await _plants_in_language(language)
        by_id = {p["id"]: p for p in plants}
        companion_ids = COMPANIONS.get(plant_id, [])
        items = []
        for cid in companion_ids:
            p = by_id.get(cid) or PLANT_INDEX.get(cid)
            if not p:
                continue
            reason = COMPANION_REASONS.get((plant_id, cid)) or COMPANION_REASONS.get((cid, plant_id))
            items.append({
                "id": p["id"], "name": p["name"], "category": p["category"],
                "summary": p["summary"], "reason": reason,
            })
        if (language or "en").lower() != "en" and (language or "").lower() in LANG_NAMES and items:
            try:
                items = await _translate_companion_reasons(items, language)
            except Exception as e:  # noqa: BLE001
                logger.warning("companion-reasons translation failed for %s: %s", language, e)
        return {"plant_id": plant_id, "companions": items}

    @router.post("/plant-image")
    async def generate_plant_image(req: PlantImageRequest):
        """Generate (or fetch cached) AI image of a plant. Returns data URL."""
        cache_key = f"plant-image:{req.plant_id}"
        style = req.style_hint or (
            "soft natural light, shallow depth of field, terracotta pot on a weathered wooden "
            "windowsill, warm sand background, editorial gardening magazine style, no text, no people"
        )
        name_lower = (req.plant_name or "").lower()
        is_flower = any(k in name_lower for k in [
            "flower", "nasturtium", "calendula", "sunflower", "marigold", "lavender",
            "cosmos", "viola", "pansy", "sweet pea", "zinnia", "borage", "geranium", "chamomile"
        ])
        subject = (
            f"A beautiful close-up photo of fresh {req.plant_name} flowers in bloom"
            if is_flower else
            f"A beautiful close-up photo of a healthy {req.plant_name} plant"
        )
        prompt = f"{subject}. {style}."
        return await _cached_image(cache_key, prompt, session=f"img-{req.plant_id}-{uuid.uuid4()}")

    @router.post("/pest-image")
    async def generate_pest_image(req: PestImageRequest):
        """Generate (or fetch cached) AI image of a pest/disease."""
        safe_key = re.sub(r"[^a-z0-9]+", "-", req.name.lower()).strip("-")
        cache_key = f"pest-image:{safe_key}"
        prompt = (
            f"A close-up macro reference photograph of '{req.name}' as seen by a home gardener "
            f"on leaves or stems. Naturalistic, soft daylight, gardening field-guide style, "
            f"no text, no people, no pesticide bottles. Subject in sharp focus, background "
            f"a softly blurred green leaf."
        )
        return await _cached_image(cache_key, prompt, session=f"pest-img-{safe_key}-{uuid.uuid4()}")

    @router.post("/plant-guide")
    async def generate_plant_guide(req: PlantGuideRequest):
        """Generate (or return cached) AI plant guide for ANY plant — even ones not
        in the curated database."""
        name = (req.query or "").strip()
        if len(name) < 2:
            raise HTTPException(400, "Query too short")
        if len(name) > 80:
            raise HTTPException(400, "Query too long")

        language = (req.language or "en").lower()
        if language not in LANG_NAMES:
            language = "en"

        slug = _plant_slug(name)
        cache_key = f"plant-guide:{slug}:{language}"
        cached = await db.guidance_cache.find_one({"key": cache_key}, {"_id": 0})
        if cached:
            return cached["data"]

        for p in PLANTS:
            if p["name"].lower() == name.lower():
                return {**p, "ai_generated": False, "curated": True}

        # Two-pass i18n: generate the EN guide once via Sonnet, translate
        # the JSON cheaply via Haiku for the other 57 languages. Saves ~75%
        # on AI bills for the same plant viewed in multiple languages.
        en_key = f"plant-guide:{slug}:en"
        en_cached = await db.guidance_cache.find_one({"key": en_key}, {"_id": 0})

        if language == "en" or not en_cached:
            system = (
                "You are a careful horticulturalist creating concise, accurate plant care guides "
                "for small-space gardeners. Stick to widely-accepted advice. If asked about a plant "
                "you're unsure exists, set 'unknown' to true and return minimal fields. "
                "ALWAYS respond as valid JSON only — no markdown fences, no extra prose."
            )

            # Always generate the source in English first when we don't have
            # an EN cache hit, so the cheap translation pass has something to
            # work from for ALL future languages.
            gen_language = language if language == "en" else "en"
            gen_language_name = LANG_NAMES[gen_language]

            user_prompt = f"""Generate a plant care guide for: "{name}"

OUTPUT LANGUAGE: {gen_language_name}. All string values must be in {gen_language_name}.

Return STRICT JSON with this exact shape (keys stay in English):
{{
  "unknown": false,
  "id": "{slug}",
  "name": "<official common name>",
  "botanical_name": "<botanical name if known, else empty>",
  "category": "Vegetable | Herb | Leafy green | Fruit | Root | Allium | Flower | Other",
  "difficulty": "Very easy | Easy | Medium | Hard",
  "sun": "Full sun | Full to partial | Partial sun | Shade",
  "water": "Low | Moderate | Regular | Frequent",
  "soil": "<one-line soil description>",
  "container": true,
  "edible_part": "<comma-separated parts that are edible, or 'Ornamental' if not edible>",
  "summary": "<1-2 sentence overview>",
  "growing": ["<3-5 short tips on growing — sowing, planting, daily care>"],
  "problems": [
    {{"name": "<pest or disease>", "solution": "<one sentence organic-first control>"}}
  ],
  "companions": ["<3-5 plant names that grow well near this one>"],
  "seasonality": "<one sentence on best growing season(s) in temperate climates>",
  "warnings": "<empty string OR a single safety note e.g. 'Leaves toxic; only fruit is edible' or 'Sap can irritate skin'. Leave empty if no warnings are warranted.>",
  "tags": ["<3-6 short lowercase tags e.g. 'heat', 'beginner', 'perennial'>"]
}}

If the plant is not a real plant or you cannot give a confident answer, return:
{{"unknown": true, "name": "{name}", "id": "{slug}"}}

Return JSON only."""

            generated = await _llm_json(system, user_prompt, session_id=f"plant-guide-{slug}-{gen_language}")
            if generated.get("unknown"):
                raise HTTPException(
                    404,
                    f"Couldn't find reliable information on '{name}'. Try a more common name.",
                )
            # Cache the EN source so future languages can translate cheaply.
            if gen_language == "en":
                await db.guidance_cache.insert_one({
                    "key": en_key, "data": generated,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
                en_cached = {"data": generated}

            if language == "en":
                data = generated
            else:
                # We just generated EN — now translate it for the requested language.
                data = await _translate_plant_guide(generated, language)
        else:
            # EN already cached → cheap Haiku translation only.
            data = await _translate_plant_guide(en_cached["data"], language)

        data["id"] = slug
        data["ai_generated"] = True
        data["curated"] = False
        data.setdefault("container", True)
        data.setdefault("tags", [])
        data.setdefault("growing", [])
        data.setdefault("problems", [])
        data.setdefault("companions", [])
        data.setdefault("warnings", "")
        data.setdefault("botanical_name", "")
        data.setdefault("category", "Other")
        data.setdefault("difficulty", "Medium")
        data.setdefault("sun", "Full to partial")
        data.setdefault("water", "Moderate")
        data.setdefault("soil", "Well-drained")
        data.setdefault("edible_part", "Ornamental")
        data.setdefault("summary", f"AI-generated guide for {data['name']}.")
        data.setdefault("seasonality", "")

        await db.guidance_cache.insert_one({
            "key": cache_key, "data": data,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        return data

    @router.get("/plant-guide/{slug}")
    async def get_cached_plant_guide(slug: str, language: str = "en"):
        """Lookup an AI plant guide by its slug — used when navigating directly to /plants/ai/{slug}."""
        if not slug.startswith("ai-"):
            raise HTTPException(404, "Not an AI plant slug")
        cache_key = f"plant-guide:{slug}:{language}"
        cached = await db.guidance_cache.find_one({"key": cache_key}, {"_id": 0})
        if cached:
            return cached["data"]
        raise HTTPException(404, "Guide not cached yet — search for the plant from the Plants page.")

    @router.get("/recent-plants")
    async def recent_ai_plants(language: str = "en", limit: int = 8):
        """Most recently generated AI plant guides — 'Recently searched' rail."""
        limit = max(1, min(limit, 24))
        pattern = f"^plant-guide:ai-.*:{re.escape(language)}$"
        cursor = (
            db.guidance_cache
              .find({"key": {"$regex": pattern}}, {"_id": 0})
              .sort("created_at", -1)
              .limit(limit)
        )
        items = []
        seen_ids = set()
        async for row in cursor:
            d = row.get("data") or {}
            if not d.get("id") or d["id"] in seen_ids:
                continue
            seen_ids.add(d["id"])
            items.append({
                "id": d["id"], "name": d.get("name"), "category": d.get("category"),
                "summary": d.get("summary"),
            })
        return {"items": items}

    # ─────────────────── OG card + crawler HTML wrapper ───────────────────
    # Plant guides are evergreen SEO entry points — every search-query gardener
    # who lands on /plants/tomato should be able to share that page into a
    # chat / DM / Pinterest pin and have it unfurl as a real branded card.
    # Mirrors the share-patch wrapper at /api/share/preview/{id}.
    async def _resolve_plant_for_og(plant_id: str) -> dict:
        """Fetch enough plant metadata to render an OG card. Works for both
        curated plants and AI-generated guides (`ai-*` slugs)."""
        if plant_id.startswith("ai-"):
            # AI plants are stored as `plant-guide:{slug}:en` in guidance_cache.
            row = await db.guidance_cache.find_one(
                {"key": f"plant-guide:{plant_id}:en"}, {"_id": 0},
            )
            if not row:
                raise HTTPException(404, "Plant not found")
            d = row.get("data") or {}
            return {
                "id": plant_id,
                "name": d.get("name") or plant_id,
                "category": d.get("category") or "",
                "difficulty": d.get("difficulty") or "",
                "sun": d.get("sun") or "",
                "water": d.get("water") or "",
                "summary": d.get("summary") or "",
            }
        p = PLANT_INDEX.get(plant_id)
        if not p:
            raise HTTPException(404, "Plant not found")
        return {
            "id": p["id"],
            "name": p.get("name") or plant_id,
            "category": p.get("category") or "",
            "difficulty": p.get("difficulty") or "",
            "sun": p.get("sun") or "",
            "water": p.get("water") or "",
            "summary": p.get("summary") or "",
        }

    @router.get("/plants/{plant_id}/og.png")
    async def plant_og_card(plant_id: str):
        """Render (and cache) the 1200×630 OG card for a plant guide page."""
        p = await _resolve_plant_for_og(plant_id)
        cached = await db.plant_og_cache.find_one(
            {"plant_id": plant_id}, {"_id": 0, "png": 1},
        )
        if cached and cached.get("png"):
            png_bytes = cached["png"]
        else:
            png_bytes = render_plant_og_png(
                plant_name=p["name"], category=p["category"],
                difficulty=p["difficulty"], sun=p["sun"], water=p["water"],
            )
            await db.plant_og_cache.update_one(
                {"plant_id": plant_id},
                {"$set": {
                    "plant_id": plant_id, "png": png_bytes,
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }},
                upsert=True,
            )
        return Response(
            content=png_bytes, media_type="image/png",
            headers={"Cache-Control": "public, max-age=86400"},
        )

    @router.get("/plants/preview/{plant_id}", response_class=HTMLResponse)
    async def plant_preview(plant_id: str, request: Request):
        """Bot-friendly HTML wrapper for a plant page. Crawlers see OG/Twitter
        meta tags up-front; humans get redirected into the SPA."""
        p = await _resolve_plant_for_og(plant_id)

        public_origin = (
            os.environ.get("PUBLIC_APP_URL", "").rstrip("/")
            or _plant_origin_from_request(request)
        )
        clean_url = f"{public_origin}/plants/{'ai/' if plant_id.startswith('ai-') else ''}{plant_id}"
        # ?v= cache-buster — keyed on the plant id itself for now (curated
        # plants don't change; AI plants rarely re-cache).
        v = hashlib.sha1(plant_id.encode()).hexdigest()[:10]
        og_image_url = f"{public_origin}/api/plants/{plant_id}/og.png?v={v}"

        title = f"How to grow {p['name']} — Patch & Pot"
        bits = [b for b in (p["category"], p["difficulty"]) if b]
        meta_facts = ("  ·  ".join(bits) + ".  ") if bits else ""
        desc = (
            f"{meta_facts}{p['summary']}".strip()
            or f"A small-space growing guide for {p['name']} on Patch & Pot."
        )

        # JSON-LD Schema.org markup — turns this page into a rich result in
        # Google search. Article + HowTo are both relevant for plant guides;
        # Article is the safer choice unless we have explicit step-by-step
        # instructions (some guides do, some don't).
        jsonld = json.dumps({
            "@context": "https://schema.org",
            "@type": "Article",
            "headline": title,
            "description": desc,
            "image": og_image_url,
            "url": clean_url,
            "author": {"@type": "Organization", "name": "Patch & Pot"},
            "publisher": {
                "@type": "Organization",
                "name": "Patch & Pot",
                "logo": {
                    "@type": "ImageObject",
                    "url": f"{public_origin}/logo192.png",
                },
            },
            "datePublished": "2025-06-01",
            "dateModified": datetime.now(timezone.utc).date().isoformat(),
            "mainEntityOfPage": clean_url,
            "about": {
                "@type": "Thing",
                "name": p["name"],
                **({"description": p["summary"]} if p.get("summary") else {}),
            },
        }, ensure_ascii=False)

        body_html = _plant_preview_html(
            title=title, desc=desc, og_image_url=og_image_url,
            clean_url=clean_url, name=p["name"], jsonld=jsonld,
        )
        return HTMLResponse(
            content=body_html,
            headers={"Cache-Control": "public, max-age=300"},
        )

    return router


def _plant_origin_from_request(request: Request) -> str:
    """Recover the public origin (scheme://host) from forwarding headers."""
    proto = request.headers.get("x-forwarded-proto") or request.url.scheme or "https"
    host = (
        request.headers.get("x-forwarded-host")
        or request.headers.get("host")
        or request.url.hostname
        or "patchandpot.app"
    )
    host = host.split(",")[0].strip()
    return f"{proto}://{host}"


def _plant_preview_html(*, title, desc, og_image_url, clean_url, name, jsonld="") -> str:
    """Minimal plant-preview HTML — same posture as share preview wrapper."""
    js_url = _js_string_literal(clean_url)
    schema_block = f'<script type="application/ld+json">{jsonld}</script>' if jsonld else ""
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
<link rel="canonical" href="{html.escape(clean_url)}">
<meta property="og:type" content="article">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:url" content="{html.escape(clean_url)}">
<meta property="og:image" content="{html.escape(og_image_url)}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="How to grow {html.escape(name)} — Patch & Pot">
<meta property="og:site_name" content="Patch & Pot">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{html.escape(title)}">
<meta name="twitter:description" content="{html.escape(desc)}">
<meta name="twitter:image" content="{html.escape(og_image_url)}">
<meta http-equiv="refresh" content="0; url={html.escape(clean_url)}">
{schema_block}
<style>
  html, body {{ margin: 0; padding: 0; background: #F7F5F0; color: #1C231A;
    font-family: ui-serif, Georgia, "Times New Roman", serif; height: 100%; }}
  .wrap {{ display: flex; flex-direction: column; align-items: center;
    justify-content: center; height: 100%; padding: 0 24px; text-align: center; }}
  h1 {{ font-style: italic; font-weight: 700; font-size: 2.2rem; color: #2D4A22;
    margin: 0 0 12px; letter-spacing: -0.01em; }}
  p  {{ color: #5C6B52; margin: 0 0 20px; font-family: ui-sans-serif, system-ui, sans-serif; }}
  a  {{ color: #C65D47; text-decoration: none; border-bottom: 1px solid #C65D47;
    padding-bottom: 2px; font-family: ui-sans-serif, system-ui, sans-serif; }}
</style>
</head>
<body>
<div class="wrap">
  <h1>Opening the {html.escape(name)} guide…</h1>
  <p>If you're not redirected automatically:</p>
  <a href="{html.escape(clean_url)}">Continue to the guide →</a>
</div>
<script>
  window.location.replace({js_url});
</script>
</body>
</html>
"""


def _js_string_literal(value: str) -> str:
    safe = (
        value.replace("\\", "\\\\")
        .replace('"', '\\"')
        .replace("\n", "\\n").replace("\r", "\\r")
        .replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")
    )
    return f'"{safe}"'


async def _record_plant_view(db, plant_id: str, fp: str) -> None:
    """24h-debounced visit counter for the homepage 'Plant of the week' rail.

    On a fresh fingerprint, inserts a TTL-expiring row in `plant_views` and
    increments two counters on `plant_stats`: an all-time `view_count` and a
    7-day-rolling `view_count_7d` that the weekly scheduler decays. On a
    repeat fingerprint the insert raises DuplicateKeyError and we silently
    skip the increment — same behaviour as shared_patch_views.
    """
    from pymongo.errors import DuplicateKeyError
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=24)
    try:
        await db.plant_views.insert_one({
            "_id": f"{plant_id}:{fp}",
            "plant_id": plant_id,
            "viewed_at": now.isoformat(),
            "expires_at": expires_at,
        })
    except DuplicateKeyError:
        # Expected on revisits within the 24h TTL window — just skip.
        return
    except Exception as e:  # noqa: BLE001
        # Network blip or other transient error — log + skip so the visit
        # counter never takes down a plant page render.
        logger.warning("plant_views insert failed (skipping counter): %s", e)
        return
    try:
        await db.plant_stats.update_one(
            {"plant_id": plant_id},
            {"$inc": {"view_count": 1, "view_count_7d": 1}},
            upsert=True,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("plant_stats increment failed: %s", e)
