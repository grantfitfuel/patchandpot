"""Set the reframed `nav.ask` label to "Ask Nàdar" verbatim in every
locale (English + all 57 non-English).

Nàdar is a persona / brand name (Scottish Gaelic for "nature") — we
deliberately keep it identical across every language, including scripts
like Chinese, Japanese, Arabic. The very short verb "Ask" stays too;
it's universally recognisable in nav contexts and preserves the persona.

No LLM call needed — this just writes the string directly.

Usage:
    cd /app && python scripts/translate_ask_nadar_keys.py
"""
from pathlib import Path
from translate_recommended_and_sort_keys import upsert_into_locale_file

LOCALES_DIR = Path("/app/frontend/src/i18n/locales")

new_values = {
    "nav.ask": "Ask Nàdar",
}


def main() -> None:
    files = sorted(LOCALES_DIR.glob("*.js"))
    for path in files:
        upsert_into_locale_file(path, new_values)
        print(f"  ✓ {path.name}")
    print(f"\ndone. {len(files)} locales updated.")


if __name__ == "__main__":
    main()
