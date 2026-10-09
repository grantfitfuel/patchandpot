"""Translate the new 'vibrant redesign' + 'homepage' hardcoded strings
to all 57 non-EN locales. Covers:

- Wellbeing calm CTA
- Calm hero (eyebrow/title/blurb)
- Journal paywall benefits (3 tiles)
- Ask paywall (hero + 3-perk tiles + CTAs) + Ask paid hero + Ask empty-state starters
- Deep Dive section (eyebrow/title/blurb/count/lesson_count/start_course)
- Guides vase-tips eyebrow
- AI Masterclass reader labels (back, loading, all_masterclasses, eyebrow,
  masterclass_label, lesson_of, lesson_n, progress, mark_complete,
  marked_complete, next_lesson, prev, next)
- Home hero (title/blurb/meta_description/ask_question CTA)
- Home AI value-prop strip (5 fragments)
- Home ethos band (eyebrow/title/body/cta)
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
_EN = (LOCALES_DIR / "en.js").read_text()


def _grab(key):
    m = re.search(rf'"{re.escape(key)}":\s*("(?:[^"\\]|\\.)*"),\s*\n', _EN)
    if not m:
        raise KeyError(f"Missing in en.js: {key}")
    return json.loads(m.group(1))


KEYS = [
    "wellbeing.calm_cta",
    "calm.hero.eyebrow",
    "calm.hero.title",
    "calm.hero.blurb",
    "journal.benefits.eyebrow",
    "journal.benefits.title",
    "journal.benefits.pin.title",
    "journal.benefits.pin.body",
    "journal.benefits.tag.title",
    "journal.benefits.tag.body",
    "journal.benefits.download.title",
    "journal.benefits.download.body",
    "ask.paywall.eyebrow",
    "ask.paywall.title",
    "ask.paywall.blurb",
    "ask.paywall.become_member",
    "ask.paywall.browse_popular",
    "ask.paywall.topics_link",
    "ask.paywall.perks.eyebrow",
    "ask.paywall.perks.title",
    "ask.paywall.perks.limit.title",
    "ask.paywall.perks.limit.body",
    "ask.paywall.perks.photo.title",
    "ask.paywall.perks.photo.body",
    "ask.paywall.perks.followups.title",
    "ask.paywall.perks.followups.body",
    "ask.paid.eyebrow",
    "ask.paid.blurb",
    "deepdive.start_course",
    "deepdive.eyebrow",
    "deepdive.title",
    "deepdive.blurb",
    "deepdive.count",
    "deepdive.lesson_count",
    "guides.vasetips.eyebrow",
    "ask.empty.intro",
    "ask.empty.starter_1",
    "ask.empty.starter_2",
    "ask.empty.starter_3",
    "ask.empty.starter_4",
    "mc.ai.back",
    "mc.ai.loading",
    "mc.ai.all_masterclasses",
    "mc.ai.eyebrow",
    "mc.ai.lesson_of",
    "mc.ai.lesson_n",
    "mc.ai.masterclass_label",
    "mc.ai.progress",
    "mc.ai.mark_complete",
    "mc.ai.marked_complete",
    "mc.ai.next_lesson",
    "mc.ai.prev",
    "mc.ai.next",
    "home.hero.title",
    "home.hero.blurb",
    "home.hero.meta_description",
    "home.cta.ask_question",
    "home.aiprop.ask_nadar",
    "home.aiprop.answers",
    "home.aiprop.masterclass_creator",
    "home.aiprop.writes_course",
    "home.aiprop.free_to_try",
    "home.ethos.eyebrow",
    "home.ethos.title",
    "home.ethos.body",
    "home.ethos.cta",
]
SOURCE = {k: _grab(k) for k in KEYS}

LOCALES = {
    "de": "German", "es": "Spanish", "gd": "Scottish Gaelic", "cy": "Welsh", "ga": "Irish",
    "da": "Danish", "nb": "Norwegian Bokmål", "sv": "Swedish", "is": "Icelandic", "fi": "Finnish",
    "pt": "Portuguese", "it": "Italian", "nl": "Dutch", "pl": "Polish", "cs": "Czech", "sk": "Slovak",
    "sl": "Slovenian", "hr": "Croatian", "bg": "Bulgarian", "ro": "Romanian", "hu": "Hungarian",
    "el": "Greek", "et": "Estonian", "lv": "Latvian", "lt": "Lithuanian", "mt": "Maltese",
    "uk": "Ukrainian", "fr": "French", "ja": "Japanese", "zh": "Chinese (Simplified)",
    "hi": "Hindi", "bn": "Bengali", "te": "Telugu", "mr": "Marathi", "ta": "Tamil", "gu": "Gujarati",
    "ur": "Urdu (RTL)", "kn": "Kannada", "ml": "Malayalam", "pa": "Punjabi", "id": "Indonesian",
    "ms": "Malay", "vi": "Vietnamese", "th": "Thai", "ko": "Korean", "tl": "Filipino", "mi": "Māori",
    "ar": "Arabic (RTL)", "tr": "Turkish", "ru": "Russian", "be": "Belarusian", "kk": "Kazakh",
    "uz": "Uzbek", "az": "Azerbaijani", "ky": "Kyrgyz", "hy": "Armenian", "ka": "Georgian",
    "sr": "Serbian",
}


async def translate(code, label):
    sys_msg = (
        "You translate UI strings for a gardening web app. Return ONLY a "
        "JSON object with the exact same keys as the input. Preserve "
        "placeholders like {n}, {total}, {current}, {done} verbatim. "
        "Preserve HTML-like arrow characters (→) verbatim. "
        "Preserve 'Nàdar' (a Scottish Gaelic proper noun) verbatim unless "
        "the target language is Scottish Gaelic itself. "
        "Preserve 'Patch & Pot' as the brand name. "
        "Keep tone warm, gentle, naturalistic — matches a mindful gardening journal."
    )
    chat = LlmChat(api_key=KEY, session_id=f"i18n-sweep-{code}",
                   system_message=sys_msg)
    chat.with_model("openai", "gpt-4o-mini")
    chat.with_params(max_tokens=6000)
    resp = await chat.send_message(UserMessage(
        text=f"TARGET LANGUAGE: {label}\nINPUT: {json.dumps(SOURCE, ensure_ascii=False)}\nJSON only."
    ))
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", resp.strip())
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", text)
        return json.loads(m.group(0)) if m else {}


def upsert(code, translated):
    """Remove any existing instances of the keys we're writing (anywhere
    in the file), then re-insert the full translated block just before
    the closing `};` so the newest values win."""
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
            if tr and set(tr) >= set(SOURCE):
                upsert(c, tr)
                print(f"  ✓ {c}")
            else:
                missing = set(SOURCE) - set(tr or {})
                print(f"  ⚠️  {c}: missing {len(missing)} keys", file=sys.stderr)
        except Exception as e:  # noqa: BLE001
            print(f"  ❌ {c}: {e!r}", file=sys.stderr)


async def main():
    sem = asyncio.Semaphore(8)
    await asyncio.gather(*[one(c, l, sem) for c, l in LOCALES.items()])
    print("done.")


if __name__ == "__main__":
    asyncio.run(main())
