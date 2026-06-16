import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Sprout, Package, Info, Sparkles } from "lucide-react";
import { useRegion } from "@/hooks/useRegion";
import { vendorsForCountry } from "@/data/vendors";
import { fetchVendorBlurbs } from "@/lib/api";
import { useI18n } from "@/i18n";

// Module-level memo so we don't refetch blurbs each time the user toggles
// between plant pages with the same (plant, country, lang) tuple in a session.
const blurbCache = new Map();

/**
 * Region-aware "Where to source" section. Shows up to three vendor cards
 * (Seeds / Pots & Compost / Tools) selected per the user's country and
 * decorated with a Claude-generated one-sentence reason why each vendor is a
 * good pick for THIS plant in THIS region. The LLM call is best-effort —
 * if the budget is exhausted or anything goes wrong, the cards still render
 * with their static sub-text.
 */
export default function SourceLinks({ plant }) {
  const { t, lang } = useI18n();
  const { region, defaultRegion } = useRegion();
  const activeRegion = region || defaultRegion;

  const cards = useMemo(() => {
    if (!plant?.name) return [];
    const vendors = vendorsForCountry(activeRegion?.country);
    const seedsVendor = vendors.find((v) => v.kind === "seeds");
    const potsVendor = vendors.find((v) => v.kind === "pots");
    const extraVendor = vendors.find((v) => v !== seedsVendor && v !== potsVendor);
    return [
      seedsVendor && { vendor: seedsVendor, slot: "seeds", label: t("source.seeds"), sub: t("source.seeds_sub", { plant: plant.name }), icon: Sprout },
      potsVendor && { vendor: potsVendor, slot: "pots", label: t("source.pots"), sub: t("source.pots_sub"), icon: Package },
      extraVendor && { vendor: extraVendor, slot: "tools", label: t("source.tools"), sub: t("source.tools_sub"), icon: Package },
    ].filter(Boolean);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plant?.name, activeRegion?.country, lang]);

  const cacheKey = useMemo(() => {
    if (!plant?.name || cards.length === 0) return null;
    return [
      plant.name.toLowerCase(),
      (activeRegion?.country || "").toLowerCase(),
      lang,
      cards.map((c) => c.vendor.id).sort().join(","),
    ].join("|");
  }, [plant?.name, activeRegion?.country, lang, cards]);

  const [blurbs, setBlurbs] = useState({});
  const [blurbsLoading, setBlurbsLoading] = useState(false);

  useEffect(() => {
    if (!cacheKey || cards.length === 0) return;
    if (blurbCache.has(cacheKey)) {
      setBlurbs(blurbCache.get(cacheKey));
      return;
    }
    let cancelled = false;
    setBlurbsLoading(true);
    fetchVendorBlurbs(
      plant.name,
      cards.map((c) => c.vendor),
      activeRegion,
      lang,
    )
      .then((data) => {
        if (cancelled) return;
        const map = (data && data.blurbs) || {};
        blurbCache.set(cacheKey, map);
        setBlurbs(map);
      })
      .catch(() => {
        // Fail soft — UI falls back to static sub-text.
        if (!cancelled) setBlurbs({});
      })
      .finally(() => {
        if (!cancelled) setBlurbsLoading(false);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  if (!plant?.name || cards.length === 0) return null;

  return (
    <section className="mt-16 border-t border-border pt-12" data-testid="source-links">
      <div className="flex items-baseline justify-between gap-4 mb-6 flex-wrap">
        <div>
          <p className="overline">{t("source.eyebrow")}</p>
          <h2 className="font-serif text-3xl md:text-4xl text-forest mt-2 leading-tight">
            {t("source.title", { country: activeRegion?.country || activeRegion?.name || "" })}
          </h2>
        </div>
        <span className="text-xs text-moss inline-flex items-center gap-1.5 max-w-xs">
          <Info strokeWidth={1.5} className="w-3.5 h-3.5 flex-shrink-0" />
          {t("source.disclosure")}
        </span>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((c) => (
          <VendorCard
            key={c.vendor.id}
            card={c}
            plantName={plant.name}
            blurb={blurbs[c.vendor.id]}
            blurbsLoading={blurbsLoading}
            cta={t("source.cta")}
          />
        ))}
      </div>
    </section>
  );
}

function VendorCard({ card, plantName, blurb, blurbsLoading, cta }) {
  const Icon = card.icon;
  return (
    <a
      href={card.vendor.url(plantName)}
      target="_blank"
      rel="sponsored noopener noreferrer"
      data-testid={`source-card-${card.slot}`}
      className="card-flat p-5 group hover:border-terracotta/60 transition-colors"
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon strokeWidth={1.5} className="w-4 h-4 text-terracotta" />
        <span className="overline">{card.label}</span>
      </div>
      <p className="font-serif text-xl text-forest leading-snug">{card.vendor.name}</p>
      {blurb ? (
        <p
          className="text-xs text-moss mt-2 leading-relaxed flex gap-1.5"
          data-testid={`source-blurb-${card.slot}`}
        >
          <Sparkles strokeWidth={1.5} className="w-3 h-3 text-terracotta flex-shrink-0 mt-0.5" />
          <span>{blurb}</span>
        </p>
      ) : blurbsLoading ? (
        <p className="text-xs text-moss/60 mt-2 leading-relaxed italic">…</p>
      ) : card.sub ? (
        <p className="text-xs text-moss mt-2 leading-relaxed">{card.sub}</p>
      ) : null}
      <span className="mt-4 inline-flex items-center gap-2 text-sm text-terracotta group-hover:gap-3 transition-all">
        {cta}
        <ExternalLink strokeWidth={1.5} className="w-3.5 h-3.5" />
      </span>
    </a>
  );
}
