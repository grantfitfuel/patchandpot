"""Region search + reverse geocode endpoints.

Backed by the free Open-Meteo geocoding API (no key required). Used by the
RegionPicker UI to let visitors auto-detect their location OR search any
place on Earth.
"""
import logging
from typing import Optional

import httpx
from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter()


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
    url = "https://geocoding-api.open-meteo.com/v1/reverse"
    params = {"latitude": lat, "longitude": lon, "language": "en", "count": 1, "format": "json"}
    place: dict[str, Optional[str]] = {"name": None, "country": None}
    try:
        async with httpx.AsyncClient(timeout=10) as http:
            r = await http.get(url, params=params)
            if r.status_code == 200:
                items = r.json().get("results") or []
                if items:
                    it = items[0]
                    place = {"name": it.get("name"), "country": it.get("country"),
                             "admin": it.get("admin1"), "timezone": it.get("timezone")}
    except Exception as e:  # noqa: BLE001
        logger.warning("Reverse geocode failed: %s", e)

    hemisphere = "southern" if lat < 0 else "northern"
    abs_lat = abs(lat)
    if abs_lat < 23.5:
        climate = "Tropical"
    elif abs_lat < 35:
        climate = "Subtropical"
    elif abs_lat < 55:
        climate = "Temperate"
    elif abs_lat < 66.5:
        climate = "Cool temperate / Subpolar"
    else:
        climate = "Polar"

    return {
        "name": place.get("name") or "Your location",
        "country": place.get("country"),
        "admin": place.get("admin"),
        "latitude": lat,
        "longitude": lon,
        "hemisphere": hemisphere,
        "climate_zone": climate,
    }
