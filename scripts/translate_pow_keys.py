"""Translate the 'Plant of the week' i18n keys into all 57 non-English
per-locale files. Same posture as translate_iter28_keys.py."""
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
    "home.plant_of_the_week.eyebrow": "Plant of the week",
    "home.plant_of_the_week.image_alt": "{name} — Patch & Pot plant guide",
    "home.plant_of_the_week.cta": "Read the {name} guide",
    "home.plant_of_the_week.views": "{n} gardeners reading this week",
    "home.plant_of_the_week.views_one": "1 gardener reading this week",
}

LOCALES = {
    "de": "German", "es": "Spanish", "gd": "Scottish Gaelic", "cy": "Welsh",
    "ga": "Irish", "da": "Danish", "nb": "Norwegian Bokmål", "sv": "Swedish",
    "is": "Icelandic", "fi": "Finnish", "pt": "Portuguese", "it": "Italian",
    "nl": "Dutch", "pl": "Polish", "cs": "Czech", "sk": "Slovak",
    "sl": "Slovenian", "hr": "Croatian", "bg": "Bulgarian", "ro": "Romanian",
    "hu": "Hungarian", "el": "Greek", "et": "Estonian", "lv": "Latvian",
    "lt": "Lithuanian", "mt": "Maltese", "uk": "Ukrainian", "fr": "French",
    "ja": "Japanese", "zh": "Chinese (Simplified)", "hi": "Hindi", "bn": "Bengali",
    "te": "Telugu", "mr": "Marathi", "ta": "Tamil", "gu": "Gujarati",
    "ur": "Urdu (RTL)", "kn": "Kannada", "ml": "Malayalam", "pa": "Punjabi",
    "id": "Indonesian", "ms": "Malay", "vi": "Vietnamese", "th": "Thai",
    "ko": "Korean", "tl": "Filipino", "mi": "Māori", "ar": "Arabic (RTL)",
    "tr": "Turkish", "ru": "Russian", "be": "Belarusian", "kk": "Kazakh",
    "uz": "Uzbek", "az": "Azerbaijani", "ky": "Kyrgyz", "hy": "Armenian",
    "ka": "Georgian",
}


async def translate(code, label):
    sys_msg = (
        "You are a professional UI localiser for a gardening app called Patch "
        "& Pot. Translate every VALUE to the target language. KEEP KEYS "
        "UNCHANGED. Preserve {placeholder} tokens EXACTLY. Brand 'Patch & "
        "Pot' stays. Escape \" as \\\". Output ONLY JSON, no markdown fences."
    )
    chat = LlmChat(api_key=KEY, session_id=f"pow-i18n-{code}", system_message=sys_msg)
    chat.with_model("openai", "gpt-4o-mini")
    chat.with_params(max_tokens=2000)
    resp = await chat.send_message(UserMessage(
        text=f"TARGET: {label}\nCODE: {code}\n\nINPUT:\n{json.dumps(NEW_KEYS, ensure_ascii=False, indent=2)}\n\nReturn ONLY the translated JSON."
    ))
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", resp.strip())
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", text)
        return json.loads(m.group(0)) if m else {}


def upsert(code, translated):
    path = LOCALES_DIR / f"{code}.js"
    if not path.exists():
        return
    text = path.read_text()
    for k in translated:
        text = re.sub(
            rf'^\s*"{re.escape(k)}":\s*"(?:[^"\\]|\\.)*"\s*,?\s*\n',
            "", text, flags=re.MULTILINE,
        )
    insert = "".join(
        f'  "{k}": {json.dumps(v, ensure_ascii=False)},\n' for k, v in translated.items()
    )
    text = re.sub(r"(\n)\};\n\nexport default dict;", insert + r"\1};\n\nexport default dict;", text, count=1)
    path.write_text(text)


async def one(code, label, sem):
    async with sem:
        print(f"→ {code} ({label})…", flush=True)
        try:
            tr = await asyncio.wait_for(translate(code, label), timeout=120)
            if tr:
                upsert(code, tr)
                k0, v0 = next(iter(tr.items()))
                print(f"  ✓ {code} ({k0} → {v0!r})")
        except Exception as e:  # noqa: BLE001
            print(f"  ❌ {code}: {e!r}", file=sys.stderr)


async def main():
    sem = asyncio.Semaphore(4)
    await asyncio.gather(*(one(c, l, sem) for c, l in LOCALES.items()))
    print("done.")


if __name__ == "__main__":
    asyncio.run(main())
