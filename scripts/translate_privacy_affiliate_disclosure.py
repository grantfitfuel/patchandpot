"""Re-translate the 2 privacy-policy HTML blocks to reflect the new,
accurate wording (affiliate links + first-party analytics disclosure).
Overwrites existing translations for the same keys.
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

# Load fresh EN source of truth so this stays in lockstep with any
# further edits made to en.js.
_EN = (LOCALES_DIR / "en.js").read_text()
def _grab(key):
    m = re.search(rf'"{re.escape(key)}":\s*("(?:[^"\\]|\\.)*"),\s*\n', _EN)
    return json.loads(m.group(1)) if m else ""

NEW_KEYS = {
    "legal.privacy.share.html": _grab("legal.privacy.share.html"),
    "legal.privacy.cookies.html": _grab("legal.privacy.cookies.html"),
}
assert all(NEW_KEYS.values()), "Failed to load EN source for one or more keys."

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
        "You translate legal HTML for a gardening web app. Keep every HTML "
        "tag, class name and href attribute exactly as-is — translate only "
        "the human-readable text between tags. Return ONLY a JSON object "
        "with the exact same keys."
    )
    chat = LlmChat(api_key=KEY, session_id=f"privacy-{code}",
                   system_message=sys_msg)
    chat.with_model("openai", "gpt-4o-mini")
    chat.with_params(max_tokens=3500)
    payload = (f"TARGET LANGUAGE: {label}\nINPUT: {json.dumps(NEW_KEYS)}\n"
               "Return the same JSON keys with translated values. Keep HTML "
               "tags intact. JSON only.")
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
    # Repair a recurring escape bug: some LLM outputs emit `\"` for HTML
    # attribute quotes, which json.dumps writes as `\\"` — a JS syntax
    # error (`\\` + `"` closes the string early). Force the file-level
    # form to `\\\"` (JS source: `\\` + `\"` = literal `\"`).
    block = re.sub(r'(?<!\\)\\\\"', r'\\\\\\"', block)
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
                print(f"  ⚠️  {c}: partial ({len(tr)}/{len(NEW_KEYS)})", file=sys.stderr)
        except Exception as e:  # noqa: BLE001
            print(f"  ❌ {c}: {e!r}", file=sys.stderr)


async def main():
    sem = asyncio.Semaphore(6)
    await asyncio.gather(*[one(c, l, sem) for c, l in LOCALES.items()])
    print("done.")


if __name__ == "__main__":
    asyncio.run(main())
