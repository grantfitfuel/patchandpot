import { Link } from "react-router-dom";
import { ArrowRight, GraduationCap } from "lucide-react";
import { MASTERCLASSES, MASTERCLASS_ORDER } from "@/data/masterclasses";
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
        Three structured courses in plain language — propagation, pest control, and plant care.
        Read at your own pace, mark lessons complete, come back across seasons.
      </p>

      <div className="grid md:grid-cols-3 gap-6 mt-12" data-testid="masterclasses-grid">
        {MASTERCLASS_ORDER.map((slug) => {
          const m = MASTERCLASSES[slug];
          const Icon = m.icon;
          const done = Object.values(progress[slug] || {}).filter(Boolean).length;
          const total = m.lessons.length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;

          return (
            <Link
              key={slug}
              to={`/masterclasses/${slug}`}
              data-testid={`masterclass-card-${slug}`}
              className="card-flat overflow-hidden flex flex-col group"
            >
              <div className="aspect-[4/3] overflow-hidden">
                <img src={m.image} alt={m.title} className="object-cover w-full h-full transition-transform duration-500 group-hover:scale-105" />
              </div>
              <div className="p-6 flex flex-col flex-1">
                <div className="flex items-center gap-3">
                  <Icon strokeWidth={1.4} className="w-4 h-4 text-terracotta" />
                  <span className="overline">{m.duration}</span>
                </div>
                <h3 className="font-serif text-3xl text-forest mt-3">{m.title}</h3>
                <p className="text-ink/75 mt-3 flex-1 leading-relaxed">{m.tagline}</p>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="h-1 bg-border overflow-hidden">
                      <div
                        className="h-1 bg-terracotta transition-all"
                        style={{ width: `${pct}%` }}
                        data-testid={`masterclass-progress-${slug}`}
                      />
                    </div>
                    <p className="text-xs text-moss mt-2">
                      {done} of {total} lessons {done === total && total > 0 ? "· complete" : ""}
                    </p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-forest group-hover:translate-x-1 transition-transform" strokeWidth={1.5} />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
