// Region-aware vendor catalog for the "Where to source" section.
//
// Each country code maps to a list of vendors. The first vendor whose
// `kind === "seeds"` is shown in the Seeds slot; the first `kind === "pots"`
// is shown in the Pots/Compost slot; an extra is used for Tools if available.
//
// URL strategy — HYBRID.
//   • Plant / seed / bulb vendors (Thompson & Morgan, Crocus, Burpee,
//     Bakker, Sakata, …) receive the plant name and deep-link to a
//     search for that plant. A reader on the Lavender page lands on
//     Crocus's lavender search, not the homepage.
//   • Amazon (every domain) is intentionally NOT plant-specific. Amazon
//     is where the reader picks up the pot, compost, trowel, twine or
//     seed tray — searching Amazon for a plant name returns essential
//     oils and ornaments, not gardening. So Amazon URLs always resolve
//     to a "garden tools" search, localised into the region's language.
//   • Pot / hardware retailers (Home Depot, Bunnings, Leroy Merlin, …)
//     still take the plant name — if a reader clicks a pots link on the
//     Tomato page they probably want tomato-adjacent kit, and these
//     search UIs handle that gracefully.
//
// Affiliate tags wired in:
//   - Amazon.co.uk → patchandpot-21
//   - Amazon.com   → patchandpot-20 (also the GLOBAL fallback)
// Amazon DE / FR / ES / IT / NL / CA / AU / JP / IN / etc. are wired as
// plain links — the moment the owner signs up for each regional
// Associates programme, add `&tag=<id>` to the returned URL and
// commissions start flowing.

const enc = (q) => encodeURIComponent(q);

// Small helper that safely returns a search query for the plant. Trims,
// falls back to an empty string, and lets us swap in different formatting
// (e.g. `+seeds`, `+plant`) per retailer without repeating the same
// null-guard everywhere.
const q = (name) => (name || "").trim();

// Awin deep-link helper.
//   - AWIN_PUB_ID is the Patch & Pot publisher account (set at sign-up).
//   - awinLink(mid, destinationUrl) wraps any retailer URL in Awin's
//     click-tracking redirect, attributing the sale to us.
//   Drop in once each merchant approves the application; until then the
//   plain destination URL is fine.
const AWIN_PUB_ID = "2954417";
export const awinLink = (mid, destinationUrl) =>
  `https://www.awin1.com/cread.php?awinmid=${mid}&awinaffid=${AWIN_PUB_ID}&clickref=patchandpot&ued=${encodeURIComponent(destinationUrl)}`;

// Amazon deep-link helper. Amazon is intentionally NOT plant-specific —
// the good UK & US plant nurseries (Crocus / Thompson & Morgan / Burpee)
// carry those; Amazon is where the reader picks up the pot, compost,
// trowel, twine, seed tray. `qualifier` (default "garden tools") is
// therefore the search term, not the plant name. Passing plant name to
// Amazon returns essential oils, ornaments and unrelated merch and hurts
// conversion. Affiliate tag appended if configured for that region.
const amazon = (domain, tag, qualifier = "garden tools") => {
  const tail = tag ? `&tag=${tag}` : "";
  return `https://www.amazon.${domain}/s?k=${enc(qualifier)}${tail}`;
};

const VENDORS_BY_COUNTRY = {
  "united kingdom": [
    { id: "thompson-morgan", name: "Thompson & Morgan", kind: "seeds",
      url: (n) => `https://www.thompson-morgan.com/search?q=${enc(q(n))}` },
    { id: "suttons", name: "Suttons", kind: "seeds",
      url: (n) => `https://www.suttons.co.uk/search?q=${enc(q(n))}` },
    // Crocus's search URL pattern (verified 2026-07): /search/_/search.QUERY/
    { id: "crocus", name: "Crocus", kind: "pots",
      url: (n) => `https://www.crocus.co.uk/search/_/search.${enc(q(n) || "plants")}/` },
    { id: "amazon-uk", name: "Amazon UK", kind: "tools",
      url: (n) => amazon("co.uk", "patchandpot-21") },
  ],
  "ireland": [
    { id: "mr-middleton", name: "Mr Middleton", kind: "seeds",
      url: (n) => `https://www.mrmiddleton.com/search?q=${enc(q(n))}` },
    { id: "thompson-morgan-ie", name: "Thompson & Morgan", kind: "pots",
      url: (n) => `https://www.thompson-morgan.com/search?q=${enc(q(n))}` },
  ],
  "united states": [
    { id: "burpee", name: "Burpee", kind: "seeds",
      url: (n) => `https://www.burpee.com/search?q=${enc(q(n))}` },
    { id: "botanical-interests", name: "Botanical Interests", kind: "seeds",
      url: (n) => `https://www.botanicalinterests.com/search?q=${enc(q(n))}` },
    { id: "home-depot", name: "The Home Depot", kind: "pots",
      url: (n) => `https://www.homedepot.com/s/${enc(q(n) || "planters")}` },
    { id: "amazon-us", name: "Amazon", kind: "tools",
      url: (n) => amazon("com", "patchandpot-20") },
  ],
  "canada": [
    { id: "west-coast-seeds", name: "West Coast Seeds", kind: "seeds",
      url: (n) => `https://www.westcoastseeds.com/search?q=${enc(q(n))}` },
    { id: "home-hardware", name: "Home Hardware", kind: "pots",
      url: (n) => `https://www.homehardware.ca/en/search/?q=${enc(q(n) || "planters")}` },
    { id: "amazon-ca", name: "Amazon.ca", kind: "tools",
      url: (n) => amazon("ca", "") },
  ],
  "australia": [
    { id: "diggers-club", name: "The Diggers Club", kind: "seeds",
      url: (n) => `https://www.diggers.com.au/catalogsearch/result/?q=${enc(q(n))}` },
    { id: "yates", name: "Yates", kind: "seeds",
      url: (n) => `https://www.yates.com.au/search?q=${enc(q(n))}` },
    { id: "bunnings", name: "Bunnings", kind: "pots",
      url: (n) => `https://www.bunnings.com.au/search/products?q=${enc(q(n) || "planters")}` },
    { id: "amazon-au", name: "Amazon.com.au", kind: "tools",
      url: (n) => amazon("com.au", "") },
  ],
  "new zealand": [
    { id: "kings-seeds", name: "Kings Seeds NZ", kind: "seeds",
      url: (n) => `https://www.kingsseeds.co.nz/search-results.html?Keyword=${enc(q(n))}` },
    { id: "mitre-10", name: "Mitre 10", kind: "pots",
      url: (n) => `https://www.mitre10.co.nz/shop?q=${enc(q(n) || "planters")}` },
    { id: "amazon-au-nz", name: "Amazon.com.au", kind: "tools",
      url: (n) => amazon("com.au", "") },
  ],
  "germany": [
    { id: "baldur-garten", name: "Baldur-Garten", kind: "seeds",
      url: (n) => `https://www.baldur-garten.de/search/?text=${enc(q(n))}` },
    { id: "dehner", name: "Dehner", kind: "pots",
      url: (n) => `https://www.dehner.de/search/?q=${enc(q(n) || "pflanztopf")}` },
    { id: "amazon-de", name: "Amazon.de", kind: "tools",
      url: (n) => amazon("de", "", "garten werkzeug") },
  ],
  "france": [
    { id: "vilmorin", name: "Vilmorin", kind: "seeds",
      url: (n) => `https://www.vilmorin-jardin.fr/catalogsearch/result/?q=${enc(q(n))}` },
    { id: "truffaut", name: "Truffaut", kind: "pots",
      url: (n) => `https://www.truffaut.com/search?q=${enc(q(n) || "pot jardin")}` },
    { id: "amazon-fr", name: "Amazon.fr", kind: "tools",
      url: (n) => amazon("fr", "", "outils jardin") },
  ],
  "spain": [
    { id: "semillaria", name: "Semillaria", kind: "seeds",
      url: (n) => `https://semillaria.es/?s=${enc(q(n))}` },
    { id: "leroy-merlin", name: "Leroy Merlin", kind: "pots",
      url: (n) => `https://www.leroymerlin.es/search?q=${enc(q(n) || "macetas")}` },
    { id: "amazon-es", name: "Amazon.es", kind: "tools",
      url: (n) => amazon("es", "", "herramientas jardin") },
  ],
  "italy": [
    { id: "bavicchi", name: "Bavicchi", kind: "seeds",
      url: (n) => `https://www.bavicchi.it/?s=${enc(q(n))}` },
    { id: "leroy-merlin-it", name: "Leroy Merlin Italia", kind: "pots",
      url: (n) => `https://www.leroymerlin.it/search?q=${enc(q(n) || "vasi")}` },
    { id: "amazon-it", name: "Amazon.it", kind: "tools",
      url: (n) => amazon("it", "", "attrezzi giardino") },
  ],
  "netherlands": [
    { id: "bakker", name: "Bakker", kind: "seeds",
      url: (n) => `https://www.bakker.com/nl-nl/search?q=${enc(q(n))}` },
    { id: "intratuin", name: "Intratuin", kind: "pots",
      url: (n) => `https://www.intratuin.nl/search?q=${enc(q(n) || "potten")}` },
    { id: "amazon-nl", name: "Amazon.nl", kind: "tools",
      url: (n) => amazon("nl", "", "tuingereedschap") },
  ],
  "belgium": [
    { id: "bakker-be", name: "Bakker", kind: "seeds",
      url: (n) => `https://www.bakker.com/nl-be/search?q=${enc(q(n))}` },
    { id: "amazon-be", name: "Amazon.com.be", kind: "tools",
      url: (n) => amazon("com.be", "", "tuingereedschap") },
  ],
  "sweden": [
    { id: "wexthuset", name: "Wexthuset", kind: "seeds",
      url: (n) => `https://www.wexthuset.com/sok?q=${enc(q(n))}` },
    { id: "amazon-se", name: "Amazon.se", kind: "tools",
      url: (n) => amazon("se", "", "tradgard verktyg") },
  ],
  "poland": [
    { id: "amazon-pl", name: "Amazon.pl", kind: "tools",
      url: (n) => amazon("pl", "", "narzedzia ogrodnicze") },
  ],
  "turkey": [
    { id: "amazon-tr", name: "Amazon.com.tr", kind: "tools",
      url: (n) => amazon("com.tr", "", "bahce aletleri") },
  ],
  "mexico": [
    { id: "amazon-mx", name: "Amazon.com.mx", kind: "tools",
      url: (n) => amazon("com.mx", "", "herramientas jardin") },
  ],
  "brazil": [
    { id: "amazon-br", name: "Amazon.com.br", kind: "tools",
      url: (n) => amazon("com.br", "", "ferramentas jardim") },
  ],
  "united arab emirates": [
    { id: "amazon-ae", name: "Amazon.ae", kind: "tools",
      url: (n) => amazon("ae", "") },
  ],
  "saudi arabia": [
    { id: "amazon-sa", name: "Amazon.sa", kind: "tools",
      url: (n) => amazon("sa", "") },
  ],
  "singapore": [
    { id: "amazon-sg", name: "Amazon.sg", kind: "tools",
      url: (n) => amazon("sg", "") },
  ],
  "japan": [
    { id: "sakata", name: "Sakata Seed", kind: "seeds",
      url: (n) => `https://sakata-tsushin.com/Form/Product/ProductList.aspx?keyword=${enc(q(n))}` },
    { id: "cainz", name: "Cainz", kind: "pots",
      url: (n) => `https://www.cainz.com/search?keyword=${enc(q(n) || "植木鉢")}` },
    { id: "amazon-jp", name: "Amazon.co.jp", kind: "tools",
      url: (n) => amazon("co.jp", "", "園芸 道具") },
  ],
  "china": [
    { id: "tmall-seeds", name: "Tmall", kind: "seeds",
      url: (n) => `https://list.tmall.com/search_product.htm?q=${enc(q(n))}` },
    { id: "jd-garden", name: "JD.com", kind: "pots",
      url: (n) => `https://search.jd.com/Search?keyword=${enc(q(n) || "花盆")}` },
  ],
  "india": [
    { id: "ugaoo", name: "Ugaoo", kind: "seeds",
      url: (n) => `https://www.ugaoo.com/search?q=${enc(q(n))}` },
    { id: "amazon-in", name: "Amazon India", kind: "pots",
      url: (n) => amazon("in", "") },
  ],
};

// Last-resort vendor — always returns *something*. Falls back to Amazon.com
// with the patchandpot-20 US tag so unsupported countries still earn referral
// fees if a visitor buys. Unlike the per-country Amazon entries (which target
// garden tools), the GLOBAL amazon-seeds fallback DOES pass the plant name,
// because there's no dedicated seed vendor for that country to route to.
const GLOBAL = [
  { id: "amazon-global", name: "Amazon", kind: "seeds",
    url: (n) => `https://www.amazon.com/s?k=${enc((q(n) || "gardening") + " seeds")}&tag=patchandpot-20` },
  { id: "etsy-global", name: "Etsy", kind: "pots",
    url: (n) => `https://www.etsy.com/search?q=${enc(q(n) || "planter pot")}` },
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
