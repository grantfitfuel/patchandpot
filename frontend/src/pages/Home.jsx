import { Link } from "react-router-dom";
import { ArrowRight, Sprout, Recycle, LayoutGrid, MapPin, Flower2, HandHelping, GraduationCap } from "lucide-react";
import { useRegion } from "@/hooks/useRegion";
import { useState } from "react";
import RegionPicker from "@/components/RegionPicker";
import { useI18n, monthLabel } from "@/i18n";

export default function Home() {
  const { region } = useRegion();
  const { t } = useI18n();
  const [pickerOpen, setPickerOpen] = useState(false);
  const month = monthLabel(new Date().getMonth() + 1, t);

  return (
    <div className="animate-fade-up">
      <section className="border-b border-border">
        <div className="container-narrow py-16 md:py-24 grid md:grid-cols-12 gap-10 items-end">
          <div className="md:col-span-7">
            <p className="hero-eyebrow overline">{t("home.eyebrow")}</p>
            <h1 className="font-serif text-5xl md:text-7xl text-forest mt-5 leading-[0.95] tracking-tight">
              {t("home.title.line1")}
              <br />
              <em className="not-italic text-terracotta">{t("home.title.line2")}</em>
            </h1>
            <p className="mt-6 text-lg text-ink/80 max-w-xl leading-relaxed">
              {t("home.intro")}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/calendar" data-testid="cta-monthly-guide" className="btn-terracotta inline-flex items-center gap-2">
                {t("home.cta.guide", { month })} <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
              </Link>
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                data-testid="cta-set-region"
                className="btn-ghost inline-flex items-center gap-2"
              >
                <MapPin className="w-4 h-4" strokeWidth={1.5} />
                {region ? `${t("region.region")} · ${region.name}` : t("region.set")}
              </button>
            </div>
          </div>
          <div className="md:col-span-5">
            <div className="aspect-[4/5] overflow-hidden border border-border">
              <img
                src="https://images.unsplash.com/photo-1745063537934-e6bf484d72eb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTF8MHwxfHNlYXJjaHwxfHx1cmJhbiUyMGdhcmRlbmluZyUyMHNtYWxsJTIwc3BhY2UlMjBiYWxjb255JTIwcGxhbnRzfGVufDB8fHx8MTc4MTQ2MjkzMnww&ixlib=rb-4.1.0&q=85"
                alt="Tending plants on a balcony"
                className="object-cover w-full h-full"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="container-narrow py-20">
        <div className="grid md:grid-cols-12 gap-8 mb-12">
          <div className="md:col-span-5">
            <p className="overline">{t("home.section.eyebrow")}</p>
            <h2 className="font-serif text-4xl md:text-5xl text-forest mt-3 leading-tight">
              {t("home.section.title")}
            </h2>
          </div>
          <p className="md:col-span-6 md:col-start-7 text-ink/75 leading-relaxed">
            {t("home.section.body")}
          </p>
        </div>

        <div className="grid md:grid-cols-12 gap-6">
          <FeatureCard to="/masterclasses" label="Learn deeply" title="Masterclasses"
            blurb="Three structured courses: propagation, pest control, and plant care."
            icon={GraduationCap} colSpan="md:col-span-7" />
          <FeatureCard to="/guides/cut-flowers" label="Bring colour home" title="Cut Flowers"
            blurb="Compact, container-friendly cut flowers — palettes, bulb lasagnes, arranging."
            icon={Flower2} colSpan="md:col-span-5" />
          <FeatureCard to="/guides/first-pot" label="Begin today" title="Your First Pot"
            blurb="Everything you need to begin — pot, compost, seeds, light and water."
            icon={Sprout} colSpan="md:col-span-5" />
          <FeatureCard to="/guides/space-saving" label="Small spaces" title="Space-Saving Ideas"
            blurb="Vertical towers, hanging rails, and crate setups for tiny spaces."
            icon={LayoutGrid} colSpan="md:col-span-7" />
          <FeatureCard to="/guides/companion" label="Plants helping plants" title="Companion Planting"
            blurb="Pair flowers with food: pollinators in, pests out, more flavour."
            icon={HandHelping} colSpan="md:col-span-5" />
          <FeatureCard to="/guides/regrow" label="Zero waste" title="Regrow from Scraps"
            blurb="Save money and reduce waste by regrowing from kitchen scraps."
            icon={Recycle} colSpan="md:col-span-4" />
          <FeatureCard to="/plants" label="Browse" title="Plant Database"
            blurb="Edibles, herbs and flowers that thrive in pots and patches."
            icon={Sprout} colSpan="md:col-span-3" />
        </div>
      </section>

      <section className="border-t border-border bg-surface">
        <div className="container-narrow py-20 max-w-3xl">
          <p className="overline">{t("home.quote.eyebrow")}</p>
          <p className="font-serif text-3xl md:text-4xl text-forest mt-5 leading-snug">
            {t("home.quote.body")}
          </p>
        </div>
      </section>

      <RegionPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </div>
  );
}

function FeatureCard({ to, label, title, blurb, icon: Icon, colSpan }) {
  return (
    <Link
      to={to}
      data-testid={`feature-${to.replace(/\//g, "-")}`}
      className={`card-flat p-8 group ${colSpan}`}
    >
      <div className="flex items-center gap-3 mb-6">
        <Icon strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
        <span className="overline">{label}</span>
      </div>
      <h3 className="font-serif text-3xl md:text-4xl text-forest mb-3">{title}</h3>
      <p className="text-ink/75 leading-relaxed mb-6">{blurb}</p>
      <span className="inline-flex items-center gap-2 text-forest text-sm tracking-wider uppercase group-hover:gap-3 transition-all">
        Open guide <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
      </span>
    </Link>
  );
}
