import { useState, useRef } from "react";
import { Sprout, X, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { createCheckout, checkAccess } from "@/lib/api";
import { setStoredAccessToken } from "@/hooks/usePaywall";

/**
 * Lifetime-access upgrade modal. £5 GBP one-time via Stripe Checkout.
 *
 * Two-step flow (deliberate): tapping "Pay £5" creates the Stripe session
 * server-side, then surfaces a real <a href> "Continue" button the user taps
 * to redirect. We do NOT auto-navigate via window.location after an `await`
 * because iOS Safari treats post-async cross-origin navigations as
 * non-user-initiated and blocks them (= permanent blank screen). A native
 * anchor click is always honoured.
 */
export default function PaywallModal({ onClose, onUnlocked, allowDismiss = true }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [tier, setTier] = useState("lifetime");
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState("");
  const continueRef = useRef(null);

  async function startCheckout() {
    setBusy(true);
    setError("");
    setCheckoutUrl("");
    try {
      const { url } = await createCheckout(window.location.origin, undefined, tier);
      setCheckoutUrl(url);
      requestAnimationFrame(() => continueRef.current?.focus());
    } catch (e) {
      console.error("checkout create failed", e);
      setError(t("paywall.error"));
    } finally {
      setBusy(false);
    }
  }

  async function tryRecover() {
    const token = recoveryToken.trim();
    if (!token) return;
    setBusy(true);
    setError("");
    try {
      const res = await checkAccess(token);
      if (res.paid) {
        setStoredAccessToken(token);
        onUnlocked?.();
      } else {
        setError(t("paywall.recovery.invalid"));
      }
    } catch (e) {
      console.error("recovery check failed", e);
      setError(t("paywall.error"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="paywall-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/55 backdrop-blur-sm animate-fade-up"
    >
      <div className="bg-sand border border-border max-w-md w-full shadow-xl">
        <div className="flex items-start justify-between px-6 pt-6">
          <div className="flex items-center gap-2">
            <Sprout strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
            <span className="overline">{t("paywall.eyebrow")}</span>
          </div>
          {allowDismiss && (
            <button
              type="button"
              data-testid="paywall-close"
              onClick={onClose}
              aria-label={t("share.close")}
              className="text-moss hover:text-forest"
            >
              <X strokeWidth={1.5} className="w-5 h-5" />
            </button>
          )}
        </div>

        <div className="px-6 pt-3 pb-6">
          <h2 className="font-serif text-3xl text-forest leading-tight">{t("paywall.title")}</h2>
          <p className="mt-3 text-ink/80 leading-relaxed">{t("paywall.body")}</p>

          <ul className="mt-5 space-y-2 text-sm text-ink/80">
            <li className="flex gap-2"><span className="text-terracotta">✦</span> {t("paywall.benefit.plants")}</li>
            <li className="flex gap-2"><span className="text-terracotta">✦</span> {t("paywall.benefit.masterclasses")}</li>
            <li className="flex gap-2"><span className="text-terracotta">✦</span> {t("paywall.benefit.pdfs")}</li>
            <li className="flex gap-2"><span className="text-terracotta">✦</span> {t("paywall.benefit.lifetime")}</li>
          </ul>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              data-testid="paywall-tier-annual"
              onClick={() => setTier("annual")}
              disabled={!!checkoutUrl}
              className={`text-left p-4 border-2 transition-colors ${
                tier === "annual"
                  ? "border-terracotta bg-sand"
                  : "border-border bg-sand/60 hover:border-forest/40"
              } disabled:opacity-60`}
            >
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-3xl text-forest">£5</span>
                <span className="text-xs text-moss">/yr</span>
              </div>
              <p className="text-[11px] uppercase tracking-wider text-moss mt-1">12-month access</p>
              <p className="text-xs text-ink/65 mt-1.5 leading-snug">Try a full growing cycle. Renews on you, not automatically.</p>
            </button>

            <button
              type="button"
              data-testid="paywall-tier-lifetime"
              onClick={() => setTier("lifetime")}
              disabled={!!checkoutUrl}
              className={`text-left p-4 border-2 transition-colors relative ${
                tier === "lifetime"
                  ? "border-terracotta bg-sand"
                  : "border-border bg-sand/60 hover:border-forest/40"
              } disabled:opacity-60`}
            >
              <span className="absolute -top-2 right-2 bg-terracotta text-sand text-[9px] tracking-wider uppercase px-1.5 py-0.5">Best value</span>
              <div className="flex items-baseline gap-1">
                <span className="font-serif text-3xl text-forest">£25</span>
                <span className="text-xs text-moss">once</span>
              </div>
              <p className="text-[11px] uppercase tracking-wider text-moss mt-1">Lifetime</p>
              <p className="text-xs text-ink/65 mt-1.5 leading-snug">Pay once, keep it forever. Equivalent to 5 years annual.</p>
            </button>
          </div>

          {checkoutUrl ? (
            <a
              ref={continueRef}
              href={checkoutUrl}
              data-testid="paywall-continue-link"
              className="mt-5 w-full btn-terracotta inline-flex items-center justify-center gap-2"
            >
              {t("paywall.continue")} →
            </a>
          ) : (
            <button
              type="button"
              data-testid="paywall-pay"
              onClick={startCheckout}
              disabled={busy}
              className="mt-5 w-full btn-terracotta inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {busy ? <Loader2 strokeWidth={1.5} className="w-4 h-4 animate-spin" /> : null}
              {tier === "annual" ? "Pay £5 — 12-month access" : "Pay £25 — unlock for life"}
            </button>
          )}

          {!showRecovery ? (
            <button
              type="button"
              data-testid="paywall-recover-open"
              onClick={() => setShowRecovery(true)}
              className="mt-3 w-full text-xs text-moss hover:text-forest underline underline-offset-4"
            >
              {t("paywall.recovery.cta")}
            </button>
          ) : (
            <div className="mt-4 pt-4 border-t border-border">
              <label className="text-xs text-moss uppercase tracking-wider">{t("paywall.recovery.label")}</label>
              <input
                type="text"
                data-testid="paywall-recovery-input"
                value={recoveryToken}
                onChange={(e) => setRecoveryToken(e.target.value)}
                placeholder="cs_test_…"
                className="mt-2 w-full text-sm p-2 bg-surface border border-border outline-none focus:border-forest"
              />
              <button
                type="button"
                data-testid="paywall-recovery-submit"
                onClick={tryRecover}
                disabled={busy || !recoveryToken.trim()}
                className="mt-2 btn-forest text-sm inline-flex items-center gap-2 disabled:opacity-50"
              >
                {busy ? <Loader2 strokeWidth={1.5} className="w-4 h-4 animate-spin" /> : null}
                {t("paywall.recovery.submit")}
              </button>
            </div>
          )}

          {error && <p className="mt-3 text-sm text-terracotta">{error}</p>}
          <p className="mt-4 text-[11px] text-moss leading-relaxed">{t("paywall.footnote")}</p>
        </div>
      </div>
    </div>
  );
}
