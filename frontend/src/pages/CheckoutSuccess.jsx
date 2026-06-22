import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, AlertCircle, Copy, Heart } from "lucide-react";
import confetti from "canvas-confetti";
import { getCheckoutStatus } from "@/lib/api";
import { setStoredAccessToken } from "@/hooks/usePaywall";
import { useI18n } from "@/i18n";
import PatronOptInCard from "@/components/PatronOptInCard";

const MAX_POLL_ATTEMPTS = 8;
const POLL_INTERVAL_MS = 2000;

// Three short confetti bursts on entry, themed to Patch & Pot's palette.
// Tip-jar specific so we don't blast confetti on every paywall completion.
function fireTipConfetti() {
  const duration = 2000;
  const end = Date.now() + duration;
  const colors = ["#C57B57", "#3A4A3A", "#E8DDC9", "#8FA68E"]; // terracotta, forest, sand, moss
  (function frame() {
    confetti({
      particleCount: 4,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.6 },
      colors,
      disableForReducedMotion: true,
    });
    confetti({
      particleCount: 4,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.6 },
      colors,
      disableForReducedMotion: true,
    });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

export default function CheckoutSuccess() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [phase, setPhase] = useState("polling"); // polling | success | tip_success | failure | expired
  const [copied, setCopied] = useState(false);
  const confettiFired = useRef(false);

  useEffect(() => {
    if (!sessionId) {
      setPhase("failure");
      return;
    }
    let cancelled = false;
    let attempts = 0;

    async function poll() {
      try {
        const status = await getCheckoutStatus(sessionId);
        if (cancelled) return;
        if (status.paid) {
          // Tips don't grant access — show a dedicated thank-you instead of
          // writing a token into localStorage that does nothing.
          if (status.package_id === "tip") {
            setPhase("tip_success");
          } else {
            setStoredAccessToken(sessionId);
            setPhase("success");
          }
          return;
        }
        if (status.status === "expired") {
          setPhase("expired");
          return;
        }
      } catch (e) {
        console.warn("checkout poll error", e);
      }
      attempts += 1;
      if (attempts >= MAX_POLL_ATTEMPTS) {
        if (!cancelled) setPhase("failure");
        return;
      }
      setTimeout(poll, POLL_INTERVAL_MS);
    }

    poll();
    return () => { cancelled = true; };
  }, [sessionId]);

  // Fire confetti exactly once when the tip-success phase is reached.
  useEffect(() => {
    if (phase === "tip_success" && !confettiFired.current) {
      confettiFired.current = true;
      fireTipConfetti();
    }
  }, [phase]);

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(sessionId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn("copy failed", e);
    }
  }

  return (
    <div className="container-narrow py-20 max-w-xl text-center" data-testid="checkout-success">
      {phase === "polling" && (
        <>
          <Loader2 strokeWidth={1.4} className="w-8 h-8 text-moss mx-auto animate-spin" />
          <h1 className="font-serif text-3xl text-forest mt-6">{t("checkout.polling.title")}</h1>
          <p className="mt-3 text-ink/75">{t("checkout.polling.body")}</p>
        </>
      )}

      {phase === "tip_success" && (
        <div data-testid="checkout-tip-success">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-terracotta/15 mx-auto">
            <Heart strokeWidth={1.4} className="w-8 h-8 text-terracotta fill-terracotta/30" />
          </div>
          <p className="overline mt-5">Thank you</p>
          <h1 className="font-serif text-4xl text-forest mt-2">
            That genuinely means a lot.
          </h1>
          <p className="mt-4 text-ink/80 leading-relaxed">
            Your £3 keeps the watering can full, the AI calls flowing, and a small independent
            garden project alive. No login, no email follow-up — just a real thank-you from one
            gardener to another.
          </p>
          <p className="mt-2 text-sm text-moss leading-relaxed">
            🌱 If you'd like to support more, the Founding Member tier (£35 lifetime) is still
            open — same one-time spirit, but it unlocks everything for life.
          </p>
          <div className="mt-6 flex flex-wrap gap-3 justify-center">
            <button
              type="button"
              data-testid="checkout-tip-continue"
              onClick={() => navigate("/")}
              className="btn-terracotta inline-flex"
            >
              Back to the garden
            </button>
            <button
              type="button"
              data-testid="checkout-tip-share"
              onClick={() => {
                const text = "I just supported @patchandpot — a gentle gardening app that actually understands my climate. 🌱";
                const url = "https://patchandpot.app";
                window.open(
                  `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
                  "_blank",
                  "noopener,noreferrer,width=550,height=420",
                );
              }}
              className="btn-ghost inline-flex"
            >
              Share so others find it
            </button>
          </div>
          <PatronOptInCard sessionId={sessionId} />
        </div>
      )}

      {phase === "success" && (
        <>
          <CheckCircle2 strokeWidth={1.2} className="w-10 h-10 text-forest mx-auto" />
          <p className="overline mt-5">{t("checkout.success.eyebrow")}</p>
          <h1 className="font-serif text-4xl text-forest mt-2">{t("checkout.success.title")}</h1>
          <p className="mt-4 text-ink/80 leading-relaxed">{t("checkout.success.body")}</p>

          <div className="mt-6 border border-border bg-sand p-4 text-left">
            <p className="overline">{t("checkout.success.token_label")}</p>
            <div className="flex items-center gap-2 mt-2">
              <code className="flex-1 text-xs bg-surface px-3 py-2 border border-border break-all">{sessionId}</code>
              <button
                type="button"
                onClick={copyToken}
                data-testid="copy-token"
                className="btn-ghost text-sm inline-flex items-center gap-2"
              >
                <Copy strokeWidth={1.5} className="w-3.5 h-3.5" /> {copied ? t("checkout.success.copied") : t("checkout.success.copy")}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-moss leading-relaxed">{t("checkout.success.token_help")}</p>
          </div>

          <button
            type="button"
            data-testid="checkout-continue"
            onClick={() => navigate("/")}
            className="mt-6 btn-terracotta inline-flex"
          >
            {t("checkout.success.cta")}
          </button>
          <PatronOptInCard sessionId={sessionId} />
        </>
      )}

      {(phase === "failure" || phase === "expired") && (
        <>
          <AlertCircle strokeWidth={1.2} className="w-10 h-10 text-terracotta mx-auto" />
          <h1 className="font-serif text-3xl text-forest mt-5">{t(`checkout.${phase}.title`)}</h1>
          <p className="mt-3 text-ink/75">{t(`checkout.${phase}.body`)}</p>
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mt-6 btn-ghost inline-flex"
          >
            {t("checkout.back_home")}
          </button>
        </>
      )}
    </div>
  );
}
