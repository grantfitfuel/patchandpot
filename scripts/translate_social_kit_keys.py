"""Translate the Social Media Kit i18n keys into all 57 non-English locales."""
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
    "share_patch.social_kit.download": "Download Social Media Kit (ZIP)",
    "share_patch.social_kit.help": (
        "Four ready-to-post images (1:1, 4:5, 9:16, 16:9) and per-platform "
        "captions — for Instagram, Reels, TikTok, Twitter and YouTube. Takes "
        "a few seconds the first time while the captions are written."
    ),
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
        "You are a professional UI localiser for Patch & Pot, a gardening "
        "app. Translate every VALUE into the target language. KEEP KEYS "
        "UNCHANGED. Keep platform names ('Instagram', 'Reels', 'TikTok', "
        "'Twitter', 'YouTube') and aspect ratios ('1:1', '4:5', '9:16', "
        "'16:9') EXACTLY as written. Brand 'Patch & Pot' stays. Escape "
        '" inside values as \\\". Output ONLY the translated JSON object — '
        "no markdown fences."
    )
    chat = LlmChat(api_key=KEY, session_id=f"social-kit-i18n-{code}", system_message=sys_msg)
    chat.with_model("openai", "gpt-4o-mini")
    chat.with_params(max_tokens=2000)
    payload = (
        f"TARGET LANGUAGE: {label}\n"
        f"LANGUAGE CODE: {code}\n\n"
        f"INPUT JSON:\n{json.dumps(NEW_KEYS, ensure_ascii=False, indent=2)}\n\n"
        "Return ONLY the translated JSON object."
    )
    resp = await chat.send_message(UserMessage(text=payload))
    text = re.sub(r"^```(?:json)?\s*", "", resp.strip())
    text = re.sub(r"\s*```$", "", text)
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
    insert_block = "".join(
        f'  "{k}": {json.dumps(v, ensure_ascii=False)},\n' for k, v in translated.items()
    )
    text = re.sub(r"(\n)\};\n\nexport default dict;", insert_block + r"\1};\n\nexport default dict;", text, count=1)
    path.write_text(text)


async def one(code, label, sem):
    async with sem:
        print(f"→ {code} ({label})…", flush=True)
        try:
            translated = await asyncio.wait_for(translate(code, label), timeout=180)
            if translated:
                upsert(code, translated)
                sample = next(iter(translated.items()))
                print(f"  ✓ {code} ({sample[0]} → {sample[1][:60]!r})")
        except Exception as e:  # noqa: BLE001
            print(f"  ❌ {code} failed: {e!r}", file=sys.stderr)


async def main():
    only = set(sys.argv[1:]) if len(sys.argv) > 1 else None
    sem = asyncio.Semaphore(3)
    tasks = [one(c, l, sem) for c, l in LOCALES.items() if not only or c in only]
    await asyncio.gather(*tasks)
    print("done.")


if __name__ == "__main__":
    asyncio.run(main())
