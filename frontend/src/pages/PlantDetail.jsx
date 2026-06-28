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
  const { t, lang } = useI18n();
  const [plant, setPlant] = useState(null);
  const [error, setError] = useState("");
  const { has, addPlant, removePlant } = useMyGarden();

  useEffect(() => {
    fetchPlant(id, lang).then(setPlant).catch(() => setError(t("plant.not_found")));
  }, [id, lang, t]);

  // SEO + social-share: dynamic <title>, description, og:image meta tags
  // pointing at the backend-rendered card so JS-executing crawlers
  // (Slack/Discord/Telegram) and Google's bot can unfurl this plant page.
  useEffect(() => {
    if (typeof document === "undefined" || !plant) return;
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
    // JSON-LD Schema.org Article — surfaces this guide as a rich result in
    // Google search (image + author + difficulty visible alongside the snippet).
    const jsonld = {
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
    };
    ensureJsonLd("plant-jsonld", jsonld);
  }, [plant]);

  if (error) return <div className="container-narrow py-16 text-terracotta">{error}</div>;
  if (!plant) return <div className="container-narrow py-16 text-moss">{t("plant.loading")}</div>;

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
            {plant.lifecycle && (
              <Spec
                icon={Sprout}
                label={t("plant.lifecycle")}
                value={t(`plants.lifecycle.${plant.lifecycle}`)}
              />
            )}
            {plant.hardiness && (
              <Spec
                icon={Sprout}
                label={t("plant.hardiness")}
                value={t(`plants.hardiness.${plant.hardiness}`)}
              />
            )}
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

function pinterestUrl(plant, t) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const url = `${origin}/api/plants/preview/${plant.id}`;
  const image = `${origin}/api/plants/${plant.id}/og.png`;
  const desc = t("plant.pin_description", { name: plant.name });
  return `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(url)}&media=${encodeURIComponent(image)}&description=${encodeURIComponent(desc)}`;
}

// Inject (or replace) a <script type="application/ld+json"> element by a
// stable data-tag attribute so React re-renders don't pile up duplicates.
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
