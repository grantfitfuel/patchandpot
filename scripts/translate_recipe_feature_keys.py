"""Translate the enlarged recipe.* + plants.cook_with.* keys into all 57
non-English locales.

Usage:
    cd /app && python scripts/translate_recipe_feature_keys.py [code1 code2 …]
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
    "recipe.eyebrow": "A real reason to grow",
    "recipe.intro": "Every recipe here uses something you can actually grow at home — glut-solvers, one-pan meals from a windowsill, and preserves that carry summer through the winter. Filter by what's in season now, or by what's already in your garden.",
    "recipe.filter.show": "Show",
    "recipe.filter.in_season": "In season now",
    "recipe.filter.my_garden": "From my garden",
    "recipe.filter.ingredient": "Showing recipes that use {ingredient}",
    "recipe.filter.clear": "Clear filter",
    "recipe.empty": "No recipes match this filter yet. Try clearing the ingredient chip or switching to \"All recipes\".",
    "recipe.section.preserves": "Preserves for Winter",
    "recipe.section.preserves_blurb": "Bottle summer while it's cheap. Every jar in the cupboard is a reason to plant more next spring — quick oil cubes, honest chutneys, jams and syrups that carry a garden through January.",
    "plants.cook_with.heading": "Cook with this",
    "plants.cook_with.subheading": "Recipes in the library that lean on this plant. Grown at home is grown for a reason.",
    "plants.cook_with.see_all": "See all {n} recipes",
}

LOCALES_DIR = Path("/app/frontend/src/i18n/locales")


async def main():
    only = set(sys.argv[1:]) if len(sys.argv) > 1 else None
    success, failures = 0, []
    for code, label in LOCALES.items():
        if only and code not in only:
            continue
        path = LOCALES_DIR / f"{code}.js"
        if not path.exists():
            print(f"  ⚠ skip {code}: file not found")
            continue
        print(f"→ {code} ({label})…", flush=True)
        try:
            translated = await asyncio.wait_for(translate_keys_for(code, label), timeout=200)
        except Exception as e:  # noqa: BLE001
            print(f"  ❌ {code} failed: {e!r}", file=sys.stderr)
            failures.append(code)
            continue
        upsert_into_locale_file(path, translated)
        print(f"  ✓ {code}: 'recipe.eyebrow' → {translated.get('recipe.eyebrow')!r}")
        success += 1
    print(f"\ndone. {success} locales updated.")
    if failures:
        print(f"failed locales (rerun with these as args): {' '.join(failures)}")


if __name__ == "__main__":
    asyncio.run(main())
