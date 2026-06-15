import { Link } from "react-router-dom";
import { ArrowRight, GraduationCap } from "lucide-react";
import { ALL_MASTERCLASSES, MASTERCLASS_SECTIONS } from "@/data/all-masterclasses";
import { useAllMasterclassProgress } from "@/hooks/useMasterclassProgress";

export default function MasterclassesPage() {
  const progress = useAllMasterclassProgress();

  return (
    <div className="container-narrow py-12 md:py-16 animate-fade-up">
      <div className="flex items-center gap-3 mb-3">
        <GraduationCap strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
        <span className="overline">Masterclasses</span>
      </div>
      <h1 className="font-serif text-5xl md:text-6xl text-forest tracking-tight">
        Learn to grow, deeply.
      </h1>
      <p className="mt-4 text-ink/75 max-w-2xl leading-relaxed text-lg">
        Structured courses in plain language — foundations of growing, plus deep dives into the
        flowers you love most. Read at your own pace, mark lessons complete, come back across seasons.
      </p>

      {MASTERCLASS_SECTIONS.map((section, idx) => (
        <section key={section.key} className={idx === 0 ? "mt-14" : "mt-20"} data-testid={`section-${section.key}`}>
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8 border-b border-border pb-4">
            <div>
              <p className="overline">{section.label}</p>
              <h2 className="font-serif text-3xl md:text-4xl text-forest mt-2">{section.title}</h2>
              <p className="text-ink/70 mt-2 max-w-xl">{section.description}</p>
            </div>
            <p className="text-sm text-moss">{section.order.length} course{section.order.length === 1 ? "" : "s"}</p>
          </div>

          <div className={section.key === "flowers"
            ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5"
            : "grid md:grid-cols-3 gap-6"
          } data-testid={`grid-${section.key}`}>
            {section.order.map((slug) => {
              const m = ALL_MASTERCLASSES[slug];
              if (!m) return null;
              const Icon = m.icon;
              const done = Object.values(progress[slug] || {}).filter(Boolean).length;
              const total = m.lessons.length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              const isCompact = section.key === "flowers";

              return (
                <Link
                  key={slug}
                  to={`/masterclasses/${slug}`}
                  data-testid={`masterclass-card-${slug}`}
                  className="card-flat overflow-hidden flex flex-col group"
                >
                  <div className={isCompact ? "aspect-square overflow-hidden" : "aspect-[4/3] overflow-hidden"}>
                    <img src={m.image} alt={m.title} className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105" />
                  </div>
                  <div className={isCompact ? "p-4 flex flex-col flex-1" : "p-6 flex flex-col flex-1"}>
                    <div className="flex items-center gap-2">
                      <Icon strokeWidth={1.4} className="w-4 h-4 text-terracotta flex-shrink-0" />
                      <span className="overline truncate">{m.duration}</span>
                    </div>
                    <h3 className={isCompact ? "font-serif text-xl text-forest mt-2" : "font-serif text-3xl text-forest mt-3"}>
                      {m.title}
                    </h3>
                    {!isCompact && <p className="text-ink/75 mt-3 flex-1 leading-relaxed">{m.tagline}</p>}
                    {isCompact && <p className="text-xs text-ink/70 mt-2 flex-1 leading-snug line-clamp-2">{m.tagline}</p>}

                    <div className={isCompact ? "mt-4" : "mt-6 flex items-center justify-between gap-3"}>
                      <div className="flex-1">
                        <div className="h-1 bg-border overflow-hidden">
                          <div
                            className="h-1 bg-terracotta transition-all"
                            style={{ width: `${pct}%` }}
                            data-testid={`masterclass-progress-${slug}`}
                          />
                        </div>
                        <p className="text-[11px] text-moss mt-1.5">
                          {done}/{total} {done === total && total > 0 ? "✓" : "lessons"}
                        </p>
                      </div>
                      {!isCompact && (
                        <ArrowRight className="w-4 h-4 text-forest group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
