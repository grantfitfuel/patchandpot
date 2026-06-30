"""Translate the new cut.tips.* + pin keys into all 57 non-English locales
and inject them into /app/frontend/src/i18n/locales/{code}.js.

Reuses the standard LOCALES + translate_keys_for + upsert_into_locale_file
pipeline.
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
    "regrow.pin_to_pinterest": "Save on Pinterest",
    "regrow.pin_description": "Regrow from Scraps — honest method ratings from Patch & Pot. Start a real harvest from kitchen scraps.",
    "cut.pin_to_pinterest": "Save on Pinterest",
    "cut.pin_description": "Cut Flowers — vase-tested by Patch & Pot. Honest vase-life, the exact stage to cut at, and what to add so flowers last longer.",
    "cut.tips.eyebrow": "Make flowers last longer",
    "cut.tips.title": "What to add to your vase (and what to skip)",
    "cut.tips.intro": "There's a real chemistry to keeping cut flowers fresh — sugar to feed the bloom, a mild acid to keep the water flowing up the stem, and a touch of bleach to stop the bacteria that block it. Skip the pennies, vodka and hairspray you'll see on Pinterest — none of it outperforms what's already in your kitchen.",
    "cut.tips.vase_food.title": "Make your own flower food",
    "cut.tips.vase_food.body": "Per litre of cool water: 1 tsp sugar (food), 1 tsp white vinegar or 2 tsp lemon juice (acid, helps stems drink), and ¼ tsp household bleach (kills the bacteria that clog stems). It outperforms most sachets and costs nothing.",
    "cut.tips.rewater.title": "Refresh every 2 days",
    "cut.tips.rewater.body": "Empty the vase, rinse off any slime, and refill with fresh food-and-water. Cloudy water is bacteria — and bacteria is the single biggest reason flowers wilt early.",
    "cut.tips.trim_stems.title": "Re-cut stems at an angle",
    "cut.tips.trim_stems.body": "Cut 1–2 cm off every stem at a 45° angle under running water before they go in the vase, and again every refill. The angle gives more surface area to drink, and underwater cuts stop air bubbles blocking the stem.",
    "cut.tips.strip_leaves.title": "Strip any leaves below the water",
    "cut.tips.strip_leaves.body": "Submerged leaves rot fast and turn the water into bacterial soup within a day. Take everything off the bottom third of the stem — even if it feels brutal.",
    "cut.tips.cool_spot.title": "Keep them cool",
    "cut.tips.cool_spot.body": "Out of direct sun, away from radiators and the top of the TV. Florists store flowers at 2–5 °C overnight; you can mimic this by moving the vase to a cool hallway or porch before bed.",
    "cut.tips.no_fruit.title": "Away from the fruit bowl",
    "cut.tips.no_fruit.body": "Ripening fruit (especially bananas, apples, tomatoes) gives off ethylene — a gas that signals petals to age. A bouquet next to a fruit bowl can die in half the time.",
    "cut.tips.spring_cold.title": "Spring bulbs like cold water",
    "cut.tips.spring_cold.body": "Tulips, daffodils, hyacinths and ranunculus last longest in cold water — and tulips will keep growing in the vase, so leave room for them to stretch 5–10 cm taller.",
    "cut.tips.clean_vase.title": "Start with a spotless vase",
    "cut.tips.clean_vase.body": "Scrub the vase with hot soapy water (or a quick swish of bleach solution) before every arrangement. Last week's bacteria film is invisible — and it'll halve the life of your fresh stems.",
    "cut.tips.footnote": "One caveat: daffodil and narcissus stems leak a sap that's toxic to other flowers. Stand them on their own for 6 hours in fresh water before adding to a mixed arrangement, and don't re-cut once mixed.",
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
            translated = await asyncio.wait_for(translate_keys_for(code, label), timeout=180)
        except Exception as e:  # noqa: BLE001
            print(f"  ❌ {code} failed: {e!r}", file=sys.stderr)
            failures.append(code)
            continue
        upsert_into_locale_file(path, translated)
        print(f"  ✓ {code}: 'cut.tips.title' → {translated.get('cut.tips.title')!r}")
        success += 1

    print(f"\ndone. {success}/{len(LOCALES) if not only else len(only)} locales updated.")
    if failures:
        print(f"failed locales (rerun with these as args): {' '.join(failures)}")


if __name__ == "__main__":
    asyncio.run(main())
