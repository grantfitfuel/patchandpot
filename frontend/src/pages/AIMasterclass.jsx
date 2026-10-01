import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, GraduationCap, Lightbulb, Sparkles } from "lucide-react";
import { fetchGeneratedMasterclass } from "@/lib/api";
import { getStoredAccessToken } from "@/hooks/usePaywall";
import { useI18n } from "@/i18n";
import PremiumGate from "@/components/PremiumGate";
import TopicImage from "@/components/TopicImage";
import ShareLessonButton from "@/components/ShareLessonButton";

/**
 * Renders an AI-generated masterclass fetched from /api/masterclass/generated/:slug.
 * Schema mirrors the hand-authored MASTERCLASSES (slug/title/lessons/...) so
 * we reuse the same visual language but skip the i18n-key indirection (content
 * arrives already in the target language).
 */
export default function AIMasterclassPage() {
  const { slug, lessonSlug } = useParams();
  const { lang } = useI18n();
  const [mc, setMc] = useState(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(`patchpot.aimc.progress.${slug}`) || "{}");
    } catch {
      return {};
    }
  });

  useEffect(() => {
    let cancelled = false;
    setMc(null);
    setError("");
    fetchGeneratedMasterclass(slug, lang)
      .then((d) => { if (!cancelled) setMc(d); })
      .catch(() => { if (!cancelled) setError("This masterclass isn't available yet."); });
    return () => { cancelled = true; };
  }, [slug, lang]);

  if (error) {
    return (
      <div className="container-narrow py-16 text-center">
        <p className="text-ink/75">{error}</p>
        <Link to="/masterclasses" className="text-terracotta underline mt-4 inline-block">Back to all masterclasses</Link>
      </div>
    );
  }
  if (!mc) {
    return (
      <div className="container-narrow py-16 text-center">
        <Sparkles strokeWidth={1.4} className="w-6 h-6 text-terracotta inline mr-2 animate-pulse" />
        <span className="text-ink/75">Loading…</span>
      </div>
    );
  }

  const lessons = mc.lessons || [];
  const current = lessonSlug
    ? lessons.find((l) => l.slug === lessonSlug) || lessons[0]
    : lessons[0];
  const currentIndex = lessons.findIndex((l) => l.slug === current.slug);
  const doneCount = Object.values(done).filter(Boolean).length;
  const total = lessons.length;

  function toggleDone(s) {
    const next = { ...done, [s]: !done[s] };
    setDone(next);
    try { localStorage.setItem(`patchpot.aimc.progress.${slug}`, JSON.stringify(next)); }
    catch (e) { console.warn("AIMasterclass: persist progress failed", e); }
  }

  return (
    <PremiumGate>
      <div className="container-narrow py-6 md:py-16 animate-fade-up pb-24 md:pb-16" data-testid={`ai-masterclass-${slug}`}>
        <Link to="/masterclasses" className="inline-flex items-center gap-2 py-2 -my-2 text-moss hover:text-forest mb-4 md:mb-6">
          <ArrowLeft strokeWidth={1.5} className="w-4 h-4" />
          <span className="text-sm md:text-base">All masterclasses</span>
        </Link>

        <div className="flex items-center gap-2 mb-2">
          <Sparkles strokeWidth={1.4} className="w-4 h-4 text-terracotta" />
          <span className="overline">AI-generated masterclass</span>
        </div>

        {/* ─────── Mobile-only compact header ───────
            Replaces the fat sidebar on narrow screens so the lesson
            content appears above the fold. Shows masterclass title +
            progress + a horizontally-scrolling chip strip of all
            lessons so the user can jump between them without scrolling
            to the bottom. */}
        <div className="md:hidden mt-2 mb-6">
          <h2 className="font-serif text-2xl text-forest leading-tight">{mc.title}</h2>
          <p className="text-xs text-moss mt-1">
            {mc.duration} · Lesson {currentIndex + 1} of {total}
          </p>
          <div className="mt-3 h-1 bg-border overflow-hidden rounded-full">
            <div className="h-1 bg-terracotta transition-all" style={{ width: `${(doneCount / total) * 100}%` }} />
          </div>
          {/* Horizontal lesson chip strip. `-mx-6` pulls out of the
              container-narrow padding so chips can scroll edge-to-edge;
              `snap-x` locks each chip for touch-swipe nav. */}
          <nav
            className="mt-5 -mx-6 px-6 overflow-x-auto hide-scrollbar snap-x snap-mandatory"
            aria-label="Lesson switcher"
          >
            <ol className="flex gap-2 w-max">
              {lessons.map((l, i) => {
                const active = l.slug === current.slug;
                const isDone = !!done[l.slug];
                return (
                  <li key={l.slug} className="snap-start">
                    <Link
                      to={`/masterclasses/custom/${slug}/${l.slug}`}
                      data-testid={`ai-lesson-chip-${l.slug}`}
                      className={`inline-flex items-center gap-2 px-3.5 py-2.5 rounded-full text-xs tracking-wide whitespace-nowrap transition-colors ${
                        active
                          ? "bg-forest text-sand"
                          : "bg-surface text-ink/80 hover:bg-forest/10"
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[9px] font-medium ${
                        isDone
                          ? "bg-terracotta text-sand"
                          : active ? "bg-sand/20 text-sand" : "bg-forest/15 text-forest"
                      }`}>
                        {isDone ? <Check strokeWidth={2.5} className="w-2.5 h-2.5" /> : i + 1}
                      </span>
                      <span className="max-w-[11rem] truncate">{l.title}</span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        <div className="grid md:grid-cols-12 gap-10 mt-2">
          {/* ─────── Desktop-only fat sidebar ───────
              Hidden on mobile (replaced by the compact header + chips
              above). Order kept at source position so no CSS `order`
              trickery needed. */}
          <aside className="hidden md:block md:col-span-4 lg:col-span-3">
            <div className="md:sticky md:top-8">
              <div className="aspect-[4/3] mb-4 overflow-hidden bg-surface">
                <TopicImage
                  subject={mc.imageSubject || mc.topic || mc.title}
                  cacheKey={`ai-mc-card:${mc.slug}`}
                  alt={mc.title}
                  eager
                  className=""
                />
              </div>
              <div className="flex items-center gap-3 mb-2">
                <GraduationCap strokeWidth={1.4} className="w-4 h-4 text-terracotta" />
                <span className="overline">Masterclass</span>
              </div>
              <h2 className="font-serif text-3xl text-forest leading-tight">{mc.title}</h2>
              <p className="text-sm text-moss mt-1">{mc.duration}</p>
              <p className="text-ink/75 mt-3 text-sm leading-relaxed">{mc.tagline}</p>

              <div className="mt-5">
                <div className="h-1 bg-border overflow-hidden">
                  <div className="h-1 bg-terracotta transition-all" style={{ width: `${(doneCount / total) * 100}%` }} />
                </div>
                <p className="text-xs text-moss mt-2">{doneCount} of {total} complete</p>
              </div>

              <ol className="mt-7 space-y-1">
                {lessons.map((l, i) => {
                  const active = l.slug === current.slug;
                  const isDone = !!done[l.slug];
                  return (
                    <li key={l.slug}>
                      <Link
                        to={`/masterclasses/custom/${slug}/${l.slug}`}
                        data-testid={`ai-lesson-nav-${l.slug}`}
                        className={`flex items-start gap-3 px-3 py-2.5 border-l-2 transition-colors ${
                          active ? "border-terracotta bg-surface text-forest"
                                 : "border-transparent hover:bg-surface/60 text-ink/75"
                        }`}
                      >
                        <span className={`mt-1 w-4 h-4 border flex-shrink-0 flex items-center justify-center ${
                          isDone ? "bg-forest border-forest" : "border-forest/40"
                        }`}>
                          {isDone && <Check strokeWidth={2.5} className="w-3 h-3 text-sand" />}
                        </span>
                        <span className="flex-1">
                          <span className="block text-[10px] tracking-[0.18em] uppercase text-moss">Lesson {i + 1}</span>
                          <span className={`block text-sm ${active ? "font-medium" : ""}`}>{l.title}</span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </div>
          </aside>

          <article className="md:col-span-8 lg:col-span-9 max-w-3xl">
            <p className="overline">Lesson {currentIndex + 1}</p>
            <h1 className="font-serif text-3xl md:text-5xl text-forest mt-3 tracking-tight text-balance">{current.title}</h1>

            <div className="prose-narrow mt-6 md:mt-8 space-y-5 text-ink/85 leading-relaxed">
              {(current.body || []).map((p, i) => (
                <p key={`${i}-${p.slice(0, 40)}`}>{p}</p>
              ))}
            </div>

            {(current.boxes || []).map((box, bi) => (
              <div key={`${bi}-${box.label}`} className="mt-8 p-5 bg-surface border-l-2 border-terracotta rounded-r-xl">
                <p className="overline text-terracotta">{box.label}</p>
                <ul className="mt-3 space-y-2 text-sm text-ink/85">
                  {(box.items || []).map((item) => (
                    <li key={item} className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-terracotta flex-shrink-0 mt-2" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {current.steps && (
              <div className="mt-8 p-5 border border-border bg-sand/40 rounded-xl">
                <p className="font-serif text-xl text-forest mb-3">{current.steps.title}</p>
                <ol className="space-y-2.5 text-sm text-ink/85">
                  {(current.steps.items || []).map((it, i) => (
                    <li key={`${i}-${it.slice(0, 40)}`} className="flex items-start gap-3">
                      <span className="font-serif text-terracotta flex-shrink-0">{i + 1}.</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {current.tip && (
              <div className="mt-8 flex items-start gap-3 p-5 bg-moss/10 border-l-2 border-moss rounded-r-xl">
                <Lightbulb strokeWidth={1.5} className="w-4 h-4 text-moss flex-shrink-0 mt-0.5" />
                <p className="text-sm text-ink/85 leading-relaxed">{current.tip}</p>
              </div>
            )}

            {/* Desktop-only footer bar: mark-complete + share + next.
                Mobile gets the same actions via the sticky bottom bar
                below so they're always one tap away. */}
            <div className="hidden md:flex mt-10 pt-6 border-t border-border flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                data-testid={`ai-mark-done-${current.slug}`}
                onClick={() => toggleDone(current.slug)}
                className="inline-flex items-center gap-2 py-2 -my-2 text-sm text-forest hover:text-terracotta"
              >
                <span className={`w-4 h-4 border flex items-center justify-center ${
                  done[current.slug] ? "bg-forest border-forest" : "border-forest/40"
                }`}>
                  {done[current.slug] && <Check strokeWidth={2.5} className="w-3 h-3 text-sand" />}
                </span>
                {done[current.slug] ? "Marked complete" : "Mark this lesson complete"}
              </button>
              <div className="flex items-center gap-3 flex-wrap">
                <ShareLessonButton
                  topicSlug={slug}
                  title={mc.title}
                  tagline={mc.tagline}
                />
                {currentIndex + 1 < total && (
                  <Link
                    to={`/masterclasses/custom/${slug}/${lessons[currentIndex + 1].slug}`}
                    data-testid="ai-next-lesson"
                    className="py-2 -my-2 text-sm text-terracotta hover:underline"
                  >
                    Next lesson →
                  </Link>
                )}
              </div>
            </div>

            {/* Mobile-only mark-complete + share row (above sticky bar) */}
            <div className="md:hidden mt-10 pt-6 border-t border-border space-y-4">
              <button
                type="button"
                data-testid={`ai-mark-done-mobile-${current.slug}`}
                onClick={() => toggleDone(current.slug)}
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-full bg-surface text-forest text-sm hover:bg-forest/10"
              >
                <span className={`w-4 h-4 border flex items-center justify-center ${
                  done[current.slug] ? "bg-forest border-forest" : "border-forest/40"
                }`}>
                  {done[current.slug] && <Check strokeWidth={2.5} className="w-3 h-3 text-sand" />}
                </span>
                {done[current.slug] ? "Marked complete" : "Mark this lesson complete"}
              </button>
              <div className="flex justify-center">
                <ShareLessonButton
                  topicSlug={slug}
                  title={mc.title}
                  tagline={mc.tagline}
                />
              </div>
            </div>
          </article>
        </div>
      </div>

      {/* ─────── Sticky mobile bottom nav ───────
          Previous ← | · · · | → Next. Always one tap from either side.
          Uses `env(safe-area-inset-bottom)` so it sits above the iOS
          home-indicator on edge-to-edge phones. Hidden on tablets+. */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-30 bg-sand/95 backdrop-blur-md border-t border-border"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0)" }}
        aria-label="Lesson navigation"
      >
        <div className="flex items-stretch justify-between">
          {currentIndex > 0 ? (
            <Link
              to={`/masterclasses/custom/${slug}/${lessons[currentIndex - 1].slug}`}
              data-testid="ai-prev-lesson-mobile"
              className="flex-1 flex items-center justify-center gap-2 py-4 text-sm text-forest hover:bg-surface/60 active:bg-forest/10"
            >
              <ArrowLeft strokeWidth={1.5} className="w-4 h-4" />
              <span>Previous</span>
            </Link>
          ) : (
            <span className="flex-1" aria-hidden="true" />
          )}
          <span className="flex items-center px-3 text-xs text-moss/80 tracking-wide">
            {currentIndex + 1} / {total}
          </span>
          {currentIndex + 1 < total ? (
            <Link
              to={`/masterclasses/custom/${slug}/${lessons[currentIndex + 1].slug}`}
              data-testid="ai-next-lesson-mobile"
              className="flex-1 flex items-center justify-center gap-2 py-4 text-sm text-terracotta font-medium hover:bg-surface/60 active:bg-terracotta/10"
            >
              <span>Next</span>
              <ArrowRight strokeWidth={1.5} className="w-4 h-4" />
            </Link>
          ) : (
            <span className="flex-1" aria-hidden="true" />
          )}
        </div>
      </nav>
    </PremiumGate>
  );
}
