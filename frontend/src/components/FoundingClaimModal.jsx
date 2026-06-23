import { useEffect, useRef, useState } from "react";
import { X, Sparkles, Check, Loader2, ArrowRight, AlertCircle } from "lucide-react";
import { createCheckout } from "@/lib/api";

/**
 * Focused "claim my Founding spot" confirmation modal.
 *
 * Critical: Stripe Checkout MUST open via a real `<a href>` element that
 * the user taps. iOS Safari (especially in Private Browsing) treats a
 * `window.location.href = url` assigned AFTER an `await` as non-user-
 * initiated and silently refuses to navigate cross-origin. So we:
 *   1. Open this modal synchronously when "Claim my spot" is tapped.
 *   2. Kick off `createCheckout` in the background.
 *   3. Render a real `<a href={url}>Continue to Stripe →</a>` once we
 *      have the URL. The user's second tap IS a fresh user gesture and
 *      iOS happily honours the cross-origin navigation.
 *
 * Side benefit: the user sees what they're buying (price, what's included,
 * 30-day refund) before being dropped on stripe.com.
 */
/**
 * Cached Stripe session URL helpers.
 *
 * A curious visitor might open the Founding modal several times before
 * paying — each open used to fire a fresh /api/checkout/session and bloat
 * payment_transactions with abandoned sessions tagged with the same ref.
 * We memoise the URL in sessionStorage for ~10 minutes. Stripe sessions
 * are reusable for ~24h, so 10min is comfortably conservative; the cache
 * also dies when the tab closes (sessionStorage semantics) which prevents
 * stale URLs lingering across browser sessions.
 *
 * The cache is keyed per-package — a tip jar checkout shouldn't get
 * served the lifetime session and vice versa.
 *
 * `inFlight` is a module-scoped dedup map: if two effects fire concurrently
 * (e.g. React 18 Strict Mode in dev, or a user double-tapping the trigger),
 * both await the same promise instead of firing two parallel POSTs.
 */
const CHECKOUT_CACHE_PREFIX = "pp-checkout-url:";
const CHECKOUT_CACHE_TTL_MS = 10 * 60 * 1000;
const inFlight = new Map();

function readCheckoutCache(packageId) {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(CHECKOUT_CACHE_PREFIX + packageId);
    if (!raw) return null;
    const { url, exp } = JSON.parse(raw);
    if (!url || !exp || Date.now() > exp) return null;
    return url;
  } catch (e) {
    console.warn("FoundingClaimModal: read cache failed", e);
    return null;
  }
}

function writeCheckoutCache(packageId, url) {
  if (typeof window === "undefined" || !url) return;
  try {
    sessionStorage.setItem(
      CHECKOUT_CACHE_PREFIX + packageId,
      JSON.stringify({ url, exp: Date.now() + CHECKOUT_CACHE_TTL_MS }),
    );
  } catch (e) {
    // Quota / privacy mode — silently skip; we just lose the optimisation.
    console.warn("FoundingClaimModal: persist cache failed", e);
  }
}

function clearCheckoutCache(packageId) {
  if (typeof window === "undefined") return;
  try { sessionStorage.removeItem(CHECKOUT_CACHE_PREFIX + packageId); }
  catch (e) { console.warn("FoundingClaimModal: clear cache failed", e); }
}

async function getOrCreateCheckout(packageId) {
  const cached = readCheckoutCache(packageId);
  if (cached) return cached;
  if (inFlight.has(packageId)) return inFlight.get(packageId);
  const p = createCheckout(window.location.origin, undefined, packageId)
    .then(({ url }) => {
      writeCheckoutCache(packageId, url);
      return url;
    })
    .catch((err) => {
      // Surface diagnostic detail so the modal's error state can show the
      // user (and us, in support emails) what actually went wrong instead
      // of a generic "couldn't reach Stripe" — invaluable when debugging
      // iOS Private Browsing / network / backend-Stripe issues without
      // DevTools access.
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail;
      const tag = status ? `HTTP ${status}` : (err?.code || "NETWORK");
      const enriched = new Error(detail ? `${tag}: ${detail}` : tag);
      enriched.original = err;
      enriched.status = status;
      enriched.tag = tag;
      throw enriched;
    })
    .finally(() => { inFlight.delete(packageId); });
  inFlight.set(packageId, p);
  return p;
}

export default function FoundingClaimModal({ remaining, total, onClose }) {
  const [phase, setPhase] = useState("preparing"); // preparing | ready | error
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [errorTag, setErrorTag] = useState("");
  const [attempt, setAttempt] = useState(0);
  const continueRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setPhase("preparing");
    setErrorTag("");

    getOrCreateCheckout("lifetime_founding")
      .then((url) => {
        if (cancelled) return;
        setCheckoutUrl(url);
        setPhase("ready");
        requestAnimationFrame(() => continueRef.current?.focus());
      })
      .catch((e) => {
        console.error("founding checkout failed", e);
        if (cancelled) return;
        setErrorTag(e?.tag || "NETWORK");
        setPhase("error");
      });

    return () => { cancelled = true; };
  }, [attempt]);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose?.(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="founding-claim-title"
      data-testid="founding-claim-modal"
      className="fixed inset-0 z-50 flex items-start justify-center bg-ink/60 px-4 pt-4 pb-8 overflow-y-auto animate-fade-up"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="relative bg-surface border border-border max-w-md w-full my-0 sm:my-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          data-testid="founding-claim-close"
          className="absolute top-4 right-4 text-ink/50 hover:text-forest p-1"
        >
          <X strokeWidth={1.6} className="w-5 h-5" />
        </button>

        <div className="p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles strokeWidth={1.5} className="w-5 h-5 text-terracotta" />
            <span className="overline">Founding Member offer</span>
          </div>
          <h2 id="founding-claim-title" className="font-serif text-3xl text-forest leading-tight">
            Lock in lifetime access for £35.
          </h2>
          <p className="mt-3 text-ink/75 leading-relaxed">
            One-time payment. No subscription. No login. Limited to the first
            30 supporters — <b data-testid="founding-claim-remaining">{remaining} of {total} spots left</b>.
          </p>

          <ul className="mt-6 space-y-2.5 text-sm">
            {[
              "Every monthly guide, forever — including next year and the year after",
              "All 10 staff masterclasses + unlimited AI-on-demand courses",
              "Seasonal Growing Journal PDF, refreshed monthly",
              "Full plant database in 58 languages",
              "30-day refund guarantee, no questions asked",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2.5 text-ink/85">
                <Check strokeWidth={2} className="w-4 h-4 text-terracotta flex-shrink-0 mt-0.5" />
                <span>{line}</span>
              </li>
            ))}
          </ul>

          <div className="mt-7 flex items-baseline justify-between border-t border-border pt-5">
            <div>
              <p className="font-serif text-4xl text-forest leading-none">£35</p>
              <p className="text-xs text-moss mt-1">Normally £50 · save £15</p>
            </div>
            <p className="text-xs text-ink/55 max-w-[180px] text-right leading-relaxed">
              You&apos;ll pay on Stripe — we never see your card.
            </p>
          </div>

          {/* CTA — three states, ALL inside the same container so the height
              doesn't jump and break iOS Safari's user-gesture tracking. */}
          <div className="mt-6">
            {phase === "preparing" && (
              <button
                type="button"
                disabled
                data-testid="founding-claim-preparing"
                className="btn-terracotta w-full inline-flex items-center justify-center gap-2 opacity-70"
              >
                <Loader2 strokeWidth={1.5} className="w-4 h-4 animate-spin" />
                Preparing your secure checkout…
              </button>
            )}
            {phase === "ready" && (
              <a
                ref={continueRef}
                href={checkoutUrl}
                target="_top"
                rel="noopener"
                data-testid="founding-claim-continue"
                className="btn-terracotta w-full inline-flex items-center justify-center gap-2"
              >
                Continue to Stripe
                <ArrowRight strokeWidth={1.5} className="w-4 h-4" />
              </a>
            )}
            {phase === "error" && (
              <div
                data-testid="founding-claim-error"
                className="border border-terracotta/40 bg-terracotta/10 p-4 flex items-start gap-3"
              >
                <AlertCircle strokeWidth={1.5} className="w-5 h-5 text-terracotta flex-shrink-0 mt-0.5" />
                <div className="text-sm text-ink/80 leading-relaxed flex-1">
                  <p>We couldn&apos;t reach Stripe just now. Please check your connection and try again — or come back in a minute.</p>
                  {errorTag && (
                    <p
                      className="mt-2 font-mono text-[10px] text-ink/50"
                      data-testid="founding-claim-error-tag"
                    >
                      Diagnostic: {errorTag}
                    </p>
                  )}
                  <div className="mt-3 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => {
                        clearCheckoutCache("lifetime_founding");
                        setAttempt((n) => n + 1);
                      }}
                      data-testid="founding-claim-retry"
                      className="text-forest font-medium underline-offset-4 hover:underline text-xs"
                    >
                      Try again
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="text-ink/60 underline-offset-4 hover:underline text-xs"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <p className="text-[11px] text-moss text-center mt-4 leading-relaxed">
            🛡️ 30-day money-back guarantee. Powered by Stripe.
          </p>
        </div>
      </div>
    </div>
  );
}
