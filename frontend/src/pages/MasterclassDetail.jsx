import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Check, GraduationCap, Lightbulb,
  Sparkles, Loader2, Download, MapPin, Languages,
} from "lucide-react";
import { ALL_MASTERCLASSES } from "@/data/all-masterclasses";
import { useMasterclassProgress } from "@/hooks/useMasterclassProgress";
import { useRegion } from "@/hooks/useRegion";
import { useI18n } from "@/i18n";
import TopicImage from "@/components/TopicImage";
import ShareCard from "@/components/ShareCard";
import ShareLessonButton from "@/components/ShareLessonButton";
import PremiumGate from "@/components/PremiumGate";
import { api } from "@/lib/api";

// In-memory cache of adapted lesson payloads, keyed by request signature.
const adaptCache = new Map();

function adaptKey({ masterclassSlug, lessonSlug, language, region }) {
  const r = region
    ? `${region.name || ""}|${region.country || ""}|${region.climate_zone || ""}|${region.hemisphere || ""}`
    : "";
  return `${masterclassSlug}|${lessonSlug}|${language}|${r}`;
}

const PERSONALISE_ELIGIBLE = new Set(["pest-control", "plant-care", "seasonal-planting"]);

function useAdaptedLesson({ masterclass, lesson, language, region, personalise }) {
  const targetRegion = personalise ? region : null;
  const key = adaptKey({
    masterclassSlug: masterclass.slug,
    lessonSlug: lesson.slug,
    language,
    region: targetRegion,
  });
  const [data, setData] = useState(() => adaptCache.get(key) || null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // English with no personalisation = original content; no fetch needed.
    if (language === "en" && !targetRegion) {
      setData(null);
      return;
    }
    if (adaptCache.has(key)) {
      setData(adaptCache.get(key));
      return;
    }
    let cancelled = false;
    setLoading(true);
    api.post("/lesson-adapt", {
      masterclass_slug: masterclass.slug,
      lesson_slug: lesson.slug,
      lesson_title: lesson.title,
      body: lesson.body || [],
      steps_title: lesson.steps?.title || null,
      steps_items: lesson.steps?.items || [],
      box_items: (lesson.boxes || []).flatMap((b) => b.items),
      tip: lesson.tip || null,
      language,
      region: targetRegion ? {
        name: targetRegion.name,
        country: targetRegion.country,
        latitude: targetRegion.latitude,
        longitude: targetRegion.longitude,
        climate_zone: targetRegion.climate_zone,
        hemisphere: targetRegion.hemisphere,
      } : null,
    })
      .then((r) => {
        if (cancelled) return;
        adaptCache.set(key, r.data);
        setData(r.data);
      })
      .catch(() => !cancelled && setData(null))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, language, targetRegion, masterclass.slug, lesson.slug, lesson.title, lesson.body, lesson.tip, lesson.steps, lesson.boxes]);

  return { data, loading, key };
}

function buildBoxItemsView(originalBoxes, flatItems) {
  // Re-shape a flat list back into the original boxes structure (same shape, same lengths).
  if (!flatItems || flatItems.length === 0) return originalBoxes || [];
  const out = [];
  let cursor = 0;
  for (const box of originalBoxes || []) {
    const len = box.items.length;
    out.push({ label: box.label, items: flatItems.slice(cursor, cursor + len) });
    cursor += len;
  }
  return out;
}

export default function MasterclassDetailPage() {
  const { slug, lessonSlug } = useParams();
  const navigate = useNavigate();
  const { region } = useRegion();
  const { lang, t } = useI18n();

  const masterclass = ALL_MASTERCLASSES[slug];
  const { completed, toggle, isDone } = useMasterclassProgress(slug || "");
  const [personalise, setPersonalise] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const currentLesson = useMemo(() => {
    if (!masterclass) return null;
    if (!lessonSlug) return masterclass.lessons[0];
    return masterclass.lessons.find((l) => l.slug === lessonSlug) || masterclass.lessons[0];
  }, [masterclass, lessonSlug]);

  // "Up next" suggestion list — first two other masterclasses. Memoised because
  // it ran on every render including during the in-progress reading state.
  const nextMasterclasses = useMemo(
    () => Object.keys(ALL_MASTERCLASSES).filter((s) => s !== slug).slice(0, 2),
    [slug]
  );

  const adaptable = !!currentLesson && (lang !== "en" || PERSONALISE_ELIGIBLE.has(slug));
  const { data: adapted, loading: adapting } = useAdaptedLesson({
    masterclass: masterclass || { slug: "" },
    lesson: currentLesson || { slug: "", body: [] },
    language: lang,
    region,
    personalise: personalise && PERSONALISE_ELIGIBLE.has(slug),
  });

  if (!masterclass) {
    return (
      <div className="container-narrow py-16">
        <p className="text-terracotta">{t("mc.not_found")}</p>
        <Link to="/masterclasses" className="btn-ghost mt-4 inline-flex">{t("mc.all_masterclasses")}</Link>
      </div>
    );
  }

  // Resolve a lesson's display title — prefers translated i18n value if a key
  // exists, otherwise falls back to the lesson.title in the data file. New
  // masterclasses (e.g. flower-arranging) don't need a sprawling i18n migration
  // before they can render.
  const lessonTitle = (lesson) => {
    const key = `mc.lesson.${slug}.${lesson.slug}`;
    const translated = t(key);
    return translated && translated !== key ? translated : lesson.title;
  };

  const currentIndex = masterclass.lessons.findIndex((l) => l.slug === currentLesson.slug);
  const prev = currentIndex > 0 ? masterclass.lessons[currentIndex - 1] : null;
  const next = currentIndex < masterclass.lessons.length - 1 ? masterclass.lessons[currentIndex + 1] : null;
  const doneCount = Object.values(completed).filter(Boolean).length;
  const total = masterclass.lessons.length;
  const Icon = masterclass.icon;

  // Compute the display content (adapted overrides original where present)
  const body = adapted?.body?.length ? adapted.body : (currentLesson.body || []);
  const stepsItems = adapted?.steps_items?.length
    ? adapted.steps_items
    : (currentLesson.steps?.items || []);
  const boxes = buildBoxItemsView(currentLesson.boxes, adapted?.box_items);
  const tip = adapted?.tip || currentLesson.tip;

  const lessonHeroSubject = `${masterclass.title}: ${currentLesson.title} — botanical editorial photograph, soft natural light, terracotta and cream palette`;
  const lessonHeroKey = `lesson-hero:${slug}:${currentLesson.slug}`;

  return (
    <PremiumGate>
    <div className="container-narrow py-12 md:py-16 animate-fade-up" data-testid={`masterclass-detail-${slug}`}>
      <Link to="/masterclasses" data-testid="back-to-masterclasses" className="inline-flex items-center gap-2 text-moss hover:text-forest mb-8">
        <ArrowLeft strokeWidth={1.5} className="w-4 h-4" /> {t("mc.all_masterclasses")}
      </Link>

      <div className="grid md:grid-cols-12 gap-10">
        {/* Sidebar */}
        <aside className="md:col-span-4 lg:col-span-3">
          <div className="md:sticky md:top-8">
            <div className="flex items-center gap-3 mb-3">
              <Icon strokeWidth={1.4} className="w-4 h-4 text-terracotta" />
              <span className="overline">{t("mc.label")}</span>
            </div>
            <h2 className="font-serif text-3xl text-forest leading-tight">{t(`mc.title.${slug}`)}</h2>
            <p className="text-sm text-moss mt-1">{(masterclass.duration || "").match(/(\d+)/) ? t("mc.duration_about", { min: masterclass.duration.match(/(\d+)/)[1] }) : masterclass.duration}</p>

            <div className="mt-5">
              <div className="h-1 bg-border overflow-hidden">
                <div
                  className="h-1 bg-terracotta transition-all"
                  style={{ width: `${(doneCount / total) * 100}%` }}
                  data-testid="masterclass-detail-progress"
                />
              </div>
              <p className="text-xs text-moss mt-2">{t("mc.progress_label", { done: doneCount, total })}</p>
            </div>

            <ol className="mt-8 space-y-1" data-testid="lesson-list">
              {masterclass.lessons.map((lesson, i) => {
                const active = lesson.slug === currentLesson.slug;
                const done = isDone(lesson.slug);
                return (
                  <li key={lesson.slug}>
                    <Link
                      to={`/masterclasses/${slug}/${lesson.slug}`}
                      data-testid={`lesson-nav-${lesson.slug}`}
                      className={`flex items-start gap-3 px-3 py-2.5 border-l-2 transition-colors ${
                        active
                          ? "border-terracotta bg-surface text-forest"
                          : "border-transparent hover:bg-surface/60 text-ink/75"
                      }`}
                    >
                      <span className={`mt-1 w-4 h-4 border flex-shrink-0 flex items-center justify-center ${
                        done ? "bg-forest border-forest" : "border-forest/40"
                      }`}>
                        {done && <Check strokeWidth={2.5} className="w-3 h-3 text-sand" />}
                      </span>
                      <span className="flex-1">
                        <span className="block text-[10px] tracking-[0.18em] uppercase text-moss">
                          {t("mc.lesson_number", { n: i + 1 })}
                        </span>
                        <span className={`block text-sm ${active ? "font-medium" : ""}`}>{lessonTitle(lesson)}</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>

        {/* Main content */}
        <article className="md:col-span-8 lg:col-span-9 max-w-3xl" data-testid={`lesson-content-${currentLesson.slug}`}>
          <p className="overline">{t("mc.lesson_number", { n: currentIndex + 1 })}</p>
          <h1 className="font-serif text-4xl md:text-5xl text-forest mt-3 tracking-tight">{lessonTitle(currentLesson)}</h1>

          {/* Adapt CTA bar (translation + regional personalisation) */}
          {(lang !== "en" || PERSONALISE_ELIGIBLE.has(slug)) && (
            <div className="mt-6 flex flex-wrap items-center gap-3 text-sm" data-testid="adapt-bar">
              {lang !== "en" && (
                <span className="inline-flex items-center gap-2 text-moss">
                  <Languages strokeWidth={1.5} className="w-4 h-4" />
                  {adapted?.translated ? t("mc.translated") : adapting ? t("mc.translating") : t("mc.auto_translating")}
                </span>
              )}
              {PERSONALISE_ELIGIBLE.has(slug) && (
                region ? (
                  <button
                    type="button"
                    data-testid="personalise-btn"
                    onClick={() => setPersonalise((p) => !p)}
                    className={`inline-flex items-center gap-2 px-3 py-1.5 border transition-colors ${
                      personalise ? "bg-forest text-sand border-forest" : "bg-sand text-forest border-forest/40 hover:bg-forest/5"
                    }`}
                  >
                    {adapting && personalise ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" strokeWidth={1.5} />}
                    {personalise ? `Personalised for ${region.name}` : `Apply to ${region.name}`}
                  </button>
                ) : (
                  <span className="inline-flex items-center gap-2 text-moss">
                    <MapPin strokeWidth={1.5} className="w-4 h-4" />
                    Set your region to personalise this lesson.
                  </span>
                )
              )}
            </div>
          )}

          {/* Lesson hero image (lazy) */}
          <div className="mt-8 aspect-[16/9] overflow-hidden border border-border bg-surface">
            <TopicImage subject={lessonHeroSubject} cacheKey={lessonHeroKey} alt={currentLesson.title} eager />
          </div>

          {body.length > 0 && (
            <div className="mt-8 space-y-5">
              {body.map((p, i) => (
                <p key={`p-${i}`} className="text-ink/80 leading-relaxed text-lg">{p}</p>
              ))}
            </div>
          )}

          {currentLesson.steps && stepsItems.length > 0 && (
            <section className="mt-12">
              <h2 className="font-serif text-2xl text-forest mb-5">{currentLesson.steps.title}</h2>
              <ol className="space-y-4">
                {stepsItems.map((s, i) => (
                  <li key={`step-${i}`} className="flex gap-4 leading-relaxed">
                    <span className="font-serif text-2xl text-terracotta flex-shrink-0 w-8">{i + 1}</span>
                    <span className="text-ink/80 pt-1">{s}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {boxes.map((box, bi) => (
            <section key={`box-${bi}`} className="mt-10 card-flat p-6">
              <p className="overline">{box.label}</p>
              <ul className="mt-4 space-y-3">
                {box.items.map((it, i) => (
                  <li key={`bi-${i}`} className="flex gap-3 text-ink/80 leading-relaxed">
                    <span className="text-terracotta mt-1.5 w-1 h-1 bg-terracotta rounded-full flex-shrink-0" />
                    <span>{it}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}

          {tip && (
            <div className="mt-10 border-l-2 border-terracotta pl-5 py-2 flex gap-4 items-start">
              <Lightbulb strokeWidth={1.4} className="w-5 h-5 text-terracotta flex-shrink-0 mt-1" />
              <p className="font-serif text-xl text-forest italic leading-relaxed">{tip}</p>
            </div>
          )}

          {/* Mark complete + nav */}
          <div className="mt-14 border-t border-border pt-8 flex flex-wrap items-center gap-4 justify-between">
            <button
              type="button"
              onClick={() => {
                const wasDone = isDone(currentLesson.slug);
                toggle(currentLesson.slug);
                // If we just completed the FINAL lesson and all others are done, open share.
                const completingAll = !wasDone &&
                  Object.values({ ...completed, [currentLesson.slug]: true }).filter(Boolean).length === total;
                if (completingAll) {
                  setTimeout(() => setShareOpen(true), 350);
                } else if (!wasDone && next) {
                  setTimeout(() => navigate(`/masterclasses/${slug}/${next.slug}`), 250);
                }
              }}
              data-testid="mark-complete-btn"
              className={`inline-flex items-center gap-2 ${
                isDone(currentLesson.slug) ? "btn-ghost" : "btn-forest"
              }`}
            >
              <Check strokeWidth={1.5} className="w-4 h-4" />
              {isDone(currentLesson.slug) ? t("mc.marked_complete") : next ? t("mc.mark_complete_continue") : t("mc.mark_complete")}
            </button>

            <div className="flex gap-3 flex-wrap">
              <ShareLessonButton
                topicSlug={slug}
                title={t(`mc.title.${slug}`)}
                tagline={t(`mc.tagline.${slug}`)}
              />
              {prev && (
                <Link to={`/masterclasses/${slug}/${prev.slug}`} data-testid="lesson-prev" className="btn-ghost inline-flex items-center gap-2">
                  <ArrowLeft strokeWidth={1.5} className="w-4 h-4" /> {t("mc.previous")}
                </Link>
              )}
              {next && (
                <Link to={`/masterclasses/${slug}/${next.slug}`} data-testid="lesson-next" className="btn-ghost inline-flex items-center gap-2">
                  {t("mc.next")} <ArrowRight strokeWidth={1.5} className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>

          {/* End of masterclass */}
          {!next && doneCount === total && (
            <div className="mt-12 card-flat p-8 text-center" data-testid="masterclass-complete">
              <GraduationCap strokeWidth={1.3} className="w-8 h-8 text-terracotta mx-auto mb-4" />
              <h3 className="font-serif text-3xl text-forest">{t("mc.complete_title")}</h3>
              <p className="text-moss mt-3">{t("mc.complete_subtitle")}</p>
              <div className="flex flex-wrap gap-3 justify-center mt-6">
                <button
                  type="button"
                  data-testid="open-share-btn"
                  onClick={() => setShareOpen(true)}
                  className="btn-terracotta inline-flex items-center gap-2"
                >
                  <Download className="w-4 h-4" strokeWidth={1.5} /> {t("mc.get_share_card")}
                </button>
                {nextMasterclasses.map((s) => (
                  <Link key={s} to={`/masterclasses/${s}`} className="btn-ghost">
                    {t(`mc.title.${s}`)} →
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>
      </div>

      <ShareCard
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        masterclassSlug={slug}
        masterclassTitle={masterclass.title}
        regionName={region?.name}
      />
    </div>
    </PremiumGate>
  );
}
