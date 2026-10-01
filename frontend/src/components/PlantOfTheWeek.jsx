import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, Sprout } from "lucide-react";
import { fetchPlantOfTheWeek } from "@/lib/api";
import { useI18n } from "@/i18n";

/**
 * Homepage "Plant of the week" hero rail.
 *
 *   - Picks the single most-viewed plant from the last 7 days, hydrated for
 *     the active locale via /api/plants/of-the-week.
 *   - Side-by-side composition: big plant OG card image on the left, plant
 *     name + summary + facts + CTA on the right.
 *   - Renders nothing while loading or when the rail is empty — so the
 *     homepage doesn't splash a placeholder card in the first days after
 *     launch before any plants have been viewed.
 *
 * The big OG card image doubles as a giveaway: anyone sharing the homepage
 * itself will see this card front-and-centre and want their patch on it.
 */
export default function PlantOfTheWeek() {
  const { t, lang } = useI18n();
  const [state, setState] = useState({ status: "loading", data: null });

  useEffect(() => {
    let cancelled = false;
    fetchPlantOfTheWeek(lang)
      .then((d) => { if (!cancelled) setState({ status: "ok", data: d }); })
      .catch(() => { if (!cancelled) setState({ status: "ok", data: { plant: null } }); });
    return () => { cancelled = true; };
  }, [lang]);

  if (state.status !== "ok" || !state.data?.plant) return null;

  const p = state.data.plant;
  const views = state.data.view_count_7d || 0;
  const link = p.id?.startsWith("ai-") ? `/plants/ai/${p.id}` : `/plants/${p.id}`;
  const stats = [
    p.category   && { k: t("plant.category"),   v: p.category   },
    p.difficulty && { k: t("plant.difficulty"), v: p.difficulty },
    p.sun        && { k: t("plant.sun"),        v: p.sun        },
    p.water      && { k: t("plant.water"),      v: p.water      },
  ].filter(Boolean);

  return (
    <section
      data-testid="plant-of-the-week"
      className="bg-sand py-14 md:py-16"
    >
      <div className="container-narrow">
        <p className="overline mb-6" data-testid="plant-of-the-week-eyebrow">
          <Sparkles strokeWidth={1.5} className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5 text-terracotta" />
          {t("home.plant_of_the_week.eyebrow")}
        </p>

        {/* Full-width terracotta spotlight. No OG image — the previous
            version duplicated the plant name / stats that were baked
            into the share-card PNG. All-typography now, with a giant
            translucent Sprout icon anchoring the right side as the
            decorative mark. Whole card is clickable. */}
        <Link
          to={link}
          data-testid="plant-of-the-week-image-link"
          className="block rounded-3xl overflow-hidden bg-terracotta text-sand p-6 md:p-12 lg:p-14 relative shadow-[0_20px_50px_rgba(0,0,0,0.08)] group"
        >
          {/* Decorative sprout — large, low-opacity, bottom-right so it
              never clashes with copy at any width. */}
          <Sprout
            aria-hidden="true"
            strokeWidth={0.9}
            className="absolute -right-10 -bottom-10 w-72 h-72 md:w-96 md:h-96 text-sand/15 pointer-events-none transition-transform duration-700 group-hover:rotate-6"
          />

          <div className="relative max-w-2xl">
            <h2 className="font-serif text-4xl md:text-6xl lg:text-7xl text-sand tracking-tight leading-[1.02] text-balance">
              {p.name}
            </h2>
            {p.botanical && (
              <p className="mt-2 font-serif italic text-sand/75 text-lg md:text-xl">
                {p.botanical}
              </p>
            )}
            {p.summary && (
              <p className="mt-6 text-lg md:text-xl text-sand/90 leading-relaxed" data-testid="plant-of-the-week-summary">
                {p.summary}
              </p>
            )}

            {stats.length > 0 && (
              <ul className="mt-7 flex flex-wrap gap-x-8 gap-y-4">
                {stats.map(({ k, v }) => (
                  <li key={k}>
                    <p className="overline text-sand/65">{k}</p>
                    <p className="mt-1 text-sand font-medium">{v}</p>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-9 flex flex-wrap items-center gap-5">
              <span
                data-testid="plant-of-the-week-cta"
                className="inline-flex items-center gap-2 rounded-full bg-sand hover:bg-white text-forest px-6 py-3 font-medium tracking-wide transition-colors"
              >
                <Sprout strokeWidth={1.5} className="w-4 h-4" />
                {t("home.plant_of_the_week.cta", { name: p.name })}
                <ArrowRight strokeWidth={1.5} className="w-4 h-4" />
              </span>
              {views > 0 && (
                <span className="text-xs uppercase tracking-wider text-sand/70" data-testid="plant-of-the-week-views">
                  {views === 1
                    ? t("home.plant_of_the_week.views_one")
                    : t("home.plant_of_the_week.views", { n: views })}
                </span>
              )}
            </div>
          </div>
        </Link>
      </div>
    </section>
  );
}
