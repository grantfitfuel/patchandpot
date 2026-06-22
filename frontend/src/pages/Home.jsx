import { Link } from "react-router-dom";
import { ArrowRight, Sprout, Recycle, LayoutGrid, MapPin, Flower2, HandHelping, GraduationCap, Heart, Check } from "lucide-react";
import { useRegion } from "@/hooks/useRegion";
import { useState } from "react";
import RegionPicker from "@/components/RegionPicker";
import ThisMonthCard from "@/components/ThisMonthCard";
import PaywallModal from "@/components/PaywallModal";
import { usePaywall } from "@/hooks/usePaywall";
import { useI18n, monthLabel } from "@/i18n";

export default function Home() {
  const { region } = useRegion();
  const { t } = useI18n();
  const { paid } = usePaywall();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const month = monthLabel(new Date().getMonth() + 1, t);

  return (
    <div className="animate-fade-up">
      {paid && (
        <div
          data-testid="supporter-ribbon"
          className="border-b border-forest/15 bg-forest/5"
        >
          <div className="container-narrow py-2 flex items-center justify-center gap-2 text-xs text-forest tracking-wider uppercase">
            <Heart strokeWidth={1.6} className="w-3.5 h-3.5 fill-terracotta text-terracotta" />
            <span>{t("home.supporter_ribbon")}</span>
          </div>
        </div>
      )}
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
                src="/img/hero.jpg"
                alt="Person tending plants on a balcony, planting into a terracotta pot"
                className="object-cover w-full h-full"
                loading="eager"
              />
            </div>
          </div>
        </div>
      </section>

      <ThisMonthCard onSetRegion={() => setPickerOpen(true)} />

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
          <FeatureCard to="/masterclasses"
            label={t("home.feature.masterclasses.label")}
            title={t("home.feature.masterclasses.title")}
            blurb={t("home.feature.masterclasses.blurb")}
            openLabel={t("home.feature.open_guide")}
            icon={GraduationCap} colSpan="md:col-span-7" />
          <FeatureCard to="/guides/cut-flowers"
            label={t("home.feature.cut_flowers.label")}
            title={t("home.feature.cut_flowers.title")}
            blurb={t("home.feature.cut_flowers.blurb")}
            openLabel={t("home.feature.open_guide")}
            icon={Flower2} colSpan="md:col-span-5" />
          <FeatureCard to="/guides/first-pot"
            label={t("home.feature.first_pot.label")}
            title={t("home.feature.first_pot.title")}
            blurb={t("home.feature.first_pot.blurb")}
            openLabel={t("home.feature.open_guide")}
            icon={Sprout} colSpan="md:col-span-5" />
          <FeatureCard to="/guides/space-saving"
            label={t("home.feature.space_saving.label")}
            title={t("home.feature.space_saving.title")}
            blurb={t("home.feature.space_saving.blurb")}
            openLabel={t("home.feature.open_guide")}
            icon={LayoutGrid} colSpan="md:col-span-7" />
          <FeatureCard to="/guides/companion"
            label={t("home.feature.companion.label")}
            title={t("home.feature.companion.title")}
            blurb={t("home.feature.companion.blurb")}
            openLabel={t("home.feature.open_guide")}
            icon={HandHelping} colSpan="md:col-span-5" />
          <FeatureCard to="/guides/regrow"
            label={t("home.feature.regrow.label")}
            title={t("home.feature.regrow.title")}
            blurb={t("home.feature.regrow.blurb")}
            openLabel={t("home.feature.open_guide")}
            icon={Recycle} colSpan="md:col-span-4" />
          <FeatureCard to="/plants"
            label={t("home.feature.plants.label")}
            title={t("home.feature.plants.title")}
            blurb={t("home.feature.plants.blurb")}
            openLabel={t("home.feature.open_guide")}
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

      {!paid && (
        <section className="border-t border-border" data-testid="home-bundle-cta">
          <div className="container-narrow py-20 md:py-24 grid md:grid-cols-12 gap-10 items-center">
            <div className="md:col-span-7">
              <p className="overline">The full library</p>
              <h2 className="font-serif text-4xl md:text-5xl text-forest mt-3 leading-tight">
                Every guide, course, AI tool and seasonal journal — in one place.
              </h2>
              <p className="mt-5 text-ink/75 leading-relaxed max-w-xl">
                Five flexible tiers — from a single month for £2.99 to lifetime for £50. No auto-renewals, no email lists, 30-day refund on every tier.
              </p>

              <ul className="mt-8 space-y-3 text-ink/85">
                {[
                  ["4 Foundation masterclasses", "Propagation · Pest Control · Plant Care · Seasonal Planting"],
                  ["6 Deep-dive courses", "Soil · Containers · Pollinators · Harvest · Cut Flowers · Reading the Sky"],
                  ["Unlimited AI masterclasses", "Suggest any topic — full lesson set in 90 seconds"],
                  ["Seasonal Growing Journal PDF", "A4 printable, region-aware, refreshed monthly"],
                  ["Full plant database", "Care guides, companions, runtime translation to 58 languages"],
                ].map(([title, sub]) => (
                  <li key={title} className="flex items-start gap-3">
                    <Check strokeWidth={2} className="w-5 h-5 text-terracotta flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-forest">{title}</p>
                      <p className="text-sm text-ink/65">{sub}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="md:col-span-5 md:col-start-8">
              <div className="bg-sand border-2 border-terracotta p-7 relative">
                <span className="absolute -top-3 left-7 bg-terracotta text-sand text-[10px] tracking-[0.18em] uppercase px-2 py-1">
                  Best value
                </span>
                <p className="font-serif text-5xl text-forest leading-none">£50</p>
                <p className="text-sm text-moss mt-1">Lifetime · pay once</p>
                <p className="text-xs text-ink/65 mt-3 leading-relaxed">
                  Breaks even with annual at year three. After that, every season is free — your 2031 garden still unlocked.
                </p>
                <button
                  type="button"
                  data-testid="home-bundle-buy-lifetime"
                  onClick={() => setPaywallOpen(true)}
                  className="mt-5 w-full btn-terracotta inline-flex items-center justify-center gap-2"
                >
                  Unlock for life <ArrowRight strokeWidth={1.5} className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  data-testid="home-bundle-buy-annual"
                  onClick={() => setPaywallOpen(true)}
                  className="mt-3 w-full text-sm text-moss hover:text-forest underline-offset-4 hover:underline"
                >
                  Or from £2.99 / month →
                </button>
                <p className="text-[11px] text-moss mt-4 text-center leading-snug">
                  🛡️ 30-day money-back guarantee. No subscriptions, no auto-renewal, no email lists.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      <RegionPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
      {paywallOpen && (
        <PaywallModal
          onClose={() => setPaywallOpen(false)}
          onUnlocked={() => setPaywallOpen(false)}
        />
      )}
    </div>
  );
}

function FeatureCard({ to, label, title, blurb, openLabel, icon: Icon, colSpan }) {
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
        {openLabel} <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
      </span>
    </Link>
  );
}
