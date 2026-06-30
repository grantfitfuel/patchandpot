/**
 * /regrow-from-scraps — SEO landing page for the regrow-from-kitchen-scraps
 * deep-dive. Filters the catalogue to plants flagged `regrow_from_scrap`
 * and exposes a method chip row (water / water-first / soil-only) so the
 * reader can pick how they want to start.
 *
 * Cards are sorted by `regrow.worth_it` (5★ first) — we deliberately put
 * the high-yield wins at the top, not the Pinterest-popular but
 * underwhelming ones.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Recycle, Sparkles } from "lucide-react";
import { fetchPlants } from "@/lib/api";
import PlantImage from "@/components/PlantImage";
import { useI18n } from "@/i18n";

const METHODS = [
  { key: "all",         match: () => true },
  { key: "water-first", match: (r) => r?.method === "water-first" },
  { key: "water",       match: (r) => r?.method === "water-only" },
  { key: "soil",        match: (r) => r?.method === "soil-only" },
];

export default function RegrowFromScrapsPage() {
  const { t, lang } = useI18n();
  const [plants, setPlants] = useState([]);
  const [method, setMethod] = useState("all");

  useEffect(() => {
    fetchPlants(lang)
      .then((list) => setPlants((list || []).filter((p) => p?.regrow_from_scrap)))
      .catch(() => setPlants([]));
  }, [lang]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = `Regrow from Scraps — Patch & Pot`;
  }, []);

  const filtered = useMemo(() => {
    const m = METHODS.find((x) => x.key === method) || METHODS[0];
    const arr = plants.filter((p) => m.match(p.regrow));
    arr.sort((a, b) => (b.regrow?.worth_it ?? 0) - (a.regrow?.worth_it ?? 0));
    return arr;
  }, [plants, method]);

  return (
    <div className="container-narrow py-12 md:py-16 animate-fade-up" data-testid="regrow-landing">
      <div className="mb-10 max-w-2xl">
        <p className="overline inline-flex items-center gap-2">
          <Recycle className="w-3.5 h-3.5" strokeWidth={1.6} />
          {t("regrow.eyebrow")}
        </p>
        <h1 className="font-serif text-5xl md:text-6xl text-forest mt-3 tracking-tight">
          {t("regrow.title")}
        </h1>
        <p className="mt-4 text-ink/75 leading-relaxed">{t("regrow.intro")}</p>
      </div>

      <div className="flex flex-wrap gap-2 mb-10" data-testid="regrow-filter-row">
        {METHODS.map((m) => (
          <button
            key={m.key}
            type="button"
            data-testid={`regrow-filter-${m.key}`}
            onClick={() => setMethod(m.key)}
            className={`text-xs px-3 py-2 border transition-colors ${
              method === m.key
                ? "bg-forest text-sand border-forest"
                : "bg-sand text-ink/70 border-border hover:border-forest/40"
            }`}
          >
            {t(`regrow.filter.${m.key}`)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-moss" data-testid="regrow-empty">{t("regrow.empty")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="regrow-grid">
          {filtered.map((p) => {
            const r = p.regrow || {};
            const stars = Math.max(1, Math.min(5, r.worth_it || 0));
            return (
              <Link
                key={p.id}
                to={`/plants/${p.id}`}
                data-testid={`regrow-card-${p.id}`}
                className="card-flat group flex flex-col"
              >
                <div className="aspect-[4/3] overflow-hidden bg-surface relative">
                  <PlantImage plant={p} />
                  {r.family_friendly && (
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 bg-forest text-sand text-[10px] uppercase tracking-widest">
                      <Sparkles className="w-3 h-3" strokeWidth={1.6} />
                      {t("regrow.kid_friendly")}
                    </span>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <p className="overline">{t(`regrow.method.${r.method}`) }</p>
                  <h3 className="font-serif text-2xl text-forest mt-1.5">{p.name}</h3>
                  <p className="text-terracotta text-base mt-1 tracking-wider" aria-label={`${stars} out of 5`}>
                    {"★".repeat(stars)}{"☆".repeat(5 - stars)}
                  </p>
                  <p className="text-sm text-ink/75 mt-3 flex-1">{r.yield_summary}</p>
                  <div className="mt-4 text-xs text-moss border-t border-border pt-3">
                    {t("regrow.days_to_first_harvest")}:{" "}
                    <span className="text-ink">
                      {t("regrow.days_value", { days: r.days_to_first_harvest })}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
