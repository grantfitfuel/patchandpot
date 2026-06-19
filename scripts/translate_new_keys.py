"""Translate the new share.* and arr.* keys into all 57 non-English locales
and insert them into each existing locale block in /app/frontend/src/i18n/index.jsx.

This is a targeted, incremental run — the locale blocks themselves already
contain hundreds of translated keys; we just need to add 5 new lines per
locale.

Usage:
    cd /app && python scripts/translate_new_keys.py
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

I18N_PATH = Path("/app/frontend/src/i18n/index.jsx")

# The 5 keys to translate, with their English values.
NEW_KEYS = {
    "share.share_masterclass": "Share masterclass",
    "share.link_copied": "Link copied",
    "share.copy_prompt": "Copy this link:",
    "arr.eyebrow": "From your garden",
    "arr.title": "Today's arrangement",
}

# Native labels for each locale — used in the LLM prompt so the model knows
# exactly which language to translate into.
LOCALES = {
    "de": "German (Deutsch)",
    "es": "Spanish (Español)",
    "gd": "Scottish Gaelic (Gàidhlig)",
    "cy": "Welsh (Cymraeg)",
    "ga": "Irish (Gaeilge)",
    "da": "Danish (Dansk)",
    "nb": "Norwegian Bokmål (Norsk bokmål)",
    "sv": "Swedish (Svenska)",
    "is": "Icelandic (Íslenska)",
    "fi": "Finnish (Suomi)",
    "pt": "Portuguese (Português)",
    "it": "Italian (Italiano)",
    "nl": "Dutch (Nederlands)",
    "pl": "Polish (Polski)",
    "cs": "Czech (Čeština)",
    "sk": "Slovak (Slovenčina)",
    "sl": "Slovenian (Slovenščina)",
    "hr": "Croatian (Hrvatski)",
    "bg": "Bulgarian (Български)",
    "ro": "Romanian (Română)",
    "hu": "Hungarian (Magyar)",
    "el": "Greek (Ελληνικά)",
    "et": "Estonian (Eesti)",
    "lv": "Latvian (Latviešu)",
    "lt": "Lithuanian (Lietuvių)",
    "mt": "Maltese (Malti)",
    "uk": "Ukrainian (Українська)",
    "fr": "French (Français)",
    "ja": "Japanese (日本語)",
    "zh": "Chinese (Simplified, 简体中文)",
    "hi": "Hindi (हिन्दी)",
    "bn": "Bengali (বাংলা)",
    "te": "Telugu (తెలుగు)",
    "mr": "Marathi (मराठी)",
    "ta": "Tamil (தமிழ்)",
    "gu": "Gujarati (ગુજરાતી)",
    "ur": "Urdu (اردو) — RTL script",
    "kn": "Kannada (ಕನ್ನಡ)",
    "ml": "Malayalam (മലയാളം)",
    "pa": "Punjabi (Gurmukhi, ਪੰਜਾਬੀ)",
    "id": "Indonesian (Bahasa Indonesia)",
    "ms": "Malay (Bahasa Melayu)",
    "vi": "Vietnamese (Tiếng Việt)",
    "th": "Thai (ไทย)",
    "ko": "Korean (한국어)",
    "tl": "Filipino / Tagalog",
    "mi": "Māori (te reo Māori)",
    "ar": "Arabic (العربية) — RTL script",
    "tr": "Turkish (Türkçe)",
    "ru": "Russian (Русский)",
    "be": "Belarusian (Беларуская)",
    "kk": "Kazakh (Қазақша)",
    "uz": "Uzbek (Oʻzbekcha)",
    "az": "Azerbaijani (Azərbaycanca)",
    "ky": "Kyrgyz (Кыргызча)",
    "hy": "Armenian (Հայերեն)",
    "ka": "Georgian (ქართული)",
}


async def translate_keys_for(lang_code: str, lang_label: str) -> dict[str, str]:
    sys_msg = (
        "You are a professional UI localiser for a gardening web app called "
        "Patch & Pot. The user will give you a tiny JSON of 5 English UI strings. "
        "Translate every VALUE into the target language using natural, idiomatic "
        "UI phrasing — short, button-like where appropriate. Keep the JSON keys "
        "unchanged. Output ONLY the translated JSON object — no prose, no fences."
    )
    chat = LlmChat(api_key=KEY, session_id=f"i18n-new-{lang_code}", system_message=sys_msg)
    chat.with_model("openai", "gpt-4o-mini")
    chat.with_params(max_tokens=600)

    payload = (
        f"TARGET LANGUAGE: {lang_label}\n"
        f"LANGUAGE CODE: {lang_code}\n\n"
        f"INPUT JSON:\n{json.dumps(NEW_KEYS, ensure_ascii=False, indent=2)}\n\n"
        "Return ONLY the translated JSON object."
    )
    resp = await chat.send_message(UserMessage(text=payload))
    text = resp.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", text)
        data = json.loads(m.group(0)) if m else {}
    out = {}
    for k, en_v in NEW_KEYS.items():
        v = data.get(k) if isinstance(data, dict) else None
        out[k] = v if (isinstance(v, str) and v.strip()) else en_v
    return out


def upsert_keys_into_block(file_text: str, lang_code: str, translated: dict[str, str]) -> str:
    """Find the locale block for `lang_code` and add/replace the new keys
    immediately before its closing brace. If a key already exists, replace it."""
    # Match the start of the block, then walk braces to find its end.
    open_pat = re.compile(rf"^  {lang_code}:\s*\{{", flags=re.MULTILINE)
    om = open_pat.search(file_text)
    if not om:
        print(f"  ⚠ could not find {lang_code} block", file=sys.stderr)
        return file_text
    depth, i = 0, om.end() - 1
    while i < len(file_text):
        c = file_text[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                close_idx = i
                break
        i += 1
    else:
        return file_text

    block = file_text[om.end() - 1 : close_idx + 1]

    # Remove any existing rows for our keys, then insert fresh.
    for k in translated:
        block = re.sub(
            rf'^\s*"{re.escape(k)}":\s*"(?:[^"\\]|\\.)*"\s*,?\s*\n',
            "",
            block,
            flags=re.MULTILINE,
        )

    # Build the new key lines and insert before the closing brace.
    insert_lines = "".join(
        f'    "{k}": {json.dumps(v, ensure_ascii=False)},\n' for k, v in translated.items()
    )
    close_pos = block.rfind("}")
    block_new = block[:close_pos] + insert_lines + block[close_pos:]

    return file_text[: om.end() - 1] + block_new + file_text[close_idx + 1 :]


async def main():
    text = I18N_PATH.read_text()
    only = set(sys.argv[1:]) if len(sys.argv) > 1 else None

    for code, label in LOCALES.items():
        if only and code not in only:
            continue
        print(f"→ {code} ({label})…", flush=True)
        try:
            translated = await asyncio.wait_for(translate_keys_for(code, label), timeout=60)
        except Exception as e:  # noqa: BLE001
            print(f"  ❌ {code} failed: {e}", file=sys.stderr)
            continue
        text = upsert_keys_into_block(text, code, translated)
        I18N_PATH.write_text(text)
        sample = list(translated.items())[0]
        print(f"  ✓ {code} ({sample[0]} → {sample[1]!r})")
    print("done.")


if __name__ == "__main__":
    asyncio.run(main())
