"""Translate the home-bundle-cta keys (introduced after iter25) into all
57 non-EN locales. Same upsert logic as translate_session_keys.py.
"""
import asyncio
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, "/app/backend")
sys.path.insert(0, "/app/scripts")
from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402
from dotenv import load_dotenv  # noqa: E402
from translate_session_keys import LOCALES, upsert_keys_into_block  # noqa: E402

load_dotenv("/app/backend/.env")
KEY = os.environ["EMERGENT_LLM_KEY"]
I18N_PATH = Path("/app/frontend/src/i18n/index.jsx")

NEW_KEYS = {
    "home.bundle.eyebrow": "The full library",
    "home.bundle.title": "Every guide, course, AI tool and seasonal journal — in one place.",
    "home.bundle.body": "Five flexible tiers — from a single month for £2.99 to lifetime for £50. No auto-renewals, no email lists, 30-day refund on every tier.",
    "home.bundle.row1.title": "4 Foundation masterclasses",
    "home.bundle.row1.sub": "Propagation · Pest Control · Plant Care · Seasonal Planting",
    "home.bundle.row2.title": "6 Deep-dive courses",
    "home.bundle.row2.sub": "Soil · Containers · Pollinators · Harvest · Cut Flowers · Reading the Sky",
    "home.bundle.row3.title": "Unlimited AI masterclasses",
    "home.bundle.row3.sub": "Suggest any topic — full lesson set in 90 seconds",
    "home.bundle.row4.title": "Seasonal Growing Journal PDF",
    "home.bundle.row4.sub": "A4 printable, region-aware, refreshed monthly",
    "home.bundle.row5.title": "Full plant database",
    "home.bundle.row5.sub": "Care guides, companions, runtime translation to 58 languages",
    "home.bundle.best_value": "Best value",
    "home.bundle.lifetime_label": "Lifetime · pay once",
    "home.bundle.lifetime_blurb": "Breaks even with annual at year three. After that, every season is free — your 2031 garden still unlocked.",
    "home.bundle.unlock_lifetime": "Unlock for life",
    "home.bundle.from_monthly": "Or from £2.99 / month →",
    "home.bundle.guarantee": "30-day money-back guarantee. No subscriptions, no auto-renewal, no email lists.",
}


async def translate_for(lang_code: str, lang_label: str) -> dict[str, str]:
    sys_msg = (
        "You are a professional UI localiser for a gardening app called "
        "Patch & Pot. Translate every VALUE into the target language using "
        "natural, idiomatic, warm phrasing. KEEP THE JSON KEYS UNCHANGED. "
        "PRESERVE em-dashes —, the · separator, currency symbols (£), arrows (→), "
        "and the brand 'Patch & Pot'. ESCAPE any double quotes inside values as \\\". "
        "Do NOT translate proper nouns (Patch & Pot, A4). Output ONLY the "
        "translated JSON object — no markdown, no preamble."
    )
    chat = LlmChat(api_key=KEY, session_id=f"i18n-bundle-{lang_code}", system_message=sys_msg)
    chat.with_model("openai", "gpt-4o-mini")
    chat.with_params(max_tokens=4000)
    payload = (
        f"TARGET LANGUAGE: {lang_label}\nLANGUAGE CODE: {lang_code}\n\n"
        f"INPUT JSON:\n{json.dumps(NEW_KEYS, ensure_ascii=False, indent=2)}\n\n"
        "Return ONLY the translated JSON object."
    )
    resp = (await chat.send_message(UserMessage(text=payload))).strip()
    resp = re.sub(r"^```(?:json)?\s*", "", resp)
    resp = re.sub(r"\s*```$", "", resp)
    try:
        out = json.loads(resp)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", resp)
        out = json.loads(m.group(0)) if m else {}
    return {k: (out.get(k) or v) for k, v in NEW_KEYS.items()}


async def main():
    text = I18N_PATH.read_text()
    sem = asyncio.Semaphore(3)

    async def one(c, l):
        async with sem:
            print(f"→ {c}…", flush=True)
            try:
                return c, await asyncio.wait_for(translate_for(c, l), timeout=180)
            except Exception as e:  # noqa: BLE001
                print(f"  ❌ {c}: {e!r}", file=sys.stderr)
                return c, None

    tasks = [one(c, l) for c, l in LOCALES.items()]
    for fut in asyncio.as_completed(tasks):
        c, t = await fut
        if t is None:
            continue
        text = upsert_keys_into_block(text, c, t)
        I18N_PATH.write_text(text)
        print(f"  ✓ {c}")
    print("done.")


if __name__ == "__main__":
    asyncio.run(main())
