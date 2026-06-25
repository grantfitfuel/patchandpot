import { useEffect, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import {
  ShieldCheck, Heart, Check, AlertCircle, Edit3, Trash2, ArrowRight,
} from "lucide-react";
import { formatApiError } from "@/lib/formatApiError";
import { fetchPatronMe, patronOptIn, patronOptOut } from "@/lib/api";

/**
 * Self-service Patrons listing manager.
 *
 * Accepts the patron's session_id (the same passwordless token from their
 * checkout receipt) either via `?session_id=…` in the URL or via a small
 * input form. The token is itself the secret bearer credential, so there's
 * no separate login step — anyone who has the token owns the listing.
 *
 * Why ship this: the privacy notice promises one-click removal, but the
 * only path was an email to hello@patchandpot.com (no inbound email wired
 * yet). This page lets patrons edit/remove without any inbox involvement.
 */
export default function PatronsManagePage() {
  const [params, setParams] = useSearchParams();
  const initialSession = params.get("session_id") || "";
  const [sessionId, setSessionId] = useState(initialSession);
  const [draftSession, setDraftSession] = useState(initialSession);
  const [state, setState] = useState(null);     // {listed, display_name, tier_label, package_id}
  const [loadError, setLoadError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionError, setActionError] = useState("");
  const [action, setAction] = useState("idle"); // idle | submitting | done

  // Edit/Add form local state
  const [name, setName] = useState("");
  const [consent, setConsent] = useState(false);
  const [editing, setEditing] = useState(false);

  async function load(token) {
    if (!token) return;
    setLoading(true);
    setLoadError(null);
    try {
      const me = await fetchPatronMe(token);
      setState(me);
      setName(me.display_name || "");
      setEditing(false);
      setAction("idle");
    } catch (e) {
      const status = e?.response?.status;
      if (status === 404) setLoadError("No paid checkout found for that token. Double-check the receipt link Stripe sent you.");
      else setLoadError(formatApiError(e, "Couldn't look that up just now."));
      setState(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (sessionId) load(sessionId); }, [sessionId]);

  function lookup(e) {
    e.preventDefault();
    const t = draftSession.trim();
    if (!t) return;
    setSessionId(t);
    setParams({ session_id: t }, { replace: true });
  }

  async function submitAddOrUpdate(e) {
    e?.preventDefault();
    if (!name.trim() || !consent) return;
    setAction("submitting");
    setActionError("");
    try {
      await patronOptIn(sessionId, name.trim());
      await load(sessionId);
      setAction("done");
    } catch (e2) {
      setActionError(formatApiError(e2, "Couldn't save that just now."));
      setAction("idle");
    }
  }

  async function submitRemove() {
    setAction("submitting");
    setActionError("");
    try {
      await patronOptOut(sessionId);
      await load(sessionId);
      setAction("done");
    } catch (e2) {
      setActionError("Couldn't remove your listing — please email hello@patchandpot.com.");
      setAction("idle");
    }
  }

  // ── Render: no session_id yet → ask for it ──────────────────────────
  if (!sessionId) {
    return (
      <div className="container-narrow py-20 max-w-md" data-testid="patrons-manage-gate">
        <Helmet><title>Manage your Patrons listing — Patch &amp; Pot</title></Helmet>
        <PageHeader />
        <p className="mt-4 text-ink/75 leading-relaxed text-sm">
          Paste the checkout token from your receipt below. It looks like
          <code className="font-mono text-[11px] bg-sand/60 px-1 mx-1">cs_live_…</code>
          or <code className="font-mono text-[11px] bg-sand/60 px-1">cs_test_…</code>
          and was shown right after you paid.
        </p>
        <form onSubmit={lookup} className="mt-5 space-y-3">
          <input
            type="text"
            value={draftSession}
            onChange={(e) => setDraftSession(e.target.value)}
            placeholder="cs_live_…"
            data-testid="patrons-manage-session-input"
            className="w-full px-4 py-3 bg-surface border border-border text-ink font-mono text-sm focus:border-terracotta focus:outline-none"
            autoFocus
          />
          <button
            type="submit"
            disabled={!draftSession.trim()}
            data-testid="patrons-manage-lookup"
            className="btn-terracotta w-full inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            Look up my listing
            <ArrowRight strokeWidth={1.5} className="w-4 h-4" />
          </button>
        </form>
        <p className="mt-6 text-xs text-moss leading-relaxed">
          Lost your token? Email{" "}
          <a href="mailto:hello@patchandpot.com" className="underline-offset-4 hover:underline text-forest">
            hello@patchandpot.com
          </a>
          {" "}and we&apos;ll remove your listing manually.
        </p>
      </div>
    );
  }

  // ── Render: lookup error ────────────────────────────────────────────
  if (loadError) {
    return (
      <div className="container-narrow py-20 max-w-md" data-testid="patrons-manage-error">
        <PageHeader />
        <div className="mt-6 border border-terracotta/40 bg-terracotta/10 p-4 flex items-start gap-3">
          <AlertCircle strokeWidth={1.5} className="w-5 h-5 text-terracotta flex-shrink-0 mt-0.5" />
          <p className="text-sm text-ink/80">{loadError}</p>
        </div>
        <button
          type="button"
          onClick={() => { setSessionId(""); setParams({}, { replace: true }); }}
          className="mt-5 text-sm text-forest underline-offset-4 hover:underline"
          data-testid="patrons-manage-try-another"
        >
          Try a different token
        </button>
      </div>
    );
  }

  // ── Render: loading / unknown ───────────────────────────────────────
  if (loading || !state) {
    return (
      <div className="container-narrow py-20 max-w-md text-center">
        <PageHeader />
        <p className="mt-6 text-ink/60 text-sm">Loading your listing…</p>
      </div>
    );
  }

  // ── Render: managed ─────────────────────────────────────────────────
  return (
    <div className="container-narrow py-16 md:py-20 max-w-xl" data-testid="patrons-manage">
      <Helmet><title>Manage your Patrons listing — Patch &amp; Pot</title><meta name="robots" content="noindex" /></Helmet>
      <PageHeader />

      <p className="mt-4 text-sm text-moss" data-testid="patrons-manage-tier">
        Verified — your support tier: <b>{state.tier_label || state.package_id}</b>
      </p>

      {actionError && (
        <div
          className="mt-5 border border-terracotta/40 bg-terracotta/10 p-3 flex items-start gap-2"
          data-testid="patrons-manage-action-error"
        >
          <AlertCircle strokeWidth={1.5} className="w-4 h-4 text-terracotta flex-shrink-0 mt-0.5" />
          <p className="text-xs text-ink/80 leading-relaxed">{actionError}</p>
        </div>
      )}

      {/* Already listed — show name + edit/remove */}
      {state.listed && !editing && (
        <div className="mt-6 border border-forest/30 bg-forest/5 p-5" data-testid="patrons-manage-listed">
          <p className="overline">Your current listing</p>
          <p className="font-serif text-3xl text-forest mt-2">{state.display_name}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => { setEditing(true); setConsent(true); }}
              data-testid="patrons-manage-edit"
              className="btn-ghost inline-flex items-center gap-2 text-sm"
            >
              <Edit3 strokeWidth={1.5} className="w-4 h-4" />
              Change name
            </button>
            <button
              type="button"
              onClick={submitRemove}
              disabled={action === "submitting"}
              data-testid="patrons-manage-remove"
              className="btn-ghost inline-flex items-center gap-2 text-sm text-terracotta hover:text-terracotta/80 disabled:opacity-50"
            >
              <Trash2 strokeWidth={1.5} className="w-4 h-4" />
              Remove me from Patrons
            </button>
          </div>
        </div>
      )}

      {/* Add or edit form */}
      {(!state.listed || editing) && (
        <form onSubmit={submitAddOrUpdate} className="mt-6 border border-border bg-sand/40 p-5" data-testid="patrons-manage-form">
          <div className="flex items-center gap-2 mb-3">
            <Heart strokeWidth={1.5} className="w-4 h-4 text-terracotta" />
            <p className="overline">{editing ? "Change your display name" : "Add me to Patrons"}</p>
          </div>
          <label htmlFor="manage-name" className="text-xs text-moss uppercase tracking-wider block mb-1">
            Display name (max 30 characters)
          </label>
          <input
            id="manage-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={30}
            placeholder="e.g. Sarah B."
            data-testid="patrons-manage-name-input"
            className="w-full px-3 py-2 bg-surface border border-border text-ink focus:border-terracotta focus:outline-none text-sm"
          />
          <label className="mt-3 flex items-start gap-2 text-sm text-ink/75 cursor-pointer">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              data-testid="patrons-manage-consent"
              className="mt-1 accent-terracotta"
            />
            <span>
              {editing
                ? "Yes — keep me listed publicly under this new name."
                : "Yes — I consent to my chosen name being displayed publicly on the Patrons page."}
            </span>
          </label>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="submit"
              disabled={!name.trim() || !consent || action === "submitting"}
              data-testid="patrons-manage-submit"
              className="btn-terracotta inline-flex items-center gap-2 disabled:opacity-50"
            >
              {action === "submitting" ? "Saving…" : (editing ? "Save name" : "Add me to Patrons")}
            </button>
            {editing && (
              <button
                type="button"
                onClick={() => { setEditing(false); setName(state.display_name || ""); }}
                className="text-sm text-ink/60 hover:text-forest underline-offset-4 hover:underline"
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      )}

      {action === "done" && state.listed && (
        <p className="mt-4 text-sm text-forest inline-flex items-center gap-1.5" data-testid="patrons-manage-done">
          <Check strokeWidth={2} className="w-4 h-4" />
          Saved. Your listing is live on the <Link to="/patrons" className="underline-offset-4 hover:underline">Patrons page</Link>.
        </p>
      )}
      {action === "done" && !state.listed && (
        <p className="mt-4 text-sm text-moss inline-flex items-center gap-1.5" data-testid="patrons-manage-done">
          <Check strokeWidth={2} className="w-4 h-4" />
          Your listing has been removed.
        </p>
      )}

      <p className="mt-10 text-[11px] text-moss leading-relaxed">
        We only ever store the display name you choose here — never your
        email, country or amount paid. Changes take effect immediately.
      </p>
    </div>
  );
}

function PageHeader() {
  return (
    <>
      <div className="flex items-center gap-2 mb-2">
        <ShieldCheck strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
        <span className="overline">Patrons · self-service</span>
      </div>
      <h1 className="font-serif text-4xl md:text-5xl text-forest leading-tight">
        Manage your listing.
      </h1>
    </>
  );
}
