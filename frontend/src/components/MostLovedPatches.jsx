import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Sprout } from "lucide-react";
import { fetchPopularPatches } from "@/lib/api";
import { useI18n } from "@/i18n";

/**
 * Subtle homepage discovery wall — the top N patches whose owners ticked
 * "list publicly" in the Share modal. Acts as social proof for new visitors
 * AND a soft conversion driver ("look at all these other people doing it").
 *
 * Renders nothing while loading or when the wall is empty — so we don't
 * splash a blank section across the homepage in the first few weeks before
 * any patches have opted in.
 */
export default function MostLovedPatches({ limit = 6 }) {
  const { t } = useI18n();
  const [items, setItems] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchPopularPatches(limit)
      .then((d) => { if (!cancelled) setItems(d.items || []); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, [limit]);

  if (!items || items.length === 0) return null;

  return (
    <section
      data-testid="most-loved-patches"
      className="bg-forest text-sand py-14 md:py-16"
    >
      <div className="container-narrow">
        <div className="flex items-end justify-between gap-6 mb-6">
          <div>
            <p className="overline text-terracotta">{t("home.most_loved.eyebrow")}</p>
            <h2 className="font-serif text-4xl md:text-5xl text-sand mt-2 tracking-tight text-balance">
              {t("home.most_loved.title")}
            </h2>
          </div>
        </div>
        <p className="text-sand/85 max-w-xl leading-relaxed mb-8">
          {t("home.most_loved.body")}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((p) => (
            <Link
              key={p.share_id}
              to={`/p/${p.share_id}`}
              data-testid={`most-loved-card-${p.share_id}`}
              className="bg-moss rounded-2xl p-5 block group transition-transform duration-300 hover:-translate-y-1"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="font-serif text-2xl text-sand leading-tight group-hover:text-terracotta transition-colors">
                    {p.patch_name}
                  </h3>
                  {p.region?.name && (
                    <p className="mt-1.5 text-xs text-sand/70 inline-flex items-center gap-1.5">
                      <MapPin strokeWidth={1.5} className="w-3.5 h-3.5" />
                      <span className="truncate">
                        {p.region.name}{p.region.country ? `, ${p.region.country}` : ""}
                      </span>
                    </p>
                  )}
                </div>
                <Sprout strokeWidth={1.2} className="w-5 h-5 text-terracotta shrink-0" />
              </div>
              <div className="mt-4 text-xs text-sand/75 flex flex-wrap gap-x-3 gap-y-1">
                <span>{t("home.most_loved.plant_count", { n: p.plant_count })}</span>
                {p.view_count > 0 && (
                  <span>·  {t("share_view.views", { n: p.view_count })}</span>
                )}
              </div>
              {p.first_plants?.length > 0 && (
                <p className="mt-3 text-sm text-sand/80 truncate">
                  {p.first_plants.map((x) => x.name).filter(Boolean).join(" · ")}
                </p>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
