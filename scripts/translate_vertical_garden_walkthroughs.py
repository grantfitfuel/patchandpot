"""Translate the 5 new vertical-garden situation labels + blurbs across
all 57 non-EN locales. 10 keys total.
"""
import asyncio
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, "/app/backend")
from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402
from dotenv import load_dotenv  # noqa: E402

load_dotenv("/app/backend/.env")
KEY = os.environ["EMERGENT_LLM_KEY"]

LOCALES_DIR = Path("/app/frontend/src/i18n/locales")

NEW_KEYS = {
    "grow.situation.ladder-planter.label": "Ladder planter",
    "grow.situation.ladder-planter.blurb":
      "A tilted step-ladder with a shallow tray on each rung — sun-facing, "
      "five tiers of herbs, salad and strawberries in the footprint of one pot.",
    "grow.situation.pallet-vertical.label": "Pallet wall garden",
    "grow.situation.pallet-vertical.blurb":
      "A wooden pallet stood upright and lined with landscape fabric — every "
      "slat becomes a shallow salad-or-herb pocket. Cheap, huge productive "
      "area, needs frequent watering.",
    "grow.situation.gutter-garden.label": "Gutter garden",
    "grow.situation.gutter-garden.blurb":
      "Lengths of plastic rain gutter stacked on a wall or fence — only 10 cm "
      "deep, but perfect for cut-and-come-again salad, spring onions and "
      "shallow-rooted herbs.",
    "grow.situation.pocket-planter.label": "Pocket planter",
    "grow.situation.pocket-planter.blurb":
      "A canvas or felt panel of sewn-in pockets, hung on a sunny wall — "
      "instant vertical garden, works well on a balcony rail too.",
    "grow.situation.trellis-tower.label": "Trellis tower",
    "grow.situation.trellis-tower.blurb":
      "A freestanding obelisk, tepee or wire tower for climbers — beans, peas, "
      "cucumbers and morning glory turn one square metre into a lush wall of "
      "green.",
}

LOCALES = {
    "de":"German","es":"Spanish","gd":"Scottish Gaelic","cy":"Welsh","ga":"Irish",
    "da":"Danish","nb":"Norwegian Bokmål","sv":"Swedish","is":"Icelandic","fi":"Finnish",
    "pt":"Portuguese","it":"Italian","nl":"Dutch","pl":"Polish","cs":"Czech","sk":"Slovak",
    "sl":"Slovenian","hr":"Croatian","bg":"Bulgarian","ro":"Romanian","hu":"Hungarian",
    "el":"Greek","et":"Estonian","lv":"Latvian","lt":"Lithuanian","mt":"Maltese",
    "uk":"Ukrainian","fr":"French","ja":"Japanese","zh":"Chinese (Simplified)",
    "hi":"Hindi","bn":"Bengali","te":"Telugu","mr":"Marathi","ta":"Tamil","gu":"Gujarati",
    "ur":"Urdu (RTL)","kn":"Kannada","ml":"Malayalam","pa":"Punjabi","id":"Indonesian",
    "ms":"Malay","vi":"Vietnamese","th":"Thai","ko":"Korean","tl":"Filipino","mi":"Māori",
    "ar":"Arabic (RTL)","tr":"Turkish","ru":"Russian","be":"Belarusian","kk":"Kazakh",
    "uz":"Uzbek","az":"Azerbaijani","ky":"Kyrgyz","hy":"Armenian","ka":"Georgian",
}


async def translate(code, label):
    sys_msg = (
        "Translate UI strings for a gardening app describing DIY vertical "
        "garden setups. Keep the tone practical and gentle. Titles stay "
        "1-3 words; blurbs one or two sentences. Return ONLY a JSON object "
        "with the exact same keys."
    )
    chat = LlmChat(api_key=KEY, session_id=f"vg-{code}", system_message=sys_msg)
    chat.with_model("openai", "gpt-4o-mini")
    chat.with_params(max_tokens=1200)
    payload = f"TARGET: {label}\nINPUT: {json.dumps(NEW_KEYS)}\nJSON only."
    resp = await chat.send_message(UserMessage(text=payload))
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", resp.strip())
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", text)
        return json.loads(m.group(0)) if m else {}


def upsert(code, translated):
    p = LOCALES_DIR / f"{code}.js"
    if not p.exists():
        return
    text = p.read_text()
    for k in translated:
        text = re.sub(rf'^\s*"{re.escape(k)}":\s*"(?:[^"\\]|\\.)*"\s*,?\s*\n',
                      "", text, flags=re.MULTILINE)
    block = "".join(f'  "{k}": {json.dumps(v, ensure_ascii=False)},\n'
                    for k, v in translated.items())
    text = re.sub(r"(\n)\};\s*\n+export default dict;",
                  block + r"\1};\nexport default dict;", text, count=1)
    p.write_text(text)


async def one(c, l, sem):
    async with sem:
        try:
            tr = await asyncio.wait_for(translate(c, l), timeout=90)
            if tr and set(tr) >= set(NEW_KEYS):
                upsert(c, tr)
                print(f"  ✓ {c}")
            else:
                print(f"  ⚠️  {c}: partial ({len(tr)}/{len(NEW_KEYS)})")
        except Exception as e:  # noqa: BLE001
            print(f"  ❌ {c}: {e!r}", file=sys.stderr)


async def main():
    sem = asyncio.Semaphore(6)
    await asyncio.gather(*[one(c, l, sem) for c, l in LOCALES.items()])
    print("done.")


if __name__ == "__main__":
    asyncio.run(main())
