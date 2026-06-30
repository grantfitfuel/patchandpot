"""Translate the new regrow.* / cut.* / plants.special.* keys into all 57
non-English locales and inject them into /app/frontend/src/i18n/locales/{code}.js.

Reuses the LOCALES + Claude helper from translate_new_keys.py and the
per-locale upsert from translate_recommended_and_sort_keys.py.
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
    # plants.special.*
    "plants.special.label": "Special collections",
    "plants.special.regrow": "Regrow from scraps",
    "plants.special.cut-flower": "Cut-flower garden",
    "plants.special.regrow.subtitle": "Plants you can start from kitchen scraps — no seed packet required.",
    "plants.special.cut-flower.subtitle": "Vase-tested cut flowers with conditioning notes and honest vase-life.",
    # /regrow-from-scraps landing
    "regrow.eyebrow": "Zero waste",
    "regrow.title": "Regrow from Scraps",
    "regrow.intro": "Start a real harvest from food you'd otherwise throw away. Each entry below has been hand-graded for honesty — no Pinterest clickbait, only methods that actually produce something edible.",
    "regrow.filter.all": "All methods",
    "regrow.filter.water": "Water only",
    "regrow.filter.water-first": "Water then soil",
    "regrow.filter.soil": "Soil only",
    "regrow.worth_it": "Worth it",
    "regrow.method": "Method",
    "regrow.method.water-first": "Root in water, transfer to soil",
    "regrow.method.water-only": "Stays in water",
    "regrow.method.soil-only": "Plant directly into soil",
    "regrow.days_to_first_harvest": "First harvest",
    "regrow.days_value": "{days} days",
    "regrow.yield": "What to expect",
    "regrow.kid_friendly": "Kid-friendly",
    "regrow.instructions": "How to do it",
    "regrow.notes": "Honest note",
    "regrow.detail.heading": "Regrow this plant from scraps",
    "regrow.empty": "No plants match this method.",
    # /cut-flowers landing
    "cut.eyebrow": "Vase-tested",
    "cut.title": "Cut Flowers",
    "cut.intro": "A curated set of flowers with honest vase-life, the exact stage to cut at, and how to condition each stem. The difference between a 5-day flower and a 21-day flower starts here.",
    "cut.filter.all": "All roles",
    "cut.filter.focal": "Focal",
    "cut.filter.spike": "Spike",
    "cut.filter.filler": "Filler",
    "cut.filter.foliage": "Foliage",
    "cut.filter.umbel": "Umbel",
    "cut.sort.vase_days": "Longest vase life",
    "cut.sort.name": "A → Z",
    "cut.vase_days": "Vase life",
    "cut.vase_days_value": "{days} days",
    "cut.cut_at_stage": "Cut at",
    "cut.conditioning": "Conditioning",
    "cut.conditioning.sear": "Sear stem ends",
    "cut.conditioning.warm-water": "Warm water hold",
    "cut.conditioning.cold-water": "Cold water hold",
    "cut.conditioning.split-woody": "Split woody stems",
    "cut.conditioning.none": "No conditioning needed",
    "cut.cut_and_come_again": "Cut & come again",
    "cut.one_shot": "One-shot — one cut, then done",
    "cut.role": "Role",
    "cut.role.focal": "Focal",
    "cut.role.spike": "Spike",
    "cut.role.filler": "Filler",
    "cut.role.foliage": "Foliage",
    "cut.role.umbel": "Umbel",
    "cut.dries_well": "Dries well — also an everlasting",
    "cut.notes": "Honest note",
    "cut.detail.heading": "As a cut flower",
    "cut.empty": "No cut flowers match this role.",
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
            translated = await asyncio.wait_for(translate_keys_for(code, label), timeout=180)
        except Exception as e:  # noqa: BLE001
            print(f"  ❌ {code} failed: {e!r}", file=sys.stderr)
            failures.append(code)
            continue
        upsert_into_locale_file(path, translated)
        print(f"  ✓ {code}: 'regrow.title' → {translated.get('regrow.title')!r}")
        success += 1

    print(f"\ndone. {success}/{len(LOCALES) if not only else len(only)} locales updated.")
    if failures:
        print(f"failed locales (rerun with these as args): {' '.join(failures)}")


if __name__ == "__main__":
    asyncio.run(main())
