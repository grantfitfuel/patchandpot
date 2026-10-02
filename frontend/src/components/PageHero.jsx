/**
 * PageHero — the vibrant colour-blocked band every content page uses as
 * its top-of-page introduction. Mirrors the rhythm set on the Home page
 * (Forest / Moss / Terracotta / Sand) so the whole app reads as one
 * confident visual system rather than a journal + an almanac + a shop.
 *
 * Variants:
 *   forest     — deep green panel with sand text + terracotta accents
 *   moss       — muted olive panel with sand text + butter accents
 *   terracotta — warm clay panel with sand text + butter accents
 *   sand       — cream band with forest text (used on long-form reader
 *                pages where we want readability but still a splash)
 *
 * Usage:
 *   <PageHero
 *     variant="terracotta"
 *     eyebrow={t("wellbeing.eyebrow")}
 *     title={t("wellbeing.title")}
 *     blurb={t("wellbeing.subtitle")}
 *     Motif={PoppyMotif}
 *     actions={<Link ... />}
 *   />
 */
import { motion } from "framer-motion";

const VARIANTS = {
  forest:     { bg: "bg-forest",     text: "text-sand",   eyebrow: "text-butter", blurb: "text-sand/85", glow: "rgba(244,201,107,0.18)" },
  moss:       { bg: "bg-moss",       text: "text-sand",   eyebrow: "text-butter", blurb: "text-sand/85", glow: "rgba(244,201,107,0.14)" },
  terracotta: { bg: "bg-terracotta", text: "text-sand",   eyebrow: "text-sand",   blurb: "text-sand/90", glow: "rgba(244,201,107,0.22)" },
  sand:       { bg: "bg-sand",       text: "text-forest", eyebrow: "text-terracotta", blurb: "text-ink/75", glow: "rgba(198,93,71,0.18)" },
};

// --- Butter accent class fallback: Tailwind doesn't know "butter" so we
// use a plain inline style for the eyebrow when variant uses it. Keeps
// the surface strict without touching tailwind config.
const BUTTER_HEX = "#F4C96B";

export default function PageHero({
  variant = "forest",
  eyebrow,
  title,
  blurb,
  actions,
  Motif,
  motifTint,            // optional: wash behind the motif (default: terracotta glow)
  compact = false,      // smaller padding for secondary pages
}) {
  const v = VARIANTS[variant] || VARIANTS.forest;
  const usesButter = variant === "forest" || variant === "moss" || variant === "terracotta";
  const paddingY = compact ? "py-10 md:py-14" : "py-14 md:py-20";
  const titleColor = variant === "sand" ? "text-forest" : "text-sand";
  return (
    <section className={`${v.bg} relative overflow-hidden`} data-testid="page-hero">
      {/* warm glow top-right so the band isn't a flat slab */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(60% 60% at 100% 0%, ${motifTint || v.glow}, transparent 65%)`,
        }}
      />
      {/* decorative dotted texture, very low opacity so it doesn't fight text */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(${variant === "sand" ? "rgba(45,74,34,0.08)" : "rgba(247,245,240,0.10)"} 1px, transparent 1px)`,
          backgroundSize: "14px 14px",
          opacity: 0.55,
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.2, 0.7, 0.2, 1] }}
        className={`container-narrow ${paddingY} relative grid md:grid-cols-12 gap-8 items-center`}
      >
        <div className={Motif ? "md:col-span-8" : "md:col-span-12"}>
          {eyebrow && (
            <p
              className={`overline ${usesButter ? "" : v.eyebrow}`}
              style={usesButter ? { color: BUTTER_HEX, opacity: 0.95 } : undefined}
            >
              {eyebrow}
            </p>
          )}
          <h1
            className={`font-serif ${compact ? "text-4xl md:text-5xl" : "text-5xl md:text-6xl"} ${titleColor} mt-3 leading-[1.03] tracking-tight text-balance`}
            data-testid="page-hero-title"
          >
            {title}
          </h1>
          {blurb && (
            <p className={`mt-4 ${v.blurb} leading-relaxed max-w-xl`} data-testid="page-hero-blurb">
              {blurb}
            </p>
          )}
          {actions && <div className="mt-6 flex flex-wrap gap-3">{actions}</div>}
        </div>
        {Motif && (
          <div className="md:col-span-4 flex md:justify-end items-center">
            <div
              className="w-28 h-28 md:w-44 md:h-44 rounded-full p-4 flex items-center justify-center"
              style={{
                background: variant === "sand"
                  ? "rgba(198,93,71,0.08)"
                  : "rgba(247,245,240,0.12)",
                border: variant === "sand"
                  ? "1px solid rgba(45,74,34,0.12)"
                  : "1px solid rgba(247,245,240,0.22)",
              }}
            >
              <Motif />
            </div>
          </div>
        )}
      </motion.div>
    </section>
  );
}
