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
