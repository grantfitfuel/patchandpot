import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Sun, Droplets, Sprout, Heart, HeartOff,
  Sparkles, AlertTriangle, HandHelping, Loader2,
} from "lucide-react";
import { fetchPlantGuide, fetchCachedPlantGuide } from "@/lib/api";
import TopicImage from "@/components/TopicImage";
import FeedbackWidget from "@/components/FeedbackWidget";
import SourceLinks from "@/components/SourceLinks";
import { useMyGarden } from "@/hooks/useMyGarden";
import { useI18n } from "@/i18n";

export default function AIPlantDetailPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const queryParam = params.get("q");
  const { t, lang } = useI18n();
  const { has, addPlant, removePlant } = useMyGarden();

  const [plant, setPlant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");

    const fromQuery = queryParam ? fetchPlantGuide(queryParam, lang) : Promise.reject();
    const fromCache = fetchCachedPlantGuide(slug, lang);

    // Try cached lookup first; fall back to generating via query param.
    fromCache
      .catch(() => fromQuery)
      .then((data) => { if (!cancelled) setPlant(data); })
      .catch((e) => {
        if (cancelled) return;
        const msg = e?.response?.data?.detail || "Couldn't load this plant guide.";
        setError(msg);
      })
      .finally(() => !cancelled && setLoading(false));

    return () => { cancelled = true; };
  }, [slug, queryParam, lang]);

  if (loading) {
    return (
      <div className="container-narrow py-16 flex items-center gap-3 text-moss" data-testid="ai-plant-loading">
        <Loader2 strokeWidth={1.4} className="w-4 h-4 animate-spin" />
        <span>{t("ai_plant.loading")}</span>
      </div>
    );
  }
  if (error || !plant) {
    return (
      <div className="container-narrow py-16">
        <p className="text-terracotta" data-testid="ai-plant-error-message">{error || t("ai_plant.not_found")}</p>
        <Link to="/plants" className="btn-ghost mt-6 inline-flex">{t("plant.back")}</Link>
      </div>
    );
  }

  const inGarden = has(plant.id);

  return (
    <div className="container-narrow py-12 md:py-16 animate-fade-up" data-testid={`ai-plant-${plant.id}`}>
      <Link to="/plants" data-testid="back-to-plants" className="inline-flex items-center gap-2 text-moss hover:text-forest mb-8">
        <ArrowLeft strokeWidth={1.5} className="w-4 h-4" /> {t("plant.back")}
      </Link>

      <div className="grid md:grid-cols-12 gap-10">
        <div className="md:col-span-6">
          <div className="aspect-square overflow-hidden border border-border bg-surface">
            <TopicImage
              subject={`a single ${plant.name}${plant.botanical_name ? ` (${plant.botanical_name})` : ""} plant, botanical editorial photograph, soft natural light`}
              cacheKey={`plant-image:${plant.id}`}
              alt={plant.name}
              eager
            />
          </div>
        </div>

        <div className="md:col-span-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.2em] uppercase px-2.5 py-1 border border-terracotta/40 text-terracotta">
              <Sparkles className="w-3 h-3" strokeWidth={1.5} /> AI-generated guide
            </span>
            <p className="overline">{plant.category}</p>
          </div>
          <h1 className="font-serif text-5xl md:text-6xl text-forest mt-1 tracking-tight">{plant.name}</h1>
          {plant.botanical_name && (
            <p className="font-serif italic text-moss mt-2">{plant.botanical_name}</p>
          )}
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
              <button type="button" data-testid="remove-from-garden"
                onClick={() => removePlant(plant.id)} className="btn-ghost inline-flex items-center gap-2">
                <HeartOff strokeWidth={1.5} className="w-4 h-4" /> {t("plant.remove")}
              </button>
            ) : (
              <button type="button" data-testid="add-to-garden"
                onClick={() => addPlant(plant)} className="btn-terracotta inline-flex items-center gap-2">
                <Heart strokeWidth={1.5} className="w-4 h-4" /> {t("plant.add")}
              </button>
            )}
            <Link to="/calendar" className="btn-ghost">{t("plant.see_month")}</Link>
          </div>

          {plant.tags && plant.tags.length > 0 && (
            <div className="mt-8 flex flex-wrap gap-2">
              {plant.tags.map((tag) => (
                <span key={tag} className="text-xs px-3 py-1 border border-border bg-surface text-moss tracking-wider uppercase">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Growing tips */}
      {plant.growing && plant.growing.length > 0 && (
        <section className="mt-16 border-t border-border pt-10 max-w-3xl" data-testid="ai-plant-growing">
          <div className="flex items-center gap-3 mb-5">
            <Sprout strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
            <span className="overline">{t("ai_plant.growing_tips")}</span>
          </div>
          <ol className="space-y-4">
            {plant.growing.map((tip, i) => (
              <li key={tip} className="flex gap-4 leading-relaxed">
                <span className="font-serif text-2xl text-terracotta flex-shrink-0 w-8">{i + 1}</span>
                <span className="text-ink/80 pt-1">{tip}</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Seasonality */}
      {plant.seasonality && (
        <section className="mt-12 max-w-3xl">
          <p className="overline">{t("ai_plant.season")}</p>
          <p className="font-serif text-2xl text-forest mt-2 leading-snug">{plant.seasonality}</p>
        </section>
      )}

      {/* Problems */}
      {plant.problems && plant.problems.length > 0 && (
        <section className="mt-12 max-w-3xl" data-testid="ai-plant-problems">
          <div className="flex items-center gap-3 mb-5">
            <AlertTriangle strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
            <span className="overline">{t("ai_plant.common_problems")}</span>
          </div>
          <ul className="space-y-4">
            {plant.problems.map((p) => (
              <li key={p.name} className="border-b border-border last:border-b-0 pb-4 last:pb-0">
                <p className="font-serif text-xl text-forest">{p.name}</p>
                <p className="text-sm text-ink/80 mt-1">{p.solution}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* AI companions */}
      {plant.companions && plant.companions.length > 0 && (
        <section className="mt-12 max-w-3xl" data-testid="ai-plant-companions">
          <div className="flex items-center gap-3 mb-5">
            <HandHelping strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
            <span className="overline">{t("ai_plant.plants_well_with")}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {plant.companions.map((c) => (
              <span key={c} className="px-3 py-2 border border-border bg-surface text-forest text-sm">{c}</span>
            ))}
          </div>
        </section>
      )}

      {/* Warnings */}
      {plant.warnings && (
        <section className="mt-12 max-w-3xl border border-terracotta/40 bg-terracotta/5 p-6" data-testid="ai-plant-warning">
          <div className="flex gap-3 items-start">
            <AlertTriangle strokeWidth={1.4} className="w-5 h-5 text-terracotta flex-shrink-0 mt-0.5" />
            <p className="text-ink/80 leading-relaxed">{plant.warnings}</p>
          </div>
        </section>
      )}

      {/* Safety disclaimer */}
      <p className="mt-16 text-xs text-moss border-t border-border pt-6 max-w-3xl leading-relaxed" data-testid="ai-plant-disclaimer">
        This plant guide is generated by AI from publicly available horticultural knowledge.
        Before eating any part of a plant, cross-check with a trusted local source or grower.
        Toxicity and edibility vary by variety, growing conditions and individual sensitivity.
      </p>

      <SourceLinks plant={plant} />

      <FeedbackWidget targetType="plant-guide" targetId={plant.id} label="Spot something off?" />
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
