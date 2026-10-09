import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { API } from "@/lib/api";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [flash, setFlash] = useState(connectedFlag ? "Instagram connected ✓" : "");

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
      setStatus(await r.json());
    } catch (e) {
      setError(e.message);
    }
  }, [token]);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const connect = async () => {
    setBusy(true); setError("");
    try {
      const r = await fetch(`${API}/instagram/oauth/start?token=${encodeURIComponent(token)}`);
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`);
      window.location.href = d.url;
    } catch (e) {
      setError(e.message); setBusy(false);
    }
  };

  const doPreview = async () => {
    setBusy(true); setError(""); setPreview(null);
    try {
      const r = await fetch(`${API}/instagram/preview?token=${encodeURIComponent(token)}`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`);
      setPreview(d);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const publishNow = async () => {
    if (!window.confirm("Publish a post to Instagram right now?")) return;
    setBusy(true); setError("");
    try {
      const r = await fetch(`${API}/instagram/publish-now?token=${encodeURIComponent(token)}`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`);
      setFlash(`Queued (run ${d.run_id}). Refresh in ~30s to see status.`);
      setTimeout(loadStatus, 8000);
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
        Automated 3x/week posting (Mon/Wed/Fri 09:00 UK). Alternates between
        a seasonal highlight and a masterclass teaser, with an AI-written
        caption and a composed 1080×1080 brand card.
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
            <p className="text-ink/80 text-sm mb-4">Not connected. One-time OAuth gets us a long-lived Page access token.</p>
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

      {/* Preview + publish-now */}
      <section className="mt-8">
        <h2 className="font-serif text-2xl text-forest mb-3">Dry-run / Publish now</h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={doPreview}
            disabled={!token || busy}
            data-testid="admin-ig-preview"
            className="btn-ghost disabled:opacity-50"
          >
            Preview today's post
          </button>
          <button
            onClick={publishNow}
            disabled={!token || busy || !status?.connected}
            data-testid="admin-ig-publish-now"
            className="btn-terracotta disabled:opacity-50"
          >
            Publish now
          </button>
        </div>
        {preview && (
          <div className="mt-6 grid md:grid-cols-2 gap-6 bg-surface border border-border p-5" style={{ borderRadius: "16px" }}>
            <img src={preview.image_b64} alt="Preview card" className="w-full aspect-square object-cover rounded" />
            <div>
              <p className="overline">Caption</p>
              <pre className="mt-2 whitespace-pre-wrap text-sm text-ink/85 font-sans">{preview.caption}</pre>
              <p className="mt-4 text-xs text-moss">Kind: {preview.content.kind || preview.content.slug} · Variant: {preview.content.variant} · {Math.round(preview.image_bytes / 1024)}KB</p>
            </div>
          </div>
        )}
      </section>

      {/* Recent posts */}
      <section className="mt-10">
        <h2 className="font-serif text-2xl text-forest mb-3">Recent posts</h2>
        {!status?.posts?.length && <p className="text-moss text-sm">No posts yet.</p>}
        <ul className="space-y-2" data-testid="admin-ig-posts">
          {(status?.posts || []).map((p) => (
            <li key={p.run_id} className="bg-surface border border-border p-4 rounded flex items-start justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs text-moss">{p.created_at}</p>
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
