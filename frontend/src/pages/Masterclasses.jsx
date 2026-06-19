import { Link } from "react-router-dom";
import { ArrowRight, GraduationCap } from "lucide-react";
import { ALL_MASTERCLASSES, MASTERCLASS_SECTIONS } from "@/data/all-masterclasses";
import { useAllMasterclassProgress } from "@/hooks/useMasterclassProgress";
import { useI18n } from "@/i18n";
import TopicImage from "@/components/TopicImage";
import AIMasterclassSuggest from "@/components/AIMasterclassSuggest";

function MasterclassCardImage({ masterclass, compact }) {
  // Foundation classes have a static `image` URL; flower classes use AI generation.
  const aspect = compact ? "aspect-square" : "aspect-[4/3]";
  if (masterclass.imageSubject) {
    return (
      <div className={`${aspect} overflow-hidden bg-surface`}>
        <TopicImage
          subject={masterclass.imageSubject}
          cacheKey={`masterclass-card:${masterclass.slug}`}
          alt={masterclass.title}
          eager
          className="transition-transform duration-500 group-hover:scale-105"
        />
      </div>
    );
  }
  return (
    <div className={`${aspect} overflow-hidden`}>
      <img src={masterclass.image} alt={masterclass.title}
        className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105" />
    </div>
  );
}

// Pull the integer minute count from "About 45 minutes" so we can re-format it in any locale.
function localisedDuration(m, t) {
  const raw = m.duration || "";
  const match = raw.match(/(\d+)/);
  if (match) return t("mc.duration_about", { min: match[1] });
  return raw;
}

export default function MasterclassesPage() {
  const progress = useAllMasterclassProgress();
  const { t } = useI18n();

  return (
    <div className="container-narrow py-12 md:py-16 animate-fade-up">
      <div className="flex items-center gap-3 mb-3">
        <GraduationCap strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
        <span className="overline">{t("mc.list_eyebrow")}</span>
      </div>
      <h1 className="font-serif text-5xl md:text-6xl text-forest tracking-tight">
        {t("mc.list_title")}
      </h1>
      <p className="mt-4 text-ink/75 max-w-2xl leading-relaxed text-lg">
        {t("mc.list_intro")}
      </p>

      <AIMasterclassSuggest />

      {MASTERCLASS_SECTIONS.map((section, idx) => (
        <section key={section.key} className={idx === 0 ? "mt-14" : "mt-20"} data-testid={`section-${section.key}`}>
          <div className="flex flex-wrap items-end justify-between gap-4 mb-8 border-b border-border pb-4">
            <div>
              <p className="overline">{t(`mc.section.${section.key}.label`)}</p>
              <h2 className="font-serif text-3xl md:text-4xl text-forest mt-2">{t(`mc.section.${section.key}.title`)}</h2>
              <p className="text-ink/70 mt-2 max-w-xl">{t(`mc.section.${section.key}.description`)}</p>
            </div>
            <p className="text-sm text-moss">{section.order.length} {section.order.length === 1 ? t("mc.courses_singular") : t("mc.courses_plural")}</p>
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
                  <MasterclassCardImage masterclass={m} compact={isCompact} />
                  <div className={isCompact ? "p-4 flex flex-col flex-1" : "p-6 flex flex-col flex-1"}>
                    <div className="flex items-center gap-2">
                      <Icon strokeWidth={1.4} className="w-4 h-4 text-terracotta flex-shrink-0" />
                      <span className="overline truncate">{localisedDuration(m, t)}</span>
                    </div>
                    <h3 className={isCompact ? "font-serif text-xl text-forest mt-2" : "font-serif text-3xl text-forest mt-3"}>
                      {t(`mc.title.${slug}`)}
                    </h3>
                    {!isCompact && <p className="text-ink/75 mt-3 flex-1 leading-relaxed">{t(`mc.tagline.${slug}`)}</p>}
                    {isCompact && <p className="text-xs text-ink/70 mt-2 flex-1 leading-snug line-clamp-2">{t(`mc.tagline.${slug}`)}</p>}

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
                          {done}/{total} {done === total && total > 0 ? "✓" : t("mc.lessons_label")}
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
