// Region-aware vendor catalog for the "Where to source" section.
//
// Design as of 2026-07 rewrite:
//   • Sovrn rejected our affiliate application, so we run ZERO auto-
//     affiliate networks. Only the two Amazon Associates tags we own
//     directly (UK: patchandpot-21, US: patchandpot-20) monetise clicks.
//   • Every plant/seed/bulb retailer (Thompson & Morgan, Crocus, Burpee,
//     Bakker etc.) has been removed. Directing readers to those with no
//     commission serves neither us nor the reader — and we now believe
//     local nurseries are a better first port of call anyway (see the
//     ShopLocalNudge card in SourceLinks.jsx, which sits above this grid
//     and encourages Google-Maps discovery of nearby garden centres).
//   • What remains is a single Amazon card per country, scoped to
//     "garden tools" (localised into the region's language). Amazon is
//     for the pot, compost, twine, seed tray — not for plants — so this
//     is the honest use of the space.
//
// If we ever get direct affiliate approval with a real UK plant nursery
// (Peter Nyssen, Higgledy, Chiltern), add them back with their own tag —
// but not before, and never through Sovrn.

const enc = (q) => encodeURIComponent(q);

// Amazon deep-link helper. Always searches for garden tools (never the
// plant name — plant-name searches on Amazon return essential oils and
// ornaments, not gardening). `qualifier` is the localised search term.
// Appends the affiliate tag if one is configured for that region.
const amazon = (domain, tag, qualifier = "garden tools") => {
  const tail = tag ? `&tag=${tag}` : "";
  return `https://www.amazon.${domain}/s?k=${enc(qualifier)}${tail}`;
};

const VENDORS_BY_COUNTRY = {
  "united kingdom": [
    { id: "amazon-uk", name: "Amazon UK", kind: "tools",
      url: () => amazon("co.uk", "patchandpot-21") },
  ],
  "ireland": [
    { id: "amazon-uk-ie", name: "Amazon UK", kind: "tools",
      url: () => amazon("co.uk", "patchandpot-21") },
  ],
  "united states": [
    { id: "amazon-us", name: "Amazon", kind: "tools",
      url: () => amazon("com", "patchandpot-20") },
  ],
  "canada": [
    { id: "amazon-ca", name: "Amazon.ca", kind: "tools",
      url: () => amazon("ca", "") },
  ],
  "australia": [
    { id: "amazon-au", name: "Amazon.com.au", kind: "tools",
      url: () => amazon("com.au", "") },
  ],
  "new zealand": [
    { id: "amazon-au-nz", name: "Amazon.com.au", kind: "tools",
      url: () => amazon("com.au", "") },
  ],
  "germany": [
    { id: "amazon-de", name: "Amazon.de", kind: "tools",
      url: () => amazon("de", "", "garten werkzeug") },
  ],
  "france": [
    { id: "amazon-fr", name: "Amazon.fr", kind: "tools",
      url: () => amazon("fr", "", "outils jardin") },
  ],
  "spain": [
    { id: "amazon-es", name: "Amazon.es", kind: "tools",
      url: () => amazon("es", "", "herramientas jardin") },
  ],
  "italy": [
    { id: "amazon-it", name: "Amazon.it", kind: "tools",
      url: () => amazon("it", "", "attrezzi giardino") },
  ],
  "netherlands": [
    { id: "amazon-nl", name: "Amazon.nl", kind: "tools",
      url: () => amazon("nl", "", "tuingereedschap") },
  ],
  "belgium": [
    { id: "amazon-be", name: "Amazon.com.be", kind: "tools",
      url: () => amazon("com.be", "", "tuingereedschap") },
  ],
  "sweden": [
    { id: "amazon-se", name: "Amazon.se", kind: "tools",
      url: () => amazon("se", "", "tradgard verktyg") },
  ],
  "poland": [
    { id: "amazon-pl", name: "Amazon.pl", kind: "tools",
      url: () => amazon("pl", "", "narzedzia ogrodnicze") },
  ],
  "turkey": [
    { id: "amazon-tr", name: "Amazon.com.tr", kind: "tools",
      url: () => amazon("com.tr", "", "bahce aletleri") },
  ],
  "mexico": [
    { id: "amazon-mx", name: "Amazon.com.mx", kind: "tools",
      url: () => amazon("com.mx", "", "herramientas jardin") },
  ],
  "brazil": [
    { id: "amazon-br", name: "Amazon.com.br", kind: "tools",
      url: () => amazon("com.br", "", "ferramentas jardim") },
  ],
  "united arab emirates": [
    { id: "amazon-ae", name: "Amazon.ae", kind: "tools",
      url: () => amazon("ae", "") },
  ],
  "saudi arabia": [
    { id: "amazon-sa", name: "Amazon.sa", kind: "tools",
      url: () => amazon("sa", "") },
  ],
  "singapore": [
    { id: "amazon-sg", name: "Amazon.sg", kind: "tools",
      url: () => amazon("sg", "") },
  ],
  "japan": [
    { id: "amazon-jp", name: "Amazon.co.jp", kind: "tools",
      url: () => amazon("co.jp", "", "園芸 道具") },
  ],
  "india": [
    { id: "amazon-in", name: "Amazon India", kind: "tools",
      url: () => amazon("in", "") },
  ],
};

// Fallback — no matching country. We route to Amazon.com with the US
// Associates tag so unsupported countries still earn a referral fee
// if a visitor buys.
const GLOBAL = [
  { id: "amazon-global", name: "Amazon", kind: "tools",
    url: () => amazon("com", "patchandpot-20") },
];

/**
 * Resolve a country (case-insensitive) to an ordered vendor list. Falls back
 * to the GLOBAL list so the UI always renders something.
 */
export function vendorsForCountry(country) {
  if (!country) return GLOBAL;
  const key = country.trim().toLowerCase();
  return VENDORS_BY_COUNTRY[key] || GLOBAL;
}

/** Pick the best vendor of a kind. Returns null if none. */
export function pickVendor(country, kind) {
  const list = vendorsForCountry(country);
  return list.find((v) => v.kind === kind) || list[0] || null;
}
