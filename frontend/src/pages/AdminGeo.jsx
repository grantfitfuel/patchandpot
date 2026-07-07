/**
 * /admin/geo — First-party geographic breakdown of API traffic.
 *
 * Reads from GET /api/admin/geo which aggregates the `visits` collection
 * (populated by the http middleware on every /api/* request). Country comes
 * from the ingress layer's geo header (Cloudflare / Vercel / Fly). No
 * third-party analytics; all data stays in Mongo. TTL-purged after 90 days.
 */
import { useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { AlertTriangle, RefreshCw, LogOut, Globe2 } from "lucide-react";
import { Link } from "react-router-dom";
import AdminTokenGate, { useAdminToken } from "@/components/AdminTokenGate";

const WINDOW_OPTIONS = [1, 7, 30, 90];

// Flag emoji from a 2-letter ISO country code. Purely presentational — the
// server never emits emoji; we compose them here from the code.
function flag(cc) {
  if (!cc || cc.length !== 2) return "🌐";
  const A = 0x1f1e6;
  return String.fromCodePoint(A + cc.charCodeAt(0) - 65) +
         String.fromCodePoint(A + cc.charCodeAt(1) - 65);
}

// Full country name from a 2-letter ISO code, using the browser's Intl DB.
// No hard-coded list — supports every country the browser knows.
function countryName(cc) {
  if (!cc || cc.length !== 2) return cc || "Unknown";
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    return dn.of(cc) || cc;
  } catch {
    return cc;
  }
}

export default function AdminGeoPage() {
  const { token, signIn, signOut } = useAdminToken();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const backend = process.env.REACT_APP_BACKEND_URL;

  async function load(tok, win) {
    if (!tok) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(
        `${backend}/api/admin/geo?token=${encodeURIComponent(tok)}&days=${win}`,
        { cache: "no-store" }
      );
      if (r.status === 403) throw new Error("Invalid admin token.");
      if (r.status === 503) throw new Error("ADMIN_TOKEN not configured on the backend.");
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setData(await r.json());
    } catch (e) {
      setError(e?.message || "Failed to load geo data.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(token, days); }, [token, days]);

  // Max daily visit count is used to scale the mini spark bars, so the
  // busiest day always fills the bar to 100 %.
  const peakDaily = useMemo(() => {
    if (!data?.daily_series?.length) return 0;
    return data.daily_series.reduce((m, r) => Math.max(m, r.visits), 0);
  }, [data]);

  // Peak per-country visits scales the horizontal country bars similarly.
  const peakCountry = useMemo(() => {
    if (!data?.top_countries?.length) return 0;
    return data.top_countries[0].visits;
  }, [data]);

  if (!token) {
    return (
      <AdminTokenGate
        title="Geographic dashboard"
        blurb="First-party visitor breakdown — no PostHog, no Google, all data stays in your own database. Enter the admin token to see where your traffic comes from."
        onSubmit={signIn}
      />
    );
  }

  return (
    <div className="container-narrow py-12" data-testid="admin-geo-page">
      <Helmet>
        <title>Geographic breakdown · Admin · Patch & Pot</title>
      </Helmet>

      <div className="flex items-baseline justify-between mb-6">
        <div>
          <p className="overline">Admin</p>
          <h1 className="font-serif text-4xl text-forest mt-1 flex items-center gap-3">
            <Globe2 strokeWidth={1.4} className="w-8 h-8" />
            Where your traffic comes from
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            data-testid="admin-geo-refresh"
            onClick={() => load(token, days)}
            className="text-xs uppercase tracking-wider text-moss hover:text-forest flex items-center gap-1"
          >
            <RefreshCw strokeWidth={1.5} className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
          <button
            onClick={signOut}
            className="text-xs uppercase tracking-wider text-moss hover:text-forest flex items-center gap-1"
          >
            <LogOut strokeWidth={1.5} className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-8">
        {WINDOW_OPTIONS.map((n) => (
          <button
            key={n}
            data-testid={`admin-geo-window-${n}`}
            onClick={() => setDays(n)}
            className={`text-xs px-3 py-2 border transition-colors ${
              days === n
                ? "bg-forest text-sand border-forest"
                : "bg-sand text-ink/70 border-border hover:border-forest/40"
            }`}
          >
            Last {n === 1 ? "24 hours" : `${n} days`}
          </button>
        ))}
      </div>

      {error && (
        <div className="card-flat p-5 mb-6 border-red-300 bg-red-50" data-testid="admin-geo-error">
          <p className="text-sm text-red-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> {error}
          </p>
        </div>
      )}

      {data && (
        <>
          <div className="grid sm:grid-cols-3 gap-4 mb-10">
            <StatCard label="Total requests" value={data.total_visits.toLocaleString()} />
            <StatCard label="With country data" value={data.total_with_country.toLocaleString()} />
            <StatCard
              label="Countries reached"
              value={data.top_countries.length}
              data-testid="admin-geo-countries-count"
            />
          </div>

          <section className="mb-12">
            <h2 className="font-serif text-2xl text-forest mb-4">Top countries</h2>
            {data.top_countries.length === 0 ? (
              <p className="text-moss italic text-sm">
                No visits with country data yet. The middleware started logging on the last redeploy —
                data will accumulate over the next few hours.
              </p>
            ) : (
              <ul className="space-y-2" data-testid="admin-geo-top-countries">
                {data.top_countries.map((row) => {
                  const pct = peakCountry ? (row.visits / peakCountry) * 100 : 0;
                  return (
                    <li key={row.country} className="grid grid-cols-[2rem_10rem_1fr_4rem] items-center gap-3">
                      <span className="text-2xl leading-none">{flag(row.country)}</span>
                      <span className="text-sm text-ink">
                        <span className="font-mono text-xs text-moss mr-2">{row.country}</span>
                        {countryName(row.country)}
                      </span>
                      <div className="h-2 bg-surface border border-border overflow-hidden">
                        <div
                          className="h-full bg-forest"
                          style={{ width: `${Math.max(2, pct)}%` }}
                        />
                      </div>
                      <span className="text-sm text-ink text-right tabular-nums">
                        {row.visits.toLocaleString()}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="mb-12">
            <h2 className="font-serif text-2xl text-forest mb-4">Daily traffic</h2>
            {data.daily_series.length === 0 ? (
              <p className="text-moss italic text-sm">No traffic in this window yet.</p>
            ) : (
              <div className="card-flat p-5" data-testid="admin-geo-daily">
                <div className="flex items-end gap-1 h-32">
                  {data.daily_series.map((row) => {
                    const h = peakDaily ? (row.visits / peakDaily) * 100 : 0;
                    return (
                      <div
                        key={row.day}
                        className="flex-1 bg-forest hover:bg-terracotta transition-colors relative group"
                        style={{ height: `${Math.max(1, h)}%` }}
                        title={`${row.day}: ${row.visits.toLocaleString()} requests`}
                      >
                        <span className="absolute left-1/2 -translate-x-1/2 -top-6 text-[10px] whitespace-nowrap bg-forest text-sand px-1.5 py-0.5 opacity-0 group-hover:opacity-100 pointer-events-none">
                          {row.day}: {row.visits.toLocaleString()}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[10px] text-moss mt-2 font-mono">
                  <span>{data.daily_series[0]?.day}</span>
                  <span>{data.daily_series[data.daily_series.length - 1]?.day}</span>
                </div>
              </div>
            )}
          </section>

          <p className="text-xs text-moss italic max-w-2xl">{data.note}</p>

          <div className="mt-10 text-xs">
            <Link to="/admin" className="text-moss hover:text-forest underline underline-offset-2">
              ← Admin hub
            </Link>
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, "data-testid": testId }) {
  return (
    <div className="card-flat p-5" data-testid={testId}>
      <p className="overline text-[0.6rem]">{label}</p>
      <p className="font-serif text-4xl text-forest mt-1 tabular-nums">{value}</p>
    </div>
  );
}
