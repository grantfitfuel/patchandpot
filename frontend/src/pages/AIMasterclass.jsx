import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Check, GraduationCap, Lightbulb, Sparkles } from "lucide-react";
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
    fetchGeneratedMasterclass(slug, lang, getStoredAccessToken() || "")
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
      <div className="container-narrow py-12 md:py-16 animate-fade-up" data-testid={`ai-masterclass-${slug}`}>
        <Link to="/masterclasses" className="inline-flex items-center gap-2 text-moss hover:text-forest mb-6">
          <ArrowLeft strokeWidth={1.5} className="w-4 h-4" /> All masterclasses
        </Link>

        <div className="flex items-center gap-2 mb-2">
          <Sparkles strokeWidth={1.4} className="w-4 h-4 text-terracotta" />
          <span className="overline">AI-generated masterclass</span>
        </div>

        <div className="grid md:grid-cols-12 gap-10 mt-2">
          <aside className="md:col-span-4 lg:col-span-3">
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
            <h1 className="font-serif text-4xl md:text-5xl text-forest mt-3 tracking-tight">{current.title}</h1>

            <div className="prose-narrow mt-8 space-y-5 text-ink/85 leading-relaxed">
              {(current.body || []).map((p, i) => (
                <p key={i}>{p}</p>
              ))}
            </div>

            {(current.boxes || []).map((box, bi) => (
              <div key={bi} className="mt-8 p-5 bg-surface border-l-2 border-terracotta">
                <p className="overline text-terracotta">{box.label}</p>
                <ul className="mt-3 space-y-2 text-sm text-ink/85">
                  {(box.items || []).map((item, ii) => (
                    <li key={ii} className="flex items-start gap-2">
                      <span className="w-1 h-1 rounded-full bg-terracotta flex-shrink-0 mt-2" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}

            {current.steps && (
              <div className="mt-8 p-5 border border-border bg-sand/40">
                <p className="font-serif text-xl text-forest mb-3">{current.steps.title}</p>
                <ol className="space-y-2.5 text-sm text-ink/85">
                  {(current.steps.items || []).map((it, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="font-serif text-terracotta flex-shrink-0">{i + 1}.</span>
                      <span>{it}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {current.tip && (
              <div className="mt-8 flex items-start gap-3 p-5 bg-moss/10 border-l-2 border-moss">
                <Lightbulb strokeWidth={1.5} className="w-4 h-4 text-moss flex-shrink-0 mt-0.5" />
                <p className="text-sm text-ink/85 leading-relaxed">{current.tip}</p>
              </div>
            )}

            <div className="mt-10 pt-6 border-t border-border flex flex-wrap items-center justify-between gap-4">
              <button
                type="button"
                data-testid={`ai-mark-done-${current.slug}`}
                onClick={() => toggleDone(current.slug)}
                className="inline-flex items-center gap-2 text-sm text-forest hover:text-terracotta"
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
                    className="text-sm text-terracotta hover:underline"
                  >
                    Next lesson →
                  </Link>
                )}
              </div>
            </div>
          </article>
        </div>
      </div>
    </PremiumGate>
  );
}
