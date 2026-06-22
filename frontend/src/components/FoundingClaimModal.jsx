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
export default function FoundingClaimModal({ remaining, total, onClose }) {
  const [phase, setPhase] = useState("preparing"); // preparing | ready | error
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [attempt, setAttempt] = useState(0);
  const continueRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    setPhase("preparing");
    (async () => {
      try {
        const { url } = await createCheckout(
          window.location.origin,
          undefined,
          "lifetime_founding",
        );
        if (cancelled) return;
        setCheckoutUrl(url);
        setPhase("ready");
        requestAnimationFrame(() => continueRef.current?.focus());
      } catch (e) {
        console.error("founding checkout failed", e);
        if (!cancelled) setPhase("error");
      }
    })();
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 px-4 py-8 animate-fade-up"
      onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}
    >
      <div className="relative bg-surface border border-border max-w-md w-full max-h-[90vh] overflow-y-auto">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          data-testid="founding-claim-close"
          className="absolute top-4 right-4 text-ink/50 hover:text-forest p-1"
        >
          <X strokeWidth={1.6} className="w-5 h-5" />
        </button>

        <div className="p-8">
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
                  <div className="mt-3 flex items-center gap-4">
                    <button
                      type="button"
                      onClick={() => setAttempt((n) => n + 1)}
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
