import { useEffect, useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { fetchFoundingStatus, createCheckout } from "@/lib/api";

/**
 * Top-of-Home banner inviting the first 30 supporters to claim a Founding
 * Member lifetime spot at £35. Disappears entirely once sold out so we
 * don't leave a "you missed it" wound on the page. Polling intentionally
 * absent — a stale count of 1 or 2 is fine; the backend will silently
 * downgrade overflow buyers to regular lifetime if the cohort is full.
 */
export default function FoundingBanner() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchFoundingStatus()
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  async function claim() {
    setLoading(true);
    try {
      const { url } = await createCheckout(window.location.origin, undefined, "lifetime_founding");
      window.location.href = url;
    } catch (e) {
      console.error("founding checkout failed", e);
      setLoading(false);
    }
  }

  if (!status || !status.active) return null;

  return (
    <div
      data-testid="founding-banner"
      className="relative bg-forest text-sand py-3 px-6 border-b border-forest/40"
    >
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-center gap-3 text-sm">
        <Sparkles strokeWidth={1.5} className="w-4 h-4 text-terracotta hidden sm:block" />
        <p className="leading-tight">
          <span className="font-semibold">Founding Member offer:</span>{" "}
          Lock in lifetime access for <span className="font-semibold">£35</span> (normally £50) —{" "}
          <span data-testid="founding-remaining">
            {status.available} of {status.total} spots left
          </span>.
        </p>
        <button
          type="button"
          data-testid="founding-claim"
          onClick={claim}
          disabled={loading}
          className="inline-flex items-center gap-1 px-3 py-1 bg-terracotta text-sand text-sm hover:bg-terracotta/90 disabled:opacity-60 whitespace-nowrap"
        >
          {loading ? "…" : "Claim my spot"}
          <ArrowRight strokeWidth={1.5} className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
