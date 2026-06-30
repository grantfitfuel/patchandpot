/**
 * PopularPlants — homepage rail showing the most-viewed curated plants
 * from the last 7 days. Pulls from /api/plants/popular which is fed by
 * the same `plant_stats.view_count_7d` counter that powers <PlantOfTheWeek>.
 *
 * Purpose:
 *   • Drives discovery toward already-cached AI-content (= no extra LLM spend)
 *   • Creates a flywheel — popular plants become more visible, get more
 *     visits, climb higher, get even more visible
 *   • Gives anonymous visitors a "what's everyone growing?" hook before
 *     they commit to picking a region or signing up
 *
 * Renders nothing while loading or if the list is empty — so a fresh
 * install or a quiet week doesn't show an empty rail.
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Flame, Eye } from "lucide-react";
import PlantImage from "@/components/PlantImage";
import { fetchPopularPlants } from "@/lib/api";
import { useI18n } from "@/i18n";

export default function PopularPlants({ limit = 8 }) {
  const { t, lang } = useI18n();
  const [state, setState] = useState({ status: "loading", items: [] });

  useEffect(() => {
    let cancelled = false;
    fetchPopularPlants(limit, lang)
      .then((d) => {
        if (cancelled) return;
        setState({ status: "ok", items: Array.isArray(d?.items) ? d.items : [] });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "ok", items: [] });
      });
    return () => { cancelled = true; };
  }, [lang, limit]);

  // Need at least 4 items to fill a row — anything less looks lonely
  // next to the rest of the homepage so we just hide the rail.
  if (state.status !== "ok" || state.items.length < 4) return null;

  return (
    <section
      className="border-t border-border bg-surface/30"
      data-testid="home-popular-plants"
    >
      <div className="container-narrow py-20 md:py-24">
        <div className="flex flex-wrap items-end justify-between gap-4 mb-10">
          <div className="min-w-0 flex-1 max-w-2xl">
            <div className="flex items-center gap-2">
              <Flame strokeWidth={1.4} className="w-4 h-4 text-terracotta" />
              <span className="overline">{t("home.popular.eyebrow")}</span>
            </div>
            <h2 className="font-serif text-4xl md:text-5xl text-forest mt-3 leading-tight">
              {t("home.popular.title")}
            </h2>
            <p className="mt-4 text-ink/75 leading-relaxed">
              {t("home.popular.body")}
            </p>
          </div>
          <Link
            to="/plants"
            data-testid="home-popular-more"
            className="text-sm text-moss hover:text-terracotta underline-offset-4 hover:underline inline-flex items-center gap-1.5 flex-shrink-0"
          >
            {t("home.popular.more")}
            <ArrowRight strokeWidth={1.5} className="w-3.5 h-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
          {state.items.slice(0, limit).map(({ plant, view_count_7d }) => (
            <Link
              key={plant.id}
              to={plant.id?.startsWith("ai-") ? `/plants/ai/${plant.id}` : `/plants/${plant.id}`}
              data-testid={`popular-card-${plant.id}`}
              className="card-flat group flex flex-col"
            >
              <div className="aspect-[4/3] overflow-hidden bg-surface">
                <PlantImage plant={plant} />
              </div>
              <div className="p-4 flex flex-col flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-serif text-lg text-forest leading-tight">
                    {plant.name}
                  </h3>
                  <span
                    className="inline-flex items-center gap-1 text-[0.65rem] text-moss/80 flex-shrink-0 mt-1"
                    aria-label={t("home.popular.views_label", { count: view_count_7d })}
                  >
                    <Eye className="w-3 h-3" strokeWidth={1.5} />
                    {view_count_7d}
                  </span>
                </div>
                {plant.summary && (
                  <p className="text-xs text-ink/65 mt-1.5 line-clamp-2 leading-snug">
                    {plant.summary}
                  </p>
                )}
                <p className="text-[0.65rem] text-moss/70 mt-3 uppercase tracking-wider">
                  {plant.category} · {plant.difficulty}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
