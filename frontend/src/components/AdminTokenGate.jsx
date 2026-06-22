import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Lock } from "lucide-react";

/**
 * Tiny shared token-gate used by /admin/* pages. Persists the token to
 * localStorage so reloads don't lock the operator out. The real auth is
 * the backend `_require_admin` check — this UI is purely a hand-off.
 */
const STORAGE_KEY = "pp-admin-token";

export function useAdminToken() {
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) || ""; } catch { return ""; }
  });
  const signIn = (t) => {
    const v = (t || "").trim();
    if (!v) return;
    try { localStorage.setItem(STORAGE_KEY, v); } catch { /* ignore */ }
    setToken(v);
  };
  const signOut = () => {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setToken("");
  };
  return { token, signIn, signOut };
}

export default function AdminTokenGate({ title, blurb, onSubmit, testIdPrefix = "admin" }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="container-narrow py-20 max-w-md" data-testid={`${testIdPrefix}-gate`}>
      <Helmet><title>{title} — Patch & Pot</title><meta name="robots" content="noindex" /></Helmet>
      <div className="flex items-center gap-3 mb-3">
        <Lock strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
        <span className="overline">Internal</span>
      </div>
      <h1 className="font-serif text-4xl text-forest leading-tight">{title}</h1>
      <p className="mt-3 text-ink/75 leading-relaxed">{blurb}</p>
      <form
        onSubmit={(e) => { e.preventDefault(); onSubmit(draft); setDraft(""); }}
        className="mt-7 space-y-3"
      >
        <input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Admin token"
          data-testid="admin-token-input"
          className="w-full px-4 py-3 bg-surface border border-border text-ink focus:border-terracotta focus:outline-none"
          autoFocus
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          data-testid="admin-token-submit"
          className="btn-terracotta w-full inline-flex items-center justify-center gap-2 disabled:opacity-50"
        >
          Open dashboard
        </button>
      </form>
    </div>
  );
}
