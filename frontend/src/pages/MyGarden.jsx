import { Link } from "react-router-dom";
import { Trash2, Sprout, MapPin, Download } from "lucide-react";
import { useMyGarden } from "@/hooks/useMyGarden";
import { useRegion } from "@/hooks/useRegion";
import PlantImage from "@/components/PlantImage";
import GuidanceView from "@/components/GuidanceView";
import MonthSelector from "@/components/MonthSelector";
import { useMemo, useState } from "react";
import RegionPicker from "@/components/RegionPicker";
import { useI18n } from "@/i18n";

export default function MyGardenPage() {
  const { plants, removePlant } = useMyGarden();
  const { region } = useRegion();
  const { t } = useI18n();
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [pickerOpen, setPickerOpen] = useState(false);

  const summary = useMemo(() => {
    if (plants.length === 0) return null;
    const label = plants.length === 1 ? t("garden.plant_singular") : t("garden.plant_plural");
    return t("garden.tending", { n: plants.length, label });
  }, [plants, t]);

  return (
    <div className="container-narrow py-12 md:py-16 animate-fade-up">
      <div className="flex flex-wrap items-end justify-between gap-6 mb-10">
        <div>
          <p className="overline">{t("garden.eyebrow")}</p>
          <h1 className="font-serif text-5xl md:text-6xl text-forest mt-3 tracking-tight">{t("garden.title")}</h1>
          {summary && <p className="mt-3 text-ink/75">{summary}</p>}
        </div>
        <div className="flex flex-wrap gap-3">
          {region && (
            <Link to={`/print/${month}`} data-testid="garden-download-btn" className="btn-terracotta inline-flex items-center gap-2">
              <Download className="w-4 h-4" strokeWidth={1.5} /> {t("download.button")}
            </Link>
          )}
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            data-testid="garden-region-btn"
            className="btn-ghost inline-flex items-center gap-2"
          >
            <MapPin className="w-4 h-4" strokeWidth={1.5} />
            {region ? region.name : t("region.set")}
          </button>
        </div>
      </div>

      {plants.length === 0 ? (
        <div className="card-flat p-10 text-center" data-testid="garden-empty">
          <Sprout strokeWidth={1.3} className="w-8 h-8 text-terracotta mx-auto mb-4" />
          <h2 className="font-serif text-3xl text-forest">{t("garden.empty.title")}</h2>
          <p className="text-moss mt-3 max-w-md mx-auto">{t("garden.empty.body")}</p>
          <Link to="/plants" data-testid="browse-plants" className="btn-terracotta inline-flex mt-6">
            {t("garden.browse")}
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-16" data-testid="garden-plants-grid">
            {plants.map((p) => {
              const linkTo = p.id.startsWith("ai-") ? `/plants/ai/${p.id}` : `/plants/${p.id}`;
              return (
                <div key={p.id} className="card-flat overflow-hidden">
                  <Link to={linkTo} className="block aspect-[4/3] bg-surface">
                    <PlantImage plant={p} />
                  </Link>
                  <div className="p-5 flex items-start justify-between gap-4">
                    <div>
                      <p className="overline">
                        {p.category}{p.ai_generated ? " · AI" : ""}
                      </p>
                      <h3 className="font-serif text-2xl text-forest mt-1">{p.name}</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => removePlant(p.id)}
                      data-testid={`garden-remove-${p.id}`}
                      className="text-moss hover:text-terracotta"
                      aria-label={`Remove ${p.name}`}
                    >
                      <Trash2 strokeWidth={1.5} className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-border pt-12">
            <p className="overline">{t("garden.this_month.eyebrow")}</p>
            <h2 className="font-serif text-4xl md:text-5xl text-forest mt-3 mb-8">{t("garden.this_month")}</h2>
          <div className="mb-8">
            <MonthSelector month={month} onChange={setMonth} />
          </div>
          <GuidanceView region={region} month={month} view="tasks" myGarden={plants.map((p) => p.name)} />
          </div>
        </>
      )}

      <RegionPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  );
}
