/**
 * `/capabilities/:slug` — dedicated marketing landing page for one product
 * capability (Ask Nàdar, 2-Minute Calm, Recipes, etc.).
 *
 * Each page is fully crawler-friendly:
 *   - Unique <title>, <meta description>, <link rel="canonical">
 *   - Open Graph + Twitter card meta
 *   - JSON-LD Product + BreadcrumbList
 *   - Semantic HTML (h1, h2, ul, section) so parsers can extract content
 *
 * Also emits a `capability_page_view` conversion event on mount and a
 * `cta_click` event on the primary CTA, so we can measure funnel from
 * marketing page → app usage in `/admin/analytics`.
 */
import { useEffect } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight, ArrowLeft, Sparkles, CheckCircle2 } from "lucide-react";
import { CAPABILITIES, CAPABILITY_ORDER } from "@/data/capabilities";
import { track, trackPageView } from "@/lib/track";

const SITE = "https://patchandpot.app";


function jsonLd(cap) {
  const url = `${SITE}/capabilities/${cap.slug}`;
  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${cap.label} — Patch & Pot`,
    description: cap.description,
    brand: { "@type": "Brand", name: "Patch & Pot" },
    url,
    category: "GardeningApp",
    offers: {
      "@type": "Offer",
      priceCurrency: "GBP",
      price: "0",
      availability: "https://schema.org/InStock",
      url,
    },
  };
  const breadcrumb = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE },
      { "@type": "ListItem", position: 2, name: "Capabilities", item: `${SITE}/capabilities` },
      { "@type": "ListItem", position: 3, name: cap.label, item: url },
    ],
  };
  return [product, breadcrumb];
}


export default function CapabilityLanding() {
  const { slug } = useParams();
  const cap = CAPABILITIES[slug];

  useEffect(() => {
    if (cap) trackPageView(`/capabilities/${cap.slug}`, { capability: cap.slug });
  }, [cap]);

  if (!cap) return <Navigate to="/capabilities" replace />;

  const canonical = `${SITE}/capabilities/${cap.slug}`;

  return (
    <div className="animate-fade-up">
      <Helmet>
        <title>{cap.title}</title>
        <meta name="description" content={cap.description} />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={cap.title} />
        <meta property="og:description" content={cap.description} />
        <meta property="og:url" content={canonical} />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={cap.title} />
        <meta name="twitter:description" content={cap.description} />
        {jsonLd(cap).map((data, i) => (
          <script key={i} type="application/ld+json">{JSON.stringify(data)}</script>
        ))}
      </Helmet>

      <section className="border-b border-border">
        <div className="container-narrow py-16 md:py-24">
          <Link
            to="/capabilities"
            className="text-sm text-moss hover:text-forest inline-flex items-center gap-1.5 mb-6"
            data-testid="capability-back"
          >
            <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.6} />
            All capabilities
          </Link>
          <p className="overline text-terracotta" data-testid="capability-eyebrow">
            {cap.label}
          </p>
          <h1
            className="font-serif text-4xl md:text-6xl text-forest mt-4 leading-[1.02] tracking-tight max-w-3xl"
            data-testid="capability-hero-title"
          >
            {cap.tagline}
          </h1>
          <p
            className="mt-6 text-lg text-ink/80 max-w-2xl leading-relaxed"
            data-testid="capability-hero-blurb"
          >
            {cap.hero}
          </p>
          <div className="mt-8">
            <Link
              to={cap.ctaTo}
              onClick={() =>
                track("cta_click", {
                  where: "capability_hero",
                  capability: cap.slug,
                  target: cap.ctaTo,
                })
              }
              data-testid="capability-cta"
              className="btn-terracotta inline-flex items-center gap-2"
            >
              {cap.ctaLabel}
              <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
            </Link>
          </div>
        </div>
      </section>

      <section className="container-narrow py-16 md:py-20">
        <p className="overline mb-6">How it works</p>
        <ul className="grid md:grid-cols-3 gap-8">
          {cap.features.map((f, i) => (
            <li key={i} className="border border-border p-6 hover:border-forest transition-colors">
              <CheckCircle2 className="w-5 h-5 text-terracotta mb-4" strokeWidth={1.5} />
              <h2 className="font-serif text-xl text-forest tracking-tight mb-2">
                {f.title}
              </h2>
              <p className="text-sm text-ink/75 leading-relaxed">{f.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-border bg-sand/40">
        <div className="container-narrow py-16 md:py-20 text-center">
          <Sparkles className="w-6 h-6 text-terracotta mx-auto mb-4" strokeWidth={1.4} />
          <h2 className="font-serif text-3xl md:text-4xl text-forest tracking-tight mb-4">
            Ready to try {cap.label}?
          </h2>
          <p className="text-ink/75 mb-8 max-w-lg mx-auto leading-relaxed">
            It takes about ten seconds — no account, no card, just start gardening.
          </p>
          <Link
            to={cap.ctaTo}
            onClick={() =>
              track("cta_click", {
                where: "capability_footer",
                capability: cap.slug,
                target: cap.ctaTo,
              })
            }
            data-testid="capability-cta-footer"
            className="btn-terracotta inline-flex items-center gap-2"
          >
            {cap.ctaLabel}
            <ArrowRight className="w-4 h-4" strokeWidth={1.5} />
          </Link>
        </div>
      </section>

      <section className="container-narrow py-16">
        <p className="overline mb-6">More capabilities</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {CAPABILITY_ORDER.filter((s) => s !== cap.slug).slice(0, 8).map((s) => {
            const other = CAPABILITIES[s];
            return (
              <Link
                key={s}
                to={`/capabilities/${s}`}
                className="border border-border p-4 hover:border-forest transition-colors group"
                data-testid={`capability-related-${s}`}
              >
                <p className="text-xs text-moss uppercase tracking-widest mb-1">
                  {other.label}
                </p>
                <p className="text-sm text-ink group-hover:text-forest transition-colors leading-snug">
                  {other.tagline}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
