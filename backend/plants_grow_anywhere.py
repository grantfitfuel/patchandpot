"""Patch & Pot — "Grow Anywhere" metadata.

Adds THREE new fields to every plant entry at module-load time:
    grow_anywhere      →  list[str]  — situation ids this plant is ideal for
    min_pot_litres     →  int        — smallest realistic pot size in litres
    min_pot_depth_cm   →  int        — minimum root depth in centimetres

Everything is rules-based (from category + tags + sun + water + lifecycle)
so we get honest coverage across all 332 plants without an AI call per
plant. A per-plant `_OVERRIDES` dict wins over the rules when we know a
plant is a special case (e.g. tomato in a bucket, sunflower NOT on a
windowsill).

`SITUATIONS` is the canonical ordered list used by the /grow-anywhere
landing page and by the Plants-page filter chips. Update BOTH the
list here and the i18n keys `grow.situation.<id>.*` when adding one.
"""

# Canonical ordered list of "grow anywhere" situations.
# Order = display order on the /grow-anywhere landing page.
SITUATIONS: list[str] = [
    "windowsill",      # bright indoor light, tight space, <3 L pots
    "workplace",       # office desk / kitchen counter, moderate light
    "balcony",         # small outdoor container, some wind
    "rooftop",         # full sun, hot, wind, weight-conscious
    "shady-corner",    # low light outdoors — under a tree / north wall
    "hanging-basket",  # trailing, light-weight, dries out fast
    "wall-crevice",    # dry-stone wall pocket, extreme drought
    "vertical-wall",   # living-wall pocket, shallow root zone
    "grow-bag",        # flexible outdoor bag, 20–40 L
    "bucket",          # reused 10–20 L bucket with drainage
    "crate",           # salvaged wooden / plastic crate, 15 cm deep
    "raised-bed",      # traditional plot or raised bed, unrestricted root run
    "water-jar",       # kitchen-scrap regrow, jam-jar of water
]

# Situation → default reason string (used by the "why" tooltip on the UI).
# Kept English-only; the frontend uses per-situation i18n copy instead.
SITUATION_LABELS: dict[str, str] = {
    "windowsill": "Windowsill",
    "workplace": "Workplace desk",
    "balcony": "Balcony pot",
    "rooftop": "Rooftop garden",
    "shady-corner": "Shady corner",
    "hanging-basket": "Hanging basket",
    "wall-crevice": "Wall crevice",
    "vertical-wall": "Vertical wall pocket",
    "grow-bag": "Grow bag",
    "bucket": "Reused bucket",
    "crate": "Wooden crate",
    "raised-bed": "Raised bed",
    "water-jar": "Water jar (no soil)",
}


# ─────────────────────── Pot-size defaults by category ───────────────────────
# (litres, depth_cm) — the smallest realistic size for the plant to actually
# produce a decent harvest / bloom. Not the "you can just about get away
# with" number; the honest lower bound.
_CATEGORY_POT: dict[str, tuple[int, int]] = {
    "Herb": (3, 15),
    "Leafy green": (5, 15),
    "Sprouts": (1, 5),
    "Vegetable": (15, 25),
    "Brassica": (15, 25),
    "Legume": (10, 25),
    "Squash": (30, 30),
    "Root": (12, 30),
    "Allium": (5, 15),
    "Fruit": (20, 30),
    "Flower": (5, 20),
    "Cut flower": (10, 25),
    "Shrub": (30, 40),
    "Climber": (15, 30),
    "Tree": (40, 45),
    "Other": (10, 20),
}


# ─────────────────────── Per-plant overrides ───────────────────────
# Only listed here when the rules alone give a wrong or lopsided answer.
# Format:  id: {"pot": (litres, depth_cm) | None,
#               "add": [situations to force-include],
#               "remove": [situations to force-exclude]}
_OVERRIDES: dict[str, dict] = {
    # Big-fruit crops — bucket / grow-bag is the standard small-space route,
    # windowsill is a lie for these.
    "tomato": {"pot": (15, 25), "add": ["bucket", "grow-bag"], "remove": ["windowsill", "wall-crevice"]},
    "cucumber": {"pot": (20, 30), "add": ["grow-bag", "bucket"], "remove": ["windowsill", "wall-crevice"]},
    "courgette": {"pot": (40, 35), "add": ["grow-bag", "bucket"], "remove": ["windowsill", "hanging-basket", "wall-crevice"]},
    "chilli": {"pot": (10, 25), "add": ["windowsill", "bucket", "balcony"], "remove": ["wall-crevice"]},
    "aubergine": {"pot": (15, 30), "add": ["bucket", "grow-bag"], "remove": ["windowsill"]},
    "pepper": {"pot": (12, 25), "add": ["windowsill", "bucket"], "remove": ["wall-crevice"]},
    "potato": {"pot": (40, 40), "add": ["grow-bag", "bucket"], "remove": ["windowsill", "hanging-basket", "wall-crevice", "workplace"]},
    "sweet-potato": {"pot": (40, 40), "add": ["grow-bag", "bucket"], "remove": ["windowsill", "wall-crevice"]},

    # Sunflowers / big showy annuals — need a proper pot, not a windowsill.
    "sunflower": {"pot": (15, 30), "add": ["balcony", "grow-bag", "bucket", "raised-bed"], "remove": ["windowsill", "hanging-basket", "wall-crevice", "workplace"]},

    # Mediterranean herbs — the wall-crevice heroes.
    "rosemary": {"pot": (5, 20), "add": ["wall-crevice", "rooftop", "balcony", "vertical-wall"], "remove": ["water-jar"]},
    "thyme": {"pot": (3, 15), "add": ["wall-crevice", "rooftop", "vertical-wall"], "remove": ["water-jar"]},
    "oregano": {"pot": (3, 15), "add": ["wall-crevice", "rooftop", "vertical-wall"]},
    "sage": {"pot": (5, 20), "add": ["wall-crevice", "rooftop"], "remove": ["water-jar"]},
    "lavender": {"pot": (5, 20), "add": ["wall-crevice", "rooftop", "balcony"], "remove": ["water-jar", "shady-corner"]},

    # Windowsill herb heroes.
    "basil": {"pot": (2, 12), "add": ["windowsill", "workplace", "vertical-wall"]},
    "chives": {"pot": (2, 12), "add": ["windowsill", "workplace", "vertical-wall", "water-jar"]},
    "parsley": {"pot": (3, 20), "add": ["windowsill", "vertical-wall", "workplace"]},
    "coriander": {"pot": (3, 15), "add": ["windowsill", "vertical-wall"]},
    "mint": {"pot": (3, 20), "add": ["windowsill", "workplace", "water-jar"]},
    "lettuce": {"pot": (3, 12), "add": ["windowsill", "crate", "vertical-wall"]},
    "spinach": {"pot": (5, 15), "add": ["crate", "windowsill"]},
    "radish": {"pot": (3, 15), "add": ["crate", "windowsill"]},
    "spring-onion": {"pot": (2, 12), "add": ["water-jar", "windowsill", "workplace"]},

    # Trailing / hanging heroes.
    "strawberry": {"pot": (5, 15), "add": ["hanging-basket", "balcony", "vertical-wall", "windowsill"]},
    "nasturtium": {"pot": (5, 15), "add": ["hanging-basket", "wall-crevice", "balcony"]},
    "sweet-alyssum": {"pot": (2, 12), "add": ["hanging-basket", "wall-crevice", "vertical-wall"]},
    "lobelia": {"pot": (2, 12), "add": ["hanging-basket", "vertical-wall"]},
    "petunia": {"pot": (3, 15), "add": ["hanging-basket", "balcony", "vertical-wall"]},
    "viola": {"pot": (2, 12), "add": ["hanging-basket", "windowsill", "vertical-wall"]},

    # Root crops — deep pot only.
    "carrot": {"pot": (10, 30), "add": ["grow-bag", "bucket"], "remove": ["windowsill", "hanging-basket", "wall-crevice", "crate", "vertical-wall"]},
    "beetroot": {"pot": (8, 25), "add": ["crate", "grow-bag", "bucket"], "remove": ["windowsill", "hanging-basket", "wall-crevice"]},
    "parsnip": {"pot": (15, 40), "add": ["grow-bag", "bucket"], "remove": ["windowsill", "hanging-basket", "wall-crevice", "crate", "vertical-wall"]},

    # Shade heroes.
    "hosta": {"pot": (10, 20), "add": ["shady-corner", "balcony"]},
    "fern-hart-tongue": {"pot": (8, 20), "add": ["shady-corner", "wall-crevice"]},

    # Alliums — sunny bucket / crate.
    "garlic": {"pot": (5, 20), "add": ["crate", "bucket", "raised-bed"]},

    # Sprouts — anywhere with light.
    "microgreens": {"pot": (1, 5), "add": ["windowsill", "workplace", "water-jar"]},
    "cress": {"pot": (1, 5), "add": ["windowsill", "workplace", "water-jar"]},
    "mustard-sprouts": {"pot": (1, 5), "add": ["windowsill", "workplace", "water-jar"]},
    "alfalfa-sprouts": {"pot": (1, 5), "add": ["windowsill", "workplace", "water-jar"]},
    "mung-bean-sprouts": {"pot": (1, 5), "add": ["windowsill", "workplace", "water-jar"]},
    "pea-shoots": {"pot": (1, 5), "add": ["windowsill", "workplace"]},

    # Shrubs / trees — big pot only, no small-space illusions.
    "fig": {"pot": (30, 40), "add": ["balcony", "raised-bed"], "remove": ["windowsill", "hanging-basket", "wall-crevice", "workplace", "vertical-wall", "crate"]},
    "olive": {"pot": (30, 40), "add": ["balcony", "rooftop", "raised-bed"], "remove": ["windowsill", "hanging-basket", "wall-crevice", "workplace", "vertical-wall", "crate", "water-jar"]},
    "lemon": {"pot": (25, 35), "add": ["balcony", "rooftop"], "remove": ["windowsill", "hanging-basket", "wall-crevice", "vertical-wall", "crate", "water-jar"]},
    "blueberry": {"pot": (20, 30), "add": ["balcony", "raised-bed"], "remove": ["hanging-basket", "wall-crevice", "vertical-wall"]},
}


# ─────────────────────── Rules engine ───────────────────────
def _derive_pot(plant: dict) -> tuple[int, int]:
    """Return (litres, depth_cm) for a plant using overrides → category
    defaults. Tags can nudge upward (e.g. `deep-pot` → +5 cm)."""
    ov = _OVERRIDES.get(plant.get("id"), {})
    pot = ov.get("pot")
    if pot:
        return pot
    litres, depth = _CATEGORY_POT.get(plant.get("category") or "Other", (10, 20))
    tags = set(plant.get("tags") or [])
    if "deep-pot" in tags or "root" in tags:
        depth = max(depth, 30)
        litres = max(litres, 10)
    if "large-pot" in tags or "tree" in tags:
        litres = max(litres, 30); depth = max(depth, 40)
    if "compact" in tags or "edging" in tags:
        litres = min(litres, 5)
    return litres, depth


def _derive_grow_anywhere(plant: dict) -> list[str]:
    """Rules-based situation flags. Overrides post-merged so a
    hand-curated `add` always wins."""
    cat = plant.get("category") or ""
    tags = set(plant.get("tags") or [])
    sun = (plant.get("sun") or "").lower()
    water = (plant.get("water") or "").lower()
    lifecycle = (plant.get("lifecycle") or "").lower()
    hardiness = (plant.get("hardiness") or "").lower()
    litres, depth = _derive_pot(plant)

    ideal: set[str] = set()

    # windowsill — bright indoor light, small root zone
    if cat in ("Herb", "Leafy green", "Sprouts") and litres <= 5 and depth <= 20:
        ideal.add("windowsill")
    if "windowsill" in tags or "indoor" in tags or hardiness == "indoor":
        ideal.add("windowsill")

    # workplace — needs to tolerate lower light + long absences
    if cat == "Sprouts":
        ideal.add("workplace")
    if cat == "Herb" and (water in ("low", "moderate")) and ("shade" in tags or "shade-tolerant" in tags or sun in ("partial sun", "shade")):
        ideal.add("workplace")

    # balcony — the default small-space container
    if plant.get("container") is not False and litres <= 30:
        ideal.add("balcony")

    # rooftop — full sun, drought-tolerant, wind-tolerant
    if ("drought" in tags or "mediterranean" in tags or "alpine" in tags
            or "coastal" in tags) and water in ("low", "moderate"):
        ideal.add("rooftop")
    if sun == "full sun" and water == "low" and litres <= 30:
        ideal.add("rooftop")

    # shady corner
    if ("shade" in tags or "shade-tolerant" in tags or "woodland" in tags
            or sun == "shade"):
        ideal.add("shady-corner")
    if cat == "Leafy green" and sun in ("partial sun", "shade"):
        ideal.add("shady-corner")

    # hanging basket — trailing, light
    if "trailing" in tags or "hanging" in tags:
        ideal.add("hanging-basket")

    # wall crevice — extreme drought, tiny root pocket
    if ("alpine" in tags or "wall" in tags) or (
        "drought" in tags and litres <= 5 and cat in ("Herb", "Flower")
    ):
        ideal.add("wall-crevice")

    # vertical wall pocket — very shallow roots
    if depth <= 15 and cat in ("Herb", "Leafy green", "Flower"):
        ideal.add("vertical-wall")
    if "trailing" in tags:
        ideal.add("vertical-wall")

    # grow bag — heavy feeders / deep roots
    if litres >= 15 or "deep-pot" in tags or cat in ("Squash", "Root", "Vegetable", "Brassica", "Legume"):
        ideal.add("grow-bag")

    # bucket — 10–20 L crops
    if 8 <= litres <= 30 and cat in ("Vegetable", "Herb", "Flower", "Fruit", "Brassica", "Legume", "Root", "Allium", "Squash"):
        ideal.add("bucket")

    # crate — shallow-rooted salad + herbs (< 20 cm depth)
    if depth <= 20 and litres <= 15 and cat in ("Herb", "Leafy green", "Root", "Allium", "Sprouts"):
        ideal.add("crate")

    # raised bed — almost everything except sprouts and pure-water regrow
    if cat != "Sprouts" and lifecycle in ("annual", "biennial", "perennial", ""):
        ideal.add("raised-bed")

    # water jar — regrow-from-scraps in water
    regrow = plant.get("regrow") or {}
    if regrow.get("method") in ("water-first", "water-only"):
        ideal.add("water-jar")

    # Apply overrides last
    ov = _OVERRIDES.get(plant.get("id"), {})
    for s in ov.get("add", []):
        ideal.add(s)
    for s in ov.get("remove", []):
        ideal.discard(s)

    # Return in canonical order so UI is stable
    return [s for s in SITUATIONS if s in ideal]


def apply_grow_anywhere_meta(plants: list[dict]) -> None:
    """Mutate `plants` in place — attach three new fields to every plant.

    Called by core.py after all other meta modules so we can safely read
    lifecycle / hardiness / regrow already set on each plant.
    Idempotent — safe to call multiple times.
    """
    for p in plants:
        litres, depth = _derive_pot(p)
        p["min_pot_litres"] = int(litres)
        p["min_pot_depth_cm"] = int(depth)
        p["grow_anywhere"] = _derive_grow_anywhere(p)
