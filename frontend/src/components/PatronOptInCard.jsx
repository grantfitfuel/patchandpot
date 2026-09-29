import { useState } from "react";
import { Heart, Check, AlertCircle, ExternalLink } from "lucide-react";
import { patronOptIn, patronOptOut } from "@/lib/api";
import { formatApiError } from "@/lib/formatApiError";

/**
 * Post-payment opt-in card surfaced on /checkout/success.
 *
 * GDPR-aware UX:
 *   - The card is COLLAPSED by default (a soft invitation, not a demand).
 *   - "Add me" is the only positive action; checkbox starts unchecked.
 *   - Submission requires both a non-empty display name AND the consent box.
 *   - "Remove me later" link is always visible after submission.
 *
 * The card is rendered for every paid phase (success + tip_success) since
 * tippers are also welcome on the Patrons page.
 */
export default function PatronOptInCard({ sessionId }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [phase, setPhase] = useState("idle"); // idle | submitting | added | removed | error
  const [errorMsg, setErrorMsg] = useState("");

  async function submit(e) {
    e?.preventDefault();
    if (!name.trim() || !consent) return;
    setPhase("submitting");
    setErrorMsg("");
    try {
      await patronOptIn(sessionId, name.trim());
      setPhase("added");
    } catch (e2) {
      const msg = formatApiError(e2, "Couldn't save that just now.");
      setErrorMsg(msg);
      setPhase("error");
    }
  }

  async function removeMe() {
    setPhase("submitting");
    setErrorMsg("");
    try {
      await patronOptOut(sessionId);
      setPhase("removed");
      setName("");
      setConsent(false);
    } catch (e2) {
      setErrorMsg("Couldn't remove your listing — please email gcanth@gmail.com and we'll handle it manually.");
      setPhase("error");
    }
  }

  if (phase === "added") {
    return (
      <div
        className="mt-8 border border-forest/30 bg-forest/5 p-5 text-left"
        data-testid="patron-opt-in-added"
      >
        <div className="flex items-start gap-3">
          <Check strokeWidth={1.8} className="w-5 h-5 text-forest flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-medium text-forest">You&apos;re on the Patrons page. Thank you.</p>
            <p className="mt-1 text-sm text-ink/70 leading-relaxed">
              Your name appears as <b>{name.trim()}</b>. You can{" "}
              <a
                href="/patrons"
                target="_blank"
                rel="noopener noreferrer"
                className="underline-offset-4 hover:underline text-forest inline-flex items-center gap-1"
                data-testid="patron-view-page"
              >
                see the page <ExternalLink strokeWidth={1.5} className="w-3 h-3" />
              </a>
              {" "}or{" "}
              <button
                type="button"
                onClick={removeMe}
                data-testid="patron-remove"
                className="underline-offset-4 hover:underline text-terracotta"
              >
                remove your listing
              </button>
              {" "}any time.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (phase === "removed") {
    return (
      <p className="mt-6 text-sm text-moss" data-testid="patron-opt-in-removed">
        Your Patrons listing has been removed.
      </p>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-testid="patron-opt-in-open"
        className="mt-8 inline-flex items-center gap-2 px-4 py-2.5 border border-forest/40 bg-sand/60 text-forest font-medium underline underline-offset-4 decoration-terracotta decoration-2 hover:bg-forest/5 hover:border-forest transition-colors"
      >
        <Heart strokeWidth={1.8} className="w-4 h-4 text-terracotta" />
        Want a thank-you mention on our Patrons page? (Optional)
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      data-testid="patron-opt-in-form"
      className="mt-8 border border-border bg-sand/40 p-5 text-left"
    >
      <div className="flex items-center gap-2 mb-3">
        <Heart strokeWidth={1.5} className="w-4 h-4 text-terracotta" />
        <p className="overline">Patrons page · optional</p>
      </div>
      <p className="text-sm text-ink/75 leading-relaxed mb-4">
        Want to be listed publicly as a supporter? We&apos;ll show only the name you
        choose below — nothing else, no email, no amount. You can remove
        yourself with one click anytime.
      </p>
      <label
        htmlFor="patron-name"
        className="text-xs text-moss uppercase tracking-wider block mb-1"
      >
        Display name (max 30 characters)
      </label>
      <input
        id="patron-name"
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={30}
        placeholder="e.g. Sarah B., The Allotment Collective"
        data-testid="patron-name-input"
        className="w-full px-3 py-2 bg-surface border border-border text-ink focus:border-terracotta focus:outline-none text-sm"
      />
      <label className="mt-3 flex items-start gap-2 text-sm text-ink/75 cursor-pointer">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
          data-testid="patron-consent-checkbox"
          className="mt-1 accent-terracotta"
        />
        <span>
          Yes — I consent to my chosen name being displayed publicly on the
          Patrons page. (Required to add me.)
        </span>
      </label>

      {phase === "error" && (
        <div
          className="mt-3 border border-terracotta/40 bg-terracotta/10 p-3 flex items-start gap-2"
          data-testid="patron-opt-in-error"
        >
          <AlertCircle strokeWidth={1.5} className="w-4 h-4 text-terracotta flex-shrink-0 mt-0.5" />
          <p className="text-xs text-ink/80 leading-relaxed">{errorMsg}</p>
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={!name.trim() || !consent || phase === "submitting"}
          data-testid="patron-opt-in-submit"
          className="btn-terracotta inline-flex items-center gap-2 disabled:opacity-50"
        >
          {phase === "submitting" ? "Adding…" : "Add me to Patrons"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          data-testid="patron-opt-in-cancel"
          className="text-sm text-ink/60 hover:text-forest underline-offset-4 hover:underline"
        >
          Not now
        </button>
      </div>
    </form>
  );
}
