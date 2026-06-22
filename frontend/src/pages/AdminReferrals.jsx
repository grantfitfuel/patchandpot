import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import {
  AlertTriangle, RefreshCw, LogOut, ExternalLink, TrendingUp, MousePointerClick,
} from "lucide-react";
import { fetchAdminReferrals } from "@/lib/api";
import { Link } from "react-router-dom";
import AdminTokenGate, { useAdminToken } from "@/components/AdminTokenGate";

const WINDOW_OPTIONS = [7, 30, 90];

/**
 * Internal dashboard for embed/referral attribution. Reads from
 * GET /api/admin/referrals — aggregates paid checkouts in the last N days
 * by `ref` token (set by the homepage `useReferralCapture` hook when a
 * visitor arrives via an embed `?ref=...` deep link).
 */
export default function AdminReferralsPage() {
  const { token, signIn, signOut } = useAdminToken();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  async function load(tok, win) {
    if (!tok) return;
    setLoading(true);
    setError(null);
    try {
      const d = await fetchAdminReferrals(tok, win);
      setData(d);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 403) setError("Invalid admin token.");
      else if (status === 503) setError("ADMIN_TOKEN is not configured on the backend.");
      else setError(e?.message || "Failed to load referrals.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(token, days); }, [token, days]);

  if (!token) {
    return (
      <AdminTokenGate
        title="Referral dashboard"
        blurb="Enter the admin token to see which embeds, blogs and direct visits are actually converting into paid checkouts."
        onSubmit={signIn}
        testIdPrefix="admin-referrals"
      />
    );
  }

  return (
    <div className="container-narrow py-12 md:py-16 animate-fade-up" data-testid="admin-referrals">
      <Helmet><title>Admin · Referrals — Patch & Pot</title><meta name="robots" content="noindex" /></Helmet>

      <header className="flex flex-wrap items-center justify-between gap-4 mb-10">
        <div>
          <p className="overline">Admin · Internal</p>
          <h1 className="font-serif text-4xl md:text-5xl text-forest mt-2">Referrals</h1>
          <Link
            to="/admin/ai-usage"
            data-testid="admin-link-ai-usage"
            className="text-sm text-moss hover:text-terracotta underline-offset-4 hover:underline mt-2 inline-block"
          >
            → See AI usage &amp; budget
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex border border-border bg-surface" role="tablist">
            {WINDOW_OPTIONS.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDays(d)}
                data-testid={`admin-referrals-window-${d}`}
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
            data-testid="admin-referrals-refresh"
            className="btn-ghost inline-flex items-center gap-2 text-sm disabled:opacity-50"
          >
            <RefreshCw strokeWidth={1.5} className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={signOut}
            data-testid="admin-referrals-sign-out"
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
          data-testid="admin-referrals-error"
        >
          <AlertTriangle strokeWidth={1.5} className="w-5 h-5 text-terracotta flex-shrink-0 mt-0.5" />
          <p className="text-sm text-ink/80">{error}</p>
        </div>
      )}

      {data && <ReferralsBoard data={data} />}
      {!data && !error && loading && (
        <p className="text-ink/60 text-sm">Loading…</p>
      )}
    </div>
  );
}

function ReferralsBoard({ data }) {
  const { sources, total_purchases, total_revenue_gbp, window_days } = data;
  const top = sources[0];
  return (
    <>
      {/* Top-line metrics. */}
      <section className="grid md:grid-cols-3 gap-5 mb-10">
        <StatCard
          icon={MousePointerClick}
          label={`Paid checkouts · ${window_days}d`}
          value={total_purchases.toLocaleString()}
          testId="admin-referrals-stat-purchases"
        />
        <StatCard
          icon={TrendingUp}
          label={`Revenue · ${window_days}d`}
          value={`£${total_revenue_gbp.toFixed(2)}`}
          testId="admin-referrals-stat-revenue"
        />
        <StatCard
          icon={ExternalLink}
          label="Top source"
          value={top ? top.ref : "—"}
          sub={top ? `${top.purchases} sale${top.purchases === 1 ? "" : "s"} · £${top.revenue_gbp.toFixed(2)}` : "No data yet"}
          testId="admin-referrals-stat-top"
        />
      </section>

      {/* Per-source breakdown. */}
      <section className="card-flat overflow-hidden" data-testid="admin-referrals-table">
        <header className="px-6 py-4 border-b border-border bg-surface">
          <p className="overline">Sources · ranked by revenue</p>
        </header>
        {sources.length === 0 ? (
          <p
            className="px-6 py-12 text-center text-ink/60 text-sm"
            data-testid="admin-referrals-empty"
          >
            No paid checkouts yet in this window. Embeds will start showing up here as soon as a visitor clicks through and completes a payment.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="px-6 py-3 overline font-normal">Source</th>
                <th className="px-6 py-3 overline font-normal">Purchases</th>
                <th className="px-6 py-3 overline font-normal">Revenue</th>
                <th className="px-6 py-3 overline font-normal">Top tier</th>
                <th className="px-6 py-3 overline font-normal">Last sale</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => {
                const topPkg = Object.entries(s.by_package).sort((a, b) => b[1] - a[1])[0];
                return (
                  <tr
                    key={s.ref}
                    className="border-b border-border last:border-0 hover:bg-sand/40"
                    data-testid={`admin-referrals-row-${s.ref}`}
                  >
                    <td className="px-6 py-4">
                      <span className="font-medium text-forest">{s.ref}</span>
                    </td>
                    <td className="px-6 py-4 font-mono">{s.purchases}</td>
                    <td className="px-6 py-4 font-mono">£{s.revenue_gbp.toFixed(2)}</td>
                    <td className="px-6 py-4 text-ink/70">
                      {topPkg ? `${topPkg[0]} (${topPkg[1]})` : "—"}
                    </td>
                    <td className="px-6 py-4 text-xs text-ink/60">
                      {s.last_purchase_at
                        ? new Date(s.last_purchase_at).toLocaleDateString(undefined, {
                            day: "numeric", month: "short", year: "numeric",
                          })
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <p className="text-xs text-ink/55 mt-4 leading-relaxed">
        Sources like <code className="font-mono bg-sand/60 px-1">embed-mygardenblog.com</code> come from the
        Founding Member widget iframe. <code className="font-mono bg-sand/60 px-1">(direct)</code> is anything
        without a ref — typing the URL in, a bookmark, or a paid ad without UTM.
      </p>
    </>
  );
}

function StatCard({ icon: Icon, label, value, sub, testId }) {
  return (
    <div className="card-flat p-6" data-testid={testId}>
      <div className="flex items-center gap-3 mb-3">
        <Icon strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
        <span className="overline">{label}</span>
      </div>
      <p className="font-serif text-4xl text-forest leading-none truncate">{value}</p>
      {sub && <p className="mt-3 text-sm text-ink/65">{sub}</p>}
    </div>
  );
}
