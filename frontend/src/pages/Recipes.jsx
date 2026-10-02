/**
 * /recipes — a small hand-curated recipe library that leans on what you
 * can actually harvest from a windowsill / balcony / patch. Modelled on
 * the original patchandpot.com/recipes.html page: quick salads, simple
 * mains, sides & soups, sweet & snacks — with allergen labels, a
 * printable recipe card view, and cross-links to any plant in the
 * library the recipe uses.
 *
 * Data lives in /src/data/recipes.js so it's easy to hand-curate and
 * doesn't cost anything to render (no AI, no DB).
 */
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Leaf, ChefHat, Clock, Users, Flame, X, Sparkles } from "lucide-react";
import { useI18n } from "@/i18n";
import { RECIPES, SECTIONS } from "@/data/recipes";
import RecipeImage from "@/components/RecipeImage";
import { useMyGarden } from "@/hooks/useMyGarden";
import PageHero from "@/components/PageHero";
import { HarvestMotif } from "@/components/illustrations/VibrantMotifs";

// Rough month → season lookup for the "in season now" filter. Northern
// hemisphere for now — southern-hemisphere users still get the "all"
// bucket, and we can flip on region later.
const MONTH_TO_SEASON = [
  "winter","winter","spring","spring","spring","summer",
  "summer","summer","autumn","autumn","autumn","winter",
];

export default function RecipesPage() {
  const { t } = useI18n();
  const [searchParams, setSearchParams] = useSearchParams();
  const focus = searchParams.get("id") || null;
  const ingredient = searchParams.get("ingredient") || null;
  const { plants: myGarden } = useMyGarden();

  const [dietFilter, setDietFilter] = useState(null);
  // "quick" filter: null | "in-season" | "my-garden"
  const [quickFilter, setQuickFilter] = useState(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = "Recipes — Patch & Pot";
    ensureMeta(
      "description",
      "A real reason to grow. Every recipe uses something you can raise at home — glut-solvers, quick meals from a windowsill, preserves that carry summer through the winter.",
    );
  }, []);

  useEffect(() => {
    if (!focus || typeof document === "undefined") return;
    requestAnimationFrame(() => {
      const el = document.getElementById(`recipe-${focus}`);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [focus]);

  const currentSeason = MONTH_TO_SEASON[new Date().getMonth()];
  const gardenIds = useMemo(() => new Set(myGarden.map((p) => p.id)), [myGarden]);

  const ingredientRecipe = useMemo(() => {
    if (!ingredient) return null;
    // The label to show for the chip: prefer a real recipe's `uses` entry
    // (already a plant id) — just prettify it.
    return ingredient.replace(/-/g, " ");
  }, [ingredient]);

  const clearIngredient = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("ingredient");
    setSearchParams(params, { replace: true });
  };

  const filtered = useMemo(() => {
    return RECIPES.filter((r) => {
      if (dietFilter && !(r.diet || []).includes(dietFilter)) return false;
      if (quickFilter === "in-season") {
        const s = r.season || ["all"];
        // Preserves are always "in season" (either you're making them
        // from a glut, or eating them in January) — see recipes.js note.
        if (!s.includes(currentSeason) && !s.includes("all") && r.section !== "preserves") return false;
      }
      if (quickFilter === "my-garden") {
        const uses = r.uses || [];
        if (!uses.some((id) => gardenIds.has(id))) return false;
      }
      if (ingredient) {
        const uses = r.uses || [];
        if (!uses.includes(ingredient)) return false;
      }
      return true;
    });
  }, [dietFilter, quickFilter, ingredient, currentSeason, gardenIds]);

  const bySection = useMemo(() => {
    const grouped = {};
    for (const r of filtered) {
      if (!grouped[r.section]) grouped[r.section] = [];
      grouped[r.section].push(r);
    }
    return grouped;
  }, [filtered]);

  const totalMatches = filtered.length;

  return (
    <div className="animate-fade-up">
      <PageHero
        variant="terracotta"
        eyebrow={t("recipe.eyebrow")}
        title={t("recipe.title")}
        blurb={t("recipe.intro")}
        Motif={HarvestMotif}
      />
      <div className="container-narrow py-10 md:py-14">

      {ingredient && (
        <div
          data-testid="recipe-ingredient-chip"
          className="mb-6 inline-flex items-center gap-2 border border-terracotta/40 bg-terracotta/5 text-terracotta px-3 py-1.5 rounded-full text-xs"
        >
          <Sparkles className="w-3.5 h-3.5" strokeWidth={1.6} />
          <span>{t("recipe.filter.ingredient", { ingredient: ingredientRecipe })}</span>
          <button
            type="button"
            onClick={clearIngredient}
            data-testid="recipe-ingredient-clear"
            className="ml-1 hover:opacity-70"
            aria-label={t("recipe.filter.clear")}
          >
            <X className="w-3.5 h-3.5" strokeWidth={1.8} />
          </button>
        </div>
      )}

      {/* Quick filter row */}
      <div className="flex flex-wrap items-center gap-2 mb-3" data-testid="recipe-quick-row">
        <span className="text-[0.65rem] uppercase tracking-widest text-moss/70 mr-1">
          {t("recipe.filter.show")}
        </span>
        {[
          { id: null,          label: t("recipe.filter.all") },
          { id: "in-season",   label: t("recipe.filter.in_season") },
          { id: "my-garden",   label: t("recipe.filter.my_garden") },
        ].map((opt) => (
          <button
            key={opt.id || "all"}
            type="button"
            data-testid={`recipe-quick-${opt.id || "all"}`}
            onClick={() => setQuickFilter(opt.id)}
            className={`text-xs px-2.5 py-1 border rounded-full transition-colors ${
              quickFilter === opt.id
                ? "bg-forest/10 text-forest border-forest"
                : "bg-transparent text-ink/60 border-border/70 hover:border-forest/40"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Diet filter chips */}
      <div className="flex flex-wrap items-center gap-2 mb-8" data-testid="recipe-diet-row">
        <span className="text-[0.65rem] uppercase tracking-widest text-moss/70 mr-1">
          {t("recipe.filter.label")}
        </span>
        {[
          { id: null, label: t("recipe.filter.all") },
          { id: "V",  label: t("recipe.diet.V") },
          { id: "VG", label: t("recipe.diet.VG") },
          { id: "GF", label: t("recipe.diet.GF") },
          { id: "DF", label: t("recipe.diet.DF") },
        ].map((opt) => (
          <button
            key={opt.id || "all"}
            type="button"
            data-testid={`recipe-diet-${opt.id || "all"}`}
            onClick={() => setDietFilter(opt.id)}
            className={`text-xs px-2.5 py-1 border rounded-full transition-colors ${
              dietFilter === opt.id
                ? "bg-forest/10 text-forest border-forest"
                : "bg-transparent text-ink/60 border-border/70 hover:border-forest/40"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {totalMatches === 0 && (
        <div className="card-flat p-6 mb-10 text-sm text-moss" data-testid="recipe-empty">
          {t("recipe.empty")}
        </div>
      )}

      {SECTIONS.map((section) => {
        const rows = bySection[section.id] || [];
        if (rows.length === 0) return null;
        return (
          <section key={section.id} className="mb-16" data-testid={`recipe-section-${section.id}`}>
            <div className="mb-6">
              <h2 className="font-serif text-3xl text-forest tracking-tight">
                {t(section.labelKey)}
              </h2>
              {section.id === "preserves" && (
                <p className="mt-2 text-sm text-moss max-w-xl">
                  {t("recipe.section.preserves_blurb")}
                </p>
              )}
            </div>
            <div className="space-y-10">
              {rows.map((r) => (
                <RecipeCard key={r.id} recipe={r} t={t} focussed={focus === r.id} />
              ))}
            </div>
          </section>
        );
      })}

      {/* Allergen key */}
      <section className="mt-20 border-t border-border pt-10 max-w-2xl">
        <h2 className="font-serif text-2xl text-forest tracking-tight mb-4">
          {t("recipe.allergen_key")}
        </h2>
        <p className="text-sm text-moss leading-relaxed">
          <strong>{t("recipe.diet.V")}</strong>: {t("recipe.diet_full.V")} ·{" "}
          <strong>{t("recipe.diet.VG")}</strong>: {t("recipe.diet_full.VG")} ·{" "}
          <strong>{t("recipe.diet.GF")}</strong>: {t("recipe.diet_full.GF")} ·{" "}
          <strong>{t("recipe.diet.DF")}</strong>: {t("recipe.diet_full.DF")}.{" "}
          {t("recipe.diet.can_be_note")}
        </p>
      </section>

      {/* Waste-less tips */}
      <section className="mt-12 max-w-2xl">
        <h2 className="font-serif text-2xl text-forest tracking-tight mb-4">
          {t("recipe.waste_tips.heading")}
        </h2>
        <p className="text-sm text-moss leading-relaxed">
          {t("recipe.waste_tips.body")}
        </p>
      </section>
      </div>
    </div>
  );
}

function RecipeCard({ recipe, t, focussed }) {
  return (
    <article
      id={`recipe-${recipe.id}`}
      data-testid={`recipe-${recipe.id}`}
      className={`card-flat overflow-hidden ${focussed ? "ring-2 ring-terracotta/40 border-terracotta/40" : ""}`}
    >
      <div className="aspect-[16/9] bg-surface/60 border-b border-border">
        <RecipeImage recipe={recipe} />
      </div>
      <div className="p-6 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
        <div className="flex-1 min-w-[220px]">
          <h3 className="font-serif text-2xl md:text-3xl text-forest tracking-tight">
            {recipe.title}
          </h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs text-moss uppercase tracking-widest">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" strokeWidth={1.5} />
              {recipe.time}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" strokeWidth={1.5} />
              {t("recipe.serves")} {recipe.serves}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5" strokeWidth={1.5} />
              ~{recipe.kcal} kcal
            </span>
          </div>
          {recipe.macros && (
            <p className="text-xs text-moss/70 mt-2">{recipe.macros}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {(recipe.diet || []).map((tag) => (
            <span
              key={tag}
              className="text-[0.65rem] uppercase tracking-widest px-2 py-1 border border-forest/30 text-forest"
              title={t(`recipe.diet_full.${tag.replace("-", "_")}`)}
            >
              {t(`recipe.diet.${tag}`)}
            </span>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-8 mt-6">
        <div className="md:col-span-2">
          <p className="overline mb-3">{t("recipe.ingredients")}</p>
          <ul className="space-y-2 text-sm text-ink/85 leading-relaxed">
            {recipe.ingredients.map((ing, i) => (
              <li key={i} className="flex gap-2">
                <Leaf className="w-3.5 h-3.5 text-forest/60 flex-shrink-0 mt-1" strokeWidth={1.5} />
                <span>{ing}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="md:col-span-3">
          <p className="overline mb-3">{t("recipe.method")}</p>
          <ol className="space-y-3 text-sm text-ink/85 leading-relaxed">
            {recipe.method.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="font-serif text-lg text-terracotta flex-shrink-0 w-6">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {recipe.uses && recipe.uses.length > 0 && (
        <div className="mt-6 pt-6 border-t border-border flex flex-wrap items-center gap-2">
          <ChefHat className="w-3.5 h-3.5 text-moss" strokeWidth={1.5} />
          <span className="text-xs text-moss/80 uppercase tracking-widest mr-1">
            {t("recipe.uses")}
          </span>
          {recipe.uses.map((pid) => (
            <Link
              key={pid}
              to={`/plants/${pid}`}
              data-testid={`recipe-plant-link-${pid}`}
              className="text-xs px-2 py-1 border border-border/70 rounded-full text-forest hover:border-forest/60"
            >
              {pid.replace(/-/g, " ")}
            </Link>
          ))}
        </div>
      )}
      </div>
    </article>
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
