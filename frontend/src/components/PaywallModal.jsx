import { useState, useRef } from "react";
import { Sprout, X, Loader2 } from "lucide-react";
import { useI18n } from "@/i18n";
import { createCheckout, checkAccess } from "@/lib/api";
import { setStoredAccessToken } from "@/hooks/usePaywall";
import { track } from "@/lib/track";
import { SHOW_LIFETIME_TIERS } from "@/lib/features";

/**
 * Time-limited-tier paywall modal. Stripe Checkout opens via a real
 * <a href> click (not window.location after an await) because iOS Safari
 * treats post-async cross-origin navigations as non-user-initiated and
 * silently blocks them.
 */

// Single source of truth for the tier cards. `id` must match a key in
// backend/core.py PAYWALL_PACKAGES.
// Numeric GBP value per tier, needed so GA4 revenue reports pick up
// `checkout_start` (and its `begin_checkout` alias) with a real amount.
const TIER_VALUE_GBP = { monthly: 2.99, quarterly: 5, biannual: 9, annual: 15, lifetime: 50 };

const ALL_TIERS = [
  { id: "monthly",   label: "1 month",   price: "£2.99", suffix: "/mo",  per_month: null,   blurb: "Try it for a single month — no commitment." },
  { id: "quarterly", label: "3 months",  price: "£5",    suffix: "",     per_month: "£1.67/mo", blurb: "A full growing season for the price of a sandwich." },
  { id: "biannual",  label: "6 months",  price: "£9",    suffix: "",     per_month: "£1.50/mo", blurb: "Half a year — covers spring through summer." },
  { id: "annual",    label: "12 months", price: "£15",   suffix: "",     per_month: "£1.25/mo", blurb: "A full growing cycle, every month covered.", badge: "Best value" },
  { id: "lifetime",  label: "Lifetime",  price: "£50",   suffix: "once", per_month: null,   blurb: "Breaks even at year 3.", badge: "Pay once" },
];

// Filter out the lifetime tier while the SHOW_LIFETIME_TIERS flag is off.
// When flipped back on, the modal picks it up with no other changes.
const TIERS = ALL_TIERS.filter((it) => SHOW_LIFETIME_TIERS || it.id !== "lifetime");

export default function PaywallModal({ onClose, onUnlocked, allowDismiss = true }) {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [checkoutUrl, setCheckoutUrl] = useState("");
  const [tier, setTier] = useState("annual");  // default to the headline tier
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryToken, setRecoveryToken] = useState("");
  const continueRef = useRef(null);

  const selected = TIERS.find((it) => it.id === tier) || TIERS[3];

  async function startCheckout() {
    setBusy(true);
    setError("");
    setCheckoutUrl("");
    // Fire the funnel event BEFORE the network call so we still record it
    // if the user drops off mid-checkout (e.g. Stripe never returns a URL).
    // `begin_checkout` is GA4's recommended event name and lights up
    // Ecommerce reports automatically without any admin config; we also
    // send the human-readable `checkout_start` alias so first-party
    // reports match the naming the team uses internally.
    const value = TIER_VALUE_GBP[tier];
    const ga4Params = {
      currency: "GBP",
      value,
      items: [{ item_id: tier, item_name: `Patch & Pot — ${tier}`, price: value, quantity: 1 }],
      tier,
    };
    track("checkout_start", ga4Params);
    track("begin_checkout", ga4Params);
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
      className="fixed inset-0 z-50 flex items-start justify-center px-4 pt-4 pb-8 bg-ink/55 backdrop-blur-sm animate-fade-up overflow-y-auto"
    >
      <div className="bg-sand border border-border max-w-md w-full shadow-xl">
        <div className="flex items-start justify-between px-6 pt-6">
          <div className="flex items-center gap-2">
            <Sprout strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
            <span className="overline">Unlock the library</span>
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
          <p className="mt-3 text-ink/80 leading-relaxed">
            {t("paywall.body")}
          </p>

          <ul className="mt-5 space-y-2 text-sm text-ink/80">
            <li className="flex gap-2"><span className="text-terracotta">✦</span> {t("paywall.benefit.plants")}</li>
            <li className="flex gap-2"><span className="text-terracotta">✦</span> {t("paywall.benefit.masterclasses")}</li>
            <li className="flex gap-2"><span className="text-terracotta">✦</span> {t("paywall.benefit.pdfs")}</li>
            <li className="flex gap-2"><span className="text-terracotta">✦</span> {t("paywall.benefit.lifetime")}</li>
          </ul>

          {/* Five-tier picker. Vertical rows scale better on mobile than a 5-col grid. */}
          <div className="mt-6 space-y-2" role="radiogroup" aria-label="Pick a tier">
            {TIERS.map((it) => {
              const isSelected = tier === it.id;
              return (
                <button
                  key={it.id}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  data-testid={`paywall-tier-${it.id}`}
                  onClick={() => setTier(it.id)}
                  disabled={!!checkoutUrl}
                  className={`w-full text-left px-4 py-3 border-2 transition-colors flex items-center gap-3 relative ${
                    isSelected
                      ? "border-terracotta bg-sand"
                      : "border-border bg-sand/60 hover:border-forest/40"
                  } disabled:opacity-60`}
                >
                  {it.badge && (
                    <span className="absolute -top-2 right-3 bg-terracotta text-sand text-[9px] tracking-wider uppercase px-1.5 py-0.5">
                      {it.badge}
                    </span>
                  )}
                  <div
                    aria-hidden="true"
                    className={`flex-shrink-0 w-4 h-4 rounded-full border-2 ${
                      isSelected ? "border-terracotta bg-terracotta/30" : "border-moss/50"
                    }`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium text-forest">{it.label}</span>
                      <span className="font-serif text-xl text-forest whitespace-nowrap">
                        {it.price}
                        {it.suffix && <span className="text-xs text-moss font-sans ml-0.5">{it.suffix}</span>}
                      </span>
                    </div>
                    <p className="text-[11px] text-ink/60 leading-snug mt-0.5">
                      {it.blurb}
                      {it.per_month && <span className="ml-1 text-moss">({it.per_month})</span>}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-moss leading-snug">
            🛡️ 30-day money-back guarantee on every tier. Email and we refund — no questions.
          </p>

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
              {`Pay ${selected.price} — ${selected.label.toLowerCase()}`}
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
