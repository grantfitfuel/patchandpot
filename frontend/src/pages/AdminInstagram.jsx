import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API } from "@/lib/api";
import { IgSeasonalLibrary } from "@/components/admin/IgSeasonalLibrary";
import { IgPreviewMedia } from "@/components/admin/IgPreviewMedia";
import { IgMusicPanel } from "@/components/admin/IgMusicPanel";

const FORMATS = [
  { id: "CAROUSEL", label: "Mon · Masterclass slideshow" },
  { id: "FEED", label: "Wed · Card Reel" },
  { id: "REEL", label: "Fri · Reel" },
  { id: "SOW", label: "Sat · What to sow" },
];
const FORMAT_LABEL = { REEL: "Reel", CAROUSEL: "Carousel", FEED: "Feed" };

const readJson = async (r) => {
  try {
    return await r.json();
  } catch {
    throw new Error(`The server took too long or hit an error (HTTP ${r.status}). Please try again in a minute.`);
  }
};

/**
 * Instagram admin dashboard.
 * - Lets the operator start the OAuth connect flow.
 * - Shows connection state + the last 20 scheduled/published posts.
 * - "Preview" generates a card + caption without publishing.
 * - "Publish now" triggers the full flow immediately (useful for testing
 *   outside the Mon/Wed/Fri schedule).
 *
 * Admin token: pulled from localStorage key "pp_admin_token" so you
 * don't have to retype it. Set once and it sticks.
 */
export default function AdminInstagram() {
  const [params] = useSearchParams();
  const connectedFlag = params.get("connected") === "1";
  const [token, setToken] = useState(() => localStorage.getItem("pp_admin_token") || "");
  const [status, setStatus] = useState(null);
  const [preview, setPreview] = useState(null);
  const [previewKey, setPreviewKey] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(
    connectedFlag ? "Instagram connected ✓" : params.get("music") === "1" ? "Facebook connected — Reels will now post with music ✓" : "",
  );

  const saveToken = (v) => {
    setToken(v);
    localStorage.setItem("pp_admin_token", v);
  };

  const loadStatus = useCallback(async () => {
    if (!token) return;
    setError("");
    try {
      const r = await fetch(`${API}/instagram/status?token=${encodeURIComponent(token)}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setStatus(await readJson(r));
    } catch (e) {
      setError(e.message);
    }
  }, [token]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const connect = async () => {
    setBusy(true); setError("");
    try {
      const r = await fetch(`${API}/instagram/oauth/start?token=${encodeURIComponent(token)}`);
      const d = await readJson(r);
      if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`);
      window.location.href = d.url;
    } catch (e) {
      setError(e.message); setBusy(false);
    }
  };

  const doPreview = async (fmt) => {
    setBusy(true); setError(""); setPreview(null); setPreviewKey(fmt || null);
    try {
      const q = `token=${encodeURIComponent(token)}`;
      const f = fmt ? `&media_format=${fmt}` : "";
      const r = await fetch(`${API}/instagram/preview?${q}${f}`, { method: "POST" });
      const job = await readJson(r);
      if (!r.ok) throw new Error(job.detail || `HTTP ${r.status}`);
      for (let i = 0; i < 90; i += 1) {
        await new Promise((res) => setTimeout(res, 3000));
        const pr = await fetch(`${API}/instagram/preview/${job.preview_id}?${q}`);
        const d = await readJson(pr);
        if (!pr.ok) throw new Error(d.detail || `HTTP ${pr.status}`);
        if (d.status === "DONE") { setPreview(d.result); return; }
        if (d.status === "ERROR") throw new Error(d.error || "Preview failed");
      }
      throw new Error("Preview is taking unusually long — please try again.");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const publishLabel = FORMATS.find((f) => f.id === previewKey)?.label;

  const publishNow = async () => {
    if (!window.confirm(`Publish ${publishLabel ? `the ${publishLabel}` : "today's post"} to Instagram right now?`)) return;
    setBusy(true); setError("");
    try {
      const f = previewKey ? `&media_format=${previewKey}` : "";
      const r = await fetch(`${API}/instagram/publish-now?token=${encodeURIComponent(token)}${f}`, { method: "POST" });
      const d = await readJson(r);
      if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`);
      setFlash(`Queued (run ${d.run_id}). Status updates below automatically — Reels take 1–3 minutes.`);
      [8000, 40000, 90000, 180000].forEach((ms) => setTimeout(loadStatus, ms));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container-narrow py-10 max-w-5xl animate-fade-up" data-testid="admin-ig-page">
      <p className="overline">Admin</p>
      <h1 className="font-serif text-4xl md:text-5xl text-forest mt-3 tracking-tight">
        Instagram publisher
      </h1>
      <p className="mt-3 text-ink/75 max-w-2xl">
        Automated 4x/week posting at 09:00 UK, every post as a Reel so it can
        carry Instagram-library music: Monday masterclass slideshow, Wednesday
        8s seasonal card, Friday 12s masterclass Reel, Saturday "What to sow"
        slideshow from the planting calendar.
      </p>

      {/* Admin token */}
      <div className="mt-8 bg-surface border border-border p-4" style={{ borderRadius: "12px" }}>
        <label className="text-sm text-ink/75 block mb-2">Admin token</label>
        <input
          type="password"
          value={token}
          onChange={(e) => saveToken(e.target.value)}
          placeholder="ppa_…"
          data-testid="admin-ig-token"
          className="w-full px-3 py-2 bg-sand border border-border rounded font-mono text-sm"
        />
      </div>

      {flash && <div className="mt-4 bg-forest text-sand px-4 py-3 rounded">{flash}</div>}
      {error && <div className="mt-4 bg-terracotta text-sand px-4 py-3 rounded" data-testid="admin-ig-error">{error}</div>}

      {/* Connection state */}
      <section className="mt-8">
        <h2 className="font-serif text-2xl text-forest mb-3">Connection</h2>
        {status?.connected ? (
          <div className="bg-moss text-sand p-5" style={{ borderRadius: "16px" }}>
            <p className="text-sm">
              Connected · <strong>{status.page_name}</strong> · IG user ID <code>{status.ig_user_id}</code>
            </p>
            <button
              onClick={connect}
              disabled={!token || busy}
              data-testid="admin-ig-reconnect"
              className="mt-3 text-xs text-sand/85 underline"
            >
              Re-connect / switch account
            </button>
          </div>
        ) : (
          <div className="bg-sand border border-border p-5" style={{ borderRadius: "16px" }}>
            <p className="text-ink/80 text-sm mb-4">Not connected. Sign in with your Instagram professional account once — the app keeps the connection refreshed automatically.</p>
            <button
              onClick={connect}
              disabled={!token || busy}
              data-testid="admin-ig-connect"
              className="btn-terracotta inline-flex items-center gap-2 disabled:opacity-50"
            >
              Connect Instagram
            </button>
          </div>
        )}
      </section>

      <IgMusicPanel token={token} status={status} onChange={loadStatus} />

      {/* Preview + publish-now */}
      <section className="mt-8">
        <h2 className="font-serif text-2xl text-forest mb-3">Dry-run / Publish now</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => doPreview()}
            disabled={!token || busy}
            data-testid="admin-ig-preview"
            className="btn-ghost disabled:opacity-50"
          >
            {busy ? "Composing…" : "Preview today's post"}
          </button>
          {FORMATS.map((f) => (
            <button
              key={f.id}
              onClick={() => doPreview(f.id)}
              disabled={!token || busy}
              data-testid={`admin-ig-preview-${f.id.toLowerCase()}`}
              className="btn-ghost disabled:opacity-50"
            >
              Preview {f.label}
            </button>
          ))}
          <button
            onClick={publishNow}
            disabled={!token || busy || !status?.connected}
            data-testid="admin-ig-publish-now"
            className="btn-terracotta disabled:opacity-50"
          >
            {publishLabel ? `Publish ${publishLabel}` : "Publish now"}
          </button>
        </div>
        {preview && (
          <div className="mt-6 grid md:grid-cols-2 gap-6 bg-surface border border-border p-5" style={{ borderRadius: "16px" }}>
            <IgPreviewMedia key={preview.media_b64.slice(-32)} preview={preview} />
            <div>
              <p className="overline">Caption</p>
              <pre className="mt-2 whitespace-pre-wrap text-sm text-ink/85 font-sans">{preview.caption}</pre>
              <p className="mt-4 text-xs text-moss">
                {FORMAT_LABEL[preview.media_format]} · {preview.content.slug} · {preview.content.season} · {Math.round(preview.media_bytes / 1024)}KB
              </p>
            </div>
          </div>
        )}
      </section>

      <IgSeasonalLibrary token={token} />

      {/* Recent posts */}
      <section className="mt-10">
        <h2 className="font-serif text-2xl text-forest mb-3">Recent posts</h2>
        {!status?.posts?.length && <p className="text-moss text-sm">No posts yet.</p>}
        <ul className="space-y-2" data-testid="admin-ig-posts">
          {(status?.posts || []).map((p) => (
            <li key={p.run_id} className="bg-surface border border-border p-4 rounded flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs text-moss">{p.created_at} · {FORMATS.find((f) => f.id === p.slot)?.label || FORMAT_LABEL[p.media_format] || "Feed"}{p.season ? ` · ${p.season}` : ""}</p>
                {p.music && <p className="text-xs text-moss" data-testid="admin-ig-post-music">Music: {p.music.title}{p.music.artist ? ` by ${p.music.artist}` : ""}</p>}
                {p.music_error && <p className="text-xs text-terracotta">Music failed, posted silently: {p.music_error}</p>}
                <p className="font-serif text-forest">{p.eyebrow} — {p.title}</p>
                {p.error && <p className="text-xs text-terracotta mt-1">{p.error}</p>}
              </div>
              <div className="text-xs text-right">
                <span className={`px-2 py-1 rounded ${
                  p.status === "PUBLISHED" ? "bg-forest text-sand" :
                  p.status === "ERROR" ? "bg-terracotta text-sand" :
                  "bg-sand text-forest border border-border"
                }`}>{p.status}</span>
                {p.media_id && (
                  <a
                    href={`https://www.instagram.com/p/${p.media_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block mt-1 text-terracotta hover:underline"
                  >
                    View on Instagram
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
