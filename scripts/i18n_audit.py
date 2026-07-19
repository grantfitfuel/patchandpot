"""Full i18n sweep — scans every locale file for missing keys and every
AI-translated backend payload for English pest / plant-name leaks.

Usage:  python3 scripts/i18n_audit.py [--lang gd,ga,cy]

Reports (to stdout, tab-separated for easy grep):
  MISSING    <lang>  <key>                            — key exists in en.js but not <lang>.js
  ENG_LEAK   <lang>  <path/to/field>   <snippet>      — English pest / insect word leaked into translated text
"""
import asyncio
import json
import re
import sys
import os
from pathlib import Path

sys.path.insert(0, "/app/backend")
from dotenv import load_dotenv
load_dotenv("/app/backend/.env")

import httpx

LOCALES_DIR = Path("/app/frontend/src/i18n/locales")
API = os.environ.get("REACT_APP_BACKEND_URL") or "http://localhost:8001"
if API == "http://localhost:8001":
    with open("/app/frontend/.env") as f:
        for line in f:
            if line.startswith("REACT_APP_BACKEND_URL="):
                API = line.split("=", 1)[1].strip().strip('"')

# English words that MUST NOT appear in a non-English translation. Regex
# word-boundaries so we don't hit false positives (e.g. "slugs" catches
# "slug" — the ONLY-english-if-word check).
ENG_WORDS = [
    "aphid", "aphids", "whitefly", "whiteflies", "greenfly", "greenflies",
    "blackfly", "blackflies", "spider mite", "slug", "slugs", "snail",
    "snails", "caterpillar", "caterpillars", "cabbage-white", "carrot fly",
    "ladybird", "ladybug", "hoverfly", "lacewing", "nasturtium", "marigold",
    "calendula", "borage", "chives",
]
ENG_RE = re.compile(r"\b(" + "|".join(re.escape(w) for w in ENG_WORDS) + r")\b", re.IGNORECASE)


def parse_locale_keys(path: Path) -> set[str]:
    """Return the set of top-level keys defined in a locale.js file. The
    files are ES modules with a `default { ... }` export — we just find
    every `"key.name":` at the start of a line."""
    src = path.read_text()
    return set(re.findall(r'^\s*"([^"]+)"\s*:', src, flags=re.MULTILINE))


def audit_missing_keys(only_langs: list[str] | None) -> list[tuple[str, str, str]]:
    en_keys = parse_locale_keys(LOCALES_DIR / "en.js")
    out = []
    for path in sorted(LOCALES_DIR.glob("*.js")):
        code = path.stem
        if code == "en":
            continue
        if only_langs and code not in only_langs:
            continue
        keys = parse_locale_keys(path)
        for k in sorted(en_keys - keys):
            out.append(("MISSING", code, k, ""))
    return out


async def audit_backend_translations(only_langs: list[str] | None) -> list[tuple[str, str, str, str]]:
    """Scan /api/plants?language=<lang> for English pest/plant word leaks."""
    codes = [p.stem for p in sorted(LOCALES_DIR.glob("*.js")) if p.stem != "en"]
    if only_langs:
        codes = [c for c in codes if c in only_langs]
    findings = []
    async with httpx.AsyncClient(timeout=60) as client:
        for code in codes:
            try:
                r = await client.get(f"{API}/api/plants", params={"language": code})
                if r.status_code != 200:
                    findings.append(("HTTP_ERR", code, f"/api/plants?language={code}", str(r.status_code)))
                    continue
                data = r.json()
            except Exception as e:
                findings.append(("HTTP_ERR", code, "/api/plants", str(e)[:100]))
                continue
            for p in data:
                for k, v in p.items():
                    if not isinstance(v, str) or len(v) < 20:
                        continue
                    m = ENG_RE.search(v)
                    if m:
                        findings.append((
                            "ENG_LEAK", code, f"{p['id']}.{k}", v[:140].replace("\n", " "),
                        ))
    return findings


async def main():
    only_langs = None
    if len(sys.argv) > 1 and sys.argv[1] == "--lang":
        only_langs = sys.argv[2].split(",")

    print("# i18n locale-file audit …", file=sys.stderr)
    missing = audit_missing_keys(only_langs)
    print("# backend translation audit …", file=sys.stderr)
    leaks = await audit_backend_translations(only_langs)

    all_findings = missing + leaks
    for row in all_findings:
        print("\t".join(row))

    # Terse summary at the end (to stderr so tab-separated stdout stays clean).
    print(f"\n# ── Summary ─────────────────────────────", file=sys.stderr)
    print(f"# Missing keys per locale:", file=sys.stderr)
    by_lang: dict[str, int] = {}
    for row in missing:
        by_lang[row[1]] = by_lang.get(row[1], 0) + 1
    for lang in sorted(by_lang):
        print(f"#   {lang:6}  {by_lang[lang]:5} keys missing", file=sys.stderr)

    print(f"# Backend English-leak rows: {len(leaks)}", file=sys.stderr)
    leak_by_lang: dict[str, int] = {}
    for row in leaks:
        leak_by_lang[row[1]] = leak_by_lang.get(row[1], 0) + 1
    for lang in sorted(leak_by_lang):
        print(f"#   {lang:6}  {leak_by_lang[lang]:5} leaks", file=sys.stderr)


if __name__ == "__main__":
    asyncio.run(main())
