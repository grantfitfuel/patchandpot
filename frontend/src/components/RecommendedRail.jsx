/**
 * RecommendedRail — region- and month-aware plant picks shown on the
 * Monthly Guide and Plants pages. Pure-client logic on top of the existing
 * `/api/plants` list, no extra network call, so the rail paints the moment
 * the page does.
 *
 * Scoring is intentionally simple and transparent (no AI):
 *   • Season match by hemisphere → +5
 *   • Helpful traits for the season (cool-season + winter, drought + summer)
 *     → +3
 *   • Always-good signals (evergreen, year-round, long-bloom) → +3
 *   • Easy-win signals (beginner, very-easy, fast) → +1–2
 *   • Hard penalty: tender plants in winter (-10) so we don't recommend
 *     tomatoes in February to a London garden.
 *
 * Plants already in the active patch's My Garden are filtered out — the
 * rail is for *additions*, not reminders.
 *
 * The shown set rotates monthly (deterministic seed = year + month) so
 * users see something fresh each visit without losing the top picks.
 */
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Sun, Droplets, Sprout, ArrowRight, Compass } from "lucide-react";
import PlantImage from "@/components/PlantImage";
import { useI18n } from "@/i18n";

const NH_SEASON = { 12: "winter", 1: "winter", 2: "winter", 3: "spring", 4: "spring", 5: "spring", 6: "summer", 7: "summer", 8: "summer", 9: "autumn", 10: "autumn", 11: "autumn" };
const SH_SEASON = { 12: "summer", 1: "summer", 2: "summer", 3: "autumn", 4: "autumn", 5: "autumn", 6: "winter", 7: "winter", 8: "winter", 9: "spring", 10: "spring", 11: "spring" };

function seasonFor(month, hemisphere) {
  return hemisphere === "southern" ? SH_SEASON[month] : NH_SEASON[month];
}

function scorePlant(plant, season) {
  const tags = new Set((plant.tags || []).map((t) => String(t).toLowerCase()));
  let s = 0;
  if (tags.has(season)) s += 5;
  if (tags.has("year-round")) s += 5;
  if (tags.has("evergreen")) s += 3;
  if (tags.has("long-bloom") || tags.has("long-season")) s += 3;
  if (season === "winter" || season === "spring") {
    if (tags.has("cool-season")) s += 3;
    if (plant.hardiness === "hardy") s += 2;
  }
  if (season === "summer") {
    if (tags.has("drought")) s += 3;
    if (tags.has("heat")) s += 3;
    if (tags.has("late-summer")) s += 2;
  }
  if (season === "autumn") {
    if (tags.has("cool-season")) s += 2;
    if (tags.has("bulb") || tags.has("corm")) s += 3; // autumn-planted bulbs
  }
  if (tags.has("beginner")) s += 2;
  if (plant.difficulty === "Very easy") s += 1;
  if (tags.has("fast") || tags.has("productive")) s += 1;
  // Hard penalty: don't tell a London gardener to sow tomatoes outdoors in Feb.
  if ((season === "winter" || season === "autumn") && plant.hardiness === "tender") s -= 10;
  if (season === "winter" && plant.hardiness === "half-hardy") s -= 4;
  // Indoor-only plants are evergreen recommendations year-round.
  if (plant.hardiness === "indoor") s = Math.max(s, 4);
  return s;
}

// Deterministic int hash → used to shuffle ties so the same 4 cards don't
// monopolise the rail forever. Seeded with year + month so the rail rotates
// once per calendar month rather than on every re-render.
function seededShuffle(arr, seed) {
  const out = arr.slice();
  let h = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export default function RecommendedRail({
  plants,
  region,
  excludeIds = [],
  month,
  count = 4,
  variant = "default", // "default" | "compact" — Plants page uses compact
}) {
  const { t, lang } = useI18n();
  const hemisphere = region?.hemisphere === "southern" ? "southern" : "northern";
  const currentMonth = month || (new Date().getMonth() + 1);
  const season = seasonFor(currentMonth, hemisphere);

  const picks = useMemo(() => {
    if (!Array.isArray(plants) || plants.length === 0) return [];
    const exclude = new Set(excludeIds);
    const scored = plants
      .filter((p) => p && p.id && !exclude.has(p.id))
      .map((p) => ({ p, s: scorePlant(p, season) }))
      .filter(({ s }) => s > 0)
      .sort((a, b) => b.s - a.s || a.p.name.localeCompare(b.p.name));
    if (scored.length === 0) return [];
    // Take the top 4×count candidates (gives variety), shuffle deterministically
    // per (year,month,hemisphere,lang) so different visits see slight rotation
    // without breaking the score-rank ordering for the very top picks.
    const now = new Date();
    const seed = now.getFullYear() * 100 + currentMonth + (hemisphere === "southern" ? 50 : 0);
    const head = scored.slice(0, Math.min(scored.length, count));
    const rest = scored.slice(head.length, head.length + count * 3);
    const rotated = seededShuffle(rest, seed).slice(0, count - head.length);
    const merged = [...head, ...rotated].slice(0, count).map((x) => x.p);
    return merged;
  }, [plants, season, excludeIds, currentMonth, hemisphere, count]);

  if (!plants || plants.length === 0) return null;
  if (picks.length === 0) return null;

  const monthName = new Date(2000, currentMonth - 1, 1).toLocaleString(lang || "en", { month: "long" });
  const seasonLabel = t(`recommended.season.${season}`);

  return (
    <section
      className={variant === "compact" ? "mb-10" : "mb-14"}
      data-testid="recommended-rail"
      aria-labelledby="recommended-rail-title"
    >
      <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Compass strokeWidth={1.4} className="w-4 h-4 text-terracotta" />
            <span className="overline">{t("recommended.eyebrow")}</span>
          </div>
          <h2
            id="recommended-rail-title"
            className={`font-serif text-forest mt-2 leading-tight ${
              variant === "compact" ? "text-2xl md:text-3xl" : "text-3xl md:text-4xl"
            }`}
          >
            {t("recommended.title", { season: seasonLabel })}
          </h2>
          <p className="text-sm text-ink/65 mt-1.5 max-w-2xl">
            {region
              ? t("recommended.subtitle", { month: monthName, region: region.name })
              : t("recommended.subtitle_no_region", { month: monthName })}
          </p>
        </div>
        <Link
          to="/plants"
          data-testid="recommended-more"
          className="text-sm text-moss hover:text-terracotta underline-offset-4 hover:underline inline-flex items-center gap-1.5 flex-shrink-0"
        >
          {t("recommended.more")}
          <ArrowRight strokeWidth={1.5} className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5" data-testid="recommended-grid">
        {picks.map((p) => (
          <Link
            to={`/plants/${p.id}`}
            key={p.id}
            data-testid={`recommended-card-${p.id}`}
            className="card-flat group flex flex-col"
          >
            <div className="aspect-[4/3] overflow-hidden bg-surface">
              <PlantImage plant={p} />
            </div>
            <div className="p-4 flex flex-col flex-1">
              <h3 className="font-serif text-lg text-forest leading-tight">{p.name}</h3>
              {p.summary && (
                <p className="text-xs text-ink/65 mt-1.5 line-clamp-2 leading-snug">
                  {p.summary}
                </p>
              )}
              <div className="flex items-center gap-3 mt-3 text-[0.65rem] text-moss/90">
                <span className="inline-flex items-center gap-1"><Sun className="w-3 h-3" strokeWidth={1.5} />{p.sun}</span>
                <span className="inline-flex items-center gap-1"><Droplets className="w-3 h-3" strokeWidth={1.5} />{p.water}</span>
                <span className="inline-flex items-center gap-1"><Sprout className="w-3 h-3" strokeWidth={1.5} />{p.difficulty}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
