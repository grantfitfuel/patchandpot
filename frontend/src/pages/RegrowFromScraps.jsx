/**
 * /regrow-from-scraps — SEO landing page for the regrow-from-kitchen-scraps
 * deep-dive. Filters the catalogue to plants flagged `regrow_from_scrap`
 * and exposes a method chip row (water / water-first / soil-only) so the
 * reader can pick how they want to start.
 *
 * Cards are sorted by `regrow.worth_it` (5★ first) — we deliberately put
 * the high-yield wins at the top, not the Pinterest-popular but
 * underwhelming ones.
 */
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Recycle, Sparkles } from "lucide-react";
import { fetchPlants } from "@/lib/api";
import PlantImage from "@/components/PlantImage";
import { useI18n } from "@/i18n";
import PageHero from "@/components/PageHero";
import { SeedlingMotif } from "@/components/illustrations/VibrantMotifs";

const METHODS = [
  { key: "all",         match: () => true },
  { key: "water-first", match: (r) => r?.method === "water-first" },
  { key: "water",       match: (r) => r?.method === "water-only" },
  { key: "soil",        match: (r) => r?.method === "soil-only" },
];

export default function RegrowFromScrapsPage() {
  const { t, lang } = useI18n();
  const [plants, setPlants] = useState([]);
  const [method, setMethod] = useState("all");

  useEffect(() => {
    fetchPlants(lang)
      .then((list) => setPlants((list || []).filter((p) => p?.regrow_from_scrap)))
      .catch(() => setPlants([]));
  }, [lang]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title = "Regrow from Scraps — Patch & Pot";
    const origin = window.location.origin;
    const imgUrl = `${origin}/api/share/og/brand.png`;
    const desc =
      "Start a real harvest from kitchen scraps — every plant on this page is hand-graded for honesty. No Pinterest clickbait, only methods that actually produce something edible.";
    ensureLandingMeta("description", desc);
    ensureLandingMeta("og:title", document.title, "property");
    ensureLandingMeta("og:description", desc, "property");
    ensureLandingMeta("og:type", "website", "property");
    ensureLandingMeta("og:image", imgUrl, "property");
    ensureLandingMeta("twitter:card", "summary_large_image");
    ensureLandingMeta("twitter:image", imgUrl);
    ensureLandingJsonLd("regrow-jsonld", {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Regrow from Scraps — honest method ratings",
      description: desc,
      url: window.location.href,
      image: imgUrl,
      publisher: { "@type": "Organization", name: "Patch & Pot" },
      dateModified: new Date().toISOString().slice(0, 10),
    });
  }, []);

  const filtered = useMemo(() => {
    const m = METHODS.find((x) => x.key === method) || METHODS[0];
    const arr = plants.filter((p) => m.match(p.regrow));
    arr.sort((a, b) => (b.regrow?.worth_it ?? 0) - (a.regrow?.worth_it ?? 0));
    return arr;
  }, [plants, method]);

  const pinUrl = useMemo(() => {
    if (typeof window === "undefined") return "#";
    const origin = window.location.origin;
    return `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(
      window.location.href
    )}&media=${encodeURIComponent(`${origin}/api/share/og/brand.png`)}&description=${encodeURIComponent(
      t("regrow.pin_description")
    )}`;
  }, [t]);

  return (
    <div className="animate-fade-up" data-testid="regrow-landing">
      <PageHero
        variant="moss"
        eyebrow={t("regrow.eyebrow")}
        title={t("regrow.title")}
        blurb={t("regrow.intro")}
        Motif={SeedlingMotif}
        actions={
          <a
            href={pinUrl}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="regrow-pin"
            aria-label={t("regrow.pin_to_pinterest")}
            className="inline-flex items-center gap-2 py-2.5 px-4 bg-sand text-forest hover:bg-[#E60023] hover:text-white transition-colors text-sm font-medium"
            style={{ borderRadius: "9999px" }}
          >
            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true">
              <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.097.118.112.221.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.746-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.017 24c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z" />
            </svg>
            {t("regrow.pin_to_pinterest")}
          </a>
        }
      />
      <div className="container-narrow py-10 md:py-14">

      <div className="flex flex-wrap gap-2 mb-10" data-testid="regrow-filter-row">
        {METHODS.map((m) => (
          <button
            key={m.key}
            type="button"
            data-testid={`regrow-filter-${m.key}`}
            onClick={() => setMethod(m.key)}
            className={`text-xs px-3 py-2 border transition-colors ${
              method === m.key
                ? "bg-forest text-sand border-forest"
                : "bg-sand text-ink/70 border-border hover:border-forest/40"
            }`}
          >
            {t(`regrow.filter.${m.key}`)}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <p className="text-moss" data-testid="regrow-empty">{t("regrow.empty")}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6" data-testid="regrow-grid">
          {filtered.map((p) => {
            const r = p.regrow || {};
            const stars = Math.max(1, Math.min(5, r.worth_it || 0));
            return (
              <Link
                key={p.id}
                to={`/plants/${p.id}`}
                data-testid={`regrow-card-${p.id}`}
                className="card-flat group flex flex-col"
              >
                <div className="aspect-[4/3] overflow-hidden bg-surface relative">
                  <PlantImage plant={p} />
                  {r.family_friendly && (
                    <span className="absolute top-3 left-3 inline-flex items-center gap-1 px-2 py-1 bg-forest text-sand text-[10px] uppercase tracking-widest">
                      <Sparkles className="w-3 h-3" strokeWidth={1.6} />
                      {t("regrow.kid_friendly")}
                    </span>
                  )}
                </div>
                <div className="p-5 flex flex-col flex-1">
                  <p className="overline">{t(`regrow.method.${r.method}`) }</p>
                  <h3 className="font-serif text-2xl text-forest mt-1.5">{p.name}</h3>
                  <p className="text-terracotta text-base mt-1 tracking-wider" aria-label={`${stars} out of 5`}>
                    {"★".repeat(stars)}{"☆".repeat(5 - stars)}
                  </p>
                  <p className="text-sm text-ink/75 mt-3 flex-1">{r.yield_summary}</p>
                  <div className="mt-4 text-xs text-moss border-t border-border pt-3">
                    {t("regrow.days_to_first_harvest")}:{" "}
                    <span className="text-ink">
                      {t("regrow.days_value", { days: r.days_to_first_harvest })}
                    </span>
                  </div>
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
/*  Head-meta helpers (same pattern as PlantDetail.jsx / CutFlowers)   */
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

