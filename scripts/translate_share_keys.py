"""Translate the new "Share my Patch" keys (share_patch.* and share_view.*)
into all 57 non-English locales and upsert them into the existing locale
blocks in /app/frontend/src/i18n/index.jsx.

Clone of scripts/translate_session_keys.py — same prompt, same chunking,
same upsert algorithm. Only the NEW_KEYS dict differs.

Usage:
    cd /app && python scripts/translate_share_keys.py
    cd /app && python scripts/translate_share_keys.py de fr   # subset
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

NEW_KEYS = {
    # Modal on /garden
    "share_patch.button": "Share my patch",
    "share_patch.eyebrow": "Share my patch",
    "share_patch.title_idle": "A public link to your patch.",
    "share_patch.title_live": "Your patch is shareable.",
    "share_patch.summary": "{n} {label} growing in {region}.",
    "share_patch.plant_singular": "plant",
    "share_patch.plant_plural": "plants",
    "share_patch.no_region": "Set this patch's region first — the public preview won't make sense without one.",
    "share_patch.create_cta": "Create my public link",
    "share_patch.creating": "Creating link…",
    "share_patch.link_label": "Your public link",
    "share_patch.copy": "Copy",
    "share_patch.copied": "Copied",
    "share_patch.open": "Open preview",
    "share_patch.native": "Share",
    "share_patch.refresh": "Update with my latest plants",
    "share_patch.fine_print": "Anyone with this link can see your patch name, region and plant list. No email, login or location precise to your street is shared.",
    "share_patch.delete": "Remove the public link",
    "share_patch.delete_confirm": "Are you sure? The URL will stop working immediately.",
    "share_patch.delete_yes": "Yes, remove it",
    "share_patch.cancel": "Cancel",
    "share_patch.close": "Close",
    "share_patch.error_generic": "Couldn't talk to the server — try again in a moment.",
    "share_patch.native_title": "{name} — my Patch & Pot garden",
    "share_patch.native_body": "Take a look at what I'm growing in {name}.",

    # Public preview /p/:shareId
    "share_view.eyebrow": "A shared patch on Patch & Pot",
    "share_view.loading": "Opening this patch…",
    "share_view.error_generic": "Something went wrong loading this patch.",
    "share_view.missing.title": "This patch isn't here.",
    "share_view.missing.body": "The link may have expired, or the gardener removed it. You can still start your own — five minutes, no email, free forever.",
    "share_view.missing.cta": "Start my own patch",
    "share_view.plants_title": "{n} plants in this patch",
    "share_view.no_plants": "This gardener hasn't added any plants to their patch yet.",
    "share_view.forecast.eyebrow": "This month",
    "share_view.forecast.title": "What {region} is doing in {month}",
    "share_view.cta_create": "Make my own",
    "share_view.cta_band.eyebrow": "Your patch, your way",
    "share_view.cta_band.title": "Build your own monthly guide.",
    "share_view.cta_band.body": "Pick your region, add your plants, and get a month-by-month plan that knows what your climate is actually doing — including the pests to watch for. Free forever for one patch.",
    "share_view.cta_band.button": "Start my own patch — free",
    "share_view.meta_description": "{name} — a Patch & Pot garden in {region}, growing {n} plants. See what they're planting, harvesting and watching for in {month}.",
}

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


async def translate_keys_for(lang_code: str, lang_label: str) -> dict:
    sys_msg = (
        "You are a professional UI localiser for a gardening web app called "
        "Patch & Pot. The user will give you a JSON of English strings. "
        "Translate every VALUE into the target language using natural, idiomatic, "
        "warm phrasing — these strings are read in a thoughtful, contemplative "
        "tone (gardening + wellbeing). KEEP THE JSON KEYS UNCHANGED. RULES:\n"
        "1. Preserve any {placeholder} tokens (curly braces) EXACTLY — don't translate them.\n"
        "2. Preserve em-dashes — and special punctuation. Currency symbols stay (£).\n"
        "3. ESCAPE any double quotes \" inside translated values as \\\".\n"
        "4. Brand 'Patch & Pot' stays as-is.\n"
        "5. Plant / insect names: localise to the natural common name in the target language.\n"
        "6. Output ONLY the translated JSON object — no markdown fences, no preamble."
    )

    async def _call(batch):
        chat = LlmChat(api_key=KEY, session_id=f"share-i18n-{lang_code}-{id(batch)}", system_message=sys_msg)
        chat.with_model("openai", "gpt-4o-mini")
        chat.with_params(max_tokens=8000)
        payload = (
            f"TARGET LANGUAGE: {lang_label}\n"
            f"LANGUAGE CODE: {lang_code}\n\n"
            f"INPUT JSON:\n{json.dumps(batch, ensure_ascii=False, indent=2)}\n\n"
            "Return ONLY the translated JSON object."
        )
        resp = await chat.send_message(UserMessage(text=payload))
        text = resp.strip()
        text = re.sub(r"^```(?:json)?\s*", "", text)
        text = re.sub(r"\s*```$", "", text)
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            m = re.search(r"\{[\s\S]*\}", text)
            try:
                return json.loads(m.group(0)) if m else None
            except json.JSONDecodeError:
                return None

    items = list(NEW_KEYS.items())
    CHUNK = 12
    merged = {}
    for i in range(0, len(items), CHUNK):
        batch = dict(items[i : i + CHUNK])
        data = await _call(batch)
        if data is None:
            for k, en_v in batch.items():
                solo = await _call({k: en_v})
                v = (solo or {}).get(k) if isinstance(solo, dict) else None
                merged[k] = v if (isinstance(v, str) and v.strip()) else en_v
        else:
            for k, en_v in batch.items():
                v = data.get(k) if isinstance(data, dict) else None
                merged[k] = v if (isinstance(v, str) and v.strip()) else en_v
    return merged


def upsert_keys_into_block(file_text: str, lang_code: str, translated: dict) -> str:
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

    for k in translated:
        block = re.sub(
            rf'^\s*"{re.escape(k)}":\s*"(?:[^"\\]|\\.)*"\s*,?\s*\n',
            "",
            block,
            flags=re.MULTILINE,
        )

    insert_lines = "".join(
        f'    "{k}": {json.dumps(v, ensure_ascii=False)},\n' for k, v in translated.items()
    )
    close_pos = block.rfind("}")
    block_new = block[:close_pos] + insert_lines + block[close_pos:]

    return file_text[: om.end() - 1] + block_new + file_text[close_idx + 1 :]


async def main():
    text = I18N_PATH.read_text()
    only = set(sys.argv[1:]) if len(sys.argv) > 1 else None
    sem = asyncio.Semaphore(2)

    async def one(code, label):
        async with sem:
            print(f"→ {code} ({label})…", flush=True)
            try:
                translated = await asyncio.wait_for(translate_keys_for(code, label), timeout=600)
                return code, translated
            except Exception as e:  # noqa: BLE001
                print(f"  ❌ {code} failed: {e!r}", file=sys.stderr)
                return code, None

    tasks = [one(c, l) for c, l in LOCALES.items() if (not only or c in only)]
    for fut in asyncio.as_completed(tasks):
        code, translated = await fut
        if translated is None:
            continue
        text = upsert_keys_into_block(text, code, translated)
        I18N_PATH.write_text(text)
        sample = list(translated.items())[0]
        print(f"  ✓ {code} ({sample[0]} → {sample[1]!r})")
    print("done.")


if __name__ == "__main__":
    asyncio.run(main())
