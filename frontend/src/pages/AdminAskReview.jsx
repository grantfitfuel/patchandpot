/**
 * /admin/ask-review — Nàdar Q&A pending-review queue.
 *
 * Lists every ask_cache row where `pending_review: true` (auto-flagged
 * by the model-refusal / blocklist filter at save time, or by the
 * down-vote threshold in vote_popular). One-tap Unhide (approve &
 * publish) or Permanent-hide (bury forever); both actions clear the
 * review flag so the entry drops out of the queue.
 */
import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { AlertTriangle, CheckCircle2, EyeOff, Eye, LogOut, RefreshCw, ShieldCheck } from "lucide-react";
import axios from "axios";
import { API } from "@/lib/api";
import AdminTokenGate, { useAdminToken } from "@/components/AdminTokenGate";

export default function AdminAskReviewPage() {
  const { token, signIn, signOut } = useAdminToken();
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await axios.get(`${API}/admin/ask/pending-review`, { params: { token } });
      setEntries(res.data?.entries || []);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message || "Failed to load queue.");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const decide = async (key, decision) => {
    setBusy(key);
    try {
      const res = await axios.post(
        `${API}/admin/ask/review/${encodeURIComponent(key)}`,
        null,
        { params: { token, decision } },
      );
      if (res.data?.ok) {
        setEntries((rows) => rows.filter((r) => r.key !== key));
        setToast({
          type: decision === "unhide" ? "unhide" : "hide",
          text: decision === "unhide" ? "Approved and published." : "Permanently hidden.",
        });
        setTimeout(() => setToast(null), 2500);
      } else {
        setToast({ type: "error", text: res.data?.reason || "Failed" });
      }
    } catch (e) {
      setToast({ type: "error", text: e?.response?.data?.detail || e.message });
    } finally {
      setBusy(null);
    }
  };

  if (!token) {
    return (
      <AdminTokenGate
        title="Ask Nàdar review queue"
        blurb="Sign in to review answers flagged for a human look — model refusals, down-voted answers, or block-list hits."
        onSubmit={signIn}
        testIdPrefix="ask-review"
      />
    );
  }

  return (
    <div className="container-narrow py-10" data-testid="admin-ask-review-page">
      <Helmet>
        <title>Ask Nàdar review · Admin · Patch & Pot</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="flex items-baseline justify-between mb-8">
        <div>
          <p className="overline flex items-center gap-2">
            <ShieldCheck strokeWidth={1.4} className="w-3.5 h-3.5 text-terracotta" />
            Admin · Ask Nàdar
          </p>
          <h1 className="font-serif text-4xl md:text-5xl text-forest mt-2 tracking-tight">
            Review queue
          </h1>
          <p className="text-sm text-moss mt-2 max-w-2xl leading-relaxed">
            Answers auto-flagged for a human look — model refusals, block-list hits, or
            down-voted answers. Approve to publish, or permanently hide.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            data-testid="ask-review-reload"
            className="text-xs uppercase tracking-wider text-moss hover:text-forest flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw strokeWidth={1.5} className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Reload
          </button>
          <button
            onClick={signOut}
            data-testid="ask-review-signout"
            className="text-xs uppercase tracking-wider text-moss hover:text-forest flex items-center gap-1"
          >
            <LogOut strokeWidth={1.5} className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>

      {error && (
        <div className="card-flat p-4 mb-6 border-terracotta/40" data-testid="ask-review-error">
          <div className="flex gap-2 text-sm text-terracotta">
            <AlertTriangle strokeWidth={1.5} className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {error}
          </div>
        </div>
      )}

      {loading && !entries.length && (
        <div className="text-sm text-moss" data-testid="ask-review-loading">Loading…</div>
      )}

      {!loading && !entries.length && !error && (
        <div className="card-flat p-8 text-center" data-testid="ask-review-empty">
          <CheckCircle2 strokeWidth={1.3} className="w-8 h-8 text-forest mx-auto mb-3" />
          <p className="font-serif text-2xl text-forest mb-1">Nothing to review.</p>
          <p className="text-sm text-moss">The queue is empty — every flagged answer has been decided.</p>
        </div>
      )}

      <div className="space-y-4">
        {entries.map((r) => (
          <article
            key={r.key}
            data-testid={`ask-review-entry-${r.key}`}
            className="card-flat p-5"
          >
            <div className="flex items-center gap-3 mb-3 text-[0.65rem] uppercase tracking-widest text-moss">
              <span data-testid={`entry-hits-${r.key}`}>{r.hits ?? 0} hits</span>
              {typeof r.down_votes === "number" && (
                <span data-testid={`entry-votes-${r.key}`}>
                  ↑{r.up_votes ?? 0} · ↓{r.down_votes ?? 0}
                </span>
              )}
              <span className={r.hidden ? "text-terracotta" : "text-forest"}>
                {r.hidden ? "hidden" : "visible"}
              </span>
              <span className="ml-auto">{shortDate(r.last_asked_at)}</span>
            </div>

            <p className="font-serif text-xl text-forest leading-snug mb-3">
              {r.question_normalized}
            </p>

            <div className="text-sm text-ink/85 leading-relaxed whitespace-pre-wrap mb-4 border-l-2 border-border pl-4 max-h-60 overflow-auto">
              {r.answer}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy === r.key}
                onClick={() => decide(r.key, "unhide")}
                data-testid={`unhide-${r.key}`}
                className="btn-primary text-xs inline-flex items-center gap-1.5 disabled:opacity-50"
              >
                <Eye strokeWidth={1.6} className="w-3.5 h-3.5" />
                Approve & publish
              </button>
              <button
                type="button"
                disabled={busy === r.key}
                onClick={() => decide(r.key, "hide")}
                data-testid={`hide-${r.key}`}
                className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 border border-terracotta/50 text-terracotta hover:bg-terracotta hover:text-cream transition-colors disabled:opacity-50"
              >
                <EyeOff strokeWidth={1.6} className="w-3.5 h-3.5" />
                Permanent-hide
              </button>
            </div>
          </article>
        ))}
      </div>

      {toast && (
        <div
          data-testid="ask-review-toast"
          className={`fixed bottom-6 right-6 px-4 py-3 shadow-lg text-sm ${
            toast.type === "error"
              ? "bg-terracotta text-cream"
              : "bg-forest text-cream"
          }`}
        >
          {toast.text}
        </div>
      )}
    </div>
  );
}

function shortDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }); }
  catch { return iso; }
}
