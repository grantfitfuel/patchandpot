"""Translate the new iter28 UI keys into all 57 non-English per-locale files
under /app/frontend/src/i18n/locales/{code}.js. Mirrors the patch the older
translate_*_keys.py scripts apply, but writes directly into the new per-locale
files instead of regex-injecting into a single monolith.
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
    "share_view.views":     "{n} visits this week",
    "share_view.views_one": "1 visit this week",
    "share_patch.embed.open":    "Get the embed code",
    "share_patch.embed.label":   "Embed on a blog or club page",
    "share_patch.embed.help":    "Paste this snippet into your site to show a tidy live preview of your patch.",
    "share_patch.embed.copy":    "Copy embed code",
    "share_patch.embed.preview": "Preview embed",
    "share_patch.qr.download":   "Download garden-gate QR sticker (PDF)",
    "share_patch.list_publicly.title": "Show on the homepage \"Most-loved patches\" wall",
    "share_patch.list_publicly.help":  "Off by default. When on, this patch may appear on the Patch & Pot homepage based on visits. You can switch it off again any time.",
    "home.most_loved.eyebrow": "Around the patch",
    "home.most_loved.title":   "Most-loved patches this week",
    "home.most_loved.body":    "Real gardens, opted in by their gardeners. Click any to see what's growing — and how Patch & Pot tunes its monthly guidance to where they live.",
    "home.most_loved.plant_count": "{n} plants",
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


async def translate(code: str, label: str) -> dict:
    sys_msg = (
        "You are a professional UI localiser for a gardening app called Patch "
        "& Pot. Translate every VALUE into the target language. KEEP KEYS "
        "UNCHANGED. Preserve {placeholder} tokens EXACTLY. Brand 'Patch & "
        "Pot' stays. Escape \" inside values as \\\". Output ONLY the "
        "translated JSON object — no markdown fences."
    )
    chat = LlmChat(api_key=KEY, session_id=f"iter28-i18n-{code}", system_message=sys_msg)
    chat.with_model("openai", "gpt-4o-mini")
    chat.with_params(max_tokens=4000)
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


def upsert_into_locale_file(code: str, translated: dict) -> None:
    path = LOCALES_DIR / f"{code}.js"
    if not path.exists():
        print(f"  ⚠ {code}: file not found, skipping")
        return
    text = path.read_text()
    # Strip any pre-existing entries for the new keys so we re-insert cleanly.
    for k in translated:
        text = re.sub(
            rf'^\s*"{re.escape(k)}":\s*"(?:[^"\\]|\\.)*"\s*,?\s*\n',
            "", text, flags=re.MULTILINE,
        )
    insert_block = "".join(
        f'  "{k}": {json.dumps(v, ensure_ascii=False)},\n' for k, v in translated.items()
    )
    # Insert just before the closing `};` of the dict.
    text = re.sub(r"(\n)\};\n\nexport default dict;", insert_block + r"\1};\n\nexport default dict;", text, count=1)
    path.write_text(text)


async def one(code, label, sem):
    async with sem:
        print(f"→ {code} ({label})…", flush=True)
        try:
            translated = await asyncio.wait_for(translate(code, label), timeout=180)
            if translated:
                upsert_into_locale_file(code, translated)
                sample = next(iter(translated.items()))
                print(f"  ✓ {code} ({sample[0]} → {sample[1]!r})")
        except Exception as e:  # noqa: BLE001
            print(f"  ❌ {code} failed: {e!r}", file=sys.stderr)


async def main():
    only = set(sys.argv[1:]) if len(sys.argv) > 1 else None
    sem = asyncio.Semaphore(3)
    tasks = [
        one(c, l, sem) for c, l in LOCALES.items()
        if not only or c in only
    ]
    await asyncio.gather(*tasks)
    print("done.")


if __name__ == "__main__":
    asyncio.run(main())
