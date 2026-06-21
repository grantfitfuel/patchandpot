"""One-off: translate the 4 new `guidance.loading.*` keys into all 57 non-EN
locales and upsert them into /app/frontend/src/i18n/index.jsx.

Reuses the helpers from translate_new_keys.py — just swaps the NEW_KEYS dict
so we don't re-translate 80 unrelated rows we already shipped.

Usage:
    cd /app && python scripts/translate_loading_keys.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from translate_new_keys import LOCALES, translate_keys_for, upsert_keys_into_block  # noqa: E402
import translate_new_keys as base  # noqa: E402

# Override NEW_KEYS — only translate the loading copy.
base.NEW_KEYS = {
    "guidance.loading.starting": "Reading {region}'s climate…",
    "guidance.loading.generating": "Choosing what to plant in {month} for {region}…",
    "guidance.loading.almost": "Almost there — finishing your {region} guide…",
    "guidance.loading.cold_note": "Fresh regions take ~30–60s the first time. Future visits are instant.",
}

I18N_PATH = Path("/app/frontend/src/i18n/index.jsx")


async def main():
    text = I18N_PATH.read_text()
    only = set(sys.argv[1:]) if len(sys.argv) > 1 else None
    success = 0
    for code, label in LOCALES.items():
        if only and code not in only:
            continue
        print(f"→ {code} ({label})…", flush=True)
        try:
            translated = await asyncio.wait_for(translate_keys_for(code, label), timeout=120)
        except Exception as e:  # noqa: BLE001
            print(f"  ❌ {code} failed: {e!r}", file=sys.stderr)
            continue
        text = upsert_keys_into_block(text, code, translated)
        I18N_PATH.write_text(text)
        sample_k = "guidance.loading.generating"
        print(f"  ✓ {code}: {sample_k!r} → {translated.get(sample_k)!r}")
        success += 1
    print(f"\ndone. {success}/{len(LOCALES)} locales updated.")


if __name__ == "__main__":
    asyncio.run(main())
