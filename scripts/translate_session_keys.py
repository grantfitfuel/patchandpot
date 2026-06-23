"""Translate the new patch / compare / wellbeing / patrons-retro keys
into all 57 non-English locales and upsert them into the existing locale
blocks in /app/frontend/src/i18n/index.jsx.

This is a forked clone of scripts/translate_new_keys.py — same prompt,
same chunking, same upsert algorithm. Only the NEW_KEYS dict differs.

Usage:
    cd /app && python scripts/translate_session_keys.py
    cd /app && python scripts/translate_session_keys.py de fr   # only some locales
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

# Re-run safe: existing translations for these keys are replaced.
NEW_KEYS = {
    # nav
    "nav.wellbeing": "Wellbeing",

    # multi-patch UI
    "patch.your_patches": "Your patches",
    "patch.of": "of",
    "patch.add_another": "Add another patch",
    "patch.add": "Add patch",
    "patch.set_region_for": "Set this patch's region",
    "patch.change_region_for": "Change region for {name}",
    "patch.region_label": "Region: {name}",
    "patch.set_region": "Set region",
    "patch.rename": "Rename",
    "patch.save": "Save",
    "patch.cancel": "Cancel",
    "patch.delete": "Delete this patch",
    "patch.delete_confirm": "Delete \"{name}\" and its plants/tasks?",
    "patch.delete_yes": "Yes, delete",
    "patch.unlock_title": "Unlock up to 25 patches",
    "patch.unlock_subtitle": "Included with any Patch & Pot membership",
    "patch.unlock_short": "Unlock more patches",
    "patch.limit_paid": "You've reached the {limit}-patch limit. Email {email} if you need more.",
    "patch.limit_free_prefix": "You've reached the free {limit}-patch limit.",
    "patch.limit_free_link": "Upgrade to track up to 25 patches.",
    "patch.manage": "Manage patches (rename, delete)",

    # /calendar/compare
    "compare.eyebrow_suffix": "Compare",
    "compare.title": "Two patches, one month.",
    "compare.subtitle": "See exactly how each garden differs this month — what to sow, what to harvest, which pests to watch for — at a glance.",
    "compare.empty": "You only have one patch right now. Add a second patch — say a holiday cottage or an allotment — and come back here to see this month side by side.",
    "compare.empty_cta": "Add another patch",
    "compare.calendar_link": "Compare patches",
    "compare.swap": "Swap",
    "compare.patch_a": "Patch A",
    "compare.patch_b": "Patch B",
    "compare.no_region": "This patch doesn't have a region yet.",
    "compare.no_region_set_one": "Set one",
    "compare.no_region_suffix": "to compare it here.",
    "compare.unlock_title": "Unlock side-by-side compare",
    "compare.unlock_body": "Pick any two of your patches and see exactly what differs this month. Included with any Patch & Pot membership.",
    "compare.unlock_cta": "Unlock to compare",

    # Retrospective patrons
    "patrons.retro.eyebrow": "Already supported but not listed?",
    "patrons.retro.title": "Add yourself any time.",
    "patrons.retro.body": "If you paid but didn't tick the opt-in box on the success page, you can add yourself here using the checkout token from your receipt. One click to edit or remove later.",
    "patrons.retro.cta": "Add me to the Patrons page",
    "patrons.footer.prefix": "Listed with explicit consent. Patrons can",
    "patrons.footer.link": "add, edit or remove their listing",
    "patrons.footer.suffix": "any time using the checkout token from their receipt — no login required. Email",
    "patrons.footer.email_suffix": "if you've lost yours.",

    # Patron opt-in
    "patron_optin.collapsed_label": "Want a thank-you mention on our Patrons page? (Optional)",
    "patron_optin.listed_thank": "You're on the Patrons page. Thank you.",

    # Wellbeing — page chrome
    "wellbeing.eyebrow": "Wellbeing journal",
    "wellbeing.title": "You grow yourself, too.",
    "wellbeing.subtitle": "Patch & Pot is more than food. Sit in your patch with no purpose apart from simply being and relaxing — listen to the birds, watch the bees, follow a butterfly across the borders. The garden tends you back, if you let it. This page is your private space to notice that, week by week, season by season.",
    "wellbeing.back_home": "Back to home",
    "wellbeing.moment.eyebrow": "This month's mindful moment",
    "wellbeing.checkin.eyebrow": "Today",
    "wellbeing.checkin.title": "How are you, gardener?",
    "wellbeing.checkin.mood_label": "How do you feel right now?",
    "wellbeing.checkin.note_label": "One thing from your patch today (optional)",
    "wellbeing.checkin.note_placeholder": "First strawberry. The smell of basil. A bee on the chamomile.",
    "wellbeing.checkin.save": "Save today's check-in",
    "wellbeing.checkin.update": "Update today's check-in",
    "wellbeing.checkin.saved": "Saved.",
    "wellbeing.principles.eyebrow": "The Patch & Pot way",
    "wellbeing.principles.title": "Three small things, every season.",
    "wellbeing.principle.notice.title": "Notice",
    "wellbeing.principle.notice.body": "Stand still in your patch for one minute. Name three things you can see, hear, or smell. The garden is always offering — most of us are too busy to receive.",
    "wellbeing.principle.slow.title": "Slow",
    "wellbeing.principle.slow.body": "Plants grow at plant pace. Watering, deadheading, pricking out — these are not chores to rush through, they're invitations to drop the day's tempo for ten minutes.",
    "wellbeing.principle.nourish.title": "Nourish",
    "wellbeing.principle.nourish.body": "Eat one thing you grew this week. Cut one stem for the kitchen table. The patch isn't there to look productive — it's there to feed you, in every sense of the word.",

    # Wellbeing — sit-and-notice (sensory immersion)
    "wellbeing.sense.eyebrow": "Sit and notice",
    "wellbeing.sense.title": "Five minutes. One chair. Your patch.",
    "wellbeing.sense.body": "The most underrated part of having a garden is the right to sit in it with no purpose apart from simply being and relaxing. Pick one sense each week and give it a real minute of your attention. You'll find more in your own patch than you ever do scrolling.",
    "wellbeing.sense.hear.title": "Listen",
    "wellbeing.sense.hear.body": "Close your eyes for sixty seconds. Count the birds you can hear without trying to identify them. Notice the rustle of the ornamental grasses, the buzz of bees in the lavender, the dry click of a hoverfly working a daisy. Garden silence is never empty — it's layered.",
    "wellbeing.sense.see.title": "Watch",
    "wellbeing.sense.see.body": "Pick one flower head and stay with it. A bumblebee bumping its way from floret to floret. A peacock butterfly opening and closing on the buddleia. A wasp drinking at the rim of a saucer. Slow looking is its own kind of meditation.",
    "wellbeing.sense.smell.title": "Breathe in",
    "wellbeing.sense.smell.body": "Crush a single leaf — basil, mint, sage, lemon balm, rosemary. Hold it under your nose for a full breath. The smell of a tomato vine after rain. Wet soil. Sun-warm box hedge. Most of these scents you've forgotten you remember.",
    "wellbeing.sense.touch.title": "Touch",
    "wellbeing.sense.touch.body": "Run your fingers along the spine of a fern, the velvet of a salvia leaf, the prickle of a borage stem, the cool give of fresh compost. Take your shoes off on the grass for one minute. Skin remembers things the mind forgets.",
    "wellbeing.sense.taste.title": "Taste",
    "wellbeing.sense.taste.body": "Eat one thing straight from the plant — a strawberry warm from the sun, a single nasturtium flower, a sprig of fennel, a pea from the pod. The shortest food chain on earth is the one that ends in your own mouth.",

    # Wellbeing — "soul" band
    "wellbeing.soul.eyebrow": "Why we built this",
    "wellbeing.soul.title": "You don't only grow food, or the transient beauty of flowers. You grow yourself and your soul.",
    "wellbeing.soul.body": "A patch teaches patience to people who don't think they have any. It rewards small daily attention more reliably than almost anything else in modern life. It pulls you outside, slows your breath, makes you kneel down, makes you look. The harvest is the carrots and the courgettes; it's also the brief, transient beauty of a poppy or a sweet pea — here today, gone next week, and all the lovelier for it. A garden — even a balcony pot or a windowsill jar — is a quiet, generous teacher of how to be a person. Patch & Pot exists to keep that practice alive in your week.",

    # Wellbeing — history
    "wellbeing.history.eyebrow": "Looking back",
    "wellbeing.history.title": "Your check-ins",
    "wellbeing.history.print": "Print booklet",
    "wellbeing.history.delete": "Delete entry",

    # Mindful moments — twelve seasonal prompts
    "wellbeing.moment.1.title": "January — listening",
    "wellbeing.moment.1.body": "The garden is asleep, and that is a gift. Wrap up, step outside, and stand still for a minute. Notice what's quiet. The first stirrings — a green shoot, a robin, a softer light — are weeks away, and that's exactly the right pace.",
    "wellbeing.moment.2.title": "February — tending the seed of intention",
    "wellbeing.moment.2.body": "Before you sow anything, sit with what you actually want from the garden this year. One handful of basil. One vase of sweet peas. One quiet half-hour after work. Plant for the life you want, not the one you think you should.",
    "wellbeing.moment.3.title": "March — first patience",
    "wellbeing.moment.3.body": "Seeds need warmth, dark, time. So do you. Resist the urge to push everything outside on the first warm day. The garden rewards the gardener who waits one more week.",
    "wellbeing.moment.4.title": "April — small, daily",
    "wellbeing.moment.4.body": "Ten minutes a day in the patch is more useful — and more nourishing — than three hours on a Saturday. Make a habit of stepping out before the kettle boils.",
    "wellbeing.moment.5.title": "May — the abundance is coming",
    "wellbeing.moment.5.body": "Everything wants to grow at once. So might you. Pick the three things that matter most this week and let the rest be imperfect. The garden will forgive you. So will you.",
    "wellbeing.moment.6.title": "June — receive",
    "wellbeing.moment.6.body": "The first strawberry, the first cut flower, the first salad from your own soil. Don't bank these moments for later — taste them now, slowly, with your hands still warm from the sun.",
    "wellbeing.moment.7.title": "July — let it be enough",
    "wellbeing.moment.7.body": "Mid-summer is when gardens look least like the photo on the seed packet. That is normal. A leggy plant, a slug-eaten leaf, a patch you didn't get to — these are not failures, they're life.",
    "wellbeing.moment.8.title": "August — share",
    "wellbeing.moment.8.body": "If you have one tomato too many, a courgette glut, an extra bunch of cosmos — give some away. The patch teaches generosity in a way nothing else does.",
    "wellbeing.moment.9.title": "September — gather",
    "wellbeing.moment.9.body": "Save a few seeds. Press a leaf in a book. Take a single photograph of the patch as it really looks today. The garden ends, but the noticing stays.",
    "wellbeing.moment.10.title": "October — let things die",
    "wellbeing.moment.10.body": "Frost will take the dahlias and the basil this month. That isn't loss — it's the deal. Cut, compost, clear, breathe out. There's a kind of peace in tidying away.",
    "wellbeing.moment.11.title": "November — rest",
    "wellbeing.moment.11.body": "The patch needs less from you now. Take that as permission. A quiet walk, a heavy book, a long bath. The gardener also overwinters.",
    "wellbeing.moment.12.title": "December — return",
    "wellbeing.moment.12.body": "The seed catalogues will come, and with them the first stirrings of next year's hope. Read them slowly, with tea. Choose less than you think you should. Begin again.",

    # Home wellbeing band
    "home.wellbeing.eyebrow": "Why we're here",
    "home.wellbeing.title": "Grow food. Grow yourself.",
    "home.wellbeing.body": "Patch & Pot is built around a simple idea: tending plants tends you back. The patch isn't only a place to produce a meal — it's a chair you sit in, the sound of bees in the rosemary, a butterfly on the buddleia, the rustle of an ornamental grass. We help you grow the food, the flowers and the small daily practice that grows you, too.",
    "home.wellbeing.cta": "Open your wellbeing journal",
}

# Native labels for each locale.
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
        "Patch & Pot. The user will give you a JSON of English strings. "
        "Translate every VALUE into the target language using natural, idiomatic, "
        "warm phrasing — these strings are read in a thoughtful, contemplative "
        "tone (gardening + wellbeing). KEEP THE JSON KEYS UNCHANGED. RULES:\n"
        "1. Preserve any {placeholder} tokens (curly braces) EXACTLY — don't translate them.\n"
        "2. Preserve em-dashes — and special punctuation. Currency symbols stay (£).\n"
        "3. ESCAPE any double quotes \" inside translated values as \\\".\n"
        "4. Brand 'Patch & Pot' stays as-is.\n"
        "5. Plant / insect names: localise to the natural common name in the target language "
        "(e.g. 'lavender' → 'lavanda' in Italian, 'buddleia' → its common-name equivalent). "
        "If a plant has no idiomatic name, keep the English name in italics inside the value (no markup).\n"
        "6. Output ONLY the translated JSON object — no markdown fences, no preamble."
    )

    async def _call(batch: dict[str, str]) -> dict | None:
        chat = LlmChat(api_key=KEY, session_id=f"i18n-session-{lang_code}-{id(batch)}", system_message=sys_msg)
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
    merged: dict[str, str] = {}
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


def upsert_keys_into_block(file_text: str, lang_code: str, translated: dict[str, str]) -> str:
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

    # Run two locales concurrently to keep wall-time sane while staying
    # well under any per-key rate limit.
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
