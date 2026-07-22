/**
 * `/admin/analytics` — CTA click-through rates by capability.
 *
 * Reads `GET /api/admin/analytics/summary` and renders:
 *   - Totals card (events / page_view / cta_click / other)
 *   - Per-capability funnel table sorted by page_views desc
 *   - Top paths sitewide
 *   - Recent raw events (debug feed)
 *
 * Auth via the shared AdminTokenGate → axios interceptor attaches the
 * `X-Admin-Token` header on every /admin/* call.
 */
import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { AlertTriangle, RefreshCw, LogOut, BarChart3, Eye, MousePointerClick, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import AdminTokenGate, { useAdminToken } from "@/components/AdminTokenGate";
import { api } from "@/lib/api";


function AdminAnalyticsInner({ signOut }) {
  const [data, setData] = useState(null);
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api.get("/admin/analytics/summary", {
        params: { days },
        headers: { "Cache-Control": "no-cache" },
      });
      setData(r.data);
    } catch (e) {
      const status = e?.response?.status;
      if (status === 403) setError("Invalid admin token.");
      else setError(e?.response?.data?.detail || e?.message || "Failed to load analytics.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="container-narrow py-12 md:py-16">
      <Helmet><title>Analytics — Patch &amp; Pot admin</title></Helmet>
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <p className="overline">Admin</p>
          <h1 className="font-serif text-4xl text-forest mt-2 tracking-tight inline-flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-terracotta" strokeWidth={1.5} />
            Analytics
          </h1>
          <p className="text-sm text-moss mt-2">
            First-party page views + CTA clicks by capability. Data lives in
            <code className="mx-1 px-1.5 py-0.5 bg-sand text-forest text-xs">analytics_events</code>.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value, 10))}
            className="border border-border/70 px-2 py-2 text-sm bg-white text-ink"
            data-testid="analytics-days"
          >
            {[7, 14, 30, 60, 90].map((d) => (
              <option key={d} value={d}>Last {d} days</option>
            ))}
          </select>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            data-testid="analytics-refresh"
            className="border border-forest/40 text-forest px-3 py-2 text-sm inline-flex items-center gap-1.5 hover:bg-forest hover:text-sand transition-colors disabled:opacity-40"
          >
            <RefreshCw strokeWidth={1.6} className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={signOut}
            className="border border-border/70 text-moss px-3 py-2 text-sm inline-flex items-center gap-1.5 hover:text-forest hover:border-forest/40 transition-colors"
            data-testid="analytics-signout"
          >
            <LogOut strokeWidth={1.6} className="w-3.5 h-3.5" /> Sign out
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 border-l-4 border-terracotta bg-terracotta/5 p-4 text-sm text-terracotta flex items-start gap-2" data-testid="analytics-error">
          <AlertTriangle className="w-4 h-4 mt-0.5" strokeWidth={1.6} />
          <span>{error}</span>
        </div>
      )}

      {data && (
        <>
          {/* ── Totals ────────────────────────────────────────────── */}
          <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10" data-testid="analytics-totals">
            <TotalCard label="Total events" value={data.totals.events} />
            <TotalCard label="Page views" value={data.totals.page_view} icon={<Eye className="w-4 h-4 text-moss" strokeWidth={1.5} />} />
            <TotalCard label="CTA clicks" value={data.totals.cta_click} icon={<MousePointerClick className="w-4 h-4 text-terracotta" strokeWidth={1.5} />} />
            <TotalCard label="Other events" value={data.totals.other} />
          </section>

          {/* ── Per-capability funnel ────────────────────────────── */}
          <section className="mb-12">
            <h2 className="font-serif text-2xl text-forest tracking-tight mb-4">Capabilities</h2>
            {data.capabilities.length === 0 ? (
              <p className="text-sm text-moss italic">
                No capability events in this window yet. Give it a day or two
                after deploying and the funnel will populate.
              </p>
            ) : (
              <div className="border border-border overflow-x-auto">
                <table className="w-full text-sm" data-testid="analytics-capabilities-table">
                  <thead className="bg-sand/40 text-moss">
                    <tr>
                      <th className="text-left px-4 py-2 font-medium">Capability</th>
                      <th className="text-right px-4 py-2 font-medium">Views</th>
                      <th className="text-right px-4 py-2 font-medium">CTA clicks</th>
                      <th className="text-right px-4 py-2 font-medium">CTR</th>
                      <th className="text-left px-4 py-2 font-medium">Top CTA targets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.capabilities.map((c) => (
                      <tr key={c.slug} className="border-t border-border/60" data-testid={`analytics-row-${c.slug}`}>
                        <td className="px-4 py-2">
                          <Link to={`/capabilities/${c.slug}`} className="text-forest hover:text-terracotta inline-flex items-center gap-1">
                            {c.slug}
                            <ArrowRight strokeWidth={1.6} className="w-3 h-3" />
                          </Link>
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums">{c.page_views}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{c.cta_clicks}</td>
                        <td className="px-4 py-2 text-right tabular-nums">
                          <span className={c.ctr_pct >= 15 ? "text-forest font-medium" : c.ctr_pct >= 5 ? "text-ink" : "text-moss/70"}>
                            {c.ctr_pct}%
                          </span>
                        </td>
                        <td className="px-4 py-2 text-xs text-moss">
                          {Object.entries(c.cta_targets || {})
                            .sort((a, b) => b[1] - a[1])
                            .slice(0, 3)
                            .map(([tgt, n]) => `${tgt} (${n})`)
                            .join(" · ") || <span className="opacity-50">—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* ── Top paths + recent feed ──────────────────────────── */}
          <section className="grid lg:grid-cols-2 gap-6">
            <div>
              <h2 className="font-serif text-2xl text-forest tracking-tight mb-4">Top paths</h2>
              {data.top_paths.length === 0 ? (
                <p className="text-sm text-moss italic">No page views yet.</p>
              ) : (
                <ul className="border border-border" data-testid="analytics-top-paths">
                  {data.top_paths.map((p) => (
                    <li key={p.path} className="flex items-center justify-between px-4 py-2 border-b border-border/60 last:border-b-0 text-sm">
                      <code className="text-forest truncate">{p.path}</code>
                      <span className="tabular-nums text-moss">{p.views}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <h2 className="font-serif text-2xl text-forest tracking-tight mb-4">Recent events</h2>
              {data.recent.length === 0 ? (
                <p className="text-sm text-moss italic">No events yet.</p>
              ) : (
                <ul className="border border-border max-h-96 overflow-y-auto" data-testid="analytics-recent">
                  {data.recent.map((r, i) => (
                    <li key={i} className="px-4 py-2 border-b border-border/60 last:border-b-0 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-terracotta font-medium">{r.event}</span>
                        <code className="text-moss truncate flex-1">{r.path}</code>
                        <span className="text-moss/60 whitespace-nowrap">
                          {new Date(r.at).toLocaleTimeString()}
                        </span>
                      </div>
                      {r.params && Object.keys(r.params).length > 0 && (
                        <div className="mt-1 text-[0.65rem] text-moss/70 truncate">
                          {JSON.stringify(r.params)}
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}


function TotalCard({ label, value, icon }) {
  return (
    <div className="border border-border p-4">
      <p className="text-[0.6rem] uppercase tracking-widest text-moss mb-1 flex items-center gap-1.5">
        {icon}
        {label}
      </p>
      <p className="text-3xl font-serif text-forest tabular-nums">{value}</p>
    </div>
  );
}


export default function AdminAnalyticsPage() {
  const { token, signIn, signOut } = useAdminToken();
  if (!token) return <AdminTokenGate onSubmit={signIn} />;
  return <AdminAnalyticsInner signOut={signOut} />;
}
