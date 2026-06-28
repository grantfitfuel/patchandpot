import { useEffect, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Send, Image as ImageIcon, Plus, Trash2, Loader2, X } from "lucide-react";
import { usePaywall, getStoredAccessToken } from "@/hooks/usePaywall";

/**
 * Ask the Garden — threaded, paywalled AI Q&A.
 *
 * Lives at /ask. Members only (gated by access_token). Hard cap of 10
 * user messages per UTC day per token. Supports image upload (≤5 MB)
 * for plant ID, leaf disease, pest spotting etc.
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
  const [usage, setUsage] = useState({ used: 0, cap: 10, remaining: 10 });
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
      const r = await fetch(`${backend}/api/ask/usage?access_token=${encodeURIComponent(accessToken)}`);
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

  useEffect(() => {
    fetchMessages(activeId);
  }, [activeId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Image picker ────────────────────────────────────────────────
  const onPickImage = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { setError("Image too large — max 5 MB."); return; }
    setImageFile(f);
    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result);
    reader.readAsDataURL(f);
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

  // ── Paywall gate ────────────────────────────────────────────────
  if (!isPaying) {
    return (
      <div className="container-narrow py-14 max-w-xl text-center" data-testid="ask-paywall">
        <Helmet><title>Ask the Garden · Patch & Pot</title></Helmet>
        <p className="overline">Members</p>
        <h1 className="font-serif text-4xl text-forest mt-2 mb-4">Ask the Garden</h1>
        <p className="text-ink/80 mb-6">
          A friendly, knowledgeable AI gardener — answers questions on edibles, cut flowers,
          pests, pruning, soil, and propagation. Upload a photo to identify a plant or diagnose a problem.
        </p>
        <p className="text-ink/70 text-sm mb-6">
          Members can ask up to 10 questions per day, with photo support and threaded follow-ups.
        </p>
        <a href="/#pricing" className="btn-primary" data-testid="ask-paywall-cta">
          Become a member
        </a>
      </div>
    );
  }

  return (
    <div className="container-narrow py-8 max-w-5xl" data-testid="ask-page">
      <Helmet><title>Ask the Garden · Patch & Pot</title></Helmet>
      <p className="overline">Members</p>
      <div className="flex items-baseline justify-between mt-2 mb-4">
        <h1 className="font-serif text-3xl text-forest">Ask the Garden</h1>
        <span className="text-sm text-moss tabular-nums" data-testid="ask-usage-counter">
          {usage.remaining} / {usage.cap} left today
        </span>
      </div>

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
                <p>Ask anything garden-related. A few starters:</p>
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
              placeholder={usage.remaining === 0 ? "Daily limit reached — back tomorrow." : "Ask anything garden-related…"}
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
