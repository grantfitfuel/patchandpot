/**
 * `/capabilities` — index of every marketing landing page.
 * Crawler-friendly hub that links to each capability's SEO page and
 * doubles as an on-site "product tour" for new visitors.
 */
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight } from "lucide-react";
import { CAPABILITIES, CAPABILITY_ORDER } from "@/data/capabilities";
import { trackPageView } from "@/lib/track";

const SITE = "https://patchandpot.app";
const TITLE = "Patch & Pot Capabilities — every gardening tool in one place";
const DESCRIPTION =
  "Ten AI-powered gardening capabilities: Ask Nàdar, monthly regional guides, personalised masterclasses, 2-Minute Calm, seasonal recipes, cut-flower bouquets, grow-anywhere walkthroughs, plant database, wellbeing journal and public topic feeds.";


function jsonLd() {
  const items = CAPABILITY_ORDER.map((slug, i) => ({
    "@type": "ListItem",
    position: i + 1,
    name: CAPABILITIES[slug].label,
    url: `${SITE}/capabilities/${slug}`,
  }));
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Patch & Pot capabilities",
    itemListElement: items,
  };
}


export default function CapabilitiesIndex() {
  useEffect(() => trackPageView("/capabilities"), []);

  return (
    <div className="animate-fade-up">
      <Helmet>
        <title>{TITLE}</title>
        <meta name="description" content={DESCRIPTION} />
        <link rel="canonical" href={`${SITE}/capabilities`} />
        <meta property="og:title" content={TITLE} />
        <meta property="og:description" content={DESCRIPTION} />
        <meta property="og:url" content={`${SITE}/capabilities`} />
        <script type="application/ld+json">{JSON.stringify(jsonLd())}</script>
      </Helmet>

      <section className="border-b border-border">
        <div className="container-narrow py-16 md:py-24 max-w-3xl">
          <p className="overline text-terracotta">Patch &amp; Pot capabilities</p>
          <h1
            className="font-serif text-4xl md:text-6xl text-forest mt-4 leading-[1.02] tracking-tight"
            data-testid="capabilities-index-title"
          >
            Ten AI-powered gardening tools, one calm home.
          </h1>
          <p className="mt-6 text-lg text-ink/80 leading-relaxed">
            Each one adapts to where you live, what you're growing and how much
            space you have. Pick where you'd like to start.
          </p>
        </div>
      </section>

      <section className="container-narrow py-16">
        <ul className="grid md:grid-cols-2 gap-4">
          {CAPABILITY_ORDER.map((slug) => {
            const cap = CAPABILITIES[slug];
            return (
              <li key={slug}>
                <Link
                  to={`/capabilities/${slug}`}
                  data-testid={`capabilities-index-${slug}`}
                  className="block border border-border p-6 hover:border-forest transition-colors group"
                >
                  <p className="text-xs text-moss uppercase tracking-widest mb-2">
                    {cap.label}
                  </p>
                  <h2 className="font-serif text-2xl text-forest tracking-tight mb-2">
                    {cap.tagline}
                  </h2>
                  <p className="text-sm text-ink/70 leading-relaxed mb-4">
                    {cap.description}
                  </p>
                  <span className="text-sm text-terracotta group-hover:underline inline-flex items-center gap-1.5">
                    Learn more
                    <ArrowRight strokeWidth={1.6} className="w-3.5 h-3.5" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
