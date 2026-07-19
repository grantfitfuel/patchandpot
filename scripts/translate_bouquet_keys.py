"""Translate the bouquet.* + nav.bouquet keys into all 57 non-English
locales. Piggy-backs on translate_new_keys.py.

Usage:
    cd /app && python scripts/translate_bouquet_keys.py [code1 code2 …]
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
    "nav.bouquet": "Bouquet",
    "bouquet.eyebrow": "Bouquet from your patch",
    "bouquet.pick.title": "Confirm what's in bloom",
    "bouquet.pick.intro": "We won't guess. Tick the plants you can actually cut in your garden today — even one herb going to flower counts. Add anything you're foraging or that isn't in our library. Two stems minimum, ten is plenty.",
    "bouquet.pick.selected_count": "{n} confirmed in bloom",
    "bouquet.pick.empty": "We couldn't find any flowering candidates in your garden yet. Add a cut-flower plant to My Garden first, or type in whatever you have blooming below.",
    "bouquet.pick.add_placeholder": "Add another (dill flower, weed, herb…)",
    "bouquet.pick.add_btn": "Add",
    "bouquet.pick.arrange_btn": "Arrange my bouquet",
    "bouquet.pick.arranging": "Arranging…",
    "bouquet.pick.need_two": "Pick at least two so we can arrange something.",
    "bouquet.result.back": "Change what's in bloom",
    "bouquet.result.vase": "Vase",
    "bouquet.result.mechanic": "Mechanic",
    "bouquet.result.stems": "Stems and cuts",
    "bouquet.result.build": "How to build it",
    "bouquet.result.regenerate": "Try a different arrangement",
    "bouquet.result.share": "Share this bouquet",
    "bouquet.result.explore_cut_flowers": "Explore cut-flower plants",
    "bouquet.result.painting": "Painting your watercolour…",
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
        print(f"  ✓ {code}: 'bouquet.pick.title' → {translated.get('bouquet.pick.title')!r}")
        success += 1
    print(f"\ndone. {success} locales updated.")
    if failures:
        print(f"failed locales (rerun with these as args): {' '.join(failures)}")


if __name__ == "__main__":
    asyncio.run(main())
