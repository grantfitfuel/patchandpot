/**
 * /ask/popular/:slug — individual popular question page.
 *
 * One URL per popular question, purely for SEO. Each is its own atomic
 * evergreen answer — we deliberately do NOT cluster into synthetic
 * topic pages (a bad question could contaminate a whole cluster).
 *
 * Content is fetched from the public `GET /api/ask/popular/{slug}`
 * endpoint, which enforces the same safety rails as the list view
 * (hits >= 1, hidden != true, first-turn only). 404s bounce back to
 * /ask/popular.
 */
import { useEffect, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle, HelpCircle, ArrowRight, Sparkles } from "lucide-react";
import axios from "axios";
import { API } from "@/lib/api";
import { useI18n } from "@/i18n";
import AskFeedbackWidget from "@/components/AskFeedbackWidget";

export default function AskPopularQuestionPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t } = useI18n();
  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    setLoading(true);
    axios
      .get(`${API}/ask/popular/${slug}`)
      .then((r) => setRow(r.data))
      .catch((e) => {
        if (e?.response?.status === 404) setNotFound(true);
        setRow(null);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (row) {
      const q = capitalizeFirst(row.question_normalized || "");
      document.title = `${q}? — Common gardening questions · Patch & Pot`;
      ensureMeta(
        "description",
        (row.answer || "").slice(0, 155).replace(/\s+/g, " ").trim(),
      );
      // FAQPage JSON-LD — one clean structured-data node per question.
      injectFaqSchema(q, row.answer || "");
    } else {
      document.title = "Common gardening questions — Patch & Pot";
    }
    return removeFaqSchema;
  }, [row]);

  if (loading) {
    return (
      <div className="container-narrow py-16 text-sm text-moss" data-testid="askpop-single-loading">
        {t("askpop.loading")}
      </div>
    );
  }

  if (notFound || !row) {
    return (
      <div className="container-narrow py-16 max-w-2xl animate-fade-up">
        <button
          type="button"
          onClick={() => navigate("/ask/popular")}
          className="text-sm text-moss hover:text-forest inline-flex items-center gap-1.5 mb-6"
          data-testid="askpop-single-back-empty"
        >
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.6} />
          {t("askpop.single.back")}
        </button>
        <h1 className="font-serif text-3xl text-forest tracking-tight mb-3">
          {t("askpop.single.not_found_title")}
        </h1>
        <p className="text-ink/75 text-sm">{t("askpop.single.not_found_blurb")}</p>
      </div>
    );
  }

  const question = capitalizeFirst(row.question_normalized || "");
  const questionWithMark = question + (question.endsWith("?") ? "" : "?");

  return (
    <div className="container-narrow py-12 md:py-16 max-w-2xl animate-fade-up">
      <Link
        to="/ask/popular"
        className="text-sm text-moss hover:text-forest inline-flex items-center gap-1.5 mb-6"
        data-testid="askpop-single-back"
      >
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.6} />
        {t("askpop.single.back")}
      </Link>

      <p className="overline">{t("askpop.eyebrow")}</p>

      <div className="flex items-start gap-3 mt-3 mb-6">
        <HelpCircle
          className="w-6 h-6 text-terracotta flex-shrink-0 mt-2"
          strokeWidth={1.4}
        />
        <h1
          className="font-serif text-3xl md:text-4xl text-forest tracking-tight leading-tight"
          data-testid="askpop-single-question"
        >
          {questionWithMark}
        </h1>
      </div>
      <p className="text-[0.65rem] uppercase tracking-widest text-moss mb-8 pl-9">
        {t("askpop.asked_n_times", { n: (row.hits || 0) + 1 })}
      </p>

      <div className="flex gap-3 pl-9">
        <MessageCircle
          className="w-5 h-5 text-forest flex-shrink-0 mt-1"
          strokeWidth={1.4}
        />
        <div
          className="text-base text-ink/85 leading-relaxed whitespace-pre-wrap flex-1"
          data-testid="askpop-single-answer"
        >
          {row.answer}
        </div>
      </div>

      <div className="pl-9">
        <AskFeedbackWidget slug={slug} />
      </div>

      <section className="mt-16 border-t border-border pt-10">
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
              data-testid="askpop-single-cta-link"
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

function capitalizeFirst(s) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
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

// Emit a small FAQPage JSON-LD block so Google can render a rich result.
// Kept minimal — one question, one answer, no ratings / speaker /
// author claims. Cleared on unmount so we don't leak schema onto
// unrelated routes.
function injectFaqSchema(question, answer) {
  if (typeof document === "undefined") return;
  removeFaqSchema();
  const data = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: [
      {
        "@type": "Question",
        name: question + (question.endsWith("?") ? "" : "?"),
        acceptedAnswer: {
          "@type": "Answer",
          text: (answer || "").slice(0, 5000),
        },
      },
    ],
  };
  const el = document.createElement("script");
  el.type = "application/ld+json";
  el.id = "askpop-faq-schema";
  el.textContent = JSON.stringify(data);
  document.head.appendChild(el);
}
function removeFaqSchema() {
  if (typeof document === "undefined") return;
  const el = document.getElementById("askpop-faq-schema");
  if (el) el.remove();
}
