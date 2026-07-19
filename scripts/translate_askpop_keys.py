"""Translate the new askpop.* keys ("Common questions" page copy)
into all 57 non-English locales.

Usage:
    cd /app && python scripts/translate_askpop_keys.py [code1 code2 …]
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
    "askpop.eyebrow": "Common questions",
    "askpop.title": "What everyone asks Nàdar",
    "askpop.intro": "Real gardening questions that members have asked Nàdar. Every one here has been asked at least twice — no fluff, no one-offs — just the honest gardening problems people actually run into. Free to browse, no sign-up.",
    "askpop.search_placeholder": "Search questions…",
    "askpop.clear_search": "Clear search",
    "askpop.expand_all": "Expand all",
    "askpop.collapse_all": "Collapse all",
    "askpop.count": "{n} questions",
    "askpop.asked_n_times": "Asked {n} times",
    "askpop.loading": "Loading questions…",
    "askpop.empty_pristine": "No popular questions yet — members are still building this list. Come back once a few of the same questions have been asked, or become a member to ask your own.",
    "askpop.empty_search": "Nothing matches that search. Try shorter words, or clear the search to see the whole list.",
    "askpop.cta.title": "Ask your own question",
    "askpop.cta.blurb": "Members can ask Nàdar up to 7 questions a day, upload photos for plant ID or pest diagnosis, and pick the thread back up whenever they like.",
    "askpop.cta.button": "Become a member",
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
        print(f"  ✓ {code}: 'askpop.title' → {translated.get('askpop.title')!r}")
        success += 1
    print(f"\ndone. {success} locales updated.")
    if failures:
        print(f"failed locales (rerun with these as args): {' '.join(failures)}")


if __name__ == "__main__":
    asyncio.run(main())
