/**
 * /ask/popular — the public "Common questions" surface.
 *
 * Reads the top cached Q&A pairs from GET /api/ask/popular and lays
 * them out as a scan-friendly FAQ. Every question shown has been
 * asked by at least two members, so we're not leaking one-off queries;
 * we're just exposing the compounding knowledge base that Ask Nàdar
 * has accumulated over time.
 *
 * Zero LLM cost per view — the data is already in Mongo, and the
 * endpoint is browser-cacheable for an hour. Meant to be a big SEO
 * surface: honest gardening Q&A that grows on its own with the app.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { HelpCircle, MessageCircle, Search, X, ArrowRight, Sparkles } from "lucide-react";
import axios from "axios";
import { API } from "@/lib/api";
import { useI18n } from "@/i18n";
import NadarSurfacesNav from "@/components/NadarSurfacesNav";

export default function AskPopularPage() {
  const { t } = useI18n();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(new Set());

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = "Common gardening questions — Patch & Pot";
    ensureMeta(
      "description",
      "Real gardening questions that members have asked Nàdar — instant answers on pruning, sowing, pests, watering, propagation and more. Free to browse, no sign-up.",
    );
  }, []);

  useEffect(() => {
    axios
      .get(`${API}/ask/popular?limit=100`)
      .then((r) => setRows(r.data?.questions || []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (r.question_normalized || "").toLowerCase().includes(q) ||
        (r.answer || "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  const toggle = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(filtered.map((r) => r.key)));
  const collapseAll = () => setExpanded(new Set());

  return (
    <div className="container-narrow py-12 md:py-16 animate-fade-up">
      <NadarSurfacesNav active="popular" />
      <div className="mb-8 max-w-2xl">
        <p className="overline">{t("askpop.eyebrow")}</p>
        <h1 className="font-serif text-5xl md:text-6xl text-forest mt-3 tracking-tight">
          {t("askpop.title")}
        </h1>
        <p className="mt-4 text-ink/75 leading-relaxed">
          {t("askpop.intro")}
        </p>
      </div>

      {/* Search + expand controls */}
      <div className="flex flex-wrap items-center gap-3 mb-8 max-w-2xl">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-moss" strokeWidth={1.6} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("askpop.search_placeholder")}
            data-testid="askpop-search"
            className="w-full border border-border/70 rounded pl-9 pr-9 py-2 text-sm focus:outline-none focus:border-forest/50 bg-white"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-moss hover:text-terracotta"
              aria-label={t("askpop.clear_search")}
              data-testid="askpop-search-clear"
            >
              <X className="w-4 h-4" strokeWidth={1.8} />
            </button>
          )}
        </div>
        {filtered.length > 0 && (
          <div className="flex gap-2 text-xs">
            <button
              type="button"
              onClick={expandAll}
              data-testid="askpop-expand-all"
              className="text-moss hover:text-forest"
            >
              {t("askpop.expand_all")}
            </button>
            <span className="text-moss/50">·</span>
            <button
              type="button"
              onClick={collapseAll}
              data-testid="askpop-collapse-all"
              className="text-moss hover:text-forest"
            >
              {t("askpop.collapse_all")}
            </button>
          </div>
        )}
      </div>

      {loading && (
        <div className="text-sm text-moss" data-testid="askpop-loading">
          {t("askpop.loading")}
        </div>
      )}

      {!loading && rows.length === 0 && (
        <div className="card-flat p-6 text-sm text-moss max-w-2xl" data-testid="askpop-empty">
          {t("askpop.empty_pristine")}
        </div>
      )}

      {!loading && rows.length > 0 && filtered.length === 0 && (
        <div className="card-flat p-6 text-sm text-moss max-w-2xl" data-testid="askpop-empty-search">
          {t("askpop.empty_search")}
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-3 mb-14" data-testid="askpop-list">
          <p className="text-xs text-moss uppercase tracking-widest mb-4">
            {t("askpop.count", { n: filtered.length })}
          </p>
          {filtered.map((r) => (
            <QuestionCard
              key={r.key}
              row={r}
              open={expanded.has(r.key)}
              onToggle={() => toggle(r.key)}
              t={t}
            />
          ))}
        </div>
      )}

      {/* CTA to Ask Nàdar */}
      <section className="mt-16 border-t border-border pt-10 max-w-2xl">
        <div className="flex items-start gap-4">
          <Sparkles className="w-6 h-6 text-terracotta flex-shrink-0 mt-1" strokeWidth={1.4} />
          <div className="flex-1">
            <h2 className="font-serif text-2xl text-forest tracking-tight mb-2">
              {t("askpop.cta.title")}
            </h2>
            <p className="text-sm text-moss leading-relaxed mb-4">
              {t("askpop.cta.blurb")}
            </p>
            <Link
              to="/ask"
              data-testid="askpop-cta-link"
              className="btn-primary inline-flex items-center gap-2"
            >
              {t("askpop.cta.button")}
              <ArrowRight className="w-4 h-4" strokeWidth={1.6} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function QuestionCard({ row, open, onToggle, t }) {
  return (
    <article
      className={`border border-border/70 rounded transition-colors ${open ? "bg-surface/40" : "bg-white hover:border-forest/40"}`}
      data-testid={`askpop-card-${row.key}`}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        data-testid={`askpop-toggle-${row.key}`}
        className="w-full text-left p-4 flex items-start gap-3 group"
      >
        <HelpCircle
          className="w-5 h-5 text-terracotta flex-shrink-0 mt-0.5"
          strokeWidth={1.4}
        />
        <div className="flex-1 min-w-0">
          <p className="font-serif text-lg text-forest leading-snug">
            {capitalizeFirst(row.question_normalized)}
            {row.question_normalized?.slice(-1) !== "?" ? "?" : ""}
          </p>
          <p className="text-[0.65rem] uppercase tracking-widest text-moss mt-2">
            {t("askpop.asked_n_times", { n: row.hits + 1 })}
          </p>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-5 pl-12" data-testid={`askpop-answer-${row.key}`}>
          <div className="flex gap-3 pt-1 border-t border-border/60 mt-1">
            <MessageCircle
              className="w-4 h-4 text-forest flex-shrink-0 mt-3.5"
              strokeWidth={1.4}
            />
            <div className="text-sm text-ink/85 leading-relaxed whitespace-pre-wrap flex-1 pt-3">
              {row.answer}
            </div>
          </div>
          {row.slug && (
            <Link
              to={`/ask/popular/${row.slug}`}
              className="mt-3 inline-block text-xs text-terracotta hover:underline"
              data-testid={`askpop-permalink-${row.key}`}
            >
              {t("askpop.permalink")} →
            </Link>
          )}
        </div>
      )}
    </article>
  );
}

function ensureMeta(name, content) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function capitalizeFirst(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}
