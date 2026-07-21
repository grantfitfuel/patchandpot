/**
 * /topics + /topics/:id — curated topic clusters over the Ask Nàdar cache.
 *
 * Two views in one file:
 *   • Index (path=`/topics`)         → tile grid of every topic + count
 *   • Detail (path=`/topics/:id`)    → hero + list of matching Q&As
 *
 * Every question rendered has already passed:
 *   1. hits >= 1                          (asked by ≥2 members)
 *   2. hidden != True                     (admin OR auto-guard clean)
 *   3. term match against a curated topic (hand-vetted taxonomy)
 *
 * No auto-generated topics — dilution risk stays at zero.
 */
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Sparkles, HelpCircle, Layers, Rss } from "lucide-react";
import axios from "axios";
import { Helmet } from "react-helmet-async";
import { API } from "@/lib/api";
import { useI18n } from "@/i18n";
import NadarSurfacesNav from "@/components/NadarSurfacesNav";

export function TopicsIndexPage() {
  const { t } = useI18n();
  const [topics, setTopics] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = "Gardening topics — Patch & Pot";
    ensureMeta("description",
      "Every question Nàdar has answered, grouped by topic — tomatoes, pruning, sowing, composting and more. Free to browse.");
  }, []);

  useEffect(() => {
    axios.get(`${API}/ask/topics`)
      .then((r) => setTopics(r.data?.topics || []))
      .catch(() => setTopics([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="container-narrow py-12 md:py-16 animate-fade-up">
      <NadarSurfacesNav active="topics" />
      <div className="mb-10 max-w-2xl">
        <p className="overline">{t("topics.eyebrow")}</p>
        <h1 className="font-serif text-5xl md:text-6xl text-forest mt-3 tracking-tight">
          {t("topics.index.title")}
        </h1>
        <p className="mt-4 text-ink/75 leading-relaxed">{t("topics.index.intro")}</p>
      </div>

      {loading && <div className="text-sm text-moss">{t("askpop.loading")}</div>}

      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4" data-testid="topics-grid">
          {topics.map((topic) => (
            <Link
              key={topic.id}
              to={`/topics/${topic.id}`}
              data-testid={`topic-tile-${topic.id}`}
              className={`card-flat p-5 group hover:border-forest/40 transition-colors ${topic.count === 0 ? "opacity-60" : ""}`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <Layers strokeWidth={1.4} className="w-6 h-6 text-forest" />
                <span className="text-[0.65rem] uppercase tracking-widest text-moss/80 px-2 py-0.5 border border-border rounded-full">
                  {t("topics.count", { n: topic.count })}
                </span>
              </div>
              <h2 className="font-serif text-2xl text-forest tracking-tight">{topic.label}</h2>
              <p className="text-sm text-moss mt-2 leading-relaxed">{topic.blurb}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-xs text-terracotta group-hover:gap-2 transition-all">
                {t("topics.open")}
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.6} />
              </span>
            </Link>
          ))}
        </div>
      )}

      <Link
        to="/ask/popular"
        className="mt-10 inline-block text-sm text-terracotta hover:underline"
        data-testid="topics-see-all"
      >
        {t("topics.see_all_questions")} →
      </Link>
    </div>
  );
}

export function TopicDetailPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    axios.get(`${API}/ask/topics/${id}`)
      .then((r) => setData(r.data))
      .catch((e) => {
        if (e?.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (data) {
      document.title = `${data.label} — Common gardening questions · Patch & Pot`;
      ensureMeta("description", data.blurb);
    }
  }, [data]);

  if (loading) return <div className="container-narrow py-16 text-sm text-moss">{t("askpop.loading")}</div>;
  if (notFound || !data) {
    return (
      <div className="container-narrow py-16 max-w-2xl animate-fade-up">
        <Link to="/topics" className="text-sm text-moss hover:text-forest inline-flex items-center gap-1.5 mb-6">
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.6} />
          {t("topics.back")}
        </Link>
        <h1 className="font-serif text-3xl text-forest tracking-tight mb-3">{t("topics.not_found")}</h1>
      </div>
    );
  }

  return (
    <div className="container-narrow py-12 md:py-16 animate-fade-up max-w-3xl">
      {/* Autodiscovery — reader apps + browsers pick up the feeds
          straight from the topic page. Backend URLs are stable and
          public, so we don't need to gate this. */}
      <Helmet>
        <link
          rel="alternate"
          type="application/rss+xml"
          title={`${data.label} — Ask Nàdar (RSS)`}
          href={`${API}/ask/topics/${id}/feed.rss`}
        />
        <link
          rel="alternate"
          type="application/feed+json"
          title={`${data.label} — Ask Nàdar (JSON Feed)`}
          href={`${API}/ask/topics/${id}/feed.json`}
        />
      </Helmet>
      <Link to="/topics" className="text-sm text-moss hover:text-forest inline-flex items-center gap-1.5 mb-6" data-testid="topic-back">
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.6} />
        {t("topics.back")}
      </Link>
      <p className="overline">{t("topics.eyebrow")}</p>
      <h1 className="font-serif text-5xl md:text-6xl text-forest mt-3 tracking-tight">{data.label}</h1>
      <p className="mt-4 text-ink/75 leading-relaxed max-w-2xl">{data.blurb}</p>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <p className="text-[0.65rem] uppercase tracking-widest text-moss/70">
          {t("topics.count", { n: data.count })}
        </p>
        <a
          href={`${API}/ask/topics/${id}/feed.rss`}
          target="_blank"
          rel="noopener noreferrer"
          data-testid={`topic-rss-${id}`}
          className="inline-flex items-center gap-1.5 text-xs text-moss hover:text-terracotta transition-colors"
          title={t("topics.subscribe_rss") || "Subscribe via RSS"}
        >
          <Rss strokeWidth={1.6} className="w-3.5 h-3.5" />
          {t("topics.subscribe_rss") || "Subscribe via RSS"}
        </a>
      </div>

      <div className="mt-10 space-y-3">
        {data.questions.length === 0 && (
          <div className="card-flat p-6 text-sm text-moss" data-testid="topic-empty">
            {t("topics.empty")}
          </div>
        )}
        {data.questions.map((r) => (
          <Link
            key={r.key}
            to={`/ask/popular/${r.slug}`}
            data-testid={`topic-question-${r.key}`}
            className="card-flat p-4 flex items-start gap-3 hover:border-forest/40 transition-colors group bg-white"
          >
            <HelpCircle className="w-5 h-5 text-terracotta flex-shrink-0 mt-1" strokeWidth={1.4} />
            <div className="flex-1 min-w-0">
              <p className="font-serif text-lg text-forest leading-snug">
                {capitalizeFirst(r.question_normalized)}{r.question_normalized?.slice(-1) === "?" ? "" : "?"}
              </p>
              <p className="text-[0.65rem] uppercase tracking-widest text-moss mt-1">
                {t("askpop.asked_n_times", { n: (r.hits || 0) + 1 })}
              </p>
            </div>
            <ArrowRight className="w-4 h-4 text-moss group-hover:text-terracotta transition-colors mt-1" strokeWidth={1.6} />
          </Link>
        ))}
      </div>

      <section className="mt-16 border-t border-border pt-10">
        <div className="flex items-start gap-4">
          <Sparkles className="w-6 h-6 text-terracotta flex-shrink-0 mt-1" strokeWidth={1.4} />
          <div className="flex-1">
            <h2 className="font-serif text-2xl text-forest tracking-tight mb-2">{t("askpop.cta.title")}</h2>
            <p className="text-sm text-moss leading-relaxed mb-4">{t("askpop.cta.blurb")}</p>
            <Link to="/ask" className="btn-primary inline-flex items-center gap-2" data-testid="topic-cta-link">
              {t("askpop.cta.button")}
              <ArrowRight className="w-4 h-4" strokeWidth={1.6} />
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

function capitalizeFirst(s) { return !s ? "" : s.charAt(0).toUpperCase() + s.slice(1); }
function ensureMeta(name, content) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector(`meta[name="${name}"]`);
  if (!el) { el = document.createElement("meta"); el.setAttribute("name", name); document.head.appendChild(el); }
  el.setAttribute("content", content);
}
