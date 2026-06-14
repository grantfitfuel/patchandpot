import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Sun, Droplets, Sprout } from "lucide-react";
import { fetchPlants } from "@/lib/api";
import PlantImage from "@/components/PlantImage";
import { useI18n } from "@/i18n";

const CATEGORIES = ["All", "Vegetable", "Herb", "Leafy green", "Fruit", "Root", "Allium", "Flower"];

export default function PlantsPage() {
  const { t } = useI18n();
  const [plants, setPlants] = useState([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");

  useEffect(() => {
    fetchPlants().then(setPlants).catch(() => setPlants([]));
  }, []);

  const filtered = plants.filter((p) => {
    if (category !== "All" && p.category !== category) return false;
    if (query && !p.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  const catLabel = (c) => t(`plants.category.${c.toLowerCase().replace(/\s+/g, "-")}`);

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
            onChange={(e) => setQuery(e.target.value)}
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

      {filtered.length === 0 && (
        <p className="text-moss" data-testid="plants-empty">{t("plants.empty")}</p>
      )}
    </div>
  );
}
