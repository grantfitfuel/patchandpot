import { useEffect, useMemo, useState } from "react";
import { ExternalLink, Sprout, Package, Info, Sparkles, Store } from "lucide-react";
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
    // Prefer a vendor explicitly marked `kind === "tools"` (typically Amazon
    // for the affiliate revenue) and fall back to any non-duplicate vendor
    // so we always render a third card when one exists.
    const extraVendor =
      vendors.find((v) => v.kind === "tools") ||
      vendors.find((v) => v !== seedsVendor && v !== potsVendor);
    return [
      seedsVendor && { vendor: seedsVendor, slot: "seeds", label: t("source.seeds"), sub: t("source.seeds_sub", { plant: plant.name }), icon: Sprout },
      potsVendor && { vendor: potsVendor, slot: "pots", label: t("source.pots"), sub: t("source.pots_sub"), icon: Package },
      extraVendor && { vendor: extraVendor, slot: "tools", label: t("source.tools"), sub: t("source.tools_sub"), icon: Package },
    ].filter(Boolean);
     
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

      <ShopLocalNudge t={t} country={activeRegion?.country} plantName={plant.name} />

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {cards.map((c) => (
          <VendorCard
            key={c.vendor.id}
            card={c}
            plantName={plant.name}
            blurb={blurbs[c.vendor.id]}
            blurbsLoading={blurbsLoading}
            cta={t("source.cta")}
            region={activeRegion}
            language={lang}
          />
        ))}
      </div>
    </section>
  );
}

/**
 * "Shop local first" nudge.
 *
 * Appears above the online vendor grid, encourages the reader to try a
 * nearby garden centre or nursery for the current plant before clicking
 * through to Amazon/Crocus. Deep-links to a Google Maps search for
 * "<plant> nursery near me" scoped to the user's country, which gives a
 * live map of local options — no accounts, no data collection.
 *
 * We intentionally sit this ABOVE the affiliate cards. It costs us a
 * little affiliate click-through, but it's the right thing to do for
 * small-business gardening and it aligns with the "reader-supported"
 * ethos the privacy notice already commits to.
 */
function ShopLocalNudge({ t, country, plantName }) {
  const query = encodeURIComponent(
    `${plantName} garden centre nursery${country ? " " + country : " near me"}`,
  );
  const mapsUrl = `https://www.google.com/maps/search/${query}`;
  return (
    <div
      data-testid="shop-local-nudge"
      className="mb-6 p-5 border border-forest/25 bg-forest/[0.04] flex flex-col sm:flex-row sm:items-center gap-4"
    >
      <div className="flex-shrink-0 w-10 h-10 bg-forest/10 rounded-full flex items-center justify-center">
        <Store strokeWidth={1.4} className="w-5 h-5 text-forest" />
      </div>
      <div className="flex-1">
        <p className="font-serif text-lg text-forest leading-snug">
          {t("source.local.title")}
        </p>
        <p className="text-sm text-ink/75 mt-1 leading-relaxed">
          {t("source.local.body")}
        </p>
      </div>
      <a
        href={mapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="shop-local-cta"
        className="flex-shrink-0 inline-flex items-center gap-1.5 text-xs uppercase tracking-wider px-4 py-2 bg-forest text-sand hover:bg-forest/85 transition-colors"
      >
        {t("source.local.cta")}
        <ExternalLink strokeWidth={1.5} className="w-3 h-3" />
      </a>
    </div>
  );
}

function VendorCard({ card, plantName, blurb, blurbsLoading, cta, region, language }) {
  const Icon = card.icon;
  const handleClick = () => {
    // Fire-and-forget — never blocks the navigation. sendBeacon is the
    // canonical API for outbound-click logging; it survives page unload.
    try {
      const body = JSON.stringify({
        vendor_id: card.vendor.id,
        vendor_name: card.vendor.name,
        plant_name: plantName,
        country: region?.country || null,
        language,
        slot: card.slot,
      });
      const url = `${process.env.REACT_APP_BACKEND_URL}/api/affiliate/click`;
      if (navigator.sendBeacon) {
        navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
      } else {
        // Fallback for browsers without sendBeacon (very rare today)
        fetch(url, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true })
          .catch((e) => console.warn("affiliate click POST failed", e));
      }
    } catch (e) {
      // Tracking must never break the click — just log so we can spot issues.
      console.warn("affiliate click tracking failed", e);
    }
  };
  return (
    <a
      href={card.vendor.url(plantName)}
      target="_blank"
      rel="sponsored noopener noreferrer"
      data-testid={`source-card-${card.slot}`}
      onClick={handleClick}
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
