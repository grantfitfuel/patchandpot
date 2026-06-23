"""Re-translate just the 4 keys whose EN copy was edited after the
initial translate_session_keys.py run:
  wellbeing.subtitle, wellbeing.sense.body,
  wellbeing.soul.title, wellbeing.soul.body
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

PATCH = {
    "wellbeing.subtitle": "Patch & Pot is more than food. Sit in your patch with no purpose apart from simply being and relaxing — listen to the birds, watch the bees, follow a butterfly across the borders. The garden tends you back, if you let it. This page is your private space to notice that, week by week, season by season.",
    "wellbeing.sense.body": "The most underrated part of having a garden is the right to sit in it with no purpose apart from simply being and relaxing. Pick one sense each week and give it a real minute of your attention. You'll find more in your own patch than you ever do scrolling.",
    "wellbeing.soul.title": "You don't only grow food, or the transient beauty of flowers. You grow yourself and your soul.",
    "wellbeing.soul.body": "A patch teaches patience to people who don't think they have any. It rewards small daily attention more reliably than almost anything else in modern life. It pulls you outside, slows your breath, makes you kneel down, makes you look. The harvest is the carrots and the courgettes; it's also the brief, transient beauty of a poppy or a sweet pea — here today, gone next week, and all the lovelier for it. A garden — even a balcony pot or a windowsill jar — is a quiet, generous teacher of how to be a person. Patch & Pot exists to keep that practice alive in your week.",
}


async def translate_for(lang_code: str, lang_label: str) -> dict[str, str]:
    sys_msg = (
        "You are a professional UI localiser for a gardening + wellbeing app. "
        "Translate every VALUE into the target language using natural, "
        "warm, contemplative phrasing. KEEP THE JSON KEYS UNCHANGED. "
        "Preserve em-dashes —, ESCAPE quotes \\\", keep the brand 'Patch & Pot'. "
        "Output ONLY the translated JSON object, no markdown."
    )
    chat = LlmChat(api_key=KEY, session_id=f"i18n-patch-{lang_code}", system_message=sys_msg)
    chat.with_model("openai", "gpt-4o-mini")
    chat.with_params(max_tokens=4000)
    payload = (
        f"TARGET LANGUAGE: {lang_label}\nLANGUAGE CODE: {lang_code}\n\n"
        f"INPUT JSON:\n{json.dumps(PATCH, ensure_ascii=False, indent=2)}\n\n"
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
    return {k: (out.get(k) or v) for k, v in PATCH.items()}


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
