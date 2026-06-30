"""Translate the new home.popular.* keys into all 57 non-English locales
and inject them into /app/frontend/src/i18n/locales/{code}.js.

Same pattern as translate_recommended_and_sort_keys.py — reuses the
LOCALES dict + Claude helper from the older translate_new_keys.py.
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
    "home.popular.eyebrow": "Most-viewed this week",
    "home.popular.title": "What other gardeners are planning",
    "home.popular.body": "The plants people are looking up most often in the last seven days. A quick window into what's in season for the wider Patch & Pot community.",
    "home.popular.more": "Browse the full library",
    "home.popular.views_label": "{count} views this week",
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
            translated = await asyncio.wait_for(translate_keys_for(code, label), timeout=120)
        except Exception as e:  # noqa: BLE001
            print(f"  ❌ {code} failed: {e!r}", file=sys.stderr)
            failures.append(code)
            continue
        upsert_into_locale_file(path, translated)
        print(f"  ✓ {code}: 'home.popular.title' → {translated.get('home.popular.title')!r}")
        success += 1

    print(f"\ndone. {success}/{len(LOCALES)} locales updated.")
    if failures:
        print(f"failed locales (rerun with these as args): {' '.join(failures)}")


if __name__ == "__main__":
    asyncio.run(main())
