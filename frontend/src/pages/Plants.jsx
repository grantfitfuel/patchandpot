import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, Sun, Droplets, Sprout, Sparkles, Loader2 } from "lucide-react";
import { fetchPlants, fetchPlantGuide, fetchRecentAIPlants } from "@/lib/api";
import PlantImage from "@/components/PlantImage";
import { useI18n } from "@/i18n";

const CATEGORIES = ["All", "Vegetable", "Herb", "Leafy green", "Fruit", "Root", "Allium", "Flower"];

export default function PlantsPage() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [plants, setPlants] = useState([]);
  const [recent, setRecent] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState("");

  useEffect(() => {
    fetchPlants().then(setPlants).catch(() => setPlants([]));
  }, []);

  useEffect(() => {
    fetchRecentAIPlants(lang).then((d) => setRecent(d.items || [])).catch(() => {});
  }, [lang]);

  const filtered = plants.filter((p) => {
    if (category !== "All" && p.category !== category) return false;
    if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

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
      const msg = e?.response?.data?.detail || "Couldn't generate a guide for that plant.";
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
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c}
              data-testid={`category-${c.toLowerCase().replace(/\s+/g, "-")}`}
              onClick={() => setCategory(c)}
              className={`text-xs px-3 py-2 border transition-colors ${
                category === c ? "bg-forest text-sand border-forest" : "bg-sand text-ink/70 border-border hover:border-forest/40"
              }`}
            >
              {catLabel(c)}
            </button>
          ))}
        </div>
      </div>

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
                <p className="overline">{r.category}</p>
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
              <p className="overline">{p.category}</p>
              <h3 className="font-serif text-2xl text-forest mt-2">{p.name}</h3>
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
