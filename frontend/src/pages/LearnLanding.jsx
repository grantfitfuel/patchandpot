import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight, GraduationCap, Lock, Sparkles } from "lucide-react";
import { ALL_MASTERCLASSES } from "@/data/all-masterclasses";
import { fetchLearnOgMeta } from "@/lib/api";
import { usePaywall } from "@/hooks/usePaywall";
import { useI18n } from "@/i18n";
import TopicImage from "@/components/TopicImage";
import PaywallModal from "@/components/PaywallModal";
import FoundingBanner from "@/components/FoundingBanner";

/**
 * SEO landing page for a masterclass topic.
 *
 *   /learn/:topic
 *
 * Strategy:
 *   - Resolve the topic from the static masterclass registry (frontend bundle)
 *     OR from the backend `/api/og/learn/{topic}` endpoint (AI-generated cache).
 *   - Render OpenGraph + Twitter Card tags via react-helmet-async so the URL
 *     unfurls into a rich preview on every modern social platform.
 *   - Non-paying visitors get the FREE intro lesson in full, then hit a soft
 *     "unlock the rest" wall. Paid users land here and can jump straight to
 *     the full masterclass.
 */
export default function LearnLandingPage() {
  const { topic } = useParams();
  const { lang, t } = useI18n();
  const { paid } = usePaywall();
  const [remote, setRemote] = useState(null);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  // Try the local registry first — it's instant, fully translated via the
  // existing i18n keys, and avoids a network round-trip for the common case.
  const local = useMemo(() => {
    const m = ALL_MASTERCLASSES[topic];
    if (!m) return null;
    const lessons = m.lessons || [];
    const intro = lessons[0] || null;
    return {
      source: "static",
      slug: topic,
      title: m.title,
      tagline: m.tagline,
      description: (intro?.body?.[0] || m.tagline || "").slice(0, 280),
      introTitle: intro?.title || "",
      introParagraphs: intro?.body || [],
      introBoxes: intro?.boxes || [],
      imageSubject: m.imageSubject || null,
      imageUrl: m.image || null,
      lessonTitles: lessons.map((l) => l.title),
      fullPath: `/masterclasses/${topic}`,
    };
  }, [topic]);

  // AI-generated masterclasses don't live in the bundle — fall back to the
  // backend cache via /api/og/learn/:topic.
  useEffect(() => {
    if (local || !topic) return;
    let cancelled = false;
    setRemoteLoading(true);
    setNotFound(false);
    fetchLearnOgMeta(topic, lang)
      .then((d) => {
        if (cancelled) return;
        setRemote({
          source: "ai",
          slug: d.slug,
          title: d.title,
          tagline: d.tagline,
          description: d.description,
          introTitle: "",
          introParagraphs: d.intro_paragraphs || [],
          introBoxes: [],
          imageSubject: d.image_subject,
          imageUrl: null,
          lessonTitles: [],
          fullPath: `/masterclasses/custom/${d.slug}`,
        });
      })
      .catch(() => !cancelled && setNotFound(true))
      .finally(() => !cancelled && setRemoteLoading(false));
    return () => { cancelled = true; };
  }, [local, topic, lang]);

  const meta = local || remote;
  const siteUrl = typeof window !== "undefined" ? window.location.origin : "";
  const canonical = `${siteUrl}/learn/${topic}`;

  if (notFound) {
    return (
      <div className="container-narrow py-20 text-center">
        <p className="overline">Patch &amp; Pot · Learn</p>
        <h1 className="font-serif text-4xl text-forest mt-2">{t("learn.not_found_title")}</h1>
        <p className="text-ink/75 mt-3">{t("learn.not_found_body")}</p>
        <Link to="/masterclasses" className="btn-ghost mt-6 inline-flex" data-testid="learn-not-found-back">
          {t("learn.not_found_back")}
        </Link>
      </div>
    );
  }

  if (!meta) {
    return (
      <div className="container-narrow py-20 text-center">
        <Sparkles strokeWidth={1.4} className="w-6 h-6 text-terracotta inline mr-2 animate-pulse" />
        <span className="text-ink/75">{t("learn.loading")}</span>
      </div>
    );
  }

  const ogTitle = `${meta.title} — Patch & Pot`;
  const ogDescription = meta.description || meta.tagline;

  return (
    <div className="container-narrow py-12 md:py-16 animate-fade-up" data-testid={`learn-landing-${topic}`}>
      <Helmet prioritizeSeoTags>
        <title>{ogTitle}</title>
        <link rel="canonical" href={canonical} />
        <meta name="description" content={ogDescription} />

        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="Patch & Pot" />
        <meta property="og:title" content={ogTitle} />
        <meta property="og:description" content={ogDescription} />
        <meta property="og:url" content={canonical} />
        {meta.imageUrl && <meta property="og:image" content={meta.imageUrl} />}

        {/* Twitter card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={ogTitle} />
        <meta name="twitter:description" content={ogDescription} />
        {meta.imageUrl && <meta name="twitter:image" content={meta.imageUrl} />}

        {/* Structured data — helps Google show a richer SERP result */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: meta.title,
            description: ogDescription,
            mainEntityOfPage: canonical,
            publisher: { "@type": "Organization", name: "Patch & Pot" },
          })}
        </script>
      </Helmet>

      <div className="flex items-center gap-3 mb-3">
        <GraduationCap strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
        <span className="overline" data-testid="learn-eyebrow">{t("learn.eyebrow_free")}</span>
      </div>

      <h1 className="font-serif text-5xl md:text-6xl text-forest tracking-tight" data-testid="learn-title">
        {meta.title}
      </h1>
      <p className="mt-4 text-ink/75 max-w-2xl leading-relaxed text-lg" data-testid="learn-tagline">
        {meta.tagline}
      </p>

      {/* Hero image */}
      <div className="mt-10 aspect-[16/9] overflow-hidden border border-border bg-surface">
        {meta.imageSubject ? (
          <TopicImage
            subject={meta.imageSubject}
            cacheKey={`learn-hero:${meta.slug}`}
            alt={meta.title}
            eager
          />
        ) : meta.imageUrl ? (
          <img src={meta.imageUrl} alt={meta.title} className="w-full h-full object-cover" />
        ) : null}
      </div>

      {/* Free intro lesson — always visible, paid or not */}
      <article className="mt-12 max-w-3xl" data-testid="learn-intro-body">
        {meta.introTitle && (
          <>
            <p className="overline">{t("learn.lesson_n", { n: 1 })}</p>
            <h2 className="font-serif text-3xl md:text-4xl text-forest mt-3 tracking-tight">
              {meta.introTitle}
            </h2>
          </>
        )}
        <div className="mt-6 space-y-5">
          {meta.introParagraphs.map((p, i) => (
            <p key={i} className="text-ink/80 leading-relaxed text-lg">{p}</p>
          ))}
        </div>

        {meta.introBoxes.map((box, bi) => (
          <section key={`box-${bi}`} className="mt-8 card-flat p-6">
            <p className="overline">{box.label}</p>
            <ul className="mt-4 space-y-3">
              {(box.items || []).map((it, i) => (
                <li key={i} className="flex gap-3 text-ink/80 leading-relaxed">
                  <span className="text-terracotta mt-1.5 w-1 h-1 bg-terracotta rounded-full flex-shrink-0" />
                  <span>{it}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </article>

      {/* Soft paywall — only shown to unpaid visitors */}
      {!paid && (
        <section
          className="mt-14 border-t border-border pt-10 max-w-3xl"
          data-testid="learn-paywall-cta"
        >
          <div className="card-flat p-8 md:p-10 text-center">
            <Lock strokeWidth={1.4} className="w-6 h-6 text-terracotta mx-auto mb-4" />
            <h3 className="font-serif text-3xl text-forest">
              {t("learn.unlock_title")}
            </h3>
            <p className="text-ink/75 mt-3 max-w-xl mx-auto">
              {t("learn.unlock_body")}
            </p>

            {meta.lessonTitles.length > 1 && (
              <ol className="mt-7 max-w-md mx-auto text-left space-y-2" data-testid="learn-lesson-list">
                {meta.lessonTitles.slice(1).map((title, i) => (
                  <li key={i} className="flex items-center gap-3 text-sm text-ink/70">
                    <Lock strokeWidth={1.5} className="w-3.5 h-3.5 text-moss flex-shrink-0" />
                    <span className="overline shrink-0 text-moss">{t("learn.lesson_n", { n: i + 2 })}</span>
                    <span className="truncate">{title}</span>
                  </li>
                ))}
              </ol>
            )}

            <button
              type="button"
              onClick={() => setShowPaywall(true)}
              data-testid="learn-unlock-btn"
              className="btn-terracotta mt-8 inline-flex items-center gap-2"
            >
              {t("learn.unlock_button")}
              <ArrowRight strokeWidth={1.5} className="w-4 h-4" />
            </button>
            <p className="text-xs text-moss mt-4">{t("learn.pricing_note")}</p>
          </div>
        </section>
      )}

      {/* Paid users — straight-through CTA into the full course */}
      {paid && (
        <div className="mt-14 max-w-3xl" data-testid="learn-paid-cta">
          <Link to={meta.fullPath} className="btn-forest inline-flex items-center gap-2">
            {t("learn.open_full")}
            <ArrowRight strokeWidth={1.5} className="w-4 h-4" />
          </Link>
        </div>
      )}

      {showPaywall && (
        <PaywallModal
          onClose={() => setShowPaywall(false)}
          onUnlocked={() => setShowPaywall(false)}
          allowDismiss
        />
      )}

      {/* Founding-cohort hook — only shown for non-paid visitors. Renders the
          same banner that lives at the top of Home so the urgency is consistent
          wherever organic traffic lands. Disappears once the cohort sells out. */}
      {!paid && (
        <div className="mt-16 -mx-4 sm:mx-0">
          <FoundingBanner />
        </div>
      )}
    </div>
  );
}
