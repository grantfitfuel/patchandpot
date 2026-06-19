// English source content for /privacy and /terms.
//
// Each section is a {titleKey, htmlKey, title, html} record.
//   - `titleKey` / `htmlKey` are the i18n keys used to look up translations.
//   - `title` and `html` are the canonical English values; they're also
//     written verbatim into the EN dictionary so the lookup never falls back
//     when language=en.
//   - `html` is rendered via dangerouslySetInnerHTML so we can preserve
//     <strong>, <a>, <ul>, <li>, <em>, etc. across translations. gpt-4o-mini
//     is reliable at preserving simple HTML structure when prompted to.
//
// LAST_UPDATED is shown beneath the H1 of each page.

export const LAST_UPDATED = "19 June 2026";

export const PRIVACY_INTRO_HTML =
  "This notice explains what personal data Patch &amp; Pot collects, why we collect it, how it is used, and the rights you have over it under the UK General Data Protection Regulation (UK GDPR) and the Data Protection Act 2018.";

export const PRIVACY_SECTIONS = [
  {
    titleKey: "legal.privacy.who.title",
    title: "Who we are",
    htmlKey: "legal.privacy.who.html",
    html:
      "<p>Patch &amp; Pot is a small independent gardening publisher (the “Service”) operated from the United Kingdom. The data controller is <strong>Grant Cameron Anthony</strong>, trading as Patch &amp; Pot, based in Barrhead, East Renfrewshire, Scotland, UK. You can reach us at <a class=\"link\" href=\"mailto:hello@patchandpot.com\">hello@patchandpot.com</a>; a full correspondence address is available on request.</p>",
  },
  {
    titleKey: "legal.privacy.collect.title",
    title: "What we collect, and why",
    htmlKey: "legal.privacy.collect.html",
    html:
      "<p>We try to collect as little as possible. In practice:</p><ul><li><strong>Location preference.</strong> When you allow location access, your browser shares an approximate latitude / longitude with us once, which we use to look up your region and climate zone for monthly guidance. We do not store your raw coordinates against an identifier; we store the resolved <em>region name</em> in your browser only.</li><li><strong>Region, language &amp; “My Garden” list.</strong> Stored in your browser’s local storage so the app remembers your settings between visits. None of this is sent to a server in a way that identifies you.</li><li><strong>Payment data.</strong> When you take out a Patch &amp; Pot membership (£5 / year or £25 / lifetime) we use <strong>Stripe</strong> to process the payment. Card details are entered into Stripe’s servers — we never see them. We receive back your email address, the amount paid, and a Stripe session identifier so we can issue your access token.</li><li><strong>Access token.</strong> A random, passwordless token tied to your purchase. Stored in your browser to unlock paid content. If you lose it, your purchase email is the recovery mechanism.</li><li><strong>Search / generation topics.</strong> When you ask our AI to author a masterclass on a topic, that topic string is sent to our servers (and to our AI providers — see below) so we can generate and cache the lesson. Topics are not tied to your identity.</li><li><strong>Basic technical logs.</strong> Standard web-server logs (IP, user-agent, requested URL, timestamp) kept for a maximum of 30 days for abuse-prevention and debugging.</li></ul>",
  },
  {
    titleKey: "legal.privacy.lawful.title",
    title: "Lawful bases (UK GDPR Art. 6)",
    htmlKey: "legal.privacy.lawful.html",
    html:
      "<ul><li><strong>Contract</strong> — for processing your membership payment and providing paid content.</li><li><strong>Legitimate interest</strong> — for keeping the site running, preventing abuse, and improving guidance quality.</li><li><strong>Consent</strong> — for use of your device location (you can decline; the site still works with a manual region).</li></ul>",
  },
  {
    titleKey: "legal.privacy.share.title",
    title: "Who we share data with",
    htmlKey: "legal.privacy.share.html",
    html:
      "<p>We use a small, intentionally minimal set of trusted processors:</p><ul><li><strong>Stripe</strong> (payment processing) — see <a class=\"link\" href=\"https://stripe.com/privacy\" target=\"_blank\" rel=\"noreferrer noopener\">stripe.com/privacy</a>.</li><li><strong>Anthropic, OpenAI, Google</strong> (AI providers) — used to generate monthly guidance, masterclasses and plant images on request. We do not pass them your email, location, or identity; only the gardening topic or region/month being requested.</li><li><strong>Our hosting provider</strong> — runs the application servers and the MongoDB database that caches generated content.</li></ul><p>We do <strong>not</strong> sell your data, share it with advertisers, or pass it to data brokers. We do not run third-party analytics or tracking pixels.</p>",
  },
  {
    titleKey: "legal.privacy.transfers.title",
    title: "International transfers",
    htmlKey: "legal.privacy.transfers.html",
    html:
      "<p>Some processors above are based outside the UK / EEA. Where this is the case, we rely on the UK Government’s adequacy regulations, the EU–US Data Privacy Framework, or Standard Contractual Clauses (SCCs) as appropriate to safeguard your data.</p>",
  },
  {
    titleKey: "legal.privacy.retention.title",
    title: "How long we keep things",
    htmlKey: "legal.privacy.retention.html",
    html:
      "<ul><li>Payment records: <strong>7 years</strong> (HMRC requirement).</li><li>Access tokens linked to a lifetime membership: kept indefinitely so your access keeps working.</li><li>Access tokens for annual membership: kept until 12 months after expiry, then deleted.</li><li>Server logs: 30 days.</li><li>AI-generated content cache: kept indefinitely (it is shared content, not personal data) but you can request a slug be regenerated or removed.</li></ul>",
  },
  {
    titleKey: "legal.privacy.rights.title",
    title: "Your rights",
    htmlKey: "legal.privacy.rights.html",
    html:
      "<p>Under UK GDPR you have the right to:</p><ul><li>Access the personal data we hold about you.</li><li>Have inaccurate data corrected.</li><li>Have your data erased (subject to our HMRC obligations on payment records).</li><li>Restrict or object to processing.</li><li>Receive a copy of your data in a portable format.</li><li>Withdraw consent where consent is the lawful basis.</li><li>Complain to the UK Information Commissioner’s Office (<a class=\"link\" href=\"https://ico.org.uk\" target=\"_blank\" rel=\"noreferrer noopener\">ico.org.uk</a>) if you believe we have mishandled your data.</li></ul><p>To exercise any of these rights, email <a class=\"link\" href=\"mailto:hello@patchandpot.com\">hello@patchandpot.com</a>. We aim to respond within 14 days and must respond within 30.</p>",
  },
  {
    titleKey: "legal.privacy.cookies.title",
    title: "Cookies & local storage",
    htmlKey: "legal.privacy.cookies.html",
    html:
      "<p>We do not use marketing or tracking cookies. We use:</p><ul><li><strong>Strictly necessary local storage</strong> for your region, language, “My Garden” list, and paywall access token.</li><li><strong>A service worker cache</strong> so the site loads quickly and works offline. Caches no personal data.</li><li><strong>Stripe Checkout</strong> sets its own session cookies during payment; these are governed by Stripe’s privacy notice.</li></ul>",
  },
  {
    titleKey: "legal.privacy.changes.title",
    title: "Changes to this notice",
    htmlKey: "legal.privacy.changes.html",
    html:
      "<p>We will update the “Last updated” date at the top of this page whenever this notice changes. Material changes will be flagged on the home page for at least 14 days.</p>",
  },
];

export const TERMS_INTRO_HTML =
  "Welcome to Patch &amp; Pot. By using the site you agree to these terms. We have tried to keep them short, fair, and in plain English.";

export const TERMS_SECTIONS = [
  {
    titleKey: "legal.terms.who.title",
    title: "Who we are",
    htmlKey: "legal.terms.who.html",
    html:
      "<p>Patch &amp; Pot is a small independent gardening publisher operated from the United Kingdom by <strong>Grant Cameron Anthony</strong>, trading as Patch &amp; Pot, based in Barrhead, East Renfrewshire, Scotland (“we”, “us”, “our”). You can contact us at <a class=\"link\" href=\"mailto:hello@patchandpot.com\">hello@patchandpot.com</a>.</p>",
  },
  {
    titleKey: "legal.terms.what.title",
    title: "What Patch & Pot is",
    htmlKey: "legal.terms.what.html",
    html:
      "<p>Patch &amp; Pot provides region-specific, AI-assisted gardening guidance, masterclasses, plant care information and a downloadable seasonal journal. Some content is free; deeper content (full masterclasses, the printable PDF journal, on-demand AI guides) is unlocked via a paid membership.</p>",
  },
  {
    titleKey: "legal.terms.membership.title",
    title: "Membership & payment",
    htmlKey: "legal.terms.membership.html",
    html:
      "<ul><li>We offer two tiers: <strong>£5 per year</strong> (annual) and <strong>£25 one-off</strong> (lifetime). Prices are inclusive of any UK VAT.</li><li>Payment is taken via Stripe. We never see your card details.</li><li>Annual memberships do <strong>not auto-renew</strong>. You must repurchase if you want another year.</li><li>Lifetime means lifetime of the Service. If Patch &amp; Pot ever shuts down, lifetime members will be given at least 60 days’ notice and a downloadable archive of their saved content where technically possible.</li></ul>",
  },
  {
    titleKey: "legal.terms.refunds.title",
    title: "Refunds & the 30-day guarantee",
    htmlKey: "legal.terms.refunds.html",
    html:
      "<p>You have a <strong>statutory 14-day right to cancel</strong> any digital-content purchase under the Consumer Contracts Regulations 2013 — except that, by purchasing membership and immediately accessing paid content, you may waive that right.</p><p>We add a <strong>30-day no-questions-asked refund</strong> on top of that. If Patch &amp; Pot is not for you within the first 30 days, email <a class=\"link\" href=\"mailto:hello@patchandpot.com\">hello@patchandpot.com</a> and we will refund you in full.</p>",
  },
  {
    titleKey: "legal.terms.ai.title",
    title: "AI-generated content disclaimer",
    htmlKey: "legal.terms.ai.html",
    html:
      "<p>Patch &amp; Pot’s monthly guidance, masterclasses and plant images are generated by AI on a region-specific basis. We work hard to keep the advice accurate, but:</p><ul><li>The guidance is <strong>informational, not professional horticultural advice</strong>.</li><li>Local conditions vary; always cross-check with local growers, seed packets, or your national gardening authority before sowing, pruning, foraging or eating anything.</li><li>Do <strong>not</strong> rely on Patch &amp; Pot to identify wild plants or fungi for consumption. Use a specialist guide.</li><li>Pest-control advice favours organic methods; follow product instructions for any commercial product you choose to use.</li></ul>",
  },
  {
    titleKey: "legal.terms.use.title",
    title: "Acceptable use",
    htmlKey: "legal.terms.use.html",
    html:
      "<p>You agree not to:</p><ul><li>Scrape the site or its API at high volume.</li><li>Resell or redistribute paid content (PDF journals, masterclass courses) without permission.</li><li>Attempt to access paid content without a valid membership token.</li><li>Submit unlawful, abusive, or copyrighted material to the AI masterclass generator.</li></ul>",
  },
  {
    titleKey: "legal.terms.ip.title",
    title: "Intellectual property",
    htmlKey: "legal.terms.ip.html",
    html:
      "<p>The Patch &amp; Pot name, logo, design, editorial copy, masterclass scripts and curated plant database are © Grant Cameron Anthony, trading as Patch &amp; Pot, 2025–2026, and may not be reproduced without written permission.</p><p>AI-generated images and AI-generated lesson text are provided for your personal use as a paying member. You may print the seasonal PDF for your own household.</p>",
  },
  {
    titleKey: "legal.terms.liability.title",
    title: "Liability",
    htmlKey: "legal.terms.liability.html",
    html:
      "<p>Patch &amp; Pot is provided “as is”. We exclude liability for indirect or consequential loss to the maximum extent permitted by law. Our total liability for any claim is capped at the amount you have paid to us in the preceding 12 months. Nothing in these terms limits our liability for fraud, death or personal injury caused by our negligence, or anything else that cannot lawfully be limited under Scots law.</p>",
  },
  {
    titleKey: "legal.terms.changes.title",
    title: "Changes to the Service or these terms",
    htmlKey: "legal.terms.changes.html",
    html:
      "<p>We may update the Service, prices, and these terms from time to time. Material changes will be flagged on the site for at least 14 days before taking effect. If you don’t agree with a change, you may request a pro-rata refund of any unused annual membership.</p>",
  },
  {
    titleKey: "legal.terms.law.title",
    title: "Governing law",
    htmlKey: "legal.terms.law.html",
    html:
      "<p>These terms are governed by the laws of Scotland and any dispute is subject to the exclusive jurisdiction of the Scottish courts.</p>",
  },
];
