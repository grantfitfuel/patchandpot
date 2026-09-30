import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X } from "lucide-react";
import { useI18n } from "@/i18n";

/**
 * Consent-gated analytics banner.
 *
 * Renders a soft bottom-anchored banner on first visit only. Decision is
 * persisted in `localStorage.pp_consent` as `"accepted"` or `"rejected"`.
 *
 *   - Accepted → calls `window.__ppInitAnalytics()` (defined in
 *     `index.html`), which injects the gtag <script> tag and fires the
 *     first `page_view` for the current page.
 *   - Rejected → the gtag <script> tag is never injected, so no GA4
 *     traffic leaves the browser. `track()` in `lib/track.js` safely
 *     no-ops because `window.gtag` is undefined.
 *   - Dismissed with the × → treated as `rejected` (fail-closed).
 *
 * The banner never re-renders once a decision is stored. To reset for
 * testing: `localStorage.removeItem("pp_consent")` and reload.
 */
const STORAGE_KEY = "pp_consent";

export default function CookieBanner() {
  const { t } = useI18n();
  // Hidden by default so returning visitors never see a flash. We only
  // reveal after checking localStorage (client-side, in useEffect).
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const decided = localStorage.getItem(STORAGE_KEY);
      if (!decided) setVisible(true);
    } catch {
      // Private browsing / storage disabled — leave banner hidden so we
      // don't nag on every navigation. We can't remember consent, so
      // being conservative means "don't load analytics".
    }
    // Allow the footer "Cookie preferences" link (or anywhere else) to
    // re-open the banner without a page reload. The event handler just
    // toggles this component's local state.
    function onReset() { setVisible(true); }
    window.addEventListener("pp:consent:reset", onReset);
    return () => window.removeEventListener("pp:consent:reset", onReset);
  }, []);

  function persist(choice) {
    try { localStorage.setItem(STORAGE_KEY, choice); } catch { /* noop */ }
    setVisible(false);
  }

  function onAccept() {
    persist("accepted");
    // Trigger the deferred GA4 loader defined in index.html.
    if (typeof window !== "undefined" && typeof window.__ppInitAnalytics === "function") {
      window.__ppInitAnalytics();
    }
  }

  function onReject() {
    persist("rejected");
    // No GA4 load. Nothing else to do.
  }

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-live="polite"
      aria-label={t("cookie.aria_label")}
      data-testid="cookie-banner"
      className="fixed bottom-4 left-4 right-4 md:left-auto md:right-6 md:bottom-6 md:max-w-md z-50"
    >
      <div className="bg-forest text-sand rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.25)] p-5 md:p-6 relative">
        <button
          type="button"
          onClick={onReject}
          aria-label={t("cookie.dismiss")}
          data-testid="cookie-dismiss"
          className="absolute top-3 right-3 text-sand/60 hover:text-sand transition-colors"
        >
          <X strokeWidth={1.6} className="w-4 h-4" />
        </button>
        <p className="font-serif text-lg leading-snug pr-6">
          {t("cookie.title")}
        </p>
        <p className="text-sm text-sand/85 mt-2 leading-relaxed">
          {t("cookie.body")}{" "}
          <Link
            to="/privacy"
            data-testid="cookie-privacy-link"
            className="underline underline-offset-4 decoration-sand/40 hover:decoration-terracotta hover:text-terracotta transition-colors"
          >
            {t("cookie.privacy_link")}
          </Link>
          .
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onAccept}
            data-testid="cookie-accept"
            className="inline-flex items-center gap-2 rounded-full bg-terracotta hover:bg-[#B04A36] text-sand px-5 py-2.5 text-sm font-medium tracking-wide transition-colors"
          >
            {t("cookie.accept")}
          </button>
          <button
            type="button"
            onClick={onReject}
            data-testid="cookie-reject"
            className="inline-flex items-center gap-2 rounded-full bg-transparent hover:bg-sand/10 border border-sand/30 text-sand px-5 py-2.5 text-sm font-medium tracking-wide transition-colors"
          >
            {t("cookie.reject")}
          </button>
        </div>
      </div>
    </div>
  );
}
