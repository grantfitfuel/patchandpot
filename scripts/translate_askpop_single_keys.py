"""Translate the extended askpop.* keys (permalink + single-page copy)
into all 57 non-English locales.

Usage:
    cd /app && python scripts/translate_askpop_single_keys.py [code1 code2 …]
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
    "askpop.permalink": "Open this question on its own page",
    "askpop.single.back": "Back to all questions",
    "askpop.single.not_found_title": "Question not found",
    "askpop.single.not_found_blurb": "This question may have been removed or hasn't been asked enough times yet to appear publicly. Browse the full common-questions list instead.",
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
            continue
        print(f"→ {code}…", flush=True)
        try:
            translated = await asyncio.wait_for(translate_keys_for(code, label), timeout=180)
        except Exception as e:  # noqa: BLE001
            print(f"  ❌ {code} failed: {e!r}", file=sys.stderr)
            failures.append(code); continue
        upsert_into_locale_file(path, translated)
        success += 1
    print(f"done. {success} locales updated.")
    if failures:
        print(f"failed: {' '.join(failures)}")


if __name__ == "__main__":
    asyncio.run(main())
