"""One-off: translate the new recommended.* keys + the plants.sort.* keys
into all 57 non-English locales and inject them into the per-locale files
at /app/frontend/src/i18n/locales/{code}.js.

The earlier translate_*_keys.py scripts targeted a monolithic
/app/frontend/src/i18n/index.jsx — that file has since been split into
per-locale modules. This script speaks the new layout.

Usage:
    cd /app && python scripts/translate_recommended_and_sort_keys.py [code1 code2 …]
    (no args  → translate all 57 non-EN locales)
    (with args → translate just the listed locale codes)
"""
import asyncio
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv  # noqa: E402

from translate_new_keys import LOCALES, translate_keys_for  # noqa: E402
import translate_new_keys as base  # noqa: E402

load_dotenv("/app/backend/.env")
os.environ.setdefault("EMERGENT_LLM_KEY", os.environ.get("EMERGENT_LLM_KEY", ""))

# Override NEW_KEYS so the imported translate_keys_for only translates the
# strings we actually need (NOT 80+ unrelated legal rows).
base.NEW_KEYS = {
    "plants.sort.default": "Sort: featured",
    "plants.sort.az": "Sort: A → Z",
    "plants.sort.difficulty": "Sort: easiest first",
    "plants.sort.lifecycle": "Sort: by lifecycle",
    "recommended.eyebrow": "Recommended for you",
    "recommended.title": "Good picks for {season}",
    "recommended.subtitle": "From our library — tuned to what's worth starting in {month} where you're growing in {region}.",
    "recommended.subtitle_no_region": "From our library — tuned to what's worth starting in {month}. Set your region for picks tailored to your climate.",
    "recommended.more": "See all plants",
    "recommended.season.spring": "spring",
    "recommended.season.summer": "summer",
    "recommended.season.autumn": "autumn",
    "recommended.season.winter": "winter",
}

LOCALES_DIR = Path("/app/frontend/src/i18n/locales")


def upsert_into_locale_file(path: Path, translated: dict[str, str]) -> None:
    """Replace existing rows for each key, or insert before the final `};`."""
    text = path.read_text(encoding="utf-8")

    # First pass: replace any existing rows for the same keys.
    for k, v in translated.items():
        safe_v = json.dumps(v, ensure_ascii=False)
        pat = re.compile(
            rf'^([ \t]*)"{re.escape(k)}":\s*"(?:[^"\\]|\\.)*"\s*,?\s*$',
            flags=re.MULTILINE,
        )
        if pat.search(text):
            text = pat.sub(lambda m: f'{m.group(1)}"{k}": {safe_v},', text, count=1)

    # Second pass: any keys still missing get inserted just before the
    # closing `};` of the dict.
    missing = {k: v for k, v in translated.items() if f'"{k}":' not in text}
    if missing:
        insert_block = "".join(
            f'  "{k}": {json.dumps(v, ensure_ascii=False)},\n'
            for k, v in missing.items()
        )
        text = re.sub(
            r"\n\};?\s*export default dict;\s*$",
            f"\n{insert_block}}};\nexport default dict;\n",
            text,
            count=1,
        )

    path.write_text(text, encoding="utf-8")


async def main():
    only = set(sys.argv[1:]) if len(sys.argv) > 1 else None
    success = 0
    failures: list[str] = []
    for code, label in LOCALES.items():
        if only and code not in only:
            continue
        path = LOCALES_DIR / f"{code}.js"
        if not path.exists():
            print(f"  ⚠ skip {code}: file not found ({path})")
            continue
        print(f"→ {code} ({label})…", flush=True)
        try:
            translated = await asyncio.wait_for(translate_keys_for(code, label), timeout=120)
        except Exception as e:  # noqa: BLE001
            print(f"  ❌ {code} failed: {e!r}", file=sys.stderr)
            failures.append(code)
            continue
        upsert_into_locale_file(path, translated)
        sample = "recommended.title"
        print(f"  ✓ {code}: {sample!r} → {translated.get(sample)!r}")
        success += 1

    print(f"\ndone. {success}/{len(LOCALES)} locales updated.")
    if failures:
        print(f"failed locales (rerun with these as args): {' '.join(failures)}")


if __name__ == "__main__":
    asyncio.run(main())
