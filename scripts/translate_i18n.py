"""Batch-translate the 27 empty language blocks in
/app/frontend/src/i18n/index.jsx via Claude Sonnet 4.5.

Reads the English dict (lines 4–364), asks Claude to produce a strict JSON
object with the same keys translated, then patches every `xx: {},` empty
block in the file with a properly-formatted JS-object literal.
"""
import asyncio
import json
import os
import re
import sys
from pathlib import Path

# Ensure backend's installed deps are importable.
sys.path.insert(0, "/app/backend")
from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402
from dotenv import load_dotenv  # noqa: E402

load_dotenv("/app/backend/.env")

I18N_PATH = Path("/app/frontend/src/i18n/index.jsx")
KEY = os.environ.get("EMERGENT_LLM_KEY") or "sk-emergent-d47168452B3B956Be7"

# Native names — used in the LLM prompt so it knows the target language clearly.
TARGETS = {
    "hi": "Hindi (हिन्दी)",
    "bn": "Bengali (বাংলা)",
    "te": "Telugu (తెలుగు)",
    "mr": "Marathi (मराठी)",
    "ta": "Tamil (தமிழ்)",
    "gu": "Gujarati (ગુજરાતી)",
    "ur": "Urdu (اردو) — RTL script",
    "kn": "Kannada (ಕನ್ನಡ)",
    "ml": "Malayalam (മലയാളം)",
    "pa": "Punjabi (Gurmukhi script, ਪੰਜਾਬੀ)",
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
    "kk": "Kazakh (Қазақша, Cyrillic)",
    "uz": "Uzbek (Oʻzbekcha, Latin)",
    "az": "Azerbaijani (Azərbaycanca, Latin)",
    "ky": "Kyrgyz (Кыргызча, Cyrillic)",
    "hy": "Armenian (Հայերեն)",
    "ka": "Georgian (ქართული)",
}


def extract_en_dict(text: str) -> dict[str, str]:
    """Pull the en: {...} block out and parse it into a Python dict."""
    # Find the en block lines 4–364.
    start = text.index("en: {")
    # walk the braces.
    depth, i = 0, start + len("en: ")
    while i < len(text):
        c = text[i]
        if c == "{":
            depth += 1
        elif c == "}":
            depth -= 1
            if depth == 0:
                end = i + 1
                break
        i += 1
    block = text[start + len("en: "): end]  # incl. outer { ... }

    # Parse `"key": "value",` pairs. Values may contain escaped chars.
    out: dict[str, str] = {}
    pat = re.compile(
        r'"([\w.\-]+)"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,?'
    )
    for m in pat.finditer(block):
        k = m.group(1)
        raw = m.group(2)
        # Convert JS-escape sequences into a real Python string via JSON.
        try:
            val = json.loads(f'"{raw}"')
        except json.JSONDecodeError:
            val = raw.encode().decode("unicode_escape")
        out[k] = val
    return out


async def translate_one(lang_code: str, lang_label: str, en: dict[str, str]) -> dict[str, str]:
    """Ask Claude Sonnet 4.5 to translate the whole dict into the target language.

    Chunked into ~125-key batches so each call's output stays well under the
    16K-token model cap and finishes within a sensible wall-clock budget.
    """
    sys_msg = (
        "You are a professional localiser for a gardening web app called "
        "'Patch & Pot'. The user will give you a JSON object of UI strings in "
        "English. Translate every VALUE into the target language, keeping the "
        "exact same JSON keys, structure and any {placeholders} (do NOT translate "
        "things inside curly braces). Preserve sentence-final punctuation and "
        "punctuation style natural for the target language. Keep brand name "
        "'Patch & Pot' as-is. Currency '£5' stays as £5. Use script and grammar "
        "native to the target language. Output ONLY a single JSON object — no "
        "prose, no markdown fences."
    )

    items = list(en.items())
    chunks: list[dict[str, str]] = []
    CHUNK = 100
    for start in range(0, len(items), CHUNK):
        chunks.append(dict(items[start:start + CHUNK]))

    out_combined: dict[str, str] = {}

    def _parse_loose(s: str) -> dict[str, str]:
        d: dict[str, str] = {}
        pat = re.compile(r'"([\w.\-]+)"\s*:\s*"((?:[^"\\]|\\.)*)"\s*,?')
        for mm in pat.finditer(s):
            try:
                d[mm.group(1)] = json.loads(f'"{mm.group(2)}"')
            except json.JSONDecodeError:
                d[mm.group(1)] = mm.group(2)
        return d

    for idx, chunk in enumerate(chunks, 1):
        chat = LlmChat(api_key=KEY, session_id=f"i18n-{lang_code}-{idx}", system_message=sys_msg)
        chat.with_model("openai", "gpt-4o-mini")
        chat.with_params(max_tokens=8000)

        payload = (
            f"TARGET LANGUAGE: {lang_label}\n"
            f"LANGUAGE CODE: {lang_code}\n"
            f"BATCH {idx}/{len(chunks)}\n\n"
            f"INPUT JSON (English):\n{json.dumps(chunk, ensure_ascii=False, indent=2)}\n\n"
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
            if m:
                try:
                    data = json.loads(m.group(0))
                except json.JSONDecodeError:
                    data = _parse_loose(m.group(0))
            else:
                data = _parse_loose(text)

        if not isinstance(data, dict) or len(data) < len(chunk) * 0.5:
            dbg = Path(f"/tmp/i18n-debug-{lang_code}-{idx}.txt")
            dbg.write_text(text)
            print(f"  ⚠ {lang_code} batch {idx}: only {len(data) if isinstance(data, dict) else 0}/{len(chunk)} keys; raw saved", file=sys.stderr)

        for k, en_v in chunk.items():
            v = data.get(k) if isinstance(data, dict) else None
            if not isinstance(v, str) or not v.strip():
                v = en_v
            out_combined[k] = v

    return out_combined


def render_block(lang_code: str, d: dict[str, str]) -> str:
    """Render a JS object literal block matching the file's style."""
    lines = [f"  {lang_code}: {{"]
    for k, v in d.items():
        # JSON-stringify the value so quotes/escapes are JS-safe.
        v_js = json.dumps(v, ensure_ascii=False)
        lines.append(f'    "{k}": {v_js},')
    lines.append("  },")
    return "\n".join(lines)


def patch_file(text: str, lang_code: str, block: str) -> str:
    """Replace `  xx: {},` (possibly on its own line) with the new block."""
    pat = re.compile(rf"^\s*{lang_code}:\s*\{{\}},?\s*$", flags=re.MULTILINE)
    m = pat.search(text)
    if not m:
        print(f"  ⚠️  could not locate empty block for {lang_code}", file=sys.stderr)
        return text
    return text[: m.start()] + block + text[m.end():]


async def main():
    text = I18N_PATH.read_text()
    en = extract_en_dict(text)
    print(f"Parsed {len(en)} English keys.")

    # Allow running on a subset for testing/resume.
    only = set(sys.argv[1:]) if len(sys.argv) > 1 else None

    for code, label in TARGETS.items():
        if only and code not in only:
            continue
        # Skip if already translated (block is non-empty).
        if re.search(rf"^\s*{code}:\s*\{{\}},?\s*$", text, re.MULTILINE) is None:
            print(f"⏭  {code} already populated, skipping")
            continue
        print(f"→ translating {code} ({label})…", flush=True)
        try:
            translated = await asyncio.wait_for(
                translate_one(code, label, en), timeout=240
            )
        except asyncio.TimeoutError:
            print(f"  ❌ {code} timed out (>240s) — skipping, can resume later", file=sys.stderr)
            continue
        except Exception as e:
            print(f"  ❌ {code} failed: {e}", file=sys.stderr)
            continue

        block = render_block(code, translated)
        text = patch_file(text, code, block)
        # Persist after every language so a partial run is recoverable.
        I18N_PATH.write_text(text)
        print(f"  ✓ {code} written ({len(translated)} keys)")

    print("done.")


if __name__ == "__main__":
    asyncio.run(main())
