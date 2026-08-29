import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight, Sprout, Recycle, LayoutGrid, MapPin, Flower2, HandHelping, GraduationCap, Heart, Check } from "lucide-react";
import { motion } from "framer-motion";
import { useRegion } from "@/hooks/useRegion";
import { useState } from "react";
import RegionPicker from "@/components/RegionPicker";
import ThisMonthCard from "@/components/ThisMonthCard";
import PaywallModal from "@/components/PaywallModal";
import FoundingBanner from "@/components/FoundingBanner";
import EmbedFoundingSnippet from "@/components/EmbedFoundingSnippet";
import MostLovedPatches from "@/components/MostLovedPatches";
import PlantOfTheWeek from "@/components/PlantOfTheWeek";
import PopularPlants from "@/components/PopularPlants";
import ProductSchema from "@/components/seo/ProductSchema";
import {
  NoticeIllustration,
  SlowIllustration,
  NourishIllustration,
} from "@/components/illustrations/WellbeingIllustrations";
import { usePaywall } from "@/hooks/usePaywall";
import { useI18n, monthLabel } from "@/i18n";
import { track } from "@/lib/track";

export default function Home() {
  const { region } = useRegion();
  const { t } = useI18n();
  const { paid } = usePaywall();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const month = monthLabel(new Date().getMonth() + 1, t);

  const HERO_TITLE =
    "The AI gardening tutor that teaches you how to garden where you live.";
  const HERO_BLURB =
    "Ask a gardening question and receive a personalised masterclass shaped around your locality, climate, season, growing conditions, space and experience.";
  // Meta description — kept under 160 chars, keyword-forward so Google's
  // snippet-picker prefers this over on-page prose. Explicit "AI tutor"
  // + "personalised masterclass" so paid features surface in search.
  const META_DESCRIPTION =
    "AI gardening tutor for your patch. Ask any question and get a personalised masterclass shaped to your climate, season, space and skill. Free to try.";

  return (
    <div className="animate-fade-up">
      {/* ─── Crawler-facing metadata (SEO + rich results) ─────────── */}
      <Helmet>
        <title>Patch &amp; Pot — AI gardening tutor that teaches you how to garden where you live</title>
        <meta name="description" content={META_DESCRIPTION} />
        <link rel="canonical" href="https://patchandpot.app/" />
        <meta property="og:title" content="Patch & Pot — AI gardening tutor" />
        <meta property="og:description" content={META_DESCRIPTION} />
        <meta property="og:url" content="https://patchandpot.app/" />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Patch & Pot — AI gardening tutor" />
        <meta name="twitter:description" content={META_DESCRIPTION} />
      </Helmet>
      <ProductSchema />

      {!paid && <FoundingBanner />}
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
            <p className="hero-eyebrow overline">Patch &amp; Pot</p>
            <h1
              className="font-serif text-4xl md:text-6xl text-forest mt-5 leading-[1.02] tracking-tight"
              data-testid="home-hero-title"
            >
              {HERO_TITLE}
            </h1>
            <p
              className="mt-6 text-lg text-ink/80 max-w-xl leading-relaxed"
              data-testid="home-hero-blurb"
            >
              {HERO_BLURB}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                to="/ask"
                data-testid="cta-ask-nadar"
                onClick={() => track("cta_click", { where: "home_hero", target: "ask_nadar" })}
                className="btn-terracotta inline-flex items-center gap-2"
              >
                Ask a gardening question <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
              </Link>
              <Link
                to="/calendar"
                data-testid="cta-monthly-guide"
                onClick={() => track("cta_click", { where: "home_hero", target: "monthly_guide" })}
                className="btn-ghost inline-flex items-center gap-2"
              >
                {t("home.cta.guide", { month })}
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

      {/* ── Micro value-prop strip ─────────────────────────────────── */}
      {/* Bold forest-green panel introducing Ask Nàdar and the
          Masterclass creator — first splash of colour after the cream
          hero, breaks up the neutral flow and reads as "here's what
          this actually is". */}
      <section
        className="bg-forest text-sand relative overflow-hidden"
        data-testid="home-value-strip"
        aria-label="How Patch and Pot works"
      >
        {/* Warm terracotta wash top-left balances the terracotta glow
            used lower on the ThisMonthCard band. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(60% 60% at 0% 0%, rgba(198,93,71,0.20), transparent 60%)",
          }}
        />
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-50px" }}
          transition={{ duration: 0.5, ease: [0.2, 0.7, 0.2, 1] }}
          className="relative container-narrow py-10 md:py-12"
        >
          <p className="text-center md:text-left text-lg md:text-2xl leading-relaxed max-w-4xl text-sand/95 font-serif">
            <strong className="text-terracotta font-semibold not-italic">Ask Nàdar</strong>{" "}
            answers any gardening question in seconds. The{" "}
            <strong className="text-terracotta font-semibold not-italic">AI Masterclass creator</strong>{" "}
            writes you a full multi-lesson course on any topic — from
            no-dig to seed saving to attracting bees. Both shaped to your
            climate zone, season, space and skill.{" "}
            <span className="text-sand/70">Free to try, unlimited for founding members.</span>
          </p>
        </motion.div>
      </section>

      {/* ── Founding ethos band ────────────────────────────────────── */}
      {/* Sits directly under the hero so returning visitors + crawlers
          both meet the "grow your own, anywhere" promise before the
          feature grid. Data-testid'd so the ethos band is easy to
          screenshot / test independently of hero copy iterations. */}
      <section
        className="bg-moss text-sand"
        data-testid="home-ethos-band"
      >
        <div className="container-narrow py-14 md:py-16 grid md:grid-cols-12 gap-8 items-center">
          <div className="md:col-span-7">
            <p className="overline text-terracotta">Our ethos</p>
            <h2
              className="font-serif text-3xl md:text-5xl text-sand mt-3 leading-[1.05] tracking-tight text-balance"
              data-testid="home-ethos-title"
            >
              Grow your own, anywhere.
            </h2>
          </div>
          <div className="md:col-span-5">
            <p
              className="text-sand/85 leading-relaxed"
              data-testid="home-ethos-blurb"
            >
              Whether that&apos;s a balcony rail, a shady kitchen windowsill, a
              ladder against the fence, a stack of gutters or a full plot —
              every guide, masterclass and calendar in Patch &amp; Pot is
              shaped to whatever space you actually have.
            </p>
            <div className="mt-5">
              <Link
                to="/grow-anywhere"
                data-testid="home-ethos-cta"
                onClick={() => track("cta_click", { where: "home_ethos", target: "grow_anywhere" })}
                className="inline-flex items-center gap-1.5 text-sm text-terracotta hover:text-sand transition-colors"
              >
                Explore Grow Anywhere
                <ArrowRight className="w-3.5 h-3.5" strokeWidth={1.6} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      <ThisMonthCard onSetRegion={() => setPickerOpen(true)} />

      <section className="container-narrow py-14 md:py-16">
        <div className="grid md:grid-cols-12 gap-6 mb-8">
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

        {/* Bento grid — every card colour-blocked (no cream), uniform
            row height, size variety comes from column span alone.
            Removing row-span variants eliminated the dead vertical
            space inside the tall Masterclasses / Space-Saving cards. */}
        <div className="grid md:grid-cols-12 gap-4 md:gap-5">
          <BentoCard to="/masterclasses"
            label={t("home.feature.masterclasses.label")}
            title={t("home.feature.masterclasses.title")}
            blurb={t("home.feature.masterclasses.blurb")}
            openLabel={t("home.feature.open_guide")}
            Icon={GraduationCap}
            variant="forest"
            span="md:col-span-8"
            index={0} />
          <BentoCard to="/guides/cut-flowers"
            label={t("home.feature.cut_flowers.label")}
            title={t("home.feature.cut_flowers.title")}
            blurb={t("home.feature.cut_flowers.blurb")}
            openLabel={t("home.feature.open_guide")}
            Icon={Flower2}
            variant="terracotta"
            span="md:col-span-4"
            index={1} />
          <BentoCard to="/guides/first-pot"
            label={t("home.feature.first_pot.label")}
            title={t("home.feature.first_pot.title")}
            blurb={t("home.feature.first_pot.blurb")}
            openLabel={t("home.feature.open_guide")}
            Icon={Sprout}
            variant="moss"
            span="md:col-span-6"
            index={2} />
          <BentoCard to="/guides/space-saving"
            label={t("home.feature.space_saving.label")}
            title={t("home.feature.space_saving.title")}
            blurb={t("home.feature.space_saving.blurb")}
            openLabel={t("home.feature.open_guide")}
            Icon={LayoutGrid}
            variant="terracotta"
            span="md:col-span-6"
            index={3} />
          <BentoCard to="/guides/companion"
            label={t("home.feature.companion.label")}
            title={t("home.feature.companion.title")}
            blurb={t("home.feature.companion.blurb")}
            openLabel={t("home.feature.open_guide")}
            Icon={HandHelping}
            variant="moss"
            span="md:col-span-4"
            index={4} />
          <BentoCard to="/guides/regrow"
            label={t("home.feature.regrow.label")}
            title={t("home.feature.regrow.title")}
            blurb={t("home.feature.regrow.blurb")}
            openLabel={t("home.feature.open_guide")}
            Icon={Recycle}
            variant="terracotta"
            span="md:col-span-4"
            index={5} />
          <BentoCard to="/plants"
            label={t("home.feature.plants.label")}
            title={t("home.feature.plants.title")}
            blurb={t("home.feature.plants.blurb")}
            openLabel={t("home.feature.open_guide")}
            Icon={Sprout}
            variant="forest"
            span="md:col-span-4"
            index={6} />
        </div>
      </section>

      <section className="bg-forest text-sand">
        <div className="container-narrow py-16 md:py-20 max-w-3xl">
          <p className="overline text-terracotta">{t("home.quote.eyebrow")}</p>
          <p className="font-serif italic text-3xl md:text-4xl lg:text-5xl text-sand mt-5 leading-snug text-balance">
            {t("home.quote.body")}
          </p>
        </div>
      </section>

      {/* Wellbeing band — three principles + a soft CTA into /wellbeing.
          Now on a moss-green backdrop so it stands out clearly from the
          sand sections above and below. The three principles sit inside
          darker forest cards for a "cards inside a card" depth trick. */}
      <section
        className="bg-moss text-sand"
        data-testid="home-wellbeing-band"
      >
        <div className="container-narrow py-14 md:py-16">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="max-w-2xl mb-8"
          >
            <p className="overline text-terracotta">{t("home.wellbeing.eyebrow")}</p>
            <h2 className="font-serif text-4xl md:text-5xl text-sand mt-3 leading-tight text-balance">
              {t("home.wellbeing.title")}
            </h2>
            <p className="mt-5 text-sand/85 leading-relaxed">
              {t("home.wellbeing.body")}
            </p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6 md:gap-8">
            {[
              { k: "notice",  Illo: NoticeIllustration },
              { k: "slow",    Illo: SlowIllustration },
              { k: "nourish", Illo: NourishIllustration },
            ].map(({ k, Illo }, idx) => (
              <motion.article
                key={k}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.45, delay: 0.08 * idx }}
                className="well-card p-6 md:p-7"
              >
                <div className="w-14 h-14 mb-5 text-terracotta">
                  <Illo />
                </div>
                <h3 className="font-serif text-xl text-sand mb-2">
                  {t(`wellbeing.principle.${k}.title`)}
                </h3>
                <p className="text-sm text-sand/80 leading-relaxed">
                  {t(`wellbeing.principle.${k}.body`)}
                </p>
              </motion.article>
            ))}
          </div>
          <Link
            to="/wellbeing"
            data-testid="home-wellbeing-cta"
            className="mt-10 inline-flex items-center gap-2 text-sand underline-offset-4 hover:underline"
          >
            {t("home.wellbeing.cta")}
            <ArrowRight strokeWidth={1.5} className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {!paid && <EmbedFoundingSnippet />}

      <PlantOfTheWeek />

      <PopularPlants />

      <MostLovedPatches />

      {!paid && (
        <section className="bg-sand" data-testid="home-bundle-cta">
          <div className="container-narrow py-14 md:py-16 grid md:grid-cols-12 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5 }}
              className="md:col-span-7"
            >
              <p className="overline">{t("home.bundle.eyebrow")}</p>
              <h2 className="font-serif text-4xl md:text-5xl text-forest mt-3 leading-tight text-balance">
                {t("home.bundle.title")}
              </h2>
              <p className="mt-5 text-ink/75 leading-relaxed max-w-xl">
                {t("home.bundle.body")}
              </p>

              <ul className="mt-8 space-y-3 text-ink/85">
                {[
                  ["home.bundle.row1.title", "home.bundle.row1.sub"],
                  ["home.bundle.row2.title", "home.bundle.row2.sub"],
                  ["home.bundle.row3.title", "home.bundle.row3.sub"],
                  ["home.bundle.row4.title", "home.bundle.row4.sub"],
                  ["home.bundle.row5.title", "home.bundle.row5.sub"],
                ].map(([titleKey, subKey]) => (
                  <li key={titleKey} className="flex items-start gap-3">
                    <Check strokeWidth={2} className="w-5 h-5 text-terracotta flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-forest">{t(titleKey)}</p>
                      <p className="text-sm text-ink/65">{t(subKey)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="md:col-span-5 md:col-start-8"
            >
              <div className="terracotta-glow rounded-2xl p-7 md:p-8 relative shadow-[0_20px_50px_rgba(0,0,0,0.08)]">
                <span className="inline-block bg-terracotta text-sand text-[10px] tracking-[0.18em] uppercase px-2.5 py-1 rounded-full">
                  {t("home.bundle.best_value")}
                </span>
                <p className="font-serif text-6xl text-forest leading-none mt-5">£50</p>
                <p className="text-sm text-moss mt-1">{t("home.bundle.lifetime_label")}</p>
                <p className="text-xs text-ink/65 mt-3 leading-relaxed">
                  {t("home.bundle.lifetime_blurb")}
                </p>
                <button
                  type="button"
                  data-testid="home-bundle-buy-lifetime"
                  onClick={() => setPaywallOpen(true)}
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 rounded-full bg-terracotta hover:bg-[#B04A36] text-sand py-3 font-medium tracking-wide transition-colors"
                >
                  {t("home.bundle.unlock_lifetime")} <ArrowRight strokeWidth={1.5} className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  data-testid="home-bundle-buy-annual"
                  onClick={() => setPaywallOpen(true)}
                  className="mt-3 w-full text-sm text-moss hover:text-forest underline-offset-4 hover:underline"
                >
                  {t("home.bundle.from_monthly")}
                </button>
                <p className="text-[11px] text-moss mt-4 text-center leading-snug">
                  🛡️ {t("home.bundle.guarantee")}
                </p>
              </div>
            </motion.div>
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

function BentoCard({ to, label, title, blurb, openLabel, Icon, variant, span, index }) {
  // Colour + accent tokens per variant. We keep the accent (icon +
  // overline + arrow) at a consistent luminance so hover still reads
  // clearly on both dark and light card variants.
  const styles = {
    forest:     { bg: "bento-forest",     eyebrow: "text-terracotta",  body: "text-sand/85", arrow: "text-sand" },
    terracotta: { bg: "bento-terracotta", eyebrow: "text-sand/90",     body: "text-sand/90", arrow: "text-sand" },
    moss:       { bg: "bento-moss",       eyebrow: "text-terracotta",  body: "text-sand/85", arrow: "text-sand" },
    cream:      { bg: "bento-cream",      eyebrow: "text-terracotta",  body: "text-ink/75",  arrow: "text-forest" },
  }[variant] || {};
  const titleColor = variant === "cream" ? "text-forest" : "text-sand";
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.5, delay: 0.06 * (index || 0), ease: [0.2, 0.7, 0.2, 1] }}
      className={`${span} h-full`}
    >
      <Link
        to={to}
        data-testid={`feature-${to.replace(/\//g, "-")}`}
        className={`bento-card ${styles.bg} h-full p-5 md:p-6 flex flex-col group`}
      >
        <div className="flex items-center gap-3 mb-4">
          <Icon strokeWidth={1.4} className={`w-5 h-5 ${styles.eyebrow}`} />
          <span className={`overline ${styles.eyebrow}`}>{label}</span>
        </div>
        <h3 className={`font-serif text-2xl md:text-3xl ${titleColor} mb-2.5 leading-snug text-balance`}>{title}</h3>
        <p className={`${styles.body} leading-relaxed mb-5 flex-1 text-sm md:text-base`}>{blurb}</p>
        <span className={`inline-flex items-center gap-2 text-sm tracking-wider uppercase group-hover:gap-3 transition-all ${styles.arrow}`}>
          {openLabel} <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
        </span>
      </Link>
    </motion.div>
  );
}
