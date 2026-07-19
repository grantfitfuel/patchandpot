/**
 * /journal — Nàdar Journal.
 *
 * Members-only. Pulls every session + message the user has ever had
 * with Nàdar and lays them out as a chronological garden notebook.
 * All the data already exists in `ask_sessions` + `ask_messages` —
 * this is a new READ view, not new storage.
 *
 * Client-side search across question + answer, sorted newest-first
 * with a "grouped by date" affordance. Each Q&A card shows the
 * question, the date, and the answer in `whitespace-pre-wrap`.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Calendar, MessageCircle, Search, X, Sparkles, ArrowRight } from "lucide-react";
import axios from "axios";
import { API } from "@/lib/api";
import { useI18n } from "@/i18n";
import { usePaywall, getStoredAccessToken } from "@/hooks/usePaywall";

export default function JournalPage() {
  const { t } = useI18n();
  const { paid } = usePaywall();
  const [entries, setEntries] = useState([]); // [{date, question, answer, session_id}]
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

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
        const sessRes = await axios.get(`${API}/ask/sessions`, { params: { access_token: token } });
        const sessions = sessRes.data || [];
        const all = [];
        // Fetch messages for each session in parallel (small N)
        await Promise.all(sessions.map(async (s) => {
          try {
            const msgRes = await axios.get(`${API}/ask/sessions/${s.id}/messages`, { params: { access_token: token } });
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

  const filtered = useMemo(() => {
    if (!query.trim()) return entries;
    const q = query.trim().toLowerCase();
    return entries.filter((e) =>
      (e.question || "").toLowerCase().includes(q) ||
      (e.answer || "").toLowerCase().includes(q)
    );
  }, [entries, query]);

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

  return (
    <div className="container-narrow py-12 md:py-16 max-w-3xl animate-fade-up">
      <div className="mb-8">
        <p className="overline">{t("journal.eyebrow")}</p>
        <h1 className="font-serif text-5xl md:text-6xl text-forest mt-3 tracking-tight">{t("journal.title")}</h1>
        <p className="mt-4 text-ink/75 leading-relaxed max-w-2xl">{t("journal.intro")}</p>
      </div>

      <div className="mb-8 relative max-w-md">
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
        {filtered.map((e) => (
          <article key={e.id} className="card-flat p-5" data-testid={`journal-entry-${e.id}`}>
            <div className="flex items-center gap-2 mb-3">
              <Calendar strokeWidth={1.6} className="w-3.5 h-3.5 text-moss" />
              <span className="text-[0.65rem] uppercase tracking-widest text-moss/80">
                {formatDate(e.date)}
              </span>
            </div>
            <p className="font-serif text-xl text-forest leading-snug">{e.question}</p>
            {e.answer && (
              <div className="mt-4 flex gap-3">
                <MessageCircle strokeWidth={1.4} className="w-4 h-4 text-forest flex-shrink-0 mt-1" />
                <div className="text-sm text-ink/85 leading-relaxed whitespace-pre-wrap flex-1">{e.answer}</div>
              </div>
            )}
          </article>
        ))}
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
