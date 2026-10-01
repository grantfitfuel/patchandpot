import { useState } from "react";
import { Heart } from "lucide-react";
import { createCheckout } from "@/lib/api";

/**
 * Pure-gratitude tip jar. Doesn't unlock anything — just lets people who
 * find the app useful chuck the gardener a £3 thank-you. Backed by the
 * `tip` Stripe package which deliberately does NOT create an access_grant.
 *
 * Placed in the Footer so it's discoverable but never competes with the
 * paywall conversion path.
 */
export default function TipJar() {
  const [loading, setLoading] = useState(false);

  async function tip() {
    setLoading(true);
    try {
      const { url } = await createCheckout(window.location.origin, undefined, "tip");
      window.location.href = url;
    } catch (e) {
      console.error("tip checkout failed", e);
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      data-testid="tip-jar-button"
      onClick={tip}
      disabled={loading}
      className="inline-flex items-center gap-1.5 py-2 -my-2 text-xs text-moss hover:text-terracotta transition-colors disabled:opacity-60"
    >
      <Heart strokeWidth={1.5} className="w-3.5 h-3.5" />
      {loading ? "…" : "Tip the gardener £3"}
    </button>
  );
}
