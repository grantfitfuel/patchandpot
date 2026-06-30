import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { ExternalLink, Trash2, TrendingUp, TrendingDown } from "lucide-react";

/**
 * Admin-only revenue dashboard.
 *
 * Lives at /admin/revenue. Gated by the same ADMIN_TOKEN the backend's
 * /api/affiliate/* admin endpoints expect — paste it in the password box,
 * the page stores it in sessionStorage (not localStorage — wipes on tab
 * close) and uses it for every request.
 *
 * Networks shown:
 *   - amazon-uk   → direct (patchandpot-21), 100% commission
 *   - amazon-us   → direct (patchandpot-20), 100% commission
 *   - sovrn       → everything else (all other Amazons + every non-Amazon
 *                   retailer routed via the Sovrn auto-affiliate JS)
 *
 * Earnings are entered manually — Amazon Associates, Sovrn and Awin all
 * pay out on their own cadence and there's no shared API to pull totals.
 * EPC = earnings / clicks for each network.
 */
const NETWORK_LABELS = {
  "amazon-uk": "Amazon UK (direct)",
  "amazon-us": "Amazon US (direct)",
  sovrn: "Sovrn (everything else)",
};

function NetworkLabel({ network }) {
  return <span>{NETWORK_LABELS[network] || network}</span>;
}

export default function RevenuePage() {
  const [token, setToken] = useState(() => sessionStorage.getItem("patchpot-admin-token") || "");
  const [days, setDays] = useState(90);
  const [data, setData] = useState(null);
  const [profit, setProfit] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Earnings entry form
  const [form, setForm] = useState({
    network: "amazon-uk",
    amount: "",
    currency: "GBP",
    period_start: "",
    period_end: "",
    note: "",
  });
  const [saving, setSaving] = useState(false);

  const backend = process.env.REACT_APP_BACKEND_URL || "";

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch(`${backend}/api/affiliate/revenue?days=${days}&token=${encodeURIComponent(token)}`);
      if (r.status === 401) {
        setError("Invalid admin token.");
        sessionStorage.removeItem("patchpot-admin-token");
        setData(null);
        return;
      }
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setData(json);
      sessionStorage.setItem("patchpot-admin-token", token);
      // Profit margin runs in parallel — failure here shouldn't break
      // the rest of the dashboard, so we swallow errors quietly.
      try {
        const pr = await fetch(
          `${backend}/api/admin/profit-margin?days=${days}&token=${encodeURIComponent(token)}`,
        );
        if (pr.ok) setProfit(await pr.json());
      } catch (e) {
        console.warn("profit-margin fetch failed", e);
      }
    } catch (e) {
      setError(e?.message || "Failed to load.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
  }, [days]);

  const submitEarnings = async (e) => {
    e.preventDefault();
    if (!form.amount || !form.period_start || !form.period_end) return;
    setSaving(true);
    try {
      const r = await fetch(`${backend}/api/affiliate/earnings?token=${encodeURIComponent(token)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          network: form.network,
          amount: parseFloat(form.amount),
          currency: form.currency,
          period_start: form.period_start,
          period_end: form.period_end,
          note: form.note || null,
        }),
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setForm({ ...form, amount: "", note: "" });
      await load();
    } catch (e) {
      setError(e?.message || "Failed to save earnings.");
    } finally {
      setSaving(false);
    }
  };

  const removeEarnings = async (id) => {
    if (!window.confirm("Delete this earnings entry?")) return;
    try {
      await fetch(`${backend}/api/affiliate/earnings/${id}?token=${encodeURIComponent(token)}`, {
        method: "DELETE",
      });
      await load();
    } catch {
      setError("Delete failed.");
    }
  };

  if (!data) {
    return (
      <div className="container-narrow py-14 max-w-md" data-testid="revenue-gate">
        <Helmet><title>Revenue · Patch & Pot</title></Helmet>
        <p className="overline">Admin</p>
        <h1 className="font-serif text-4xl text-forest mt-2 mb-4">Revenue dashboard</h1>
        <p className="text-ink/80 mb-4">Paste the admin token to unlock.</p>
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="ADMIN_TOKEN"
          className="w-full border border-border rounded px-3 py-2 mb-3"
          data-testid="revenue-token-input"
        />
        <button
          onClick={load}
          disabled={loading || !token}
          className="btn-primary w-full"
          data-testid="revenue-unlock-btn"
        >
          {loading ? "Loading…" : "Unlock"}
        </button>
        {error && <p className="text-terracotta text-sm mt-3" data-testid="revenue-error">{error}</p>}
      </div>
    );
  }

  return (
    <div className="container-narrow py-12 max-w-4xl" data-testid="revenue-page">
      <Helmet><title>Revenue · Patch & Pot</title></Helmet>

      <p className="overline">Admin</p>
      <div className="flex items-center justify-between mt-2 mb-2">
        <h1 className="font-serif text-4xl text-forest tracking-tight">Revenue dashboard</h1>
        <select
          value={days}
          onChange={(e) => setDays(Number(e.target.value))}
          className="text-sm border border-border rounded px-2 py-1"
          data-testid="revenue-days-select"
        >
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
          <option value={180}>Last 180 days</option>
          <option value={365}>Last year</option>
        </select>
      </div>
      <p className="text-ink/70 text-sm mb-8">
        Clicks tracked live. Earnings entered manually when payouts land (Amazon Associates and Sovrn don’t share an API).
      </p>

      {/* Net margin — Stripe + affiliate revenue minus Stripe fees + AI spend */}
      {profit && (
        <section className="mb-12" data-testid="revenue-profit-margin">
          <h2 className="font-serif text-2xl text-forest mb-1">Net margin</h2>
          <p className="text-ink/60 text-xs mb-4">
            Gross income minus Stripe processing fees and estimated AI spend over the window.
          </p>
          <div className="border border-border bg-surface/40 p-5">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 items-end">
              <ProfitFigure
                label="Stripe gross"
                value={profit.stripe.gross_gbp}
                subtitle={`${profit.stripe.transaction_count} txn${profit.stripe.transaction_count === 1 ? "" : "s"}`}
                tone="positive"
              />
              <ProfitFigure
                label="Affiliate"
                value={profit.affiliate_earnings_gbp}
                subtitle="Logged payouts"
                tone="positive"
              />
              <ProfitFigure
                label="Stripe fees"
                value={-profit.stripe.fees_gbp}
                subtitle={`${(profit.stripe.fee_pct * 100).toFixed(2)}% + £${profit.stripe.fee_flat_gbp.toFixed(2)}/txn`}
                tone="negative"
              />
              <ProfitFigure
                label="AI spend"
                value={-profit.ai_spend_gbp}
                subtitle={`${profit.ai_calls.sonnet} Sonnet · ${profit.ai_calls.haiku} Haiku · ${profit.ai_calls.images} img`}
                tone="negative"
              />
              <ProfitFigure
                label="Net profit"
                value={profit.net_profit_gbp}
                subtitle={
                  profit.margin_pct !== null
                    ? `${profit.margin_pct.toFixed(1)}% margin`
                    : "—"
                }
                tone={profit.net_profit_gbp >= 0 ? "positive-strong" : "negative-strong"}
                large
              />
            </div>
            {profit.stripe.tip_gbp > 0 && (
              <p className="text-xs text-ink/55 mt-4">
                Tip jar contributed £{profit.stripe.tip_gbp.toFixed(2)} of the Stripe gross.
              </p>
            )}
            <p className="text-[11px] text-ink/45 mt-3 leading-relaxed">
              {profit.note}
            </p>
          </div>
        </section>
      )}

      {/* Per-network rollup */}
      <section className="mb-12">
        <h2 className="font-serif text-2xl text-forest mb-4">Per-network rollup</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="revenue-rollup-table">
            <thead className="text-left text-ink/60 border-b border-border">
              <tr>
                <th className="py-2 pr-4">Network</th>
                <th className="py-2 pr-4 text-right">Clicks</th>
                <th className="py-2 pr-4 text-right">Earnings (£)</th>
                <th className="py-2 text-right">EPC</th>
              </tr>
            </thead>
            <tbody>
              {data.rollup.length === 0 && (
                <tr><td colSpan={4} className="py-6 text-ink/50 text-center">No data yet.</td></tr>
              )}
              {data.rollup.map((row) => (
                <tr key={row.network} className="border-b border-border/40">
                  <td className="py-2 pr-4"><NetworkLabel network={row.network} /></td>
                  <td className="py-2 pr-4 text-right tabular-nums">{row.clicks.toLocaleString()}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{row.earnings.toFixed(2)}</td>
                  <td className="py-2 text-right tabular-nums text-moss">{row.epc.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Earnings entry */}
      <section className="mb-12">
        <h2 className="font-serif text-2xl text-forest mb-4">Log a payout</h2>
        <form onSubmit={submitEarnings} className="grid grid-cols-2 sm:grid-cols-6 gap-3 items-end" data-testid="revenue-earnings-form">
          <label className="col-span-2 sm:col-span-2 text-sm">
            <span className="block text-ink/70 mb-1">Network</span>
            <select
              value={form.network}
              onChange={(e) => setForm({ ...form, network: e.target.value })}
              className="w-full border border-border rounded px-2 py-1.5"
            >
              <option value="amazon-uk">Amazon UK (direct)</option>
              <option value="amazon-us">Amazon US (direct)</option>
              <option value="sovrn">Sovrn (aggregate)</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-ink/70 mb-1">Amount</span>
            <input
              type="number" step="0.01" min="0" required
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="w-full border border-border rounded px-2 py-1.5"
              data-testid="revenue-amount-input"
            />
          </label>
          <label className="text-sm">
            <span className="block text-ink/70 mb-1">Cur.</span>
            <select
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="w-full border border-border rounded px-2 py-1.5"
            >
              <option>GBP</option><option>USD</option><option>EUR</option>
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-ink/70 mb-1">Period start</span>
            <input
              type="date" required
              value={form.period_start}
              onChange={(e) => setForm({ ...form, period_start: e.target.value })}
              className="w-full border border-border rounded px-2 py-1.5"
            />
          </label>
          <label className="text-sm">
            <span className="block text-ink/70 mb-1">Period end</span>
            <input
              type="date" required
              value={form.period_end}
              onChange={(e) => setForm({ ...form, period_end: e.target.value })}
              className="w-full border border-border rounded px-2 py-1.5"
            />
          </label>
          <label className="col-span-2 sm:col-span-5 text-sm">
            <span className="block text-ink/70 mb-1">Note (optional)</span>
            <input
              type="text" maxLength={200}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              className="w-full border border-border rounded px-2 py-1.5"
              placeholder="e.g. ‘Q1 Amazon Associates payout’"
            />
          </label>
          <button type="submit" disabled={saving} className="btn-primary col-span-2 sm:col-span-1" data-testid="revenue-save-btn">
            {saving ? "Saving…" : "Save"}
          </button>
        </form>
      </section>

      {/* Earnings ledger */}
      <section className="mb-12">
        <h2 className="font-serif text-2xl text-forest mb-4">Earnings ledger</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="revenue-ledger-table">
            <thead className="text-left text-ink/60 border-b border-border">
              <tr>
                <th className="py-2 pr-4">Period</th>
                <th className="py-2 pr-4">Network</th>
                <th className="py-2 pr-4 text-right">Amount</th>
                <th className="py-2 pr-4">Note</th>
                <th className="py-2"></th>
              </tr>
            </thead>
            <tbody>
              {data.ledger.length === 0 && (
                <tr><td colSpan={5} className="py-6 text-ink/50 text-center">No payouts logged yet.</td></tr>
              )}
              {data.ledger.map((row) => (
                <tr key={row.id} className="border-b border-border/40">
                  <td className="py-2 pr-4 text-ink/70">{row.period_start} → {row.period_end}</td>
                  <td className="py-2 pr-4"><NetworkLabel network={row.network} /></td>
                  <td className="py-2 pr-4 text-right tabular-nums">{Number(row.amount).toFixed(2)} {row.currency}</td>
                  <td className="py-2 pr-4 text-ink/60">{row.note || "—"}</td>
                  <td className="py-2 text-right">
                    <button onClick={() => removeEarnings(row.id)} className="text-terracotta hover:text-forest" data-testid={`revenue-delete-${row.id}`}>
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Click breakdown */}
      <section className="mb-8">
        <h2 className="font-serif text-2xl text-forest mb-4">Click breakdown (by vendor)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" data-testid="revenue-clicks-table">
            <thead className="text-left text-ink/60 border-b border-border">
              <tr>
                <th className="py-2 pr-4">Vendor</th>
                <th className="py-2 text-right">Clicks</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(data.clicks_by_vendor || {})
                .sort(([, a], [, b]) => b - a)
                .map(([vendor, count]) => (
                  <tr key={vendor} className="border-b border-border/40">
                    <td className="py-2 pr-4">{vendor}</td>
                    <td className="py-2 text-right tabular-nums">{count.toLocaleString()}</td>
                  </tr>
                ))}
              {Object.keys(data.clicks_by_vendor || {}).length === 0 && (
                <tr><td colSpan={2} className="py-6 text-ink/50 text-center">No clicks tracked in window.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="text-sm text-moss flex gap-4">
        <a className="link inline-flex items-center gap-1" href="https://affiliate-program.amazon.co.uk/home/reports" target="_blank" rel="noreferrer">
          Amazon UK report <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <a className="link inline-flex items-center gap-1" href="https://affiliate-program.amazon.com/home/reports" target="_blank" rel="noreferrer">
          Amazon US report <ExternalLink className="w-3.5 h-3.5" />
        </a>
        <a className="link inline-flex items-center gap-1" href="https://platform.sovrn.com/reports" target="_blank" rel="noreferrer">
          Sovrn report <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>
    </div>
  );
}

function ProfitFigure({ label, value, subtitle, tone = "neutral", large = false }) {
  const toneCls = {
    positive: "text-forest",
    "positive-strong": "text-forest font-semibold",
    negative: "text-terracotta/85",
    "negative-strong": "text-terracotta font-semibold",
    neutral: "text-ink",
  }[tone] || "text-ink";
  // Show explicit minus sign for negative-tone rows even if the upstream
  // value was already negative (avoids "--0.73" rendering).
  const abs = Math.abs(value);
  const prefix = value < 0 ? "−" : "";
  const Icon = tone === "negative" || tone === "negative-strong" ? TrendingDown : TrendingUp;
  return (
    <div
      className="flex flex-col"
      data-testid={`profit-fig-${label.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <div className="flex items-center gap-1.5 text-xs text-ink/55 uppercase tracking-wider">
        <Icon strokeWidth={1.6} className="w-3 h-3" />
        {label}
      </div>
      <div className={`tabular-nums ${large ? "text-3xl font-serif" : "text-xl"} ${toneCls} mt-1`}>
        {prefix}£{abs.toFixed(2)}
      </div>
      {subtitle && (
        <div className="text-[11px] text-ink/50 mt-0.5 leading-snug">{subtitle}</div>
      )}
    </div>
  );
}
