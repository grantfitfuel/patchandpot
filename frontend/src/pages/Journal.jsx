/**
 * /journal — Nàdar Journal with pinning + plant tagging.
 *
 * Members-only. Pulls every session + message the user has ever had
 * with Nàdar. Overlay of per-entry metadata (pin + tag) is fetched
 * separately from /api/ask/journal/meta and merged in.
 *
 * Pins float to the top. Client-side search across question + answer.
 * Tag is a free-form string; frontend surfaces My-Garden plant names
 * as suggestions in a native <datalist>.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Calendar, MessageCircle, Search, X, Sparkles, ArrowRight, Pin, PinOff, Tag } from "lucide-react";
import axios from "axios";
import { API } from "@/lib/api";
import { useI18n } from "@/i18n";
import { usePaywall, getStoredAccessToken } from "@/hooks/usePaywall";
import { useMyGarden } from "@/hooks/useMyGarden";
import NadarSurfacesNav from "@/components/NadarSurfacesNav";

export default function JournalPage() {
  const { t } = useI18n();
  const { paid } = usePaywall();
  const { plants: gardenPlants } = useMyGarden();
  const [entries, setEntries] = useState([]); // [{date, question, answer, session_id, id}]
  const [meta, setMeta] = useState({});       // { [user_message_id]: {pinned, tag} }
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [tagFilter, setTagFilter] = useState("");

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = "Nàdar Journal — Patch & Pot";
    ensureMeta("description",
      "Every question you've asked Nàdar, with the date and full answer — a personal gardening notebook that lives with you across seasons.");
  }, []);

  useEffect(() => {
    if (!paid) { setLoading(false); return; }
    const token = getStoredAccessToken();
    if (!token) { setLoading(false); return; }

    (async () => {
      try {
        const [sessRes, metaRes] = await Promise.all([
          axios.get(`${API}/ask/sessions`),
          axios.get(`${API}/ask/journal/meta`)
            .catch(() => ({ data: { meta: [] } })),
        ]);
        const sessions = sessRes.data || [];
        const metaRows = metaRes.data?.meta || [];
        const metaMap = {};
        for (const m of metaRows) {
          metaMap[m.user_message_id] = { pinned: !!m.pinned, tag: m.tag || "" };
        }
        setMeta(metaMap);
        const all = [];
        await Promise.all(sessions.map(async (s) => {
          try {
            const msgRes = await axios.get(`${API}/ask/sessions/${s.id}/messages`);
            const msgs = msgRes.data || [];
            for (let i = 0; i < msgs.length; i += 1) {
              const m = msgs[i];
              if (m.role !== "user") continue;
              const answer = msgs[i + 1]?.role === "assistant" ? msgs[i + 1].content : "";
              all.push({
                id: m.id,
                session_id: s.id,
                session_title: s.title || "",
                date: m.created_at,
                question: m.content || "",
                answer,
              });
            }
          } catch (_e) { /* skip broken sessions */ }
        }));
        all.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
        setEntries(all);
      } catch (_e) {
        setEntries([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [paid]);

  const updateMeta = useCallback(async (entry, patch) => {
    const token = getStoredAccessToken();
    if (!token) return;
    // Optimistic UI so the user sees the change instantly.
    setMeta((m) => ({
      ...m,
      [entry.id]: { ...(m[entry.id] || {}), ...patch },
    }));
    try {
      await axios.post(`${API}/ask/journal/meta`, {
        user_message_id: entry.id,
        session_id: entry.session_id,
        ...patch,
      });
    } catch (_e) {
      // Roll back on failure — not fatal, but keeps state honest.
      setMeta((m) => {
        const copy = { ...m };
        delete copy[entry.id];
        return copy;
      });
    }
  }, []);

  const togglePin = (entry) => {
    const cur = meta[entry.id]?.pinned || false;
    updateMeta(entry, { pinned: !cur });
  };

  const setTag = (entry, tag) => {
    updateMeta(entry, { tag });
  };

  const allTags = useMemo(() => {
    const s = new Set();
    Object.values(meta).forEach((m) => { if (m.tag) s.add(m.tag); });
    gardenPlants.forEach((p) => { if (p.name) s.add(p.name); });
    return [...s].sort();
  }, [meta, gardenPlants]);

  const filtered = useMemo(() => {
    let rows = entries;
    if (tagFilter) {
      rows = rows.filter((e) => (meta[e.id]?.tag || "") === tagFilter);
    }
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      rows = rows.filter((e) =>
        (e.question || "").toLowerCase().includes(q) ||
        (e.answer || "").toLowerCase().includes(q) ||
        (meta[e.id]?.tag || "").toLowerCase().includes(q)
      );
    }
    // Pinned first (stable within group).
    return [...rows].sort((a, b) => {
      const pa = meta[a.id]?.pinned ? 1 : 0;
      const pb = meta[b.id]?.pinned ? 1 : 0;
      if (pa !== pb) return pb - pa;
      return 0;
    });
  }, [entries, query, meta, tagFilter]);

  if (!paid) {
    return (
      <div className="container-narrow py-16 max-w-2xl text-center animate-fade-up">
        <BookOpen strokeWidth={1.2} className="w-10 h-10 text-terracotta mx-auto mb-4" />
        <p className="overline">{t("journal.eyebrow")}</p>
        <h1 className="font-serif text-4xl text-forest mt-3 mb-4">{t("journal.title")}</h1>
        <p className="text-ink/75 mb-6 leading-relaxed">{t("journal.paywall_blurb")}</p>
        <a href="/#pricing" className="btn-primary" data-testid="journal-paywall-cta">
          {t("journal.paywall_cta")}
        </a>
      </div>
    );
  }

  const pinnedCount = Object.values(meta).filter((m) => m.pinned).length;

  return (
    <div className="container-narrow py-12 md:py-16 max-w-3xl animate-fade-up">
      <NadarSurfacesNav active="journal" />
      <div className="mb-8">
        <p className="overline">{t("journal.eyebrow")}</p>
        <h1 className="font-serif text-5xl md:text-6xl text-forest mt-3 tracking-tight">{t("journal.title")}</h1>
        <p className="mt-4 text-ink/75 leading-relaxed max-w-2xl">{t("journal.intro")}</p>
        {pinnedCount > 0 && (
          <p className="mt-3 text-xs text-moss inline-flex items-center gap-1.5" data-testid="journal-pinned-count">
            <Pin strokeWidth={1.5} className="w-3.5 h-3.5 text-terracotta" fill="currentColor" />
            {t("journal.pinned_count").replace("{n}", pinnedCount)}
          </p>
        )}
      </div>

      <datalist id="journal-tag-suggestions">
        {allTags.map((t) => <option key={t} value={t} />)}
      </datalist>

      <div className="mb-8 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-moss" strokeWidth={1.6} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("journal.search_placeholder")}
            data-testid="journal-search"
            className="w-full border border-border/70 rounded pl-9 pr-9 py-2 text-sm focus:outline-none focus:border-forest/50 bg-white"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-moss hover:text-terracotta"
              data-testid="journal-search-clear"
            >
              <X className="w-4 h-4" strokeWidth={1.8} />
            </button>
          )}
        </div>
        {allTags.length > 0 && (
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            data-testid="journal-tag-filter"
            className="border border-border/70 rounded px-2 py-2 text-sm bg-white text-ink"
          >
            <option value="">{t("journal.tag_filter_all")}</option>
            {allTags.map((tg) => <option key={tg} value={tg}>{tg}</option>)}
          </select>
        )}
      </div>

      {loading && <div className="text-sm text-moss">{t("journal.loading")}</div>}
      {!loading && entries.length === 0 && (
        <div className="card-flat p-6 text-sm text-moss max-w-2xl" data-testid="journal-empty">
          {t("journal.empty")}
          <Link to="/ask" className="text-terracotta hover:underline ml-1">{t("journal.empty_link")} →</Link>
        </div>
      )}
      {!loading && entries.length > 0 && filtered.length === 0 && (
        <div className="card-flat p-6 text-sm text-moss max-w-2xl">{t("journal.empty_search")}</div>
      )}

      <div className="space-y-6" data-testid="journal-list">
        {filtered.map((e) => {
          const m = meta[e.id] || {};
          const pinned = !!m.pinned;
          return (
            <article
              key={e.id}
              className={`card-flat p-5 relative ${pinned ? "border-terracotta/40 ring-1 ring-terracotta/10" : ""}`}
              data-testid={`journal-entry-${e.id}`}
            >
              <div className="flex items-center gap-2 mb-3">
                <Calendar strokeWidth={1.6} className="w-3.5 h-3.5 text-moss" />
                <span className="text-[0.65rem] uppercase tracking-widest text-moss/80">
                  {formatDate(e.date)}
                </span>
                {m.tag && (
                  <span className="ml-1 inline-flex items-center gap-1 text-[0.65rem] uppercase tracking-widest text-terracotta bg-terracotta/10 px-1.5 py-0.5" data-testid={`journal-tag-badge-${e.id}`}>
                    <Tag strokeWidth={1.8} className="w-3 h-3" />
                    {m.tag}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => togglePin(e)}
                  data-testid={`journal-pin-${e.id}`}
                  className="ml-auto text-moss hover:text-terracotta transition-colors"
                  aria-label={pinned ? t("journal.unpin") : t("journal.pin")}
                  title={pinned ? t("journal.unpin") : t("journal.pin")}
                >
                  {pinned ? (
                    <Pin strokeWidth={1.6} className="w-4 h-4 text-terracotta" fill="currentColor" />
                  ) : (
                    <PinOff strokeWidth={1.6} className="w-4 h-4" />
                  )}
                </button>
              </div>

              <p className="font-serif text-xl text-forest leading-snug">{e.question}</p>

              {e.answer && (
                <div className="mt-4 flex gap-3">
                  <MessageCircle strokeWidth={1.4} className="w-4 h-4 text-forest flex-shrink-0 mt-1" />
                  <div className="text-sm text-ink/85 leading-relaxed whitespace-pre-wrap flex-1">{e.answer}</div>
                </div>
              )}

              <TagEditor
                entryId={e.id}
                initial={m.tag || ""}
                onSave={(v) => setTag(e, v)}
                t={t}
              />
            </article>
          );
        })}
      </div>

      <section className="mt-16 border-t border-border pt-10">
        <div className="flex items-start gap-4">
          <Sparkles strokeWidth={1.4} className="w-6 h-6 text-terracotta flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h2 className="font-serif text-2xl text-forest tracking-tight mb-2">{t("journal.cta.title")}</h2>
            <p className="text-sm text-moss leading-relaxed mb-4">{t("journal.cta.blurb")}</p>
            <Link to="/ask" className="btn-primary inline-flex items-center gap-2" data-testid="journal-cta-ask">
              {t("journal.cta.button")}
              <ArrowRight className="w-4 h-4" strokeWidth={1.6} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Inline tag editor. Uses a shared <datalist id="journal-tag-suggestions">
 * (rendered once at page level) so users get autocomplete on their own
 * My-Garden plant names + any tag they've used before. Free-text values
 * are also accepted — the datalist is suggestion-only.
 */
function TagEditor({ entryId, initial, onSave, t }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(initial);
  useEffect(() => { setValue(initial); }, [initial]);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        data-testid={`journal-tag-edit-${entryId}`}
        className="mt-4 text-[0.65rem] uppercase tracking-widest text-moss hover:text-terracotta inline-flex items-center gap-1"
      >
        <Tag strokeWidth={1.6} className="w-3 h-3" />
        {initial ? t("journal.tag_edit") : t("journal.tag_add")}
      </button>
    );
  }
  return (
    <form
      className="mt-4 flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave(value.trim());
        setEditing(false);
      }}
    >
      <Tag strokeWidth={1.6} className="w-3.5 h-3.5 text-moss" />
      <input
        type="text"
        autoFocus
        list="journal-tag-suggestions"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("journal.tag_placeholder")}
        data-testid={`journal-tag-input-${entryId}`}
        className="border border-border rounded px-2 py-1 text-xs bg-white focus:outline-none focus:border-forest/50 min-w-[160px]"
      />
      <button
        type="submit"
        data-testid={`journal-tag-save-${entryId}`}
        className="text-[0.65rem] uppercase tracking-widest text-forest hover:text-terracotta"
      >
        {t("journal.tag_save")}
      </button>
      <button
        type="button"
        onClick={() => { setValue(initial); setEditing(false); }}
        className="text-[0.65rem] uppercase tracking-widest text-moss hover:text-terracotta"
      >
        {t("journal.tag_cancel")}
      </button>
    </form>
  );
}

function formatDate(iso) {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }); }
  catch { return iso; }
}
function ensureMeta(name, content) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector(`meta[name="${name}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute("name", name); document.head.appendChild(el); }
  el.setAttribute("content", content);
}
