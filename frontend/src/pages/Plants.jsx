import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Search, Sun, Droplets, Sprout, Sparkles, Loader2, Recycle, Flower2 } from "lucide-react";
import { fetchPlants, fetchPlantGuide, fetchRecentAIPlants } from "@/lib/api";
import PlantImage from "@/components/PlantImage";
import RecommendedRail from "@/components/RecommendedRail";
import { useI18n } from "@/i18n";
import { useRegion } from "@/hooks/useRegion";
import { useMyGarden } from "@/hooks/useMyGarden";
import { formatApiError } from "@/lib/formatApiError";

// Each group may declare `subFilters`: a list of {key, label, categories?, tags?}.
// A sub-filter matches a plant if EITHER its categories include p.category OR
// any of its tags appear in p.tags. Selecting an additional sub-filter narrows
// the visible list further (defaults to "all in group" = no sub-filter active).
const GROUPS = [
  { key: "all", label: "plants.group.all", categories: null },
  {
    key: "edibles",
    label: "plants.group.edibles",
    categories: ["Vegetable", "Brassica", "Legume", "Squash", "Leafy green", "Allium", "Root"],
    subFilters: [
      { key: "vegetable", label: "plants.category.vegetable", categories: ["Vegetable"] },
      { key: "leafy-green", label: "plants.category.leafy-green", categories: ["Leafy green"] },
      { key: "brassica", label: "plants.category.brassica", categories: ["Brassica"] },
      { key: "legume", label: "plants.category.legume", categories: ["Legume"] },
      { key: "squash", label: "plants.category.squash", categories: ["Squash"] },
      { key: "root", label: "plants.category.root", categories: ["Root"] },
      { key: "allium", label: "plants.category.allium", categories: ["Allium"] },
    ],
  },
  { key: "herbs", label: "plants.group.herbs", categories: ["Herb"] },
  { key: "fruit", label: "plants.group.fruit", categories: ["Fruit"] },
  {
    key: "flowers",
    label: "plants.group.flowers",
    categories: ["Flower"],
    subFilters: [
      { key: "bulbs", label: "plants.subfilter.bulbs", tags: ["bulb", "corm", "tuber", "rhizome"] },
      { key: "drought", label: "plants.subfilter.drought", tags: ["drought"] },
      { key: "shade", label: "plants.subfilter.shade", tags: ["shade"] },
      { key: "edible-petals", label: "plants.subfilter.edible-petals", tags: ["edible-flower"] },
      { key: "fragrant", label: "plants.subfilter.fragrant", tags: ["fragrant"] },
    ],
  },
  {
    key: "cut-flowers",
    label: "plants.group.cut-flowers",
    categories: ["Cut flower"],
    subFilters: [
      { key: "bulbs", label: "plants.subfilter.bulbs", tags: ["bulb", "corm", "tuber", "rhizome"] },
      { key: "spires", label: "plants.subfilter.spires", tags: ["spire"] },
      { key: "fillers", label: "plants.subfilter.fillers", tags: ["filler"] },
      { key: "fragrant", label: "plants.subfilter.fragrant", tags: ["fragrant"] },
      { key: "everlasting", label: "plants.subfilter.everlasting", tags: ["everlasting"] },
      { key: "perennials", label: "plants.subfilter.perennials", tags: ["perennial"] },
    ],
  },
  {
    key: "shrubs",
    label: "plants.group.shrubs",
    categories: ["Shrub", "Climber"],
    subFilters: [
      { key: "shrub", label: "plants.category.shrub", categories: ["Shrub"] },
      { key: "climber", label: "plants.category.climber", categories: ["Climber"] },
    ],
  },
  { key: "sprouts", label: "plants.group.sprouts", categories: ["Sprouts"] },
];

function matchesSubFilter(p, sf) {
  if (sf.categories && sf.categories.includes(p.category)) return true;
  if (sf.tags && sf.tags.some((t) => (p.tags || []).includes(t))) return true;
  return false;
}

export default function PlantsPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { region } = useRegion();
  const { plants: myGarden } = useMyGarden();
  const [plants, setPlants] = useState([]);
  const [recent, setRecent] = useState([]);
  const [query, setQuery] = useState("");
  const [sortBy, setSortBy] = useState("default");
  const [group, setGroup] = useState("all");
  const [subFilterKey, setSubFilterKey] = useState(null);
  const [lifecycle, setLifecycle] = useState(null);
  // Niche filters (regrow-from-scraps, cut-flower garden) live alongside
  // group/sub-filter — they're independent toggles, not part of the
  // category taxonomy.
  const [specialFilter, setSpecialFilter] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    fetchPlants(lang).then(setPlants).catch(() => setPlants([]));
  }, [lang]);

  useEffect(() => {
    fetchRecentAIPlants(lang).then((d) => setRecent(d.items || [])).catch(() => {});
  }, [lang]);

  // Reset sub-filter when the parent group changes.
  useEffect(() => { setSubFilterKey(null); setLifecycle(null); }, [group]);

  const activeGroup = GROUPS.find((g) => g.key === group) || GROUPS[0];
  const activeSub = activeGroup.subFilters?.find((s) => s.key === subFilterKey) || null;
  const baseFiltered = plants.filter((p) => {
    if (activeGroup.categories && !activeGroup.categories.includes(p.category)) return false;
    if (activeSub && !matchesSubFilter(p, activeSub)) return false;
    if (lifecycle && p.lifecycle !== lifecycle) return false;
    if (specialFilter === "regrow" && !p.regrow_from_scrap) return false;
    if (specialFilter === "cut-flower" && !p.cut_flower) return false;
    if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const DIFFICULTY_ORDER = { "Very easy": 0, "Easy": 1, "Medium": 2, "Hard": 3 };
  const LIFECYCLE_ORDER = { "annual": 0, "biennial": 1, "perennial": 2 };
  const filtered = (() => {
    if (sortBy === "default") return baseFiltered;
    const arr = [...baseFiltered];
    if (sortBy === "az") arr.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "difficulty") arr.sort((a, b) => (DIFFICULTY_ORDER[a.difficulty] ?? 9) - (DIFFICULTY_ORDER[b.difficulty] ?? 9));
    else if (sortBy === "lifecycle") arr.sort((a, b) => (LIFECYCLE_ORDER[a.lifecycle] ?? 9) - (LIFECYCLE_ORDER[b.lifecycle] ?? 9) || a.name.localeCompare(b.name));
    return arr;
  })();

  // Only show the lifecycle chip row when at least two lifecycle types
  // exist within the current group + sub-filter slice. Avoids redundant
  // chips for e.g. patio fruit (all perennials).
  const lifecyclesPresent = new Set(
    plants
      .filter((p) => {
        if (activeGroup.categories && !activeGroup.categories.includes(p.category)) return false;
        if (activeSub && !matchesSubFilter(p, activeSub)) return false;
        return true;
      })
      .map((p) => p.lifecycle)
      .filter(Boolean)
  );
  const showLifecycleRow = lifecyclesPresent.size >= 2;

  const catLabel = (c) => t(`plants.category.${c.toLowerCase().replace(/\s+/g, "-")}`);

  const askAI = async () => {
    if (!query.trim() || generating) return;
    setGenerating(true);
    setAiError("");
    try {
      const guide = await fetchPlantGuide(query.trim(), lang);
      // Cache hit on backend means instant; otherwise this is the slow path.
      navigate(`/plants/ai/${guide.id}?q=${encodeURIComponent(query.trim())}`);
    } catch (e) {
      const msg = formatApiError(e, "Couldn't generate a guide for that plant.");
      setAiError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const showAskCTA = query.trim().length >= 2 && filtered.length === 0;

  return (
    <div className="container-narrow py-12 md:py-16 animate-fade-up">
      <div className="mb-10">
        <p className="overline">{t("plants.eyebrow")}</p>
        <h1 className="font-serif text-5xl md:text-6xl text-forest mt-3 tracking-tight">{t("plants.title")}</h1>
        <p className="mt-3 text-ink/75 max-w-xl">{t("plants.subtitle")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-8">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-moss" strokeWidth={1.5} />
          <input
            type="text"
            data-testid="plants-search"
            placeholder={t("plants.search")}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setAiError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" && showAskCTA) askAI(); }}
            className="w-full pl-10 pr-3 py-3 bg-sand border border-border focus:border-forest outline-none text-ink"
          />
        </div>
        <select
          data-testid="plants-sort"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="text-xs px-3 py-2 bg-sand border border-border text-ink/80 cursor-pointer hover:border-forest/40 focus:border-forest outline-none"
        >
          <option value="default">{t("plants.sort.default")}</option>
          <option value="az">{t("plants.sort.az")}</option>
          <option value="difficulty">{t("plants.sort.difficulty")}</option>
          <option value="lifecycle">{t("plants.sort.lifecycle")}</option>
        </select>
        <div className="flex flex-wrap gap-2">
          {GROUPS.map((g) => (
            <button
              key={g.key}
              data-testid={`group-${g.key}`}
              onClick={() => setGroup(g.key)}
              className={`text-xs px-3 py-2 border transition-colors ${
                group === g.key ? "bg-forest text-sand border-forest" : "bg-sand text-ink/70 border-border hover:border-forest/40"
              }`}
            >
              {t(g.label)}
            </button>
          ))}
        </div>
      </div>

      {/* Secondary sub-filter row — only when group has 2+ sub-filters */}
      {activeGroup.subFilters && activeGroup.subFilters.length > 1 && (
        <div className="flex flex-wrap gap-2 -mt-4 mb-8 pl-1" data-testid="subfilter-row">
          <button
            type="button"
            data-testid="subfilter-all"
            onClick={() => setSubFilterKey(null)}
            className={`text-xs px-2.5 py-1 border rounded-full transition-colors ${
              subFilterKey === null ? "bg-forest/10 text-forest border-forest" : "bg-transparent text-ink/60 border-border/70 hover:border-forest/40"
            }`}
          >
            {t("plants.subcategory.all")}
          </button>
          {activeGroup.subFilters.map((sf) => (
            <button
              key={sf.key}
              type="button"
              data-testid={`subfilter-${sf.key}`}
              onClick={() => setSubFilterKey(sf.key)}
              className={`text-xs px-2.5 py-1 border rounded-full transition-colors ${
                subFilterKey === sf.key ? "bg-forest/10 text-forest border-forest" : "bg-transparent text-ink/60 border-border/70 hover:border-forest/40"
              }`}
            >
              {t(sf.label)}
            </button>
          ))}
        </div>
      )}

      {/* Tertiary lifecycle row — Annual / Biennial / Perennial */}
      {showLifecycleRow && (
        <div className="flex flex-wrap items-center gap-2 -mt-4 mb-8 pl-1" data-testid="lifecycle-row">
          <span className="text-[0.65rem] uppercase tracking-widest text-moss/70 mr-1">
            {t("plants.lifecycle.label")}
          </span>
          <button
            type="button"
            data-testid="lifecycle-all"
            onClick={() => setLifecycle(null)}
            className={`text-xs px-2.5 py-1 border rounded-full transition-colors ${
              lifecycle === null ? "bg-forest/10 text-forest border-forest" : "bg-transparent text-ink/60 border-border/70 hover:border-forest/40"
            }`}
          >
            {t("plants.subcategory.all")}
          </button>
          {["annual", "biennial", "perennial"].filter((lc) => lifecyclesPresent.has(lc)).map((lc) => (
            <button
              key={lc}
              type="button"
              data-testid={`lifecycle-${lc}`}
              onClick={() => setLifecycle(lc)}
              className={`text-xs px-2.5 py-1 border rounded-full transition-colors ${
                lifecycle === lc ? "bg-forest/10 text-forest border-forest" : "bg-transparent text-ink/60 border-border/70 hover:border-forest/40"
              }`}
            >
              {t(`plants.lifecycle.${lc}`)}
            </button>
          ))}
        </div>
      )}

      {/* Empty state with AI CTA */}
      {showAskCTA && (
        <div className="card-flat p-8 mb-10 flex flex-col sm:flex-row items-center gap-6" data-testid="ai-plant-cta">
          <Sparkles strokeWidth={1.4} className="w-8 h-8 text-terracotta flex-shrink-0" />
          <div className="flex-1 text-center sm:text-left">
            <h2 className="font-serif text-2xl text-forest">Not in our library?</h2>
            <p className="text-moss mt-1">
              Ask Patch &amp; Pot to put together a quick guide for <em className="text-forest not-italic">&ldquo;{query}&rdquo;</em> — care, season, problems and companions.
            </p>
            {aiError && <p className="text-sm text-terracotta mt-2" data-testid="ai-plant-error">{aiError}</p>}
          </div>
          <button
            type="button"
            onClick={askAI}
            disabled={generating}
            data-testid="ask-ai-btn"
            className="btn-terracotta inline-flex items-center gap-2 whitespace-nowrap"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" strokeWidth={1.5} />}
            {generating ? "Growing your guide…" : `Ask about ${query.trim().split(" ")[0]}`}
          </button>
        </div>
      )}

      {/* Recommended rail — only on the unfiltered default view, so it
          doesn't fight a user who's already drilled into a category. */}
      {group === "all" && !subFilterKey && !lifecycle && !query.trim() && (
        <RecommendedRail
          plants={plants}
          region={region}
          excludeIds={(myGarden || []).map((p) => p?.id).filter(Boolean)}
          variant="compact"
        />
      )}

      {/* Recently searched AI plants rail */}
      {recent.length > 0 && (
        <section className="mb-12" data-testid="recent-ai-rail">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Sparkles strokeWidth={1.4} className="w-4 h-4 text-terracotta" />
              <span className="overline">Recently searched · AI guides</span>
            </div>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-2 px-2">
            {recent.map((r) => (
              <Link
                key={r.id}
                to={`/plants/ai/${r.id}`}
                data-testid={`recent-ai-${r.id}`}
                className="card-flat px-4 py-3 min-w-[180px] flex-shrink-0 group hover:border-forest/40"
              >
                <p className="overline">{catLabel(r.category)}</p>
                <p className="font-serif text-lg text-forest mt-1 truncate">{r.name}</p>
                <p className="text-xs text-moss mt-1 line-clamp-2 leading-snug">{r.summary}</p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="plants-grid">
        {filtered.map((p) => (
          <Link
            to={`/plants/${p.id}`}
            key={p.id}
            data-testid={`plant-card-${p.id}`}
            className="card-flat group flex flex-col"
          >
            <div className="aspect-[4/3] overflow-hidden bg-surface">
              <PlantImage plant={p} />
            </div>
            <div className="p-5 flex flex-col flex-1">
              <p className="overline">{catLabel(p.category)}</p>
              <h3 className="font-serif text-2xl text-forest mt-2">{p.name}</h3>
              {p.botanical && (
                <p className="font-serif italic text-xs text-moss/80 mt-0.5" data-testid={`plant-card-botanical-${p.id}`}>
                  {p.botanical}
                </p>
              )}
              {(p.hardiness || p.lifecycle) && (
                <p className="text-xs text-moss mt-1" data-testid={`plant-card-meta-${p.id}`}>
                  {[
                    p.hardiness && p.hardiness !== "indoor" ? t(`plants.hardiness.${p.hardiness}`) : (p.hardiness === "indoor" ? t("plants.hardiness.indoor") : null),
                    p.lifecycle ? t(`plants.lifecycle.${p.lifecycle}`).toLowerCase() : null,
                  ].filter(Boolean).join(" ")}
                </p>
              )}
              <p className="text-sm text-ink/70 mt-2 flex-1">{p.summary}</p>
              <div className="flex items-center gap-4 mt-4 text-xs text-moss">
                <span className="inline-flex items-center gap-1.5"><Sun className="w-3.5 h-3.5" strokeWidth={1.5} />{p.sun}</span>
                <span className="inline-flex items-center gap-1.5"><Droplets className="w-3.5 h-3.5" strokeWidth={1.5} />{p.water}</span>
                <span className="inline-flex items-center gap-1.5"><Sprout className="w-3.5 h-3.5" strokeWidth={1.5} />{p.difficulty}</span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && !showAskCTA && (
        <p className="text-moss" data-testid="plants-empty">{t("plants.empty")}</p>
      )}
    </div>
  );
}
