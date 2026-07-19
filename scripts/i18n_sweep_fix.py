"""Sweep-fix: for EVERY key that exists in en.js but not in a non-EN locale,
translate the English value into that locale and inject it.

Uses the existing translate_new_keys pipeline. Reads the English source
directly from en.js so we never fall behind again.
"""
import asyncio
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv  # noqa: E402

from translate_new_keys import LOCALES, translate_keys_for  # noqa: E402
import translate_new_keys as base  # noqa: E402
from translate_recommended_and_sort_keys import upsert_into_locale_file  # noqa: E402

load_dotenv("/app/backend/.env")

LOCALES_DIR = Path("/app/frontend/src/i18n/locales")


def parse_locale(path: Path) -> dict[str, str]:
    """Very forgiving parser: pulls "key": "value", pairs out of a locale
    ES-module file. Handles double-quoted strings only (the format used
    throughout this codebase). Concatenates continued strings safely."""
    src = path.read_text()
    out: dict[str, str] = {}
    # match key: "value" — value may contain escaped quotes
    for m in re.finditer(r'"([^"]+)"\s*:\s*"((?:\\.|[^"\\])*)"', src):
        out[m.group(1)] = m.group(2)
    return out


async def main():
    en = parse_locale(LOCALES_DIR / "en.js")
    print(f"# en.js has {len(en)} keys", file=sys.stderr)

    # Per-locale sweep. For each locale, compute the exact set of keys that
    # exist in EN but not there, then translate only those.
    for code, label in LOCALES.items():
        path = LOCALES_DIR / f"{code}.js"
        if not path.exists():
            continue
        loc = parse_locale(path)
        missing = {k: en[k] for k in en if k not in loc and en[k].strip()}
        if not missing:
            print(f"→ {code}: complete, skip", flush=True)
            continue
        print(f"→ {code} ({label}): {len(missing)} missing…", flush=True)
        base.NEW_KEYS = missing
        try:
            translated = await asyncio.wait_for(translate_keys_for(code, label), timeout=300)
        except Exception as e:  # noqa: BLE001
            print(f"  ❌ {code} failed: {e!r}", file=sys.stderr)
            continue
        upsert_into_locale_file(path, translated)
        sample = next(iter(translated.values()))[:60] if translated else ""
        print(f"  ✓ {code}: sample → {sample!r}")


if __name__ == "__main__":
    asyncio.run(main())
