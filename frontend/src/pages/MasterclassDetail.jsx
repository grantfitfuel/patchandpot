import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check, GraduationCap, Lightbulb } from "lucide-react";
import { ALL_MASTERCLASSES } from "@/data/all-masterclasses";
import { useMasterclassProgress } from "@/hooks/useMasterclassProgress";

export default function MasterclassDetailPage() {
  const { slug, lessonSlug } = useParams();
  const navigate = useNavigate();

  const masterclass = ALL_MASTERCLASSES[slug];
  const { completed, toggle, isDone } = useMasterclassProgress(slug || "");

  const currentLesson = useMemo(() => {
    if (!masterclass) return null;
    if (!lessonSlug) return masterclass.lessons[0];
    return masterclass.lessons.find((l) => l.slug === lessonSlug) || masterclass.lessons[0];
  }, [masterclass, lessonSlug]);

  if (!masterclass) {
    return (
      <div className="container-narrow py-16">
        <p className="text-terracotta">Masterclass not found.</p>
        <Link to="/masterclasses" className="btn-ghost mt-4 inline-flex">All masterclasses</Link>
      </div>
    );
  }

  const currentIndex = masterclass.lessons.findIndex((l) => l.slug === currentLesson.slug);
  const prev = currentIndex > 0 ? masterclass.lessons[currentIndex - 1] : null;
  const next = currentIndex < masterclass.lessons.length - 1 ? masterclass.lessons[currentIndex + 1] : null;
  const doneCount = Object.values(completed).filter(Boolean).length;
  const total = masterclass.lessons.length;

  const Icon = masterclass.icon;

  return (
    <div className="container-narrow py-12 md:py-16 animate-fade-up" data-testid={`masterclass-detail-${slug}`}>
      <Link to="/masterclasses" data-testid="back-to-masterclasses" className="inline-flex items-center gap-2 text-moss hover:text-forest mb-8">
        <ArrowLeft strokeWidth={1.5} className="w-4 h-4" /> All masterclasses
      </Link>

      <div className="grid md:grid-cols-12 gap-10">
        {/* Sidebar - lesson list */}
        <aside className="md:col-span-4 lg:col-span-3">
          <div className="md:sticky md:top-8">
            <div className="flex items-center gap-3 mb-3">
              <Icon strokeWidth={1.4} className="w-4 h-4 text-terracotta" />
              <span className="overline">Masterclass</span>
            </div>
            <h2 className="font-serif text-3xl text-forest leading-tight">{masterclass.title}</h2>
            <p className="text-sm text-moss mt-1">{masterclass.duration}</p>

            <div className="mt-5">
              <div className="h-1 bg-border overflow-hidden">
                <div
                  className="h-1 bg-terracotta transition-all"
                  style={{ width: `${(doneCount / total) * 100}%` }}
                  data-testid="masterclass-detail-progress"
                />
              </div>
              <p className="text-xs text-moss mt-2">{doneCount} of {total} complete</p>
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
                          Lesson {i + 1}
                        </span>
                        <span className={`block text-sm ${active ? "font-medium" : ""}`}>{lesson.title}</span>
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
          <p className="overline">{currentLesson.eyebrow}</p>
          <h1 className="font-serif text-4xl md:text-5xl text-forest mt-3 tracking-tight">{currentLesson.title}</h1>

          {currentLesson.body && (
            <div className="mt-8 space-y-5">
              {currentLesson.body.map((p, i) => (
                <p key={`p-${i}`} className="text-ink/80 leading-relaxed text-lg">{p}</p>
              ))}
            </div>
          )}

          {currentLesson.steps && (
            <section className="mt-12">
              <h2 className="font-serif text-2xl text-forest mb-5">{currentLesson.steps.title}</h2>
              <ol className="space-y-4">
                {currentLesson.steps.items.map((s, i) => (
                  <li key={`step-${i}`} className="flex gap-4 leading-relaxed">
                    <span className="font-serif text-2xl text-terracotta flex-shrink-0 w-8">{i + 1}</span>
                    <span className="text-ink/80 pt-1">{s}</span>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {currentLesson.boxes && currentLesson.boxes.map((box, bi) => (
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

          {currentLesson.tip && (
            <div className="mt-10 border-l-2 border-terracotta pl-5 py-2 flex gap-4 items-start">
              <Lightbulb strokeWidth={1.4} className="w-5 h-5 text-terracotta flex-shrink-0 mt-1" />
              <p className="font-serif text-xl text-forest italic leading-relaxed">{currentLesson.tip}</p>
            </div>
          )}

          {/* Mark complete + nav */}
          <div className="mt-14 border-t border-border pt-8 flex flex-wrap items-center gap-4 justify-between">
            <button
              type="button"
              onClick={() => {
                toggle(currentLesson.slug);
                if (!isDone(currentLesson.slug) && next) {
                  setTimeout(() => navigate(`/masterclasses/${slug}/${next.slug}`), 250);
                }
              }}
              data-testid="mark-complete-btn"
              className={`inline-flex items-center gap-2 ${
                isDone(currentLesson.slug) ? "btn-ghost" : "btn-forest"
              }`}
            >
              <Check strokeWidth={1.5} className="w-4 h-4" />
              {isDone(currentLesson.slug) ? "Marked complete" : next ? "Mark complete & continue" : "Mark complete"}
            </button>

            <div className="flex gap-3">
              {prev && (
                <Link
                  to={`/masterclasses/${slug}/${prev.slug}`}
                  data-testid="lesson-prev"
                  className="btn-ghost inline-flex items-center gap-2"
                >
                  <ArrowLeft strokeWidth={1.5} className="w-4 h-4" /> Previous
                </Link>
              )}
              {next && (
                <Link
                  to={`/masterclasses/${slug}/${next.slug}`}
                  data-testid="lesson-next"
                  className="btn-ghost inline-flex items-center gap-2"
                >
                  Next <ArrowRight strokeWidth={1.5} className="w-4 h-4" />
                </Link>
              )}
            </div>
          </div>

          {/* End of masterclass */}
          {!next && doneCount === total && (
            <div className="mt-12 card-flat p-8 text-center" data-testid="masterclass-complete">
              <GraduationCap strokeWidth={1.3} className="w-8 h-8 text-terracotta mx-auto mb-4" />
              <h3 className="font-serif text-3xl text-forest">Masterclass complete.</h3>
              <p className="text-moss mt-3">
                Now do it. The plants are waiting.
              </p>
              <div className="flex flex-wrap gap-3 justify-center mt-6">
                {Object.keys(ALL_MASTERCLASSES)
                  .filter((s) => s !== slug)
                  .slice(0, 3)
                  .map((s) => (
                    <Link key={s} to={`/masterclasses/${s}`} className="btn-ghost">
                      {ALL_MASTERCLASSES[s].title} →
                    </Link>
                  ))}
              </div>
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
