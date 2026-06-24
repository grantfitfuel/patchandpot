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
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const ogImg = `${origin}/api/plants/${p.id}/og.png`;
  const link = p.id?.startsWith("ai-") ? `/plants/ai/${p.id}` : `/plants/${p.id}`;

  return (
    <section
      data-testid="plant-of-the-week"
      className="border-t border-border py-16 md:py-20 bg-surface/30"
    >
      <div className="container-narrow">
        <p className="overline" data-testid="plant-of-the-week-eyebrow">
          <Sparkles strokeWidth={1.5} className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5 text-terracotta" />
          {t("home.plant_of_the_week.eyebrow")}
        </p>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-10 items-center">
          {/* OG card image — left half. Links straight to the plant guide
              so any tap on the visual lands on the page. */}
          <Link
            to={link}
            data-testid="plant-of-the-week-image-link"
            className="md:col-span-7 block group"
          >
            <div className="aspect-[1200/630] bg-sand border border-border overflow-hidden">
              <img
                src={ogImg}
                alt={t("home.plant_of_the_week.image_alt", { name: p.name })}
                loading="lazy"
                width="1200"
                height="630"
                className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-700"
              />
            </div>
          </Link>

          {/* Copy column — right half */}
          <div className="md:col-span-5">
            <h2 className="font-serif text-4xl md:text-5xl text-forest tracking-tight leading-tight">
              {p.name}
            </h2>
            {p.summary && (
              <p className="mt-5 text-ink/80 leading-relaxed" data-testid="plant-of-the-week-summary">
                {p.summary}
              </p>
            )}

            <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              {p.category && (
                <li>
                  <p className="overline text-moss">{t("plant.category")}</p>
                  <p className="mt-1 text-ink">{p.category}</p>
                </li>
              )}
              {p.difficulty && (
                <li>
                  <p className="overline text-moss">{t("plant.difficulty")}</p>
                  <p className="mt-1 text-ink">{p.difficulty}</p>
                </li>
              )}
              {p.sun && (
                <li>
                  <p className="overline text-moss">{t("plant.sun")}</p>
                  <p className="mt-1 text-ink">{p.sun}</p>
                </li>
              )}
              {p.water && (
                <li>
                  <p className="overline text-moss">{t("plant.water")}</p>
                  <p className="mt-1 text-ink">{p.water}</p>
                </li>
              )}
            </ul>

            <Link
              to={link}
              data-testid="plant-of-the-week-cta"
              className="btn-terracotta inline-flex items-center gap-2 mt-8"
            >
              <Sprout strokeWidth={1.5} className="w-4 h-4" />
              {t("home.plant_of_the_week.cta", { name: p.name })}
              <ArrowRight strokeWidth={1.5} className="w-4 h-4" />
            </Link>

            {views > 0 && (
              <p className="mt-4 text-xs uppercase tracking-wider text-moss/80" data-testid="plant-of-the-week-views">
                {views === 1
                  ? t("home.plant_of_the_week.views_one")
                  : t("home.plant_of_the_week.views", { n: views })}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
