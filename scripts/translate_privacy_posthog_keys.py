"""Translate the two updated privacy-notice HTML keys into all 57 non-English
locales and inject them into /app/frontend/src/i18n/locales/{code}.js.

Adds PostHog + Sovrn Commerce disclosure to the legal privacy notice, per
the compliance update. The HTML markup must be preserved verbatim; only the
visible copy is translated.
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

# The HTML markup — tags, attrs, `<a href>` URLs, `<strong>` wrappers — must
# be preserved letter-for-letter. Only the human-readable text inside is
# translated. `translate_new_keys.translate_keys_for` already gives the LLM
# that instruction as part of its shared system prompt.
base.NEW_KEYS = {
    "legal.privacy.share.html": (
        "<p>We use a small, intentionally minimal set of trusted processors:</p>"
        "<ul>"
        "<li><strong>Stripe</strong> (payment processing) — see "
        "<a class=\\\"link\\\" href=\\\"https://stripe.com/privacy\\\" target=\\\"_blank\\\" rel=\\\"noreferrer noopener\\\">stripe.com/privacy</a>."
        "</li>"
        "<li><strong>Anthropic, OpenAI, Google</strong> (AI providers) — used to generate monthly guidance, masterclasses and plant images on request. We do not pass them your email, location, or identity; only the gardening topic or region/month being requested."
        "</li>"
        "<li><strong>Sovrn Commerce</strong> (affiliate link tracking) — may rewrite outbound product links to add affiliate tracking, in exchange for a small commission we receive if you subsequently buy. See "
        "<a class=\\\"link\\\" href=\\\"https://www.sovrn.com/privacy-policy/\\\" target=\\\"_blank\\\" rel=\\\"noreferrer noopener\\\">sovrn.com/privacy-policy</a>."
        "</li>"
        "<li><strong>Our hosting provider</strong> — runs the application servers and the MongoDB database that caches generated content."
        "</li>"
        "</ul>"
        "<p>We do <strong>not</strong> sell your data, share it with advertisers, or pass it to data brokers. We do not run any advertising trackers, fingerprinting scripts, or third-party analytics.</p>"
    ),
    "legal.privacy.cookies.html": (
        "<p>We do not use marketing or advertising cookies. We use:</p>"
        "<ul>"
        "<li><strong>Strictly necessary local storage</strong> for your region, language, \u201cMy Garden\u201d list, and paywall access token.</li>"
        "<li><strong>A service worker cache</strong> so the site loads quickly and works offline. Caches no personal data.</li>"
        "<li><strong>Sovrn Commerce</strong> may set an affiliate-attribution cookie when you click an outbound product link, so any resulting purchase is credited to us.</li>"
        "<li><strong>Stripe Checkout</strong> sets its own session cookies during payment; these are governed by Stripe\u2019s privacy notice.</li>"
        "</ul>"
    ),
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
            translated = await asyncio.wait_for(translate_keys_for(code, label), timeout=240)
        except Exception as e:  # noqa: BLE001
            print(f"  ❌ {code} failed: {e!r}", file=sys.stderr)
            failures.append(code)
            continue
        upsert_into_locale_file(path, translated)
        preview = (translated.get("legal.privacy.cookies.html") or "")[:70].replace("\n", " ")
        print(f"  ✓ {code}: cookies.html → {preview!r}…")
        success += 1

    total = len(only) if only else len(LOCALES)
    print(f"\ndone. {success}/{total} locales updated.")
    if failures:
        print(f"failed locales (rerun with these as args): {' '.join(failures)}")


if __name__ == "__main__":
    asyncio.run(main())
