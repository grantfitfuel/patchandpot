import { useEffect, useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { fetchFoundingStatus } from "@/lib/api";
import FoundingClaimModal from "@/components/FoundingClaimModal";

/**
 * Top-of-Home banner inviting the first 30 supporters to claim a Founding
 * Member lifetime spot at £35. Disappears entirely once sold out so we
 * don't leave a "you missed it" wound on the page.
 *
 * Clicking "Claim my spot" opens FoundingClaimModal — NOT a direct Stripe
 * redirect — because iOS Safari (especially Private Browsing) silently
 * blocks `window.location.href = url` that happens after an `await`. The
 * modal renders a real `<a href>` link so the user's tap counts as a
 * fresh user gesture for the cross-origin navigation.
 */
export default function FoundingBanner() {
  const [status, setStatus] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchFoundingStatus()
      .then((s) => { if (!cancelled) setStatus(s); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Deep-link: visitors arriving via the embed widget land on /?founding=1.
  // Auto-open the claim modal so they don't have to find the banner and tap
  // a second time — this is the difference between "interested" and
  // "checkout reached" for cold embed traffic.
  useEffect(() => {
    if (!status || !status.active) return;
    if (typeof window === "undefined") return;
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("founding") === "1") {
        setShowModal(true);
        // Clean up the URL so a refresh doesn't keep reopening the modal
        // (and so the user can share the same URL with friends without
        // forcing the modal on them too).
        params.delete("founding");
        const qs = params.toString();
        const newUrl = window.location.pathname + (qs ? `?${qs}` : "") + window.location.hash;
        window.history.replaceState({}, "", newUrl);
      }
    } catch {
      // URL parsing / replaceState may throw in exotic sandboxes — safe to ignore.
    }
  }, [status]);

  if (!status || !status.active) return null;

  return (
    <>
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
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1 px-3 py-1 bg-terracotta text-sand text-sm hover:bg-terracotta/90 whitespace-nowrap"
          >
            Claim my spot
            <ArrowRight strokeWidth={1.5} className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {showModal && (
        <FoundingClaimModal
          remaining={status.available}
          total={status.total}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  );
}
