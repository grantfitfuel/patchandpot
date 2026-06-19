import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

/**
 * UK-GDPR / ICO-compliant privacy notice.
 *
 * Anchored at /privacy. Linked from the global footer (mandatory).
 * Plain-language, single-column layout to stay consistent with the rest of
 * the app's editorial design.
 */
export default function PrivacyPage() {
  return (
    <div className="container-narrow py-14 md:py-20 max-w-3xl" data-testid="privacy-page">
      <Helmet>
        <title>Privacy Notice — Patch &amp; Pot</title>
        <meta name="description" content="How Patch & Pot collects, uses, and protects your personal data." />
        <link rel="canonical" href="/privacy" />
      </Helmet>

      <p className="overline">Legal</p>
      <h1 className="font-serif text-5xl text-forest mt-2 tracking-tight">Privacy Notice</h1>
      <p className="text-sm text-moss mt-3">Last updated: 19 June 2026</p>

      <p className="mt-8 text-ink/80 leading-relaxed text-lg">
        This notice explains what personal data Patch &amp; Pot collects, why we collect it,
        how it is used, and the rights you have over it under the UK General Data Protection
        Regulation (UK GDPR) and the Data Protection Act 2018.
      </p>

      <Section title="Who we are">
        <p>
          Patch &amp; Pot is a small independent gardening publisher (the “Service”) operated
          from the United Kingdom. The data controller is <strong>Grant Cameron Anthony</strong>,
          trading as Patch &amp; Pot, based in Barrhead, East Renfrewshire, Scotland, UK.
          You can reach us at{" "}
          <a className="link" href="mailto:hello@patchandpot.app">hello@patchandpot.app</a>;
          a full correspondence address is available on request.
        </p>
      </Section>

      <Section title="What we collect, and why">
        <p>We try to collect as little as possible. In practice:</p>
        <ul className="list-disc pl-6 space-y-2 mt-3">
          <li>
            <strong>Location preference.</strong> When you allow location access, your browser
            shares an approximate latitude / longitude with us once, which we use to look up
            your region and climate zone for monthly guidance. We do not store your raw
            coordinates against an identifier; we store the resolved <em>region name</em> in
            your browser only.
          </li>
          <li>
            <strong>Region, language &amp; “My Garden” list.</strong> Stored in your browser’s
            local storage so the app remembers your settings between visits. None of this is
            sent to a server in a way that identifies you.
          </li>
          <li>
            <strong>Payment data.</strong> When you take out a Patch &amp; Pot membership
            (£5 / year or £25 / lifetime) we use <strong>Stripe</strong> to process the payment.
            Card details are entered into Stripe’s servers — we never see them. We receive
            back your email address, the amount paid, and a Stripe session identifier so we
            can issue your access token.
          </li>
          <li>
            <strong>Access token.</strong> A random, passwordless token tied to your purchase.
            Stored in your browser to unlock paid content. If you lose it, your purchase email
            is the recovery mechanism.
          </li>
          <li>
            <strong>Search / generation topics.</strong> When you ask our AI to author a
            masterclass on a topic, that topic string is sent to our servers (and to our AI
            providers — see below) so we can generate and cache the lesson. Topics are not
            tied to your identity.
          </li>
          <li>
            <strong>Basic technical logs.</strong> Standard web-server logs (IP, user-agent,
            requested URL, timestamp) kept for a maximum of 30 days for abuse-prevention and
            debugging.
          </li>
        </ul>
      </Section>

      <Section title="Lawful bases (UK GDPR Art. 6)">
        <ul className="list-disc pl-6 space-y-2 mt-3">
          <li><strong>Contract</strong> — for processing your membership payment and providing paid content.</li>
          <li><strong>Legitimate interest</strong> — for keeping the site running, preventing abuse, and improving guidance quality.</li>
          <li><strong>Consent</strong> — for use of your device location (you can decline; the site still works with a manual region).</li>
        </ul>
      </Section>

      <Section title="Who we share data with">
        <p>We use a small, intentionally minimal set of trusted processors:</p>
        <ul className="list-disc pl-6 space-y-2 mt-3">
          <li><strong>Stripe</strong> (payment processing) — see <a className="link" href="https://stripe.com/privacy" target="_blank" rel="noreferrer noopener">stripe.com/privacy</a>.</li>
          <li><strong>Anthropic, OpenAI, Google</strong> (AI providers) — used to generate monthly guidance, masterclasses and plant images on request. We do not pass them your email, location, or identity; only the gardening topic or region/month being requested.</li>
          <li><strong>Our hosting provider</strong> — runs the application servers and the MongoDB database that caches generated content.</li>
        </ul>
        <p className="mt-3">
          We do <strong>not</strong> sell your data, share it with advertisers, or pass it to
          data brokers. We do not run third-party analytics or tracking pixels.
        </p>
      </Section>

      <Section title="International transfers">
        <p>
          Some processors above are based outside the UK / EEA. Where this is the case, we
          rely on the UK Government’s adequacy regulations, the EU–US Data Privacy Framework,
          or Standard Contractual Clauses (SCCs) as appropriate to safeguard your data.
        </p>
      </Section>

      <Section title="How long we keep things">
        <ul className="list-disc pl-6 space-y-2 mt-3">
          <li>Payment records: <strong>7 years</strong> (HMRC requirement).</li>
          <li>Access tokens linked to a lifetime membership: kept indefinitely so your access keeps working.</li>
          <li>Access tokens for annual membership: kept until 12 months after expiry, then deleted.</li>
          <li>Server logs: 30 days.</li>
          <li>AI-generated content cache: kept indefinitely (it is shared content, not personal data) but you can request a slug be regenerated or removed.</li>
        </ul>
      </Section>

      <Section title="Your rights">
        <p>Under UK GDPR you have the right to:</p>
        <ul className="list-disc pl-6 space-y-2 mt-3">
          <li>Access the personal data we hold about you.</li>
          <li>Have inaccurate data corrected.</li>
          <li>Have your data erased (subject to our HMRC obligations on payment records).</li>
          <li>Restrict or object to processing.</li>
          <li>Receive a copy of your data in a portable format.</li>
          <li>Withdraw consent where consent is the lawful basis.</li>
          <li>Complain to the UK Information Commissioner’s Office (<a className="link" href="https://ico.org.uk" target="_blank" rel="noreferrer noopener">ico.org.uk</a>) if you believe we have mishandled your data.</li>
        </ul>
        <p className="mt-3">
          To exercise any of these rights, email <a className="link" href="mailto:hello@patchandpot.app">hello@patchandpot.app</a>.
          We aim to respond within 14 days and must respond within 30.
        </p>
      </Section>

      <Section title="Cookies &amp; local storage">
        <p>
          We do not use marketing or tracking cookies. We use:
        </p>
        <ul className="list-disc pl-6 space-y-2 mt-3">
          <li><strong>Strictly necessary local storage</strong> for your region, language, “My Garden” list, and paywall access token.</li>
          <li><strong>A service worker cache</strong> so the site loads quickly and works offline. Caches no personal data.</li>
          <li><strong>Stripe Checkout</strong> sets its own session cookies during payment; these are governed by Stripe’s privacy notice.</li>
        </ul>
      </Section>

      <Section title="Changes to this notice">
        <p>
          We will update the “Last updated” date at the top of this page whenever this notice
          changes. Material changes will be flagged on the home page for at least 14 days.
        </p>
      </Section>

      <div className="mt-14 pt-8 border-t border-border text-sm text-moss">
        <Link to="/terms" className="link" data-testid="privacy-to-terms">Read the Terms of Service →</Link>
      </div>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-10">
      <h2 className="font-serif text-2xl text-forest mb-3">{title}</h2>
      <div className="text-ink/80 leading-relaxed">{children}</div>
    </section>
  );
}
