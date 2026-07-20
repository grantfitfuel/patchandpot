/**
 * /admin/calm — author + render management for the 12 Calm variants.
 *
 * Two-step workflow per row:
 *   1. Author script (cheap, ~5s Claude call) — creates or overwrites
 *      the blocks + transcript for a month.
 *   2. Render audio (~20-40s ElevenLabs call) — stitches all blocks
 *      into a single MP3 stored on disk.
 *
 * Each row shows the current state (no script / scripted / rendered),
 * duration if rendered, and the two action buttons.
 */
import { useCallback, useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { CheckCircle2, Loader2, RefreshCw, PenLine, Volume2, LogOut, AlertTriangle, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import AdminTokenGate, { useAdminToken } from "@/components/AdminTokenGate";

const MONTH_NAMES = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export default function AdminCalmPage() {
  const { token, signIn, signOut } = useAdminToken();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState({}); // {slug: 'author'|'render'}

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      // SEC-002: X-Admin-Token header attached via axios interceptor.
      const r = await api.get("/admin/calm/list");
      setItems(r.data?.items || []);
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const authorMonth = async (month) => {
    setBusy((b) => ({ ...b, [`m${month}`]: "author" }));
    try {
      await api.post("/admin/calm/author", null, {
        params: { month, hemisphere: "nh", force_reauthor: true },
      });
      await load();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    } finally {
      setBusy((b) => { const c = { ...b }; delete c[`m${month}`]; return c; });
    }
  };

  const renderSlug = async (slug) => {
    setBusy((b) => ({ ...b, [slug]: "render" }));
    try {
      await api.post("/admin/calm/render", null, {
        params: { slug },
      });
      await load();
    } catch (e) {
      setError(e?.response?.data?.detail || e.message);
    } finally {
      setBusy((b) => { const c = { ...b }; delete c[slug]; return c; });
    }
  };

  if (!token) {
    return (
      <AdminTokenGate
        title="2-Minute Calm — admin"
        blurb="Sign in to author scripts and render audio for the monthly Calm rotation."
        onSubmit={signIn}
        testIdPrefix="calm-admin"
      />
    );
  }

  const bySlug = {};
  for (const it of items) bySlug[it.slug] = it;

  return (
    <div className="container-narrow py-10 max-w-4xl" data-testid="admin-calm-page">
      <Helmet>
        <title>2-Minute Calm · Admin · Patch & Pot</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div className="flex items-baseline justify-between mb-8">
        <div>
          <p className="overline inline-flex items-center gap-1.5">
            <ShieldCheck strokeWidth={1.4} className="w-3.5 h-3.5 text-terracotta" />
            Admin · Calm
          </p>
          <h1 className="font-serif text-4xl md:text-5xl text-forest mt-2 tracking-tight">
            2-Minute Calm — content
          </h1>
          <p className="text-sm text-moss mt-2 max-w-2xl leading-relaxed">
            Author (Claude Sonnet) then render (ElevenLabs) each monthly
            variant. Renders take ~20-40 seconds — don&apos;t navigate away.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            disabled={loading}
            data-testid="calm-admin-reload"
            className="text-xs uppercase tracking-wider text-moss hover:text-forest inline-flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw strokeWidth={1.5} className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            Reload
          </button>
          <button
            onClick={signOut}
            className="text-xs uppercase tracking-wider text-moss hover:text-forest inline-flex items-center gap-1"
            data-testid="calm-admin-signout"
          >
            <LogOut strokeWidth={1.5} className="w-3.5 h-3.5" />
            Sign out
          </button>
        </div>
      </div>

      {error && (
        <div className="card-flat p-4 mb-6 border-terracotta/40" data-testid="calm-admin-error">
          <div className="flex gap-2 text-sm text-terracotta">
            <AlertTriangle strokeWidth={1.5} className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {typeof error === "string" ? error : JSON.stringify(error)}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {MONTH_NAMES.map((name, idx) => {
          const month = idx + 1;
          const slug = `${name}-nh`;
          const row = bySlug[slug];
          const scripted = !!row;
          const rendered = !!row?.audio_generated;
          const authoring = busy[`m${month}`] === "author";
          const renderingNow = busy[slug] === "render";
          return (
            <div
              key={slug}
              data-testid={`calm-admin-row-${slug}`}
              className="card-flat p-4"
            >
              <div className="flex items-baseline justify-between mb-2">
                <div>
                  <p className="text-[0.65rem] uppercase tracking-widest text-moss">
                    {String(month).padStart(2, "0")} · {row?.season_label || "—"}
                  </p>
                  <h3 className="font-serif text-xl text-forest leading-snug capitalize">
                    {row?.title || name}
                  </h3>
                </div>
                <div className="text-right">
                  {rendered && (
                    <span className="inline-flex items-center gap-1 text-[0.65rem] uppercase tracking-widest text-forest" data-testid={`calm-status-rendered-${slug}`}>
                      <CheckCircle2 strokeWidth={1.6} className="w-3.5 h-3.5" />
                      {formatDuration(row.duration_s)}
                    </span>
                  )}
                  {scripted && !rendered && (
                    <span className="text-[0.65rem] uppercase tracking-widest text-moss">Scripted</span>
                  )}
                  {!scripted && (
                    <span className="text-[0.65rem] uppercase tracking-widest text-moss/60">Empty</span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  type="button"
                  disabled={authoring || renderingNow}
                  onClick={() => authorMonth(month)}
                  data-testid={`calm-author-${slug}`}
                  className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 border border-border hover:border-forest/50 disabled:opacity-50"
                >
                  {authoring ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.6} /> : <PenLine className="w-3.5 h-3.5" strokeWidth={1.6} />}
                  {scripted ? "Re-author" : "Author script"}
                </button>
                <button
                  type="button"
                  disabled={!scripted || authoring || renderingNow}
                  onClick={() => renderSlug(slug)}
                  data-testid={`calm-render-${slug}`}
                  className="text-xs inline-flex items-center gap-1.5 px-3 py-1.5 border border-terracotta/50 text-terracotta hover:bg-terracotta hover:text-cream transition-colors disabled:opacity-50"
                >
                  {renderingNow ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={1.6} /> : <Volume2 className="w-3.5 h-3.5" strokeWidth={1.6} />}
                  {rendered ? "Re-render audio" : "Render audio"}
                </button>
              </div>
              {rendered && (
                <p className="text-[0.6rem] uppercase tracking-widest text-moss/70 mt-2 tabular-nums" data-testid={`calm-size-${slug}`}>
                  {(row.audio_size_bytes / 1024).toFixed(0)}KB · {row.voice_id || "default voice"}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDuration(seconds) {
  if (!seconds && seconds !== 0) return "";
  const s = Math.round(seconds);
  const m = Math.floor(s / 60);
  const r = String(s % 60).padStart(2, "0");
  return `${m}:${r}`;
}
