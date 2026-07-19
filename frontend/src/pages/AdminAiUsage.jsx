import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  Activity, Image as ImageIcon, Sparkles, Languages, AlertTriangle,
  RefreshCw, LogOut, Lock,
} from "lucide-react";
import { fetchAdminAiUsage } from "@/lib/api";
import { Link } from "react-router-dom";

/**
 * Internal-only dashboard for the AI usage telemetry the backend already
 * exposes at GET /api/admin/ai-usage. Token-gated — we never wire this into
 * the public navigation. Token persists in localStorage so reloads don't
 * lock the operator out, but a single click on "Sign out" clears it.
 */
const TOKEN_KEY = "pp-admin-token";
const WINDOW_OPTIONS = [7, 30, 90];

export default function AdminAiUsagePage() {
  const [token, setToken] = useState(() => {
    try { return localStorage.getItem(TOKEN_KEY) || ""; }
    catch (e) { console.warn("AdminAiUsage: read token failed", e); return ""; }
  });
  const [draft, setDraft] = useState("");
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function load(tok, win) {
    if (!tok) return;
    setLoading(true);
    setError(null);
    try {
      const d = await fetchAdminAiUsage(tok, win);
      setData(d);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 403) setError("Invalid admin token.");
      else if (status === 503) setError("ADMIN_TOKEN is not configured on the backend.");
      else setError(e?.message || "Failed to load AI usage.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(token, days); }, [token, days]);

  function signIn(e) {
    e.preventDefault();
    const t = draft.trim();
    if (!t) return;
    try { localStorage.setItem(TOKEN_KEY, t); }
    catch (e) { console.warn("AdminAiUsage: persist token failed", e); }
    setToken(t);
    setDraft("");
  }

  function signOut() {
    try { localStorage.removeItem(TOKEN_KEY); }
    catch (e) { console.warn("AdminAiUsage: clear token failed", e); }
    setToken("");
    setData(null);
    setError(null);
  }

  // Token gate — small inline form. Doesn't even pretend to be secure; the
  // real auth is the backend check.
  if (!token) {
    return (
      <div className="container-narrow py-20 max-w-md" data-testid="admin-ai-usage-gate">
        <Helmet><title>Admin · AI Usage — Patch & Pot</title><meta name="robots" content="noindex" /></Helmet>
        <div className="flex items-center gap-3 mb-3">
          <Lock strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
          <span className="overline">Internal</span>
        </div>
        <h1 className="font-serif text-4xl text-forest leading-tight">AI usage dashboard</h1>
        <p className="mt-3 text-ink/75 leading-relaxed">
          Enter the admin token to view the last 7/30/90 days of LLM call counts
          and the current budget circuit-breaker state.
        </p>
        <form onSubmit={signIn} className="mt-7 space-y-3">
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

  return (
    <div className="container-narrow py-12 md:py-16 animate-fade-up" data-testid="admin-ai-usage">
      <Helmet><title>Admin · AI Usage — Patch & Pot</title><meta name="robots" content="noindex" /></Helmet>

      <header className="flex flex-wrap items-center justify-between gap-4 mb-10">
        <div>
          <p className="overline">Admin · Internal</p>
          <h1 className="font-serif text-4xl md:text-5xl text-forest mt-2">AI usage</h1>
          <Link
            to="/admin"
            data-testid="admin-back-hub"
            className="text-sm text-moss hover:text-terracotta underline-offset-4 hover:underline mt-2 inline-block"
          >
            ← Admin hub
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex border border-border bg-surface" role="tablist">
            {WINDOW_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                data-testid={`admin-window-${d}`}
                className={`px-4 py-2 text-sm tracking-wider uppercase transition-colors ${
                  days === d ? "bg-forest text-sand" : "text-ink/70 hover:text-forest"
                }`}
              >{d}d</button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => load(token, days)}
            disabled={loading}
            data-testid="admin-refresh"
            className="btn-ghost inline-flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <RefreshCw strokeWidth={1.5} className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={signOut}
            data-testid="admin-sign-out"
            className="btn-ghost inline-flex items-center gap-2 text-sm"
          >
            <LogOut strokeWidth={1.5} className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </header>

      {error && (
        <div
          className="border border-terracotta/40 bg-terracotta/10 p-4 mb-8 flex items-start gap-3"
          data-testid="admin-error"
        >
          <AlertTriangle strokeWidth={1.5} className="w-5 h-5 text-terracotta flex-shrink-0 mt-0.5" />
          <p className="text-sm text-ink/80">{error}</p>
        </div>
      )}

      {data && <UsageBoard data={data} token={token} />}
      {!data && !error && loading && (
        <p className="text-ink/60 text-sm">Loading…</p>
      )}
    </div>
  );
}

function UsageBoard({ data, token }) {
  const { calls, relative_cost_units, budget, window_days, plant_guide_daily } = data;
  const totalCalls = (calls.sonnet?.total || 0) + (calls.haiku?.total || 0) + (calls.images || 0);
  const cap = budget?.monthly_cap_gbp || 0;
  const used = budget?.estimated_30d_gbp || 0;
  const pct = useMemo(() => {
    if (!cap || cap <= 0) return 0;
    return Math.min(100, Math.round((used / cap) * 1000) / 10);
  }, [cap, used]);
  const barColor =
    !budget?.enabled ? "bg-moss/60" :
    budget.over_budget ? "bg-terracotta" :
    pct >= 80 ? "bg-amber-500" : "bg-forest";

  return (
    <>
      {/* Budget banner — the only metric that matters at a glance. */}
      <section
        className="card-flat p-6 md:p-8 mb-10"
        data-testid="admin-budget-card"
      >
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <p className="overline">Monthly AI budget</p>
            <p className="font-serif text-4xl text-forest mt-2">
              £{used.toFixed(2)}
              <span className="text-ink/50 text-2xl"> / £{cap.toFixed(2)}</span>
            </p>
          </div>
          <div className="text-right">
            <span
              data-testid="admin-budget-status"
              className={`inline-block px-3 py-1 text-xs tracking-wider uppercase ${
                !budget?.enabled ? "bg-moss/20 text-moss" :
                budget.over_budget ? "bg-terracotta text-sand" :
                pct >= 80 ? "bg-amber-100 text-amber-800" :
                "bg-forest/10 text-forest"
              }`}
            >
              {!budget?.enabled ? "Cap disabled" :
                budget.over_budget ? "Circuit breaker tripped" :
                pct >= 80 ? "Approaching cap" : "Healthy"}
            </span>
            <p className="text-xs text-ink/60 mt-2">Rolling 30 days · cache hits always served</p>
          </div>
        </div>
        <div className="mt-5 h-2 bg-border overflow-hidden">
          <div
            className={`h-full transition-all ${barColor}`}
            style={{ width: `${budget?.enabled ? Math.max(2, pct) : 0}%` }}
            data-testid="admin-budget-bar"
          />
        </div>
        {plant_guide_daily && (
          <div className="mt-5 pt-5 border-t border-border flex flex-wrap items-end gap-x-6 gap-y-2"
               data-testid="admin-plant-guide-daily">
            <div>
              <p className="overline">Today&apos;s new AI plant guides</p>
              <p className="font-serif text-2xl text-forest mt-1">
                {plant_guide_daily.used_today}
                <span className="text-ink/50 text-base"> / {plant_guide_daily.limit}</span>
              </p>
            </div>
            <p className="text-xs text-ink/60 max-w-md leading-relaxed">
              Hard ceiling on uncached Sonnet generations. Once we hit it, novel
              plant searches return a friendly 429 until UTC midnight. Cached
              plants keep serving normally.
            </p>
          </div>
        )}
      </section>

      {/* Per-engine call breakdown. */}
      <section className="grid md:grid-cols-3 gap-5 mb-10">
        <UsageCard
          icon={Sparkles}
          label={`Sonnet · ${window_days}d`}
          value={calls.sonnet?.total ?? 0}
          breakdown={[
            ["Guidance (EN)", calls.sonnet?.guidance_base_en],
            ["Plant guides (EN)", calls.sonnet?.plant_guide_en],
            ["Arrangements", calls.sonnet?.arrangements],
            ["Masterclasses", calls.sonnet?.masterclasses],
          ]}
          testId="admin-card-sonnet"
        />
        <UsageCard
          icon={Languages}
          label={`Haiku · ${window_days}d`}
          value={calls.haiku?.total ?? 0}
          breakdown={[
            ["Guidance translations", calls.haiku?.guidance_base_translations],
            ["Garden personalisations", calls.haiku?.garden_personalisations],
            ["Plant guide translations", calls.haiku?.plant_guide_translations],
          ]}
          testId="admin-card-haiku"
        />
        <UsageCard
          icon={ImageIcon}
          label={`Images · ${window_days}d`}
          value={calls.images ?? 0}
          breakdown={[["Nano Banana renders", calls.images]]}
          testId="admin-card-images"
        />
      </section>

      <section className="grid md:grid-cols-2 gap-5">
        <div className="card-flat p-6" data-testid="admin-card-total">
          <div className="flex items-center gap-3 mb-3">
            <Activity strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
            <span className="overline">Total LLM calls · {window_days}d</span>
          </div>
          <p className="font-serif text-5xl text-forest">{totalCalls.toLocaleString()}</p>
          <p className="mt-2 text-sm text-ink/65">
            Relative cost units: <b>{relative_cost_units}</b>
            <span className="text-ink/45"> (Sonnet 1× · Haiku 0.25× · Image 0.15×)</span>
          </p>
        </div>
        <div className="card-flat p-6 text-sm text-ink/70 leading-relaxed">
          <p className="overline mb-3">How this works</p>
          <p>{data.note}</p>
          <p className="mt-3 text-xs text-ink/50">
            Snapshot since {new Date(data.since).toLocaleString()}
          </p>
        </div>
      </section>

      <AskUsageReset token={token} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Ask-the-Garden daily-counter reset                                 */
/*  Lets an operator zero a member's ask_usage rows directly from the  */
/*  admin UI — no need to drop to curl. Single date or full wipe.      */
/* ------------------------------------------------------------------ */
function AskUsageReset({ token }) {
  const backend = process.env.REACT_APP_BACKEND_URL;
  const [accessToken, setAccessToken] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);

  async function clear() {
    if (!accessToken.trim()) {
      setErr("Member access_token is required.");
      return;
    }
    if (!window.confirm(
      date
        ? `Clear ask_usage for date ${date} for this member?`
        : "Wipe ALL ask_usage rows for this member?"
    )) return;
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const params = new URLSearchParams({ token, access_token: accessToken.trim() });
      if (date) params.set("date", date.trim());
      const r = await fetch(`${backend}/api/admin/ask/clear-usage?${params.toString()}`, {
        method: "POST",
        cache: "no-store",
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.detail || `HTTP ${r.status}`);
      setResult(j);
    } catch (e) {
      setErr(e?.message || "Failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card-flat p-6 mt-6" data-testid="admin-ask-usage-reset">
      <div className="flex items-center gap-3 mb-3">
        <RefreshCw strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
        <span className="overline">Reset Ask Nàdar counter</span>
      </div>
      <p className="text-sm text-ink/70 mb-4 max-w-2xl">
        Wipe a member&apos;s daily question counter. Leave date blank to wipe every row for that member,
        or fill it in (YYYY-MM-DD) to clear just one day. Uses the admin token already signed in above.
      </p>

      <div className="grid sm:grid-cols-[1fr_180px_auto] gap-3 mb-3">
        <input
          data-testid="ask-reset-access-token"
          type="text"
          placeholder="Member access_token"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-border bg-sand font-mono"
        />
        <input
          data-testid="ask-reset-date"
          type="text"
          placeholder="YYYY-MM-DD (optional)"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-border bg-sand font-mono"
        />
        <button
          type="button"
          data-testid="ask-reset-submit"
          onClick={clear}
          disabled={busy}
          className="px-4 py-2 text-xs uppercase tracking-wider bg-forest text-sand hover:bg-forest/85 disabled:opacity-50"
        >
          {busy ? "Clearing…" : "Clear"}
        </button>
      </div>

      {err && (
        <p className="text-sm text-red-700 mt-2" data-testid="ask-reset-error">{err}</p>
      )}
      {result && (
        <div className="mt-3 text-sm" data-testid="ask-reset-result">
          <p className="text-forest">
            ✓ Removed {result.rows_removed} row(s). Scope: {result.scope}.
          </p>
          {result.remaining_rows?.length ? (
            <div className="mt-2">
              <p className="overline text-[0.6rem] mb-1">Remaining ask_usage history</p>
              <ul className="font-mono text-xs text-ink/85 space-y-0.5">
                {result.remaining_rows.map((row) => (
                  <li key={row.date}>{row.date} → count={row.count}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-moss italic mt-2">No ask_usage rows remain for this member.</p>
          )}
        </div>
      )}
    </section>
  );
}

function UsageCard({ icon: Icon, label, value, breakdown, testId }) {
  return (
    <div className="card-flat p-6" data-testid={testId}>
      <div className="flex items-center gap-3 mb-3">
        <Icon strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
        <span className="overline">{label}</span>
      </div>
      <p className="font-serif text-4xl text-forest">{(value || 0).toLocaleString()}</p>
      <ul className="mt-4 space-y-1.5 text-sm">
        {breakdown.filter(([, v]) => v != null).map(([k, v]) => (
          <li key={k} className="flex items-baseline justify-between gap-2">
            <span className="text-ink/65">{k}</span>
            <span className="font-mono text-ink/85">{(v || 0).toLocaleString()}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
