import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { CheckCircle2, Loader2, AlertCircle, Copy } from "lucide-react";
import { getCheckoutStatus } from "@/lib/api";
import { setStoredAccessToken } from "@/hooks/usePaywall";
import { useI18n } from "@/i18n";

const MAX_POLL_ATTEMPTS = 8;
const POLL_INTERVAL_MS = 2000;

export default function CheckoutSuccess() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [phase, setPhase] = useState("polling"); // polling | success | failure | expired
  const [copied, setCopied] = useState(false);

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
          setStoredAccessToken(sessionId);
          setPhase("success");
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
