"""Translate the three new source.local.* keys ("Shop local first" nudge)
into all 57 non-English locales.
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

base.NEW_KEYS = {
    "source.local.title": "Shop local first",
    "source.local.body": (
        "The best plants come from a real nursery — someone who knows your "
        "soil, your climate, and can tell you if a variety actually thrives "
        "on your street. Try a local garden centre before the online options "
        "below. It keeps small growers going."
    ),
    "source.local.cta": "Find nurseries near me",
}

LOCALES_DIR = Path("/app/frontend/src/i18n/locales")


async def main():
    success = 0
    failures = []
    for code, label in LOCALES.items():
        path = LOCALES_DIR / f"{code}.js"
        if not path.exists():
            continue
        print(f"→ {code} ({label})…", flush=True)
        try:
            translated = await asyncio.wait_for(translate_keys_for(code, label), timeout=120)
        except Exception as e:  # noqa: BLE001
            print(f"  ❌ {code} failed: {e!r}", file=sys.stderr)
            failures.append(code)
            continue
        upsert_into_locale_file(path, translated)
        print(f"  ✓ {code}: {translated.get('source.local.title')!r}")
        success += 1

    print(f"\ndone. {success}/{len(LOCALES)} locales updated.")
    if failures:
        print(f"failed: {' '.join(failures)}")


if __name__ == "__main__":
    asyncio.run(main())
