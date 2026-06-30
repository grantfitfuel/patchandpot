/**
 * /cut-flowers — SEO landing page for the vase-tested cut-flower deep-dive.
 * Filters the catalogue to plants flagged `cut_flower` (with hand-curated
 * vase_days / conditioning / arrangement_role) and exposes a role chip row
 * so a reader can build a real arrangement (focal + spike + filler + foliage).
 *
 * Default sort = longest vase life first — we put the workhorses up top, not
 * the pretty-but-sulky ones.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Flower2, Sparkles } from "lucide-react";
import { fetchPlants } from "@/lib/api";
import PlantImage from "@/components/PlantImage";
import { useI18n } from "@/i18n";

const ROLES = ["all", "focal", "spike", "filler", "foliage", "umbel"];

export default function CutFlowersPage() {
  const { t, lang } = useI18n();
  const [plants, setPlants] = useState([]);
  const [role, setRole] = useState("all");
  const [sortBy, setSortBy] = useState("vase_days");

  useEffect(() => {
    fetchPlants(lang)
      .then((list) => setPlants((list || []).filter((p) => p?.cut_flower_data)))
      .catch(() => setPlants([]));
  }, [lang]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = `Cut Flowers — Patch & Pot`;
  }, []);

  const filtered = useMemo(() => {
    const arr = plants.filter((p) =>
      role === "all" ? true : p.cut_flower_data?.arrangement_role === role
    );
    if (sortBy === "vase_days") {
      arr.sort((a, b) => (b.cut_flower_data?.vase_days ?? 0) - (a.cut_flower_data?.vase_days ?? 0));
    } else if (sortBy === "name") {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    }
    return arr;
  }, [plants, role, sortBy]);

  return (
    <div className="container-narrow py-12 md:py-16 animate-fade-up" data-testid="cut-flowers-landing">
      <div className="mb-10 max-w-2xl">
        <p className="overline inline-flex items-center gap-2">
          <Flower2 className="w-3.5 h-3.5" strokeWidth={1.6} />
          {t("cut.eyebrow")}
        </p>
        <h1 className="font-serif text-5xl md:text-6xl text-forest mt-3 tracking-tight">
          {t("cut.title")}
        </h1>
        <p className="mt-4 text-ink/75 leading-relaxed">{t("cut.intro")}</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-10">
        <div className="flex flex-wrap gap-2" data-testid="cut-flowers-filter-row">
          {ROLES.map((r) => (
            <button
              key={r}
              type="button"
              data-testid={`cut-filter-${r}`}
              onClick={() => setRole(r)}
              className={`text-xs px-3 py-2 border transition-colors ${
                role === r
                  ? "bg-forest text-sand border-forest"
                  : "bg-sand text-ink/70 border-border hover:border-forest/40"
              }`}
            >
              {t(`cut.filter.${r}`)}
            </button>
          ))}
        </div>
        <select
          data-testid="cut-flowers-sort"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="text-xs px-3 py-2 bg-sand border border-border text-ink/80 cursor-pointer hover:border-forest/40 focus:border-forest outline-none ml-auto"
        >
          <option value="vase_days">{t("cut.sort.vase_days")}</option>
          <option value="name">{t("cut.sort.name")}</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="text-moss" data-testid="cut-flowers-empty">{t("cut.empty")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="cut-flowers-grid">
          {filtered.map((p) => {
            const d = p.cut_flower_data || {};
            return (
              <Link
                key={p.id}
                to={`/plants/${p.id}`}
                data-testid={`cut-card-${p.id}`}
                className="card-flat group flex flex-col"
              >
                <div className="aspect-[4/3] overflow-hidden bg-surface relative">
                  <PlantImage plant={p} />
                  {d.cut_and_come_again && (
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 bg-terracotta text-sand text-[10px] uppercase tracking-widest">
                      <Sparkles className="w-3 h-3" strokeWidth={1.6} />
                      {t("cut.cut_and_come_again")}
                    </span>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <p className="overline">{t(`cut.role.${d.arrangement_role}`)}</p>
                  <h3 className="font-serif text-2xl text-forest mt-1.5">{p.name}</h3>
                  <p className="text-sm text-moss mt-1" data-testid={`cut-card-vase-${p.id}`}>
                    {t("cut.vase_days_value", { days: d.vase_days })} ·{" "}
                    {t(`cut.conditioning.${d.conditioning}`)}
                  </p>
                  <p className="text-sm text-ink/75 mt-3 flex-1">{d.cut_at_stage}</p>
                  {d.dries_well && (
                    <p className="text-xs text-forest italic mt-3 border-t border-border pt-3">
                      {t("cut.dries_well")}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
