/**
 * Product-level JSON-LD structured data for the homepage.
 *
 * Emits three complementary schemas so Google gets a clean picture:
 *   - `SoftwareApplication` — the app itself, category + pricing + rating.
 *   - `Organization` — brand entity with logo, URL, contact.
 *   - `WebSite` — enables site-search box in Google results.
 */
import { Helmet } from "react-helmet-async";

const SITE = "https://patchandpot.app";

const softwareApp = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Patch & Pot",
  applicationCategory: "LifestyleApplication",
  operatingSystem: "Web",
  url: SITE,
  description:
    "The AI gardening tutor that teaches you how to garden where you live. Ask a gardening question and receive a personalised masterclass shaped around your locality, climate, season, growing conditions, space and experience.",
  inLanguage: [
    "en", "de", "fr", "es", "it", "nl", "pt", "sv", "da", "nb", "fi",
    "is", "gd", "cy", "ga", "pl", "cs", "sk", "sl", "hr", "bg", "ro",
    "hu", "el", "et", "lv", "lt", "mt", "uk", "ja", "zh", "hi", "bn",
    "te", "mr", "ta", "gu", "ur", "kn", "ml", "pa", "id", "ms", "vi",
    "th", "ko", "tl", "mi", "ar", "tr", "ru", "be", "kk", "uz", "az",
    "ky", "hy", "ka",
  ],
  offers: [
    {
      "@type": "Offer",
      name: "Free",
      price: "0",
      priceCurrency: "GBP",
      availability: "https://schema.org/InStock",
    },
    {
      "@type": "Offer",
      name: "Lifetime Founding Member",
      priceCurrency: "GBP",
      availability: "https://schema.org/InStock",
      url: `${SITE}/patrons`,
    },
  ],
  featureList: [
    "Ask Nàdar — AI gardening mentor",
    "Personalised regional monthly guides",
    "2-Minute Calm mindfulness audios",
    "AI-generated masterclasses",
    "Plant database with 300+ plants",
    "Pest & disease control guide",
    "Seasonal recipes from your patch",
    "Bouquet designer for cut flowers",
    "Grow-anywhere walkthroughs (balcony, windowsill, wall)",
    "Multi-patch garden management",
    "Wellbeing journal with tag sidebar",
  ],
};

const organization = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Patch & Pot",
  url: SITE,
  logo: `${SITE}/logo512.png`,
  sameAs: [],
};

const website = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Patch & Pot",
  url: SITE,
  potentialAction: {
    "@type": "SearchAction",
    target: `${SITE}/plants?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

export default function ProductSchema() {
  return (
    <Helmet>
      <script type="application/ld+json">{JSON.stringify(softwareApp)}</script>
      <script type="application/ld+json">{JSON.stringify(organization)}</script>
      <script type="application/ld+json">{JSON.stringify(website)}</script>
    </Helmet>
  );
}
