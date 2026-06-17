import { useEffect, useState } from "react";
import { usePaywall } from "@/hooks/usePaywall";
import PaywallModal from "./PaywallModal";

/**
 * Soft paywall wrapper. Paid users see the children immediately. Free users
 * see the children for `previewSeconds` then a modal blocks further reading
 * until they pay (or close — but the modal returns the moment they navigate).
 */
export default function PremiumGate({ children, previewSeconds = 60 }) {
  const { paid, loading, refresh } = usePaywall();
  const [forceShow, setForceShow] = useState(false);

  useEffect(() => {
    if (paid || loading) return;
    const t = setTimeout(() => setForceShow(true), previewSeconds * 1000);
    return () => clearTimeout(t);
  }, [paid, loading, previewSeconds]);

  return (
    <>
      {children}
      {!paid && !loading && forceShow && (
        <PaywallModal
          allowDismiss={false}
          onUnlocked={() => { refresh(); setForceShow(false); }}
        />
      )}
    </>
  );
}
