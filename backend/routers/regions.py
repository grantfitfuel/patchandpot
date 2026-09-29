"""Region search + reverse geocode + IP-based detect endpoints.

Backed by:
  - Open-Meteo geocoding (free, no key) for search + reverse-from-lat/lon
  - Cloudflare edge headers (`cf-iplatitude`, `cf-iplongitude`, `cf-ipcountry`)
    for IP-based lat/lon when the browser's Geolocation API fails or is denied
  - ipapi.co (free 1000/day, no key) as a last-resort fallback when the request
    didn't come through Cloudflare or the CF headers are absent.

The whole detect/ip-detect path is best-effort: if everything fails, we return
a 503 and the UI falls back to manual search.
"""
import logging
from typing import Optional

import httpx
from fastapi import APIRouter, HTTPException, Request

logger = logging.getLogger(__name__)
router = APIRouter()


def _climate_for(lat: float) -> str:
    a = abs(lat)
    if a < 23.5:
        return "Tropical"
    if a < 35:
        return "Subtropical"
    if a < 55:
        return "Temperate"
    if a < 66.5:
        return "Cool temperate / Subpolar"
    return "Polar"


def _resolve_name(*, name, admin, country, lat, lon):
    """Pick the best human-readable name for a region.

    Cascade: city name → admin/region → country → a coord stub. We deliberately
    NEVER return the literal phrase "Your location" — that string used to leak
    all the way into PDF titles and AI prompts when reverse-geocode came back
    empty. A coord stub like "Near 51.5°N, 0.1°W" is uglier but at least carries
    real information the user can recognise.
    """
    for candidate in (name, admin, country):
        if candidate and isinstance(candidate, str) and candidate.strip():
            return candidate.strip()
    if lat is not None and lon is not None:
        try:
            lat_f = float(lat)
            lon_f = float(lon)
            ns = "N" if lat_f >= 0 else "S"
            ew = "E" if lon_f >= 0 else "W"
            return f"Near {abs(lat_f):.1f}°{ns}, {abs(lon_f):.1f}°{ew}"
        except (TypeError, ValueError):
            pass
    return "Unknown location"


async def _reverse_name(http: httpx.AsyncClient, lat: float, lon: float) -> dict:
    """Best-effort: ask Open-Meteo for a city/country name for these coords.

    Falls back to OpenStreetMap's Nominatim when Open-Meteo returns nothing —
    we found Open-Meteo's /v1/reverse endpoint silently 404s for a lot of
    valid coords (incl. central London) which used to leak the "Your location"
    fallback all the way into PDF titles.
    """
    place: dict[str, Optional[str]] = {"name": None, "country": None, "admin": None}
    try:
        r = await http.get(
            "https://geocoding-api.open-meteo.com/v1/reverse",
            params={"latitude": lat, "longitude": lon, "language": "en", "count": 1, "format": "json"},
        )
        if r.status_code == 200:
            items = r.json().get("results") or []
            if items:
                it = items[0]
                place = {
                    "name": it.get("name"),
                    "country": it.get("country"),
                    "admin": it.get("admin1"),
                    "timezone": it.get("timezone"),
                }
    except Exception as e:  # noqa: BLE001
        logger.warning("reverse name lookup (open-meteo) failed: %s", e)

    # Open-Meteo unavailable or empty → try Nominatim (OSM). Their usage policy
    # requires a meaningful User-Agent and ≤1 req/sec; both are easy here.
    if not place.get("name"):
        try:
            r = await http.get(
                "https://nominatim.openstreetmap.org/reverse",
                params={
                    "lat": lat, "lon": lon, "format": "json",
                    "zoom": 10, "accept-language": "en",
                },
                headers={"User-Agent": "PatchAndPot/1.0 (gardening app; gcanth@gmail.com)"},
            )
            if r.status_code == 200:
                data = r.json() or {}
                addr = data.get("address") or {}
                # Prefer the smallest sensible locality. Some of these are
                # mutually exclusive depending on country: 'city' / 'town' /
                # 'village' / 'municipality' / 'suburb' / 'county'.
                locality = (
                    addr.get("city") or addr.get("town") or addr.get("village")
                    or addr.get("municipality") or addr.get("suburb")
                    or addr.get("county") or data.get("name")
                )
                place["name"] = place.get("name") or locality
                place["country"] = place.get("country") or addr.get("country")
                place["admin"] = place.get("admin") or addr.get("state") or addr.get("region")
        except Exception as e:  # noqa: BLE001
            logger.warning("reverse name lookup (nominatim) failed: %s", e)

    return place


@router.get("/regions/search")
async def search_regions(q: str):
    """Search places via Open-Meteo geocoding (free, no key)."""
    if not q or len(q.strip()) < 2:
        return {"results": []}

    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {"name": q.strip(), "count": 8, "language": "en", "format": "json"}
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            r = await http.get(url, params=params)
            r.raise_for_status()
            payload = r.json()
    except Exception as e:  # noqa: BLE001
        logger.error("Geocoding search failed: %s", e)
        return {"results": []}

    results = [{
        "name": item.get("name"),
        "admin": item.get("admin1"),
        "country": item.get("country"),
        "latitude": item.get("latitude"),
        "longitude": item.get("longitude"),
        "timezone": item.get("timezone"),
    } for item in payload.get("results", [])]
    return {"results": results}


@router.get("/regions/reverse")
async def reverse_geocode(lat: float, lon: float):
    """Reverse geocode coordinates and infer hemisphere + a rough climate label."""
    async with httpx.AsyncClient(timeout=10) as http:
        place = await _reverse_name(http, lat, lon)
    hemisphere = "southern" if lat < 0 else "northern"
    return {
        "name": _resolve_name(
            name=place.get("name"),
            admin=place.get("admin"),
            country=place.get("country"),
            lat=lat, lon=lon,
        ),
        "country": place.get("country"),
        "admin": place.get("admin"),
        "latitude": lat,
        "longitude": lon,
        "hemisphere": hemisphere,
        "climate_zone": _climate_for(lat),
    }


@router.get("/regions/ip-detect")
async def ip_detect(request: Request):
    """Last-resort geo-detect using the request's IP / Cloudflare edge headers.

    Strategy:
      1. If the request came through Cloudflare AND `cf-iplatitude` / `cf-iplongitude`
         are present (IP Geolocation enabled in CF dashboard), use those.
      2. Else, look up the request IP against ipapi.co (free, no key, 1000/day).
      3. Either way, reverse-geocode the resulting lat/lon for a friendly city name.

    Returns the same shape as `/regions/reverse` so the frontend can use it
    interchangeably.
    """
    cf_lat = request.headers.get("cf-iplatitude")
    cf_lon = request.headers.get("cf-iplongitude")
    cf_country = request.headers.get("cf-ipcountry")

    lat: Optional[float] = None
    lon: Optional[float] = None
    country_hint: Optional[str] = None
    name_hint: Optional[str] = None
    admin_hint: Optional[str] = None
    source = "unknown"

    if cf_lat and cf_lon:
        try:
            lat, lon = float(cf_lat), float(cf_lon)
            country_hint = cf_country
            source = "cloudflare"
        except (TypeError, ValueError):
            lat = lon = None

    if lat is None or lon is None:
        # Find a usable request IP: prefer x-forwarded-for (first hop), fall back to
        # the socket peer. Skip private/loopback ranges — ipapi.co rejects them.
        xff = request.headers.get("x-forwarded-for", "")
        client_ip = (xff.split(",")[0].strip() if xff else None) or (
            request.client.host if request.client else None
        )
        if client_ip and not (
            client_ip.startswith(("10.", "192.168.", "127.", "169.254.", "172.16."))
            or client_ip == "::1"
        ):
            try:
                async with httpx.AsyncClient(timeout=6) as http:
                    r = await http.get(f"https://ipapi.co/{client_ip}/json/")
                    if r.status_code == 200:
                        d = r.json()
                        lat = d.get("latitude")
                        lon = d.get("longitude")
                        country_hint = d.get("country_name") or d.get("country")
                        # ipapi already gives us a city and region — use them
                        # so we don't need a secondary reverse-geocode that
                        # often returns nothing for IP-centroid coordinates.
                        name_hint = d.get("city")
                        admin_hint = d.get("region")
                        source = "ipapi"
            except Exception as e:  # noqa: BLE001
                logger.warning("ipapi lookup failed for %s: %s", client_ip, e)

    if lat is None or lon is None:
        raise HTTPException(503, "Could not detect your location from your network.")

    # Try to enrich the name with Open-Meteo (gives nicer city names than ipapi
    # in some regions). Fall back to whatever the IP service gave us.
    async with httpx.AsyncClient(timeout=8) as http:
        place = await _reverse_name(http, float(lat), float(lon))

    return {
        "name": _resolve_name(
            name=place.get("name") or name_hint,
            admin=place.get("admin") or admin_hint,
            country=place.get("country") or country_hint,
            lat=lat, lon=lon,
        ),
        "country": place.get("country") or country_hint,
        "admin": place.get("admin") or admin_hint,
        "latitude": float(lat),
        "longitude": float(lon),
        "hemisphere": "southern" if lat < 0 else "northern",
        "climate_zone": _climate_for(float(lat)),
        "detect_source": source,
    }
