/**
 * /grow-anywhere — landing hub that reframes the plant library by
 * WHERE you have to grow (not what species you want). Windowsills,
 * balconies, rooftops, wall crevices, water jars — every situation is
 * a tile with a live plant count and links straight into the filtered
 * /plants?situation=<id> catalogue.
 *
 * Data comes from /api/plants (already loaded once per session) — we
 * just derive per-situation counts client-side.
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, Sprout } from "lucide-react";
import { fetchPlants } from "@/lib/api";
import { useI18n } from "@/i18n";
import { SITUATIONS, SITUATION_SECTIONS } from "@/data/growAnywhere";
import PageHero from "@/components/PageHero";
import { WindowsillMotif } from "@/components/illustrations/VibrantMotifs";

export default function GrowAnywherePage() {
  const { t, lang } = useI18n();
  const [plants, setPlants] = useState([]);
  const [searchParams] = useSearchParams();
  const highlight = searchParams.get("highlight");

  useEffect(() => {
    fetchPlants(lang).then(setPlants).catch(() => setPlants([]));
  }, [lang]);

  const counts = useMemo(() => {
    const map = {};
    for (const p of plants) {
      for (const sid of (p.grow_anywhere || [])) {
        map[sid] = (map[sid] || 0) + 1;
      }
    }
    return map;
  }, [plants]);

  // Set doc title / description on mount so the page has proper SEO meta.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = "Grow Anywhere — Patch & Pot";
    ensureMeta(
      "description",
      "You don't need a garden to grow something worth eating or looking at. Every plant in our library, sorted by the space you actually have — from a bright sill to a battered bucket.",
    );
  }, []);

  return (
    <div className="animate-fade-up">
      <PageHero
        variant="moss"
        eyebrow={t("grow.eyebrow")}
        title={t("grow.title")}
        blurb={t("grow.intro")}
        Motif={WindowsillMotif}
      />
      <div className="container-narrow py-10 md:py-14">

      {SITUATION_SECTIONS.map((section) => {
        const ids = section.ids.filter((id) =>
          SITUATIONS.some((s) => s.id === id)
        );
        return (
          <section
            key={section.id}
            className="mb-14"
            data-testid={`grow-section-${section.id}`}
          >
            <h2 className="font-serif text-2xl text-forest tracking-tight mb-6">
              {t(`grow.section.${section.id}`)}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {ids.map((id) => {
                const meta = SITUATIONS.find((s) => s.id === id);
                if (!meta) return null;
                const Icon = meta.icon;
                const n = counts[id] || 0;
                const isHl = highlight === id;
                return (
                  <Link
                    key={id}
                    to={`/plants?situation=${id}`}
                    data-testid={`grow-tile-${id}`}
                    className={`card-flat p-6 group hover:border-forest/40 transition-colors flex flex-col ${
                      isHl ? "ring-2 ring-terracotta/40 border-terracotta/40" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <Icon
                        strokeWidth={1.4}
                        className="w-7 h-7 text-forest"
                      />
                      {n > 0 && (
                        <span
                          className="text-[0.65rem] uppercase tracking-widest text-moss/80 px-2 py-0.5 border border-border rounded-full"
                          data-testid={`grow-tile-count-${id}`}
                        >
                          {t("grow.tile.count", { n })}
                        </span>
                      )}
                    </div>
                    <h3 className="font-serif text-2xl text-forest tracking-tight">
                      {t(`grow.situation.${id}.label`)}
                    </h3>
                    <p className="text-sm text-moss mt-2 leading-relaxed flex-1">
                      {t(`grow.situation.${id}.blurb`)}
                    </p>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-xs text-terracotta group-hover:gap-2 transition-all">
                      <Sprout className="w-3.5 h-3.5" strokeWidth={1.6} />
                      {t("grow.explore_all")}
                      <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.6} />
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="mt-16 border-t border-border pt-10 text-center">
        <Link
          to="/plants"
          data-testid="grow-anywhere-see-all"
          className="btn-ghost inline-flex items-center gap-2"
        >
          {t("grow.explore_all")} →
        </Link>
      </div>
      </div>
    </div>
  );
}

function ensureMeta(name, content) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("name", name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}
