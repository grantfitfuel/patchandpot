/**
 * Unified plant detail page — serves BOTH curated plants
 * (`/plants/:id` → e.g. /plants/tomato) and AI-generated guides
 * (`/plants/ai/:slug` → e.g. /plants/ai/ai-yarrow).
 *
 * The two flows share ~80% of the markup (hero image, title, spec grid,
 * add/remove from garden, tags, SourceLinks). They diverge only on:
 *   • Data source: `fetchPlant` vs `fetchCachedPlantGuide` + `fetchPlantGuide` fallback.
 *   • Image: `<PlantImage>` for curated (uses static photo URL) vs
 *     `<TopicImage>` for AI (Gemini-rendered watercolour on first view).
 *   • Curated extras: SEO meta + JSON-LD + Pinterest button + CompanionsSection.
 *   • AI extras: AI badge, growing tips, seasonality, problems, AI companion
 *     names, warnings, safety disclaimer, FeedbackWidget — wrapped in
 *     <PremiumGate> because AI guides are a paid feature.
 *
 * Routing remains unchanged (two routes in App.js); we just point both at
 * this single component and branch on `useParams()`.
 */
import { useEffect, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft, Sun, Droplets, Sprout, Heart, HeartOff,
  Sparkles, AlertTriangle, HandHelping, Loader2, Recycle, Flower2, Scissors, MapPin,
} from "lucide-react";
import {
  fetchPlant, fetchPlantGuide, fetchCachedPlantGuide,
} from "@/lib/api";
import { formatApiError } from "@/lib/formatApiError";
import PlantImage from "@/components/PlantImage";
import TopicImage from "@/components/TopicImage";
import CompanionsSection from "@/components/CompanionsSection";
import SourceLinks from "@/components/SourceLinks";
import FeedbackWidget from "@/components/FeedbackWidget";
import PremiumGate from "@/components/PremiumGate";
import { useMyGarden } from "@/hooks/useMyGarden";
import { useI18n } from "@/i18n";
import { getSituation } from "@/data/growAnywhere";

export default function PlantDetailPage() {
  const params = useParams();
  // Route /plants/ai/:slug uses `slug`; /plants/:id uses `id`. Whichever is
  // present tells us which fetch path to follow.
  const isAi = !!params.slug;
  const idOrSlug = params.id || params.slug;
  const [searchParams] = useSearchParams();
  const queryParam = searchParams.get("q");

  const { t, lang } = useI18n();
  const { has, addPlant, removePlant } = useMyGarden();

  const [plant, setPlant] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setPlant(null);

    const loader = isAi
      ? fetchCachedPlantGuide(idOrSlug, lang).catch(() =>
          queryParam
            ? fetchPlantGuide(queryParam, lang)
            : Promise.reject(new Error("missing-query"))
        )
      : fetchPlant(idOrSlug, lang);

    loader
      .then((data) => { if (!cancelled) setPlant(data); })
      .catch((e) => {
        if (cancelled) return;
        setError(
          isAi
            ? formatApiError(e, t("ai_plant.not_found"))
            : t("plant.not_found")
        );
      })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [idOrSlug, isAi, queryParam, lang, t]);

  // SEO meta + JSON-LD for curated plants only — AI guides are noindex by
  // policy (paid gate + content varies between users on regeneration).
  useEffect(() => {
    if (isAi || typeof document === "undefined" || !plant) return;
    document.title = `How to grow ${plant.name} — Patch & Pot`;
    const bits = [plant.category, plant.difficulty].filter(Boolean).join("  ·  ");
    const desc = `${bits ? bits + ". " : ""}${plant.summary || `A small-space growing guide for ${plant.name} on Patch & Pot.`}`;
    const origin = window.location.origin;
    const imgUrl = `${origin}/api/plants/${plant.id}/og.png`;
    ensurePlantMeta("description", desc);
    ensurePlantMeta("og:title", document.title, "property");
    ensurePlantMeta("og:description", desc, "property");
    ensurePlantMeta("og:type", "article", "property");
    ensurePlantMeta("og:image", imgUrl, "property");
    ensurePlantMeta("og:image:width", "1200", "property");
    ensurePlantMeta("og:image:height", "630", "property");
    ensurePlantMeta("twitter:card", "summary_large_image");
    ensurePlantMeta("twitter:image", imgUrl);
    ensureJsonLd("plant-jsonld", {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: document.title,
      description: desc,
      image: imgUrl,
      url: window.location.href,
      author: { "@type": "Organization", name: "Patch & Pot" },
      publisher: {
        "@type": "Organization",
        name: "Patch & Pot",
        logo: { "@type": "ImageObject", url: `${origin}/logo192.png` },
      },
      datePublished: "2025-06-01",
      dateModified: new Date().toISOString().slice(0, 10),
      mainEntityOfPage: window.location.href,
      about: { "@type": "Thing", name: plant.name },
    });
  }, [plant, isAi]);

  if (loading) {
    return (
      <div
        className="container-narrow py-16 flex items-center gap-3 text-moss"
        data-testid={isAi ? "ai-plant-loading" : "plant-loading"}
      >
        <Loader2 strokeWidth={1.4} className="w-4 h-4 animate-spin" />
        <span>{isAi ? t("ai_plant.loading") : t("plant.loading")}</span>
      </div>
    );
  }
  if (error || !plant) {
    return (
      <div className="container-narrow py-16">
        <p
          className="text-terracotta"
          data-testid={isAi ? "ai-plant-error-message" : "plant-error"}
        >
          {error || (isAi ? t("ai_plant.not_found") : t("plant.not_found"))}
        </p>
        <Link to="/plants" className="btn-ghost mt-6 inline-flex">{t("plant.back")}</Link>
      </div>
    );
  }

  const body = (
    <div
      className="container-narrow py-12 md:py-16 animate-fade-up"
      data-testid={isAi ? `ai-plant-${plant.id}` : undefined}
    >
      <Link
        to="/plants"
        data-testid="back-to-plants"
        className="inline-flex items-center gap-2 text-moss hover:text-forest mb-8"
      >
        <ArrowLeft strokeWidth={1.5} className="w-4 h-4" /> {t("plant.back")}
      </Link>

      <PlantDetailHero
        plant={plant}
        isAi={isAi}
        inGarden={has(plant.id)}
        onAdd={() => addPlant(plant)}
        onRemove={() => removePlant(plant.id)}
        t={t}
      />

      {/* Curated-only: companions from the DB-curated list */}
      {!isAi && <CompanionsSection plantId={plant.id} />}

      {/* Curated-only: "Where can I grow this?" — bridges to the
          /grow-anywhere landing hub. Only renders when we have at least
          one ideal situation on the plant. */}
      {!isAi && plant.grow_anywhere && plant.grow_anywhere.length > 0 && (
        <GrowAnywhereSection situations={plant.grow_anywhere} t={t} />
      )}

      {/* Curated-only: regrow-from-scraps deep-dive (only on plants where
          we have hand-curated method/yield/rating data). */}
      {!isAi && plant.regrow && <RegrowSection regrow={plant.regrow} t={t} />}

      {/* Curated-only: vase-tested cut-flower data (only on plants where we
          have hand-curated vase-days, conditioning and arrangement role). */}
      {!isAi && plant.cut_flower_data && (
        <CutFlowerSection data={plant.cut_flower_data} t={t} />
      )}

      {/* AI-only: growing tips, seasonality, problems, companions, warnings */}
      {isAi && <AIPlantExtras plant={plant} t={t} />}

      <SourceLinks plant={plant} />

      {isAi && (
        <FeedbackWidget
          targetType="plant-guide"
          targetId={plant.id}
          label="Spot something off?"
        />
      )}
    </div>
  );

  return isAi ? <PremiumGate>{body}</PremiumGate> : body;
}

/* ------------------------------------------------------------------ */
/*  Hero section — image + title + specs + actions + tags             */
/* ------------------------------------------------------------------ */
function PlantDetailHero({ plant, isAi, inGarden, onAdd, onRemove, t }) {
  // Curated plants store the Latin name on `botanical`; AI guides store
  // it on `botanical_name`. Normalise so the hero renders the same.
  const botanical = plant.botanical || plant.botanical_name || "";

  return (
    <div className="grid md:grid-cols-12 gap-10">
      <div className="md:col-span-6">
        <div className={`aspect-square overflow-hidden border border-border ${isAi ? "bg-surface" : ""}`}>
          {isAi ? (
            <TopicImage
              subject={`a single ${plant.name}${botanical ? ` (${botanical})` : ""} plant, botanical editorial photograph, soft natural light`}
              cacheKey={`plant-image:${plant.id}`}
              alt={plant.name}
              eager
            />
          ) : (
            <PlantImage plant={plant} eager />
          )}
        </div>
      </div>

      <div className="md:col-span-6">
        <div className="flex items-center gap-2 mb-2">
          {isAi && (
            <span className="inline-flex items-center gap-1.5 text-[10px] tracking-[0.2em] uppercase px-2.5 py-1 border border-terracotta/40 text-terracotta">
              <Sparkles className="w-3 h-3" strokeWidth={1.5} /> AI-generated guide
            </span>
          )}
          <p className="overline">{plant.category}</p>
        </div>
        <h1 className="font-serif text-5xl md:text-6xl text-forest mt-1 tracking-tight">{plant.name}</h1>
        {botanical && (
          <p
            className="font-serif italic text-base md:text-lg text-moss/80 mt-2"
            data-testid="plant-detail-botanical"
          >
            {botanical}
          </p>
        )}
        <p className="text-ink/80 mt-5 text-lg leading-relaxed">{plant.summary}</p>

        <div className="grid grid-cols-2 gap-4 mt-8">
          <Spec icon={Sun} label={t("plant.sun")} value={plant.sun} />
          <Spec icon={Droplets} label={t("plant.water")} value={plant.water} />
          <Spec icon={Sprout} label={t("plant.soil")} value={plant.soil} />
          <Spec icon={Sprout} label={t("plant.difficulty")} value={plant.difficulty} />
          <Spec
            icon={Sprout}
            label={t("plant.container")}
            value={plant.container ? t("common.yes") : t("common.no")}
          />
          <Spec icon={Sprout} label={t("plant.edible_part")} value={plant.edible_part} />
          {/* Curated-only metadata. AI guides don't return lifecycle/hardiness. */}
          {!isAi && plant.lifecycle && (
            <Spec
              icon={Sprout}
              label={t("plant.lifecycle")}
              value={t(`plants.lifecycle.${plant.lifecycle}`)}
            />
          )}
          {!isAi && plant.hardiness && (
            <Spec
              icon={Sprout}
              label={t("plant.hardiness")}
              value={t(`plants.hardiness.${plant.hardiness}`)}
            />
          )}
          {!isAi && plant.min_pot_litres && (
            <Spec
              icon={Sprout}
              label={t("plants.pot_litres")}
              value={t("plants.pot_litres_value", { litres: plant.min_pot_litres })}
            />
          )}
          {!isAi && plant.min_pot_depth_cm && (
            <Spec
              icon={Sprout}
              label={t("plants.pot_depth")}
              value={t("plants.pot_depth_value", { depth: plant.min_pot_depth_cm })}
            />
          )}
        </div>

        <div className="mt-10 flex flex-wrap gap-3">
          {inGarden ? (
            <button
              type="button"
              data-testid="remove-from-garden"
              onClick={onRemove}
              className="btn-ghost inline-flex items-center gap-2"
            >
              <HeartOff strokeWidth={1.5} className="w-4 h-4" /> {t("plant.remove")}
            </button>
          ) : (
            <button
              type="button"
              data-testid="add-to-garden"
              onClick={onAdd}
              className="btn-terracotta inline-flex items-center gap-2"
            >
              <Heart strokeWidth={1.5} className="w-4 h-4" /> {t("plant.add")}
            </button>
          )}
          <Link to="/calendar" data-testid="see-month-guide" className="btn-ghost">
            {t("plant.see_month")}
          </Link>
          {/* Pinterest pin button is curated-only — AI guides are paid and
              shouldn't pollute Pinterest with shareable cards. */}
          {!isAi && (
            <a
              href={pinterestUrl(plant, t)}
              target="_blank"
              rel="noopener noreferrer"
              data-testid="plant-pinterest-save"
              aria-label={t("plant.pin_to_pinterest")}
              title={t("plant.pin_to_pinterest")}
              className="btn-ghost inline-flex items-center gap-2 hover:bg-[#E60023] hover:text-white hover:border-[#E60023]"
            >
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true">
                <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.097.118.112.221.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.746-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z"/>
              </svg>
              {t("plant.pin_to_pinterest")}
            </a>
          )}
        </div>

        {plant.tags && plant.tags.length > 0 && (
          <div className={`flex flex-wrap gap-2 ${isAi ? "mt-8" : "mt-10"}`}>
            {plant.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs px-3 py-1 border border-border bg-surface text-moss tracking-wider uppercase"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AI-only extras                                                     */
/* ------------------------------------------------------------------ */
function AIPlantExtras({ plant, t }) {
  return (
    <>
      {plant.growing && plant.growing.length > 0 && (
        <section
          className="mt-16 border-t border-border pt-10 max-w-3xl"
          data-testid="ai-plant-growing"
        >
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

      {plant.seasonality && (
        <section className="mt-12 max-w-3xl">
          <p className="overline">{t("ai_plant.season")}</p>
          <p className="font-serif text-2xl text-forest mt-2 leading-snug">
            {plant.seasonality}
          </p>
        </section>
      )}

      {plant.problems && plant.problems.length > 0 && (
        <section className="mt-12 max-w-3xl" data-testid="ai-plant-problems">
          <div className="flex items-center gap-3 mb-5">
            <AlertTriangle strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
            <span className="overline">{t("ai_plant.common_problems")}</span>
          </div>
          <ul className="space-y-4">
            {plant.problems.map((p) => (
              <li
                key={p.name}
                className="border-b border-border last:border-b-0 pb-4 last:pb-0"
              >
                <p className="font-serif text-xl text-forest">{p.name}</p>
                <p className="text-sm text-ink/80 mt-1">{p.solution}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {plant.companions && plant.companions.length > 0 && (
        <section className="mt-12 max-w-3xl" data-testid="ai-plant-companions">
          <div className="flex items-center gap-3 mb-5">
            <HandHelping strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
            <span className="overline">{t("ai_plant.plants_well_with")}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {plant.companions.map((c) => (
              <span key={c} className="px-3 py-2 border border-border bg-surface text-forest text-sm">
                {c}
              </span>
            ))}
          </div>
        </section>
      )}

      {plant.warnings && (
        <section
          className="mt-12 max-w-3xl border border-terracotta/40 bg-terracotta/5 p-6"
          data-testid="ai-plant-warning"
        >
          <div className="flex gap-3 items-start">
            <AlertTriangle strokeWidth={1.4} className="w-5 h-5 text-terracotta flex-shrink-0 mt-0.5" />
            <p className="text-ink/80 leading-relaxed">{plant.warnings}</p>
          </div>
        </section>
      )}

      <p
        className="mt-16 text-xs text-moss border-t border-border pt-6 max-w-3xl leading-relaxed"
        data-testid="ai-plant-disclaimer"
      >
        This plant guide is generated by AI from publicly available horticultural knowledge.
        Before eating any part of a plant, cross-check with a trusted local source or grower.
        Toxicity and edibility vary by variety, growing conditions and individual sensitivity.
      </p>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Regrow-from-scraps deep-dive (curated only)                        */
/* ------------------------------------------------------------------ */
function GrowAnywhereSection({ situations, t }) {
  return (
    <section
      className="mt-16 border-t border-border pt-10 max-w-3xl"
      data-testid="plant-grow-anywhere-section"
    >
      <div className="flex items-center gap-3 mb-3">
        <MapPin strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
        <span className="overline">{t("plants.grow_where.heading")}</span>
      </div>
      <p className="text-moss text-sm mb-6 leading-relaxed max-w-2xl">
        {t("plants.grow_where.subheading")}
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {situations.map((sid) => {
          const meta = getSituation(sid);
          if (!meta) return null;
          const Icon = meta.icon;
          return (
            <Link
              key={sid}
              to={`/grow-anywhere?highlight=${sid}`}
              data-testid={`plant-situation-${sid}`}
              className="card-flat p-4 flex gap-3 group hover:border-forest/40"
            >
              <Icon
                strokeWidth={1.4}
                className="w-5 h-5 text-forest flex-shrink-0 mt-1"
              />
              <div className="flex-1">
                <p className="font-serif text-lg text-forest leading-tight">
                  {t(`grow.situation.${sid}.label`)}
                </p>
                <p className="text-xs text-moss mt-1 leading-snug">
                  {t(`grow.situation.${sid}.blurb`)}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}


function RegrowSection({ regrow, t }) {
  const stars = Math.max(1, Math.min(5, regrow.worth_it || 0));
  return (
    <section
      className="mt-16 border-t border-border pt-10 max-w-3xl"
      data-testid="plant-regrow-section"
    >
      <div className="flex items-center gap-3 mb-5">
        <Recycle strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
        <span className="overline">{t("regrow.detail.heading")}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Spec
          icon={Sprout}
          label={t("regrow.method")}
          value={t(`regrow.method.${regrow.method}`)}
        />
        <Spec
          icon={Sprout}
          label={t("regrow.days_to_first_harvest")}
          value={t("regrow.days_value", { days: regrow.days_to_first_harvest })}
        />
        <Spec
          icon={Sprout}
          label={t("regrow.worth_it")}
          value={`${"★".repeat(stars)}${"☆".repeat(5 - stars)}`}
        />
        {regrow.family_friendly && (
          <Spec icon={Sprout} label={t("regrow.kid_friendly")} value={t("common.yes")} />
        )}
      </div>

      <div className="space-y-5">
        <div>
          <p className="overline mb-2">{t("regrow.instructions")}</p>
          <p className="text-ink/85 leading-relaxed" data-testid="plant-regrow-instructions">
            {regrow.instructions}
          </p>
        </div>
        <div>
          <p className="overline mb-2">{t("regrow.yield")}</p>
          <p className="text-ink/85 leading-relaxed">{regrow.yield_summary}</p>
        </div>
        {regrow.notes && (
          <div className="border-l-2 border-terracotta/50 pl-4">
            <p className="overline mb-1">{t("regrow.notes")}</p>
            <p className="text-sm text-moss leading-relaxed">{regrow.notes}</p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Cut-flower vase-life deep-dive (curated only)                      */
/* ------------------------------------------------------------------ */
function CutFlowerSection({ data, t }) {
  return (
    <section
      className="mt-16 border-t border-border pt-10 max-w-3xl"
      data-testid="plant-cutflower-section"
    >
      <div className="flex items-center gap-3 mb-5">
        <Scissors strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
        <span className="overline">{t("cut.detail.heading")}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Spec
          icon={Flower2}
          label={t("cut.vase_days")}
          value={t("cut.vase_days_value", { days: data.vase_days })}
        />
        <Spec
          icon={Flower2}
          label={t("cut.conditioning")}
          value={t(`cut.conditioning.${data.conditioning}`)}
        />
        <Spec
          icon={Flower2}
          label={t("cut.role")}
          value={t(`cut.role.${data.arrangement_role}`)}
        />
        <Spec
          icon={Flower2}
          label={t("cut.cut_and_come_again")}
          value={data.cut_and_come_again ? t("common.yes") : t("cut.one_shot")}
        />
      </div>

      <div className="space-y-5">
        <div>
          <p className="overline mb-2">{t("cut.cut_at_stage")}</p>
          <p className="text-ink/85 leading-relaxed" data-testid="plant-cutflower-stage">
            {data.cut_at_stage}
          </p>
        </div>
        {data.dries_well && (
          <p className="text-sm text-forest italic">{t("cut.dries_well")}</p>
        )}
        {data.notes && (
          <div className="border-l-2 border-terracotta/50 pl-4">
            <p className="overline mb-1">{t("cut.notes")}</p>
            <p className="text-sm text-moss leading-relaxed">{data.notes}</p>
          </div>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Tiny shared helpers                                                */
/* ------------------------------------------------------------------ */
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

function ensurePlantMeta(name, content, attr = "name") {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function ensureJsonLd(tag, data) {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector(`script[data-jsonld="${tag}"]`);
  if (!el) {
    el = document.createElement("script");
    el.type = "application/ld+json";
    el.setAttribute("data-jsonld", tag);
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function pinterestUrl(plant, t) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/api/plants/preview/${plant.id}`;
  const image = `${origin}/api/plants/${plant.id}/og.png`;
  const desc = t("plant.pin_description", { name: plant.name });
  return `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&media=${encodeURIComponent(image)}&description=${encodeURIComponent(desc)}`;
}
