import { useState } from "react";
import { API } from "@/lib/api";

export const IgMusicPanel = ({ token, status, onChange }) => {
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [err, setErr] = useState("");
  const q = `token=${encodeURIComponent(token)}`;

  const call = async (path, opts) => {
    setBusy(true); setErr("");
    try {
      const r = await fetch(`${API}/instagram/fb/${path}${path.includes("?") ? "&" : "?"}${q}`, opts);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || `HTTP ${r.status}`);
      return d;
    } catch (e) {
      setErr(e.message);
      return null;
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    const d = await call("oauth/start");
    if (d?.url) window.location.href = d.url;
  };
  const test = async () => setResults((await call("music-test"))?.results || null);
  const disconnect = async () => { await call("disconnect", { method: "POST" }); onChange(); };

  if (!status) return null;
  return (
    <section className="mt-8" data-testid="admin-ig-music">
      <h2 className="font-serif text-2xl text-forest mb-1">Reel music</h2>
      <p className="text-sm text-ink/70 mb-3">
        Instagram only lets automated Reels use its music library through a Facebook connection. Without it, Reels post silently.
      </p>
      <div className="bg-sand border border-border p-5" style={{ borderRadius: "16px" }}>
        {status.music_connected ? (
          <>
            <p className="text-sm" data-testid="admin-ig-music-status">
              Music on · via Facebook Page <strong>{status.music_page_name}</strong>. Each post picks a random folky track (upbeat folk, indie folk, folk pop, ukulele, banjo, happy acoustic and more) and never repeats one of the last 30 used.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button onClick={test} disabled={busy} data-testid="admin-ig-music-test" className="btn-ghost disabled:opacity-50">
                {busy ? "Searching…" : "Test music search"}
              </button>
              <button onClick={disconnect} disabled={busy} data-testid="admin-ig-music-disconnect" className="text-xs underline text-ink/70">
                Disconnect
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-sm text-ink/80 mb-3" data-testid="admin-ig-music-status">
              {status.music_configured ? "Not connected." : "Waiting for the Facebook app keys to be added."}
            </p>
            <button
              onClick={connect}
              disabled={busy || !status.music_configured}
              data-testid="admin-ig-music-connect"
              className="btn-terracotta disabled:opacity-50"
            >
              Connect Facebook (for music)
            </button>
          </>
        )}
        {err && <p className="mt-3 text-sm text-terracotta" data-testid="admin-ig-music-error">{err}</p>}
        {results && (
          <ul className="mt-4 space-y-2 text-sm" data-testid="admin-ig-music-results">
            {results.map((r) => (
              <li key={r.query}>
                <strong>{r.query}:</strong>{" "}
                {r.error ? <span className="text-terracotta">{r.error}</span>
                  : r.tracks.length ? r.tracks.map((t) => `${t.title || t.id}${t.artist ? ` — ${t.artist}` : ""}`).join(" · ")
                  : "no tracks found"}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
};
