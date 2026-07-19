import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Send, Image as ImageIcon, Plus, Trash2, Loader2, X, ArrowRight } from "lucide-react";
import { usePaywall, getStoredAccessToken } from "@/hooks/usePaywall";

/**
 * Downscale and re-encode an image File so it slips under Claude vision's
 * 5 MB ceiling without the user noticing. Keeps aspect ratio; uses
 * `createImageBitmap` (handles EXIF orientation natively) and a canvas
 * to render at the new size. Returns a new JPEG File.
 */
async function compressImage(file, { maxEdge = 1600, quality = 0.82, maxBytes = 4.5 * 1024 * 1024 } = {}) {
  if (file.size <= maxBytes && file.type === "image/jpeg") {
    // Already small JPEG — no work needed.
    return file;
  }
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const { width: w0, height: h0 } = bitmap;
  const scale = Math.min(1, maxEdge / Math.max(w0, h0));
  const w = Math.round(w0 * scale);
  const h = Math.round(h0 * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  // Recompress, dropping quality further if still too big.
  let q = quality;
  let blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", q));
  while (blob && blob.size > maxBytes && q > 0.4) {
    q -= 0.1;
    blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", q));
  }
  if (!blob) throw new Error("toBlob returned null");
  const name = (file.name || "photo").replace(/\.[a-z0-9]+$/i, "") + ".jpg";
  return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
}

/**
 * Ask Nàdar — threaded, paywalled AI Q&A.
 *
 * Lives at /ask. Members only (gated by access_token). Hard cap of 7
 * user messages per UTC day per token. Supports image upload (any size —
 * we downscale + recompress to fit Claude vision's ~5 MB ceiling client-side
 * so the user never sees the limit) for plant ID, leaf disease, pest
 * spotting etc.
 *
 * Layout: left sidebar with session history, right pane is the active
 * conversation. Mobile collapses the sidebar into a top dropdown.
 */
export default function AskPage() {
  const { paid: isPaying } = usePaywall();
  const accessToken = getStoredAccessToken() || "";
  const backend = process.env.REACT_APP_BACKEND_URL || "";

  const [sessions, setSessions] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [usage, setUsage] = useState({ used: 0, cap: 7, remaining: 7 });
  const [audit, setAudit] = useState(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [text, setText] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  // ── Data fetchers ───────────────────────────────────────────────
  const fetchSessions = async () => {
    if (!accessToken) return;
    try {
      const r = await fetch(`${backend}/api/ask/sessions?access_token=${encodeURIComponent(accessToken)}`);
      if (r.ok) setSessions(await r.json());
    } catch {/* noop */}
  };

  const fetchUsage = async () => {
    if (!accessToken) return;
    try {
      // Force-bypass any intermediate cache (browser HTTP, service worker)
      // because this is a per-user counter that MUST be fresh every load.
      const r = await fetch(
        `${backend}/api/ask/usage?access_token=${encodeURIComponent(accessToken)}&_=${Date.now()}`,
        { cache: "no-store" }
      );
      if (r.ok) setUsage(await r.json());
    } catch {/* noop */}
  };

  const fetchMessages = async (sid) => {
    if (!accessToken || !sid) { setMessages([]); return; }
    try {
      const r = await fetch(`${backend}/api/ask/sessions/${sid}/messages?access_token=${encodeURIComponent(accessToken)}`);
      if (r.ok) setMessages(await r.json());
    } catch {/* noop */}
  };

  useEffect(() => {
    if (accessToken && isPaying) {
      fetchSessions();
      fetchUsage();
    }
  }, [accessToken, isPaying]);

  // Refetch the daily counter whenever the tab regains focus or visibility
  // — fixes the case where a user keeps the PWA open across midnight and
  // sees yesterday's count until they manually reload.
  useEffect(() => {
    if (!accessToken || !isPaying) return;
    const refresh = () => { if (document.visibilityState === "visible") fetchUsage(); };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [accessToken, isPaying]);

  useEffect(() => {
    fetchMessages(activeId);
  }, [activeId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Image picker ────────────────────────────────────────────────
  // Phone cameras routinely produce 8-15 MB JPEGs which exceed Claude's
  // 5 MB vision limit. Rather than reject them, downscale + recompress in
  // the browser to a max 1600 px longest edge / ~1.5 MB JPEG before upload.
  // Plant ID needs detail, not megapixels.
  const onPickImage = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError("");
    // Allow up to 30 MB raw; we'll compress it down ourselves.
    if (f.size > 30 * 1024 * 1024) { setError("Image too large — please pick one under 30 MB."); return; }
    try {
      const compressed = await compressImage(f, { maxEdge: 1600, quality: 0.82, maxBytes: 4.5 * 1024 * 1024 });
      setImageFile(compressed);
      const reader = new FileReader();
      reader.onload = () => setImagePreview(reader.result);
      reader.readAsDataURL(compressed);
    } catch (err) {
      console.error("image compression failed", err);
      setError("Couldn't process that image — try a different one.");
    }
  };

  const clearImage = () => { setImageFile(null); setImagePreview(null); };

  // ── Send ─────────────────────────────────────────────────────────
  const onSend = async () => {
    if (sending || (!text.trim() && !imageFile)) return;
    setSending(true);
    setError("");

    // Optimistic add user bubble
    const localId = `local-${Date.now()}`;
    setMessages((m) => [...m, {
      id: localId, role: "user", content: text, has_image: !!imageFile, created_at: new Date().toISOString(),
    }]);

    const fd = new FormData();
    fd.append("access_token", accessToken || "");
    fd.append("message", text);
    if (activeId) fd.append("session_id", activeId);
    if (imageFile) fd.append("image", imageFile);

    try {
      const r = await fetch(`${backend}/api/ask/message`, { method: "POST", body: fd });
      const json = await r.json();
      if (!r.ok) {
        const detail = typeof json?.detail === "string" ? json.detail : `Error ${r.status}`;
        setError(detail);
        setMessages((m) => m.filter((x) => x.id !== localId));
        return;
      }
      setActiveId(json.session_id);
      setUsage(json.usage);
      setText(""); clearImage();
      await fetchMessages(json.session_id);
      await fetchSessions();
    } catch (e) {
      setError(e?.message || "Network error");
      setMessages((m) => m.filter((x) => x.id !== localId));
    } finally {
      setSending(false);
    }
  };

  const onNewSession = () => { setActiveId(null); setMessages([]); setError(""); };

  const onDeleteSession = async (sid) => {
    if (!window.confirm("Delete this conversation?")) return;
    try {
      await fetch(`${backend}/api/ask/sessions/${sid}?access_token=${encodeURIComponent(accessToken)}`, { method: "DELETE" });
      if (sid === activeId) onNewSession();
      await fetchSessions();
    } catch {/* noop */}
  };

  // ── "What counted?" audit drawer ────────────────────────────────
  // Surfaces the raw timestamps + daily-usage rows so the user can verify
  // the counter against what's actually in the DB.
  const onOpenAudit = async () => {
    setAuditOpen(true);
    setAudit(null);
    try {
      const r = await fetch(
        `${backend}/api/ask/audit?access_token=${encodeURIComponent(accessToken)}&_=${Date.now()}`,
        { cache: "no-store" }
      );
      if (r.ok) setAudit(await r.json());
    } catch {/* noop */}
  };

  // ── Paywall gate ────────────────────────────────────────────────
  if (!isPaying) {
    return (
      <div className="container-narrow py-14 max-w-xl text-center" data-testid="ask-paywall">
        <Helmet><title>Ask Nàdar · Patch & Pot</title></Helmet>
        <p className="overline">Members</p>
        <h1 className="font-serif text-4xl text-forest mt-2 mb-2">Ask Nàdar</h1>
        <p className="text-[0.65rem] uppercase tracking-widest text-moss/70 mb-4">
          Nàdar · <em className="not-italic">Nature</em>, in Scottish Gaelic
        </p>
        <p className="text-ink/80 mb-6">
          A patient, knowledgeable garden mentor — Nàdar answers questions on edibles, cut flowers,
          pests, pruning, soil and propagation with the voice of someone who has seen the same
          seasons come round for decades. Upload a photo to identify a plant or diagnose a problem.
        </p>
        <p className="text-ink/70 text-sm mb-6">
          Members can ask Nàdar up to 7 questions per day, with photo support and threaded follow-ups.
        </p>
        <a href="/#pricing" className="btn-primary" data-testid="ask-paywall-cta">
          Become a member
        </a>
        <div className="mt-6 text-sm">
          <Link
            to="/ask/popular"
            className="text-terracotta hover:underline inline-flex items-center gap-1.5"
            data-testid="ask-paywall-popular-link"
          >
            Or browse {" "}
            <span className="underline">common gardening questions</span>{" "}
            people have already asked
            <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.6} />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-narrow py-8 max-w-5xl" data-testid="ask-page">
      <Helmet><title>Ask Nàdar · Patch & Pot</title></Helmet>
      <p className="overline">Members</p>
      <div className="flex items-baseline justify-between mt-2 mb-4">
        <div>
          <h1 className="font-serif text-3xl text-forest">Ask Nàdar</h1>
          <p className="text-[0.65rem] uppercase tracking-widest text-moss/70 mt-1">
            Nàdar · <em className="not-italic">Nature</em>, in Scottish Gaelic
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="ask-audit-btn"
            onClick={onOpenAudit}
            className="text-xs text-moss underline underline-offset-2 hover:text-forest"
          >
            What counted?
          </button>
          <span className="text-sm text-moss tabular-nums" data-testid="ask-usage-counter">
            {usage.remaining} / {usage.cap} left today
          </span>
        </div>
      </div>

      {auditOpen && (
        <div
          data-testid="ask-audit-drawer"
          className="mb-6 border border-border rounded p-4 bg-sand/60 text-sm"
        >
          <div className="flex items-baseline justify-between mb-3">
            <p className="overline">Your question history (last 14 days)</p>
            <button
              type="button"
              onClick={() => setAuditOpen(false)}
              className="text-xs text-moss hover:text-forest"
              data-testid="ask-audit-close"
            >
              Close
            </button>
          </div>
          {!audit ? (
            <p className="text-moss italic">Loading…</p>
          ) : (
            <>
              <p className="text-xs text-moss mb-3">
                The counter today reads against UTC date{" "}
                <span className="font-mono text-ink">{audit.today_key_utc}</span>. Server
                time now is{" "}
                <span className="font-mono text-ink">{audit.now_utc}</span>. Daily
                cap is {audit.cap}.
              </p>

              <button
                type="button"
                data-testid="copy-access-token"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(accessToken);
                    alert("Your access token has been copied to the clipboard.");
                  } catch {
                    // Fallback for older iOS Safari that blocks clipboard API
                    // outside a direct user gesture (rare). Show the token
                    // in a prompt so the user can long-press-copy manually.
                    window.prompt("Your access token (long-press to copy):", accessToken);
                  }
                }}
                className="mb-4 text-xs text-forest underline underline-offset-2 hover:opacity-80"
              >
                Copy my access token
              </button>

              <p className="overline text-[0.6rem] mb-1">Daily-usage rows (what the counter reads)</p>
              {audit.usage_rows?.length ? (
                <ul className="mb-4 font-mono text-xs text-ink/85 space-y-0.5" data-testid="audit-usage-rows">
                  {audit.usage_rows.map((u) => (
                    <li key={u.date}>
                      <span className={u.date === audit.today_key_utc ? "text-terracotta" : ""}>
                        {u.date}
                      </span>{" "}
                      → count={u.count} (updated {u.updated_at || "—"})
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-moss italic mb-4">No usage rows on file.</p>
              )}

              <p className="overline text-[0.6rem] mb-1">Every user-message you&apos;ve sent (newest first)</p>
              {audit.user_messages?.length ? (
                <ul className="space-y-1.5 max-h-[40vh] overflow-y-auto" data-testid="audit-messages">
                  {audit.user_messages.map((m, i) => (
                    <li key={i} className="border-l-2 border-border pl-3">
                      <div className="font-mono text-xs text-moss">{m.created_at}</div>
                      <div className="text-ink/85">
                        <span className="text-moss">{m.session_title}: </span>
                        {m.preview}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-moss italic">No messages on file.</p>
              )}
            </>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
        {/* Sidebar */}
        <aside className="border border-border rounded p-3 bg-surface/40 md:max-h-[70vh] md:overflow-y-auto" data-testid="ask-sidebar">
          <button onClick={onNewSession} className="w-full inline-flex items-center justify-center gap-2 btn-secondary mb-3" data-testid="ask-new-chat-btn">
            <Plus className="w-4 h-4" /> New question
          </button>
          {sessions.length === 0 && <p className="text-xs text-ink/50 px-1">No history yet.</p>}
          <ul className="space-y-1">
            {sessions.map((s) => (
              <li key={s.id} className={`group flex items-center gap-1 rounded px-2 py-1.5 text-sm cursor-pointer hover:bg-surface ${s.id === activeId ? "bg-surface text-forest font-medium" : "text-ink/80"}`}
                  onClick={() => setActiveId(s.id)} data-testid={`ask-session-${s.id}`}>
                <span className="flex-1 truncate">{s.title}</span>
                <button onClick={(e) => { e.stopPropagation(); onDeleteSession(s.id); }}
                        className="opacity-0 group-hover:opacity-100 text-terracotta hover:text-forest"
                        aria-label="Delete">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Conversation */}
        <main className="flex flex-col">
          <div className="flex-1 min-h-[300px] md:max-h-[60vh] md:overflow-y-auto border border-border rounded p-4 bg-white/40" data-testid="ask-messages">
            {messages.length === 0 && (
              <div className="text-ink/50 text-sm space-y-2">
                <p>Ask Nàdar anything garden-related. A few starters:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>Why are my rose leaves turning black?</li>
                  <li>Can I grow dahlias in pots in Scotland?</li>
                  <li>What flowers well with Globemaster alliums?</li>
                  <li>Identify this plant from a photo →</li>
                </ul>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`mb-3 flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-forest text-white" : "bg-surface text-ink"}`} data-testid={`ask-msg-${m.role}`}>
                  {m.has_image && m.role === "user" && (
                    <div className="text-xs opacity-70 mb-1 inline-flex items-center gap-1"><ImageIcon className="w-3 h-3" /> photo attached</div>
                  )}
                  {m.content || (m.role === "user" ? "(image only)" : "")}
                </div>
              </div>
            ))}
            {sending && (
              <div className="text-ink/50 text-sm inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Thinking…</div>
            )}
            <div ref={endRef} />
          </div>

          {/* Composer */}
          {imagePreview && (
            <div className="mt-3 inline-flex items-start gap-2 self-start">
              <img src={imagePreview} alt="" className="w-20 h-20 object-cover rounded border border-border" />
              <button onClick={clearImage} className="text-terracotta hover:text-forest" aria-label="Remove image" data-testid="ask-clear-image">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="mt-3 flex items-end gap-2">
            <label className="cursor-pointer text-moss hover:text-forest p-2 border border-border rounded" data-testid="ask-image-btn">
              <ImageIcon className="w-5 h-5" />
              <input type="file" accept="image/*" onChange={onPickImage} className="hidden" />
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); onSend(); }
              }}
              rows={2}
              maxLength={4000}
              placeholder={usage.remaining === 0 ? "Daily limit reached — back tomorrow." : "Ask Nàdar anything garden-related…"}
              className="flex-1 border border-border rounded px-3 py-2 text-sm resize-none focus:outline-none focus:border-forest"
              disabled={sending || usage.remaining === 0}
              data-testid="ask-input"
            />
            <button onClick={onSend} disabled={sending || usage.remaining === 0 || (!text.trim() && !imageFile)} className="btn-primary inline-flex items-center gap-1" data-testid="ask-send-btn">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Ask
            </button>
          </div>

          {error && <p className="text-terracotta text-sm mt-2" data-testid="ask-error">{error}</p>}
        </main>
      </div>
    </div>
  );
}
