"""Translate the new grow.* / plants.grow_where.* / plants.pot_* /
recipe.* / nav.* keys into all 57 non-English locales and inject them
into /app/frontend/src/i18n/locales/{code}.js.

Reuses the LOCALES + Claude helper from translate_new_keys.py and the
per-locale upsert from translate_recommended_and_sort_keys.py.

Usage:
    cd /app && python scripts/translate_grow_anywhere_and_recipes_keys.py [code1 code2 …]
"""
import asyncio
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv  # noqa: E402

from translate_new_keys import LOCALES, translate_keys_for  # noqa: E402
import translate_new_keys as base  # noqa: E402
from translate_recommended_and_sort_keys import upsert_into_locale_file  # noqa: E402

load_dotenv("/app/backend/.env")
os.environ.setdefault("EMERGENT_LLM_KEY", os.environ.get("EMERGENT_LLM_KEY", ""))


base.NEW_KEYS = {
    # nav additions
    "nav.grow_anywhere": "Grow Anywhere",
    "nav.recipes": "Recipes",

    # plants page — grow-where chip + pot spec keys
    "plants.grow_where.label": "Grow where?",
    "plants.grow_where.hint": "Filter by where you can realistically grow it.",
    "plants.grow_where.clear": "All spaces",
    "plants.pot_litres": "Smallest pot",
    "plants.pot_litres_value": "{litres} L",
    "plants.pot_depth": "Root depth",
    "plants.pot_depth_value": "{depth} cm",
    "plants.grow_where.heading": "Where can I grow this?",
    "plants.grow_where.subheading": "Situations where this plant is a reliable fit — from someone's kitchen sill to a wind-blown rooftop.",

    # /grow-anywhere landing
    "grow.eyebrow": "Grow anywhere",
    "grow.title": "Grow Anywhere",
    "grow.intro": "You don't need a garden to grow something worth eating or looking at. Pick a situation you actually have — a bright office window, a battered bucket, a shady backyard corner, a wall crevice — and we'll show you every plant in the library that thrives there.",
    "grow.tile.count": "{n} plants",
    "grow.filter_active": "Showing plants that thrive on a {situation}",
    "grow.filter_active_clear": "Clear filter",
    "grow.section.small_indoors": "Small & indoors",
    "grow.section.outdoors_small": "Outdoors, small containers",
    "grow.section.creative": "Creative reuse & tight spots",
    "grow.section.bigger": "Bigger containers & beds",
    "grow.section.no_soil": "No soil at all",

    "grow.situation.windowsill.label": "Windowsill",
    "grow.situation.windowsill.blurb": "Bright indoor light, small pot, no outdoor access — the classic kitchen sill.",
    "grow.situation.workplace.label": "Workplace desk",
    "grow.situation.workplace.blurb": "Office corner, moderate light, forgiving of weekends away.",
    "grow.situation.balcony.label": "Balcony",
    "grow.situation.balcony.blurb": "A few pots on a flat outdoor perch — some sun, some wind.",
    "grow.situation.rooftop.label": "Rooftop",
    "grow.situation.rooftop.blurb": "Full sun, hot in summer, wind-battered — pick tough, drought-tolerant plants.",
    "grow.situation.shady-corner.label": "Shady corner",
    "grow.situation.shady-corner.blurb": "North-facing patch, under a tree, or in the lee of a building.",
    "grow.situation.hanging-basket.label": "Hanging basket",
    "grow.situation.hanging-basket.blurb": "Trailing plants overhead — light, dries out fast, wants a soft touch.",
    "grow.situation.wall-crevice.label": "Wall crevice",
    "grow.situation.wall-crevice.blurb": "A drystone pocket or crumbling brick — tiny root run, huge drought.",
    "grow.situation.vertical-wall.label": "Vertical wall pocket",
    "grow.situation.vertical-wall.blurb": "Living-wall pouches or stacked planters — very shallow roots only.",
    "grow.situation.grow-bag.label": "Grow bag",
    "grow.situation.grow-bag.blurb": "Cheap flexible bag, 20–40 L — hungry crops with big roots love these.",
    "grow.situation.bucket.label": "Reused bucket",
    "grow.situation.bucket.blurb": "A salvaged 10–20 L bucket with drainage holes — a proper productive pot for very little cost.",
    "grow.situation.crate.label": "Wooden crate",
    "grow.situation.crate.blurb": "A shallow wine or veg crate lined with hessian — perfect for salad and shallow-rooted herbs.",
    "grow.situation.raised-bed.label": "Raised bed",
    "grow.situation.raised-bed.blurb": "A traditional plot or timber-sided bed — deepest root run, widest planting choice.",
    "grow.situation.water-jar.label": "Water jar",
    "grow.situation.water-jar.blurb": "A jam jar of water on the sill — no soil at all. Regrow from kitchen scraps.",

    "grow.empty": "No plants match this space yet.",
    "grow.explore_all": "Explore the plant library",
    "grow.cta.title": "Grow Anywhere",
    "grow.cta.blurb": "No garden? A sunny sill, a wall pocket or a battered bucket is enough. Find plants that thrive in the space you actually have.",
    "grow.cta.button": "Find plants for your space",

    # /recipes landing
    "recipe.eyebrow": "Kitchen",
    "recipe.title": "Recipes",
    "recipe.intro": "Budget-friendly dishes that lean on balcony and windowsill harvests. Allergen labelled, one-pan where we can, and every recipe cross-links to the plants it uses.",
    "recipe.filter.label": "Diet",
    "recipe.filter.all": "All recipes",
    "recipe.section.salads": "Quick Salads",
    "recipe.section.mains": "Simple Mains",
    "recipe.section.sides": "Soups & Sides",
    "recipe.section.sweet": "Sweet & Snacks",
    "recipe.serves": "Serves",
    "recipe.ingredients": "Ingredients",
    "recipe.method": "Method",
    "recipe.uses": "From your patch",
    "recipe.diet.V": "V",
    "recipe.diet.VG": "VG",
    "recipe.diet.GF": "GF",
    "recipe.diet.DF": "DF",
    "recipe.diet.can-gf": "can be GF",
    "recipe.diet_full.V": "vegetarian",
    "recipe.diet_full.VG": "vegan",
    "recipe.diet_full.GF": "gluten-free",
    "recipe.diet_full.DF": "dairy-free",
    "recipe.diet_full.can_gf": "with a gluten-free flour swap",
    "recipe.diet.can_be_note": "\"can be\" tags mean an easy swap gets you there.",
    "recipe.allergen_key": "Allergen key",
    "recipe.waste_tips.heading": "Waste-less tips",
    "recipe.waste_tips.body": "Freeze herb stems in olive-oil cubes for winter soups · bake stale bread into crumbs · simmer tomato skins and onion trimmings for a light stock · roast leftover roots into a soup base the next day.",
}

LOCALES_DIR = Path("/app/frontend/src/i18n/locales")


async def main():
    only = set(sys.argv[1:]) if len(sys.argv) > 1 else None
    success = 0
    failures: list[str] = []
    for code, label in LOCALES.items():
        if only and code not in only:
            continue
        path = LOCALES_DIR / f"{code}.js"
        if not path.exists():
            print(f"  ⚠ skip {code}: file not found")
            continue
        print(f"→ {code} ({label})…", flush=True)
        try:
            translated = await asyncio.wait_for(translate_keys_for(code, label), timeout=240)
        except Exception as e:  # noqa: BLE001
            print(f"  ❌ {code} failed: {e!r}", file=sys.stderr)
            failures.append(code)
            continue
        upsert_into_locale_file(path, translated)
        print(f"  ✓ {code}: 'grow.title' → {translated.get('grow.title')!r}")
        success += 1

    print(f"\ndone. {success}/{len(LOCALES) if not only else len(only)} locales updated.")
    if failures:
        print(f"failed locales (rerun with these as args): {' '.join(failures)}")


if __name__ == "__main__":
    asyncio.run(main())
