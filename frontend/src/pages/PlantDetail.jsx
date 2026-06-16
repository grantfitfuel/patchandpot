import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Sun, Droplets, Sprout, Heart, HeartOff } from "lucide-react";
import { fetchPlant } from "@/lib/api";
import PlantImage from "@/components/PlantImage";
import CompanionsSection from "@/components/CompanionsSection";
import SourceLinks from "@/components/SourceLinks";
import { useMyGarden } from "@/hooks/useMyGarden";
import { useI18n } from "@/i18n";

export default function PlantDetailPage() {
  const { id } = useParams();
  const { t } = useI18n();
  const [plant, setPlant] = useState(null);
  const [error, setError] = useState("");
  const { has, addPlant, removePlant } = useMyGarden();

  useEffect(() => {
    fetchPlant(id).then(setPlant).catch(() => setError("Plant not found"));
  }, [id]);

  if (error) return <div className="container-narrow py-16 text-terracotta">{error}</div>;
  if (!plant) return <div className="container-narrow py-16 text-moss">Loading…</div>;

  const inGarden = has(plant.id);

  return (
    <div className="container-narrow py-12 md:py-16 animate-fade-up">
      <Link to="/plants" data-testid="back-to-plants" className="inline-flex items-center gap-2 text-moss hover:text-forest mb-8">
        <ArrowLeft strokeWidth={1.5} className="w-4 h-4" /> {t("plant.back")}
      </Link>

      <div className="grid md:grid-cols-12 gap-10">
        <div className="md:col-span-6">
          <div className="aspect-square overflow-hidden border border-border">
            <PlantImage plant={plant} eager />
          </div>
        </div>

        <div className="md:col-span-6">
          <p className="overline">{plant.category}</p>
          <h1 className="font-serif text-5xl md:text-6xl text-forest mt-3 tracking-tight">{plant.name}</h1>
          <p className="text-ink/80 mt-5 text-lg leading-relaxed">{plant.summary}</p>

          <div className="grid grid-cols-2 gap-4 mt-8">
            <Spec icon={Sun} label={t("plant.sun")} value={plant.sun} />
            <Spec icon={Droplets} label={t("plant.water")} value={plant.water} />
            <Spec icon={Sprout} label={t("plant.soil")} value={plant.soil} />
            <Spec icon={Sprout} label={t("plant.difficulty")} value={plant.difficulty} />
            <Spec icon={Sprout} label={t("plant.container")} value={plant.container ? t("common.yes") : t("common.no")} />
            <Spec icon={Sprout} label={t("plant.edible_part")} value={plant.edible_part} />
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            {inGarden ? (
              <button
                type="button"
                data-testid="remove-from-garden"
                onClick={() => removePlant(plant.id)}
                className="btn-ghost inline-flex items-center gap-2"
              >
                <HeartOff strokeWidth={1.5} className="w-4 h-4" /> {t("plant.remove")}
              </button>
            ) : (
              <button
                type="button"
                data-testid="add-to-garden"
                onClick={() => addPlant(plant)}
                className="btn-terracotta inline-flex items-center gap-2"
              >
                <Heart strokeWidth={1.5} className="w-4 h-4" /> {t("plant.add")}
              </button>
            )}
            <Link to="/calendar" data-testid="see-month-guide" className="btn-ghost">
              {t("plant.see_month")}
            </Link>
          </div>

          {plant.tags && plant.tags.length > 0 && (
            <div className="mt-10 flex flex-wrap gap-2">
              {plant.tags.map((t2) => (
                <span key={t2} className="text-xs px-3 py-1 border border-border bg-surface text-moss tracking-wider uppercase">
                  {t2}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <CompanionsSection plantId={plant.id} />
      <SourceLinks plant={plant} />
    </div>
  );
}

function Spec({ icon: Icon, label, value }) {
  return (
    <div className="border-l border-border pl-4">
      <div className="flex items-center gap-2 text-moss">
        <Icon strokeWidth={1.4} className="w-4 h-4" />
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-ink mt-1.5">{value}</p>
    </div>
  );
}
