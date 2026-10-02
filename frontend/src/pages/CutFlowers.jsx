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
import { Flower2, Sparkles, Lightbulb } from "lucide-react";
import { fetchPlants } from "@/lib/api";
import PlantImage from "@/components/PlantImage";
import { useI18n } from "@/i18n";
import PageHero from "@/components/PageHero";
import { PoppyMotif } from "@/components/illustrations/VibrantMotifs";

const ROLES = ["all", "focal", "spike", "filler", "foliage", "umbel"];

// Six tips on making cut flowers last longer in a vase. Curated to stay
// honest — no Pinterest myths (pennies, hairspray, vodka). Every tip below
// has either a chemistry reason or is what real cut-flower growers do.
const TIP_KEYS = [
  "vase_food",
  "rewater",
  "trim_stems",
  "strip_leaves",
  "cool_spot",
  "no_fruit",
  "spring_cold",
  "clean_vase",
];

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

  // SEO meta + JSON-LD CollectionPage schema. Helps Google understand this
  // page as a curated set rather than a generic article, and unfurls cleanly
  // on Pinterest / Facebook / Twitter via the brand OG fallback.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = "Cut Flowers — Patch & Pot";
    const origin = window.location.origin;
    const imgUrl = `${origin}/api/share/og/brand.png`;
    const desc =
      "A curated set of vase-tested cut flowers with honest vase-life, the exact stage to cut at, and how to condition each stem — plus what to add to make flowers last longer.";
    ensureLandingMeta("description", desc);
    ensureLandingMeta("og:title", document.title, "property");
    ensureLandingMeta("og:description", desc, "property");
    ensureLandingMeta("og:type", "website", "property");
    ensureLandingMeta("og:image", imgUrl, "property");
    ensureLandingMeta("twitter:card", "summary_large_image");
    ensureLandingMeta("twitter:image", imgUrl);
    ensureLandingJsonLd("cut-flowers-jsonld", {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Cut Flowers — vase-tested",
      description: desc,
      url: window.location.href,
      image: imgUrl,
      publisher: { "@type": "Organization", name: "Patch & Pot" },
      dateModified: new Date().toISOString().slice(0, 10),
    });
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

  const pinUrl = useMemo(() => {
    if (typeof window === "undefined") return "#";
    const origin = window.location.origin;
    return `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(
      window.location.href
    )}&media=${encodeURIComponent(`${origin}/api/share/og/brand.png`)}&description=${encodeURIComponent(
      t("cut.pin_description")
    )}`;
  }, [t]);

  return (
    <div className="animate-fade-up" data-testid="cut-flowers-landing">
      <PageHero
        variant="terracotta"
        eyebrow={t("cut.eyebrow")}
        title={t("cut.title")}
        blurb={t("cut.intro")}
        Motif={PoppyMotif}
        actions={
          <a
            href={pinUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="cut-flowers-pin"
            aria-label={t("cut.pin_to_pinterest")}
            className="inline-flex items-center gap-2 py-2.5 px-4 bg-sand text-forest hover:bg-[#E60023] hover:text-white transition-colors text-sm font-medium"
            style={{ borderRadius: "9999px" }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.097.118.112.221.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.746-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z" />
            </svg>
            {t("cut.pin_to_pinterest")}
          </a>
        }
      />
      <div className="container-narrow py-10 md:py-14">

      <VaseLifeTips t={t} />

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
                  <p className="text-sm text-moss mt-1" data-testid={`cut-card-meta-${p.id}`}>
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Vase-life tips — what to add and what to avoid                    */
/* ------------------------------------------------------------------ */
function VaseLifeTips({ t }) {
  return (
    <section className="mb-16 border-y border-border py-10" data-testid="vase-tips-section">
      <div className="flex items-center gap-3 mb-2">
        <Lightbulb strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
        <p className="overline">{t("cut.tips.eyebrow")}</p>
      </div>
      <h2 className="font-serif text-3xl md:text-4xl text-forest tracking-tight mb-3">
        {t("cut.tips.title")}
      </h2>
      <p className="text-ink/75 max-w-2xl leading-relaxed mb-8">{t("cut.tips.intro")}</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6">
        {TIP_KEYS.map((k, i) => (
          <div key={k} data-testid={`vase-tip-${k}`} className="flex gap-3">
            <span className="font-serif text-2xl text-terracotta flex-shrink-0 w-7 leading-none mt-1">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <h3 className="font-serif text-lg text-forest leading-snug">
                {t(`cut.tips.${k}.title`)}
              </h3>
              <p className="text-sm text-ink/75 mt-1.5 leading-relaxed">
                {t(`cut.tips.${k}.body`)}
              </p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-moss mt-8 italic max-w-2xl">
        {t("cut.tips.footnote")}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Head-meta helpers (same pattern as PlantDetail.jsx)                */
/* ------------------------------------------------------------------ */
function ensureLandingMeta(name, content, attr = "name") {
  if (typeof document === "undefined") return;
  let el = document.head.querySelector(`meta[${attr}="${name}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, name);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function ensureLandingJsonLd(tag, data) {
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
