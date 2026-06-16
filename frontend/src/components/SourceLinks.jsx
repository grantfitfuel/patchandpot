import { ExternalLink, Sprout, Package, Info } from "lucide-react";
import { useRegion } from "@/hooks/useRegion";
import { vendorsForCountry } from "@/data/vendors";
import { useI18n } from "@/i18n";

/**
 * Shows up to three region-aware "where to source" cards: seeds, pots/compost,
 * and one extra. Country is taken from the user's active region (or the
 * default London region if none picked). All outbound links carry
 * rel="sponsored noopener noreferrer" so search engines treat them correctly
 * and we comply with FTC affiliate-disclosure guidance.
 */
export default function SourceLinks({ plant }) {
  const { t } = useI18n();
  const { region, defaultRegion } = useRegion();
  const activeRegion = region || defaultRegion;

  if (!plant?.name) return null;

  const vendors = vendorsForCountry(activeRegion?.country);
  // Prefer one of each kind, then fill with extras.
  const seedsVendor = vendors.find((v) => v.kind === "seeds");
  const potsVendor = vendors.find((v) => v.kind === "pots");
  const extraVendor = vendors.find((v) => v !== seedsVendor && v !== potsVendor);

  const cards = [
    seedsVendor && {
      vendor: seedsVendor,
      label: t("source.seeds"),
      sub: t("source.seeds_sub", { plant: plant.name }),
      icon: Sprout,
    },
    potsVendor && {
      vendor: potsVendor,
      label: t("source.pots"),
      sub: t("source.pots_sub"),
      icon: Package,
    },
    extraVendor && {
      vendor: extraVendor,
      label: t("source.tools"),
      sub: t("source.tools_sub"),
      icon: Package,
    },
  ].filter(Boolean);

  if (cards.length === 0) return null;

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
          <a
            key={c.vendor.id}
            href={c.vendor.url(plant.name)}
            target="_blank"
            rel="sponsored noopener noreferrer"
            data-testid={`source-card-${c.vendor.kind}`}
            className="card-flat p-5 group hover:border-terracotta/60 transition-colors"
          >
            <div className="flex items-center gap-2 mb-3">
              <c.icon strokeWidth={1.5} className="w-4 h-4 text-terracotta" />
              <span className="overline">{c.label}</span>
            </div>
            <p className="font-serif text-xl text-forest leading-snug">{c.vendor.name}</p>
            {c.sub && <p className="text-xs text-moss mt-1.5 leading-relaxed">{c.sub}</p>}
            <span className="mt-4 inline-flex items-center gap-2 text-sm text-terracotta group-hover:gap-3 transition-all">
              {t("source.cta")}
              <ExternalLink strokeWidth={1.5} className="w-3.5 h-3.5" />
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
