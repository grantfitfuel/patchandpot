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

# The keys to translate (English values).
# This script is idempotent: re-running it updates existing translated rows.
NEW_KEYS = {
    "share.share_masterclass": "Share masterclass",
    "share.link_copied": "Link copied",
    "share.copy_prompt": "Copy this link:",
    "arr.eyebrow": "From your garden",
    "arr.title": "Today's arrangement",
    "arr.subtitle_prefix": "One seasonal arrangement, built from only what's in your garden right now — using the principles from",
    "arr.empty": "Add a few plants to your garden first, and we'll suggest an arrangement using only what you have.",
    "arr.no_region": "Set your region above so the arrangement is right for the season where you are.",
    "arr.cta_intro": "We'll look at your {count} plants, the climate where you are, and propose a recipe you can build today.",
    "arr.cta_button": "Suggest an arrangement",
    "arr.loading": "Reading your garden and the season…",
    "arr.try_again": "Try again",
    "arr.error_default": "Couldn't reach the arranger right now. Try again in a moment.",
    "arr.label_vase": "Vase",
    "arr.label_mechanic": "Mechanic",
    "arr.label_stems": "Stems",
    "arr.label_build": "Build, in order",
    "arr.label_tip": "Tip",
    "arr.regenerate": "Suggest a different one",
    "arr.read_masterclass": "Read the arranging masterclass →",
    "learn.eyebrow_free": "Free intro lesson",
    "learn.not_found_title": "This topic isn't available yet.",
    "learn.not_found_body": "It may not have been generated, or the link is mistyped.",
    "learn.not_found_back": "Browse all masterclasses",
    "learn.loading": "Loading…",
    "learn.lesson_n": "Lesson {n}",
    "learn.unlock_title": "Continue the full masterclass",
    "learn.unlock_body": "You've read the free intro lesson. The remaining lessons — plus every other masterclass, the climate-accurate growing journal PDF, and AI region-tuned guides — unlock with a single Patch & Pot membership.",
    "learn.unlock_button": "Unlock the full masterclass",
    "learn.pricing_note": "£5 a year or £25 for life. 30-day guarantee.",
    "learn.open_full": "Open the full masterclass",
    "footer.legal.privacy": "Privacy",
    "footer.legal.terms": "Terms",
    "footer.legal.contact": "Contact",
    "footer.trading_as": "trading as",
    "footer.rights": "All rights reserved.",
    "mc.title.flower-arranging": "The Art of Flower Arranging",
    "mc.tagline.flower-arranging": "From a fistful of garden stems to a vase you'd be proud to put on any table — principles, mechanics, and seasonal recipes.",
    "mc.section.arranging.label": "Floristry",
    "mc.section.arranging.title": "Floristry & Arranging",
    "mc.section.arranging.description": "Turn home-grown stems into arrangements you'd be proud to put on any table — principles, mechanics, and seasonal recipes.",
    "legal.eyebrow": "Legal",
    "legal.last_updated": "Last updated: {date}",
    "legal.banner.notice": "This translation is provided for your convenience. The English version is the legally authoritative text.",
    "legal.banner.read_en": "Read the English version",
    "legal.privacy.page_title": "Privacy Notice — Patch & Pot",
    "legal.privacy.page_description": "How Patch & Pot collects, uses, and protects your personal data.",
    "legal.privacy.heading": "Privacy Notice",
    "legal.privacy.intro_html": "This notice explains what personal data Patch &amp; Pot collects, why we collect it, how it is used, and the rights you have over it under the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.",
    "legal.privacy.read_terms": "Read the Terms of Service →",
    "legal.terms.page_title": "Terms of Service — Patch & Pot",
    "legal.terms.page_description": "The terms under which Patch & Pot is provided.",
    "legal.terms.heading": "Terms of Service",
    "legal.terms.intro_html": "Welcome to Patch &amp; Pot. By using the site you agree to these terms. We have tried to keep them short, fair, and in plain English.",
    "legal.terms.read_privacy": "Read the Privacy Notice →",
    "legal.privacy.who.title": "Who we are",
    "legal.privacy.who.html": "<p>Patch &amp; Pot is a small independent gardening publisher (the “Service”) operated from the United Kingdom. The data controller is <strong>Grant Cameron Anthony</strong>, trading as Patch &amp; Pot, based in Barrhead, East Renfrewshire, Scotland, UK. You can reach us at <a class=\\\"link\\\" href=\\\"mailto:hello@patchandpot.com\\\">hello@patchandpot.com</a>; a full correspondence address is available on request.</p>",
    "legal.privacy.collect.title": "What we collect, and why",
    "legal.privacy.collect.html": "<p>We try to collect as little as possible. In practice:</p><ul><li><strong>Location preference.</strong> When you allow location access, your browser shares an approximate latitude / longitude with us once, which we use to look up your region and climate zone for monthly guidance. We do not store your raw coordinates against an identifier; we store the resolved <em>region name</em> in your browser only.</li><li><strong>Region, language &amp; “My Garden” list.</strong> Stored in your browser’s local storage so the app remembers your settings between visits. None of this is sent to a server in a way that identifies you.</li><li><strong>Payment data.</strong> When you take out a Patch &amp; Pot membership (£5 / year or £25 / lifetime) we use <strong>Stripe</strong> to process the payment. Card details are entered into Stripe’s servers — we never see them. We receive back your email address, the amount paid, and a Stripe session identifier so we can issue your access token.</li><li><strong>Access token.</strong> A random, passwordless token tied to your purchase. Stored in your browser to unlock paid content. If you lose it, your purchase email is the recovery mechanism.</li><li><strong>Search / generation topics.</strong> When you ask our AI to author a masterclass on a topic, that topic string is sent to our servers (and to our AI providers — see below) so we can generate and cache the lesson. Topics are not tied to your identity.</li><li><strong>Basic technical logs.</strong> Standard web-server logs (IP, user-agent, requested URL, timestamp) kept for a maximum of 30 days for abuse-prevention and debugging.</li></ul>",
    "legal.privacy.lawful.title": "Lawful bases (UK GDPR Art. 6)",
    "legal.privacy.lawful.html": "<ul><li><strong>Contract</strong> — for processing your membership payment and providing paid content.</li><li><strong>Legitimate interest</strong> — for keeping the site running, preventing abuse, and improving guidance quality.</li><li><strong>Consent</strong> — for use of your device location (you can decline; the site still works with a manual region).</li></ul>",
    "legal.privacy.share.title": "Who we share data with",
    "legal.privacy.share.html": "<p>We use a small, intentionally minimal set of trusted processors:</p><ul><li><strong>Stripe</strong> (payment processing) — see <a class=\\\"link\\\" href=\\\"https://stripe.com/privacy\\\" target=\\\"_blank\\\" rel=\\\"noreferrer noopener\\\">stripe.com/privacy</a>.</li><li><strong>Anthropic, OpenAI, Google</strong> (AI providers) — used to generate monthly guidance, masterclasses and plant images on request. We do not pass them your email, location, or identity; only the gardening topic or region/month being requested.</li><li><strong>Our hosting provider</strong> — runs the application servers and the MongoDB database that caches generated content.</li></ul><p>We do <strong>not</strong> sell your data, share it with advertisers, or pass it to data brokers. We do not run third-party analytics or tracking pixels.</p>",
    "legal.privacy.transfers.title": "International transfers",
    "legal.privacy.transfers.html": "<p>Some processors above are based outside the UK / EEA. Where this is the case, we rely on the UK Government’s adequacy regulations, the EU–US Data Privacy Framework, or Standard Contractual Clauses (SCCs) as appropriate to safeguard your data.</p>",
    "legal.privacy.retention.title": "How long we keep things",
    "legal.privacy.retention.html": "<ul><li>Payment records: <strong>7 years</strong> (HMRC requirement).</li><li>Access tokens linked to a lifetime membership: kept indefinitely so your access keeps working.</li><li>Access tokens for annual membership: kept until 12 months after expiry, then deleted.</li><li>Server logs: 30 days.</li><li>AI-generated content cache: kept indefinitely (it is shared content, not personal data) but you can request a slug be regenerated or removed.</li></ul>",
    "legal.privacy.rights.title": "Your rights",
    "legal.privacy.rights.html": "<p>Under UK GDPR you have the right to:</p><ul><li>Access the personal data we hold about you.</li><li>Have inaccurate data corrected.</li><li>Have your data erased (subject to our HMRC obligations on payment records).</li><li>Restrict or object to processing.</li><li>Receive a copy of your data in a portable format.</li><li>Withdraw consent where consent is the lawful basis.</li><li>Complain to the UK Information Commissioner’s Office (<a class=\\\"link\\\" href=\\\"https://ico.org.uk\\\" target=\\\"_blank\\\" rel=\\\"noreferrer noopener\\\">ico.org.uk</a>) if you believe we have mishandled your data.</li></ul><p>To exercise any of these rights, email <a class=\\\"link\\\" href=\\\"mailto:hello@patchandpot.com\\\">hello@patchandpot.com</a>. We aim to respond within 14 days and must respond within 30.</p>",
    "legal.privacy.cookies.title": "Cookies & local storage",
    "legal.privacy.cookies.html": "<p>We do not use marketing or tracking cookies. We use:</p><ul><li><strong>Strictly necessary local storage</strong> for your region, language, “My Garden” list, and paywall access token.</li><li><strong>A service worker cache</strong> so the site loads quickly and works offline. Caches no personal data.</li><li><strong>Stripe Checkout</strong> sets its own session cookies during payment; these are governed by Stripe’s privacy notice.</li></ul>",
    "legal.privacy.changes.title": "Changes to this notice",
    "legal.privacy.changes.html": "<p>We will update the “Last updated” date at the top of this page whenever this notice changes. Material changes will be flagged on the home page for at least 14 days.</p>",
    "legal.terms.who.title": "Who we are",
    "legal.terms.who.html": "<p>Patch &amp; Pot is a small independent gardening publisher operated from the United Kingdom by <strong>Grant Cameron Anthony</strong>, trading as Patch &amp; Pot, based in Barrhead, East Renfrewshire, Scotland (“we”, “us”, “our”). You can contact us at <a class=\\\"link\\\" href=\\\"mailto:hello@patchandpot.com\\\">hello@patchandpot.com</a>.</p>",
    "legal.terms.what.title": "What Patch & Pot is",
    "legal.terms.what.html": "<p>Patch &amp; Pot provides region-specific, AI-assisted gardening guidance, masterclasses, plant care information and a downloadable seasonal journal. Some content is free; deeper content (full masterclasses, the printable PDF journal, on-demand AI guides) is unlocked via a paid membership.</p>",
    "legal.terms.membership.title": "Membership & payment",
    "legal.terms.membership.html": "<ul><li>We offer two tiers: <strong>£5 per year</strong> (annual) and <strong>£25 one-off</strong> (lifetime). Prices are inclusive of any UK VAT.</li><li>Payment is taken via Stripe. We never see your card details.</li><li>Annual memberships do <strong>not auto-renew</strong>. You must repurchase if you want another year.</li><li>Lifetime means lifetime of the Service. If Patch &amp; Pot ever shuts down, lifetime members will be given at least 60 days’ notice and a downloadable archive of their saved content where technically possible.</li></ul>",
    "legal.terms.refunds.title": "Refunds & the 30-day guarantee",
    "legal.terms.refunds.html": "<p>You have a <strong>statutory 14-day right to cancel</strong> any digital-content purchase under the Consumer Contracts Regulations 2013 — except that, by purchasing membership and immediately accessing paid content, you may waive that right.</p><p>We add a <strong>30-day no-questions-asked refund</strong> on top of that. If Patch &amp; Pot is not for you within the first 30 days, email <a class=\\\"link\\\" href=\\\"mailto:hello@patchandpot.com\\\">hello@patchandpot.com</a> and we will refund you in full.</p>",
    "legal.terms.ai.title": "AI-generated content disclaimer",
    "legal.terms.ai.html": "<p>Patch &amp; Pot’s monthly guidance, masterclasses and plant images are generated by AI on a region-specific basis. We work hard to keep the advice accurate, but:</p><ul><li>The guidance is <strong>informational, not professional horticultural advice</strong>.</li><li>Local conditions vary; always cross-check with local growers, seed packets, or your national gardening authority before sowing, pruning, foraging or eating anything.</li><li>Do <strong>not</strong> rely on Patch &amp; Pot to identify wild plants or fungi for consumption. Use a specialist guide.</li><li>Pest-control advice favours organic methods; follow product instructions for any commercial product you choose to use.</li></ul>",
    "legal.terms.use.title": "Acceptable use",
    "legal.terms.use.html": "<p>You agree not to:</p><ul><li>Scrape the site or its API at high volume.</li><li>Resell or redistribute paid content (PDF journals, masterclass courses) without permission.</li><li>Attempt to access paid content without a valid membership token.</li><li>Submit unlawful, abusive, or copyrighted material to the AI masterclass generator.</li></ul>",
    "legal.terms.ip.title": "Intellectual property",
    "legal.terms.ip.html": "<p>The Patch &amp; Pot name, logo, design, editorial copy, masterclass scripts and curated plant database are © Grant Cameron Anthony, trading as Patch &amp; Pot, 2025–2026, and may not be reproduced without written permission.</p><p>AI-generated images and AI-generated lesson text are provided for your personal use as a paying member. You may print the seasonal PDF for your own household.</p>",
    "legal.terms.liability.title": "Liability",
    "legal.terms.liability.html": "<p>Patch &amp; Pot is provided “as is”. We exclude liability for indirect or consequential loss to the maximum extent permitted by law. Our total liability for any claim is capped at the amount you have paid to us in the preceding 12 months. Nothing in these terms limits our liability for fraud, death or personal injury caused by our negligence, or anything else that cannot lawfully be limited under Scots law.</p>",
    "legal.terms.changes.title": "Changes to the Service or these terms",
    "legal.terms.changes.html": "<p>We may update the Service, prices, and these terms from time to time. Material changes will be flagged on the site for at least 14 days before taking effect. If you don’t agree with a change, you may request a pro-rata refund of any unused annual membership.</p>",
    "legal.terms.law.title": "Governing law",
    "legal.terms.law.html": "<p>These terms are governed by the laws of Scotland and any dispute is subject to the exclusive jurisdiction of the Scottish courts.</p>",
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
        "You are a professional UI + legal-text localiser for a gardening web "
        "app called Patch & Pot. The user will give you a JSON of English strings. "
        "Translate every VALUE into the target language using natural, idiomatic "
        "phrasing. KEEP THE JSON KEYS UNCHANGED. CRITICAL RULES:\n"
        "1. Preserve any {placeholder} tokens (curly braces) EXACTLY — don't translate them.\n"
        "2. Preserve ALL HTML tags exactly: <p>, <ul>, <li>, <strong>, <em>, <a class=..>, href, target, rel. Translate the TEXT INSIDE the tags only — never translate tag names, attribute names, attribute values, URLs, email addresses, or HTML entities like &amp;.\n"
        "3. CAREFULLY ESCAPE ANY DOUBLE QUOTES \" THAT APPEAR INSIDE YOUR TRANSLATED TEXT AS \\\". HTML attribute quotes stay as-is (they're inside the attribute syntax that you copied verbatim).\n"
        "4. Currency '£5' / '£25' stays as £5 / £25. Keep brand 'Patch & Pot' as-is. Keep proper-noun 'Grant Cameron Anthony' as-is. Keep place names 'Barrhead, East Renfrewshire, Scotland' as-is (you may add the local script's transliteration in parens for non-Latin scripts).\n"
        "5. Keep statutory references intact: 'UK GDPR', 'Data Protection Act 2018', 'Consumer Contracts Regulations 2013', 'HMRC', 'Scots law' (note: governing law is Scots law specifically — don't substitute English law).\n"
        "6. Output ONLY the translated JSON object — no markdown fences, no preamble."
    )

    async def _call(batch: dict[str, str]) -> dict | None:
        chat = LlmChat(api_key=KEY, session_id=f"i18n-new-{lang_code}-{id(batch)}", system_message=sys_msg)
        chat.with_model("openai", "gpt-4o-mini")
        chat.with_params(max_tokens=6000)
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

    # Chunk by 15 keys. If a chunk fails to parse, fall back to translating
    # the offending keys ONE AT A TIME — that almost always parses cleanly
    # because there are no sibling-key boundaries the model can miss.
    items = list(NEW_KEYS.items())
    CHUNK = 15
    merged: dict[str, str] = {}
    for i in range(0, len(items), CHUNK):
        batch = dict(items[i : i + CHUNK])
        data = await _call(batch)
        if data is None:
            # Per-key fallback
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
            translated = await asyncio.wait_for(translate_keys_for(code, label), timeout=300)
        except Exception as e:  # noqa: BLE001
            print(f"  ❌ {code} failed: {e!r}", file=sys.stderr)
            continue
        text = upsert_keys_into_block(text, code, translated)
        I18N_PATH.write_text(text)
        sample = list(translated.items())[0]
        print(f"  ✓ {code} ({sample[0]} → {sample[1]!r})")
    print("done.")


if __name__ == "__main__":
    asyncio.run(main())
