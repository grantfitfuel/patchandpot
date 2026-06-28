// Region-aware vendor catalog for the "Where to source" section.
//
// Each country code maps to a list of vendors. The first vendor whose
// `kind === "seeds"` is shown in the Seeds slot; the first `kind === "pots"`
// is shown in the Pots/Compost slot; an extra is used for Tools if available.
//
// URL strategy per kind:
//   - seeds: the plant name is the search query — vendor returns the right
//     packet (e.g. "Kale seeds" on Thompson & Morgan).
//   - pots / tools: the PLANT NAME IS IGNORED. The user is in a pots-and-
//     compost mindset, not a "buy more kale" one. We point them at the
//     vendor's pots/planters category page (or a search for the local
//     equivalent of "pots" / "garden tools" where we don't have a stable
//     deep link). The AI-written blurb above the link still provides the
//     plant-specific context.
//
// Affiliate tags wired in:
//   - Amazon.co.uk → patchandpot-21 (UK list + qualifying tool searches)
//   - Amazon.com   → patchandpot-20 (US list + GLOBAL fallback)
// Amazon DE / FR / ES / IT / NL / CA / AU / JP / IN are wired in as plain
// (non-affiliated) links — same path is in place so the moment the owner
// signs up for each regional Associates programme, swap `&tag=` in and
// commissions start flowing without touching anything else.
// Keys are searched case-insensitive; we fall back to a `global` Amazon-search
// vendor so the section is never empty.

const enc = (q) => encodeURIComponent(q);

// Awin deep-link helper.
//   - AWIN_PUB_ID is the Patch & Pot publisher account (set at sign-up).
//   - awinLink(mid, destinationUrl) wraps any retailer URL in Awin's
//     click-tracking redirect, attributing the sale to us.
//   Usage:  url: () => awinLink(12345, "https://www.crocus.co.uk/department/pots-and-planters/")
//   Drop in once each merchant approves the application; until then the
//   plain destination URL is fine.
const AWIN_PUB_ID = "2954417";
const awinLink = (mid, destinationUrl) =>
  `https://www.awin1.com/cread.php?awinmid=${mid}&awinaffid=${AWIN_PUB_ID}&clickref=patchandpot&ued=${encodeURIComponent(destinationUrl)}`;

const VENDORS_BY_COUNTRY = {
  "united kingdom": [
    { id: "thompson-morgan", name: "Thompson & Morgan", kind: "seeds", url: (q) => `https://www.thompson-morgan.com/search?q=${enc(q + " seeds")}` },
    { id: "suttons", name: "Suttons", kind: "seeds", url: (q) => `https://www.suttons.co.uk/search?q=${enc(q + " seeds")}` },
    { id: "crocus", name: "Crocus", kind: "pots", url: () => "https://www.crocus.co.uk/department/pots-and-planters/" },
    { id: "amazon-uk", name: "Amazon UK", kind: "tools", url: () => `https://www.amazon.co.uk/s?k=${enc("garden tools")}&tag=patchandpot-21` },
  ],
  "ireland": [
    { id: "mr-middleton", name: "Mr Middleton", kind: "seeds", url: (q) => `https://www.mrmiddleton.com/search?q=${enc(q + " seeds")}` },
    { id: "thompson-morgan", name: "Thompson & Morgan", kind: "pots", url: () => "https://www.thompson-morgan.com/c/pots-planters" },
  ],
  "united states": [
    { id: "burpee", name: "Burpee", kind: "seeds", url: (q) => `https://www.burpee.com/search?q=${enc(q + " seeds")}` },
    { id: "botanical-interests", name: "Botanical Interests", kind: "seeds", url: (q) => `https://www.botanicalinterests.com/search?q=${enc(q + " seeds")}` },
    { id: "home-depot", name: "The Home Depot", kind: "pots", url: () => "https://www.homedepot.com/b/Outdoors-Garden-Center-Pots-Planters/N-5yc1vZc54y" },
    { id: "amazon-us", name: "Amazon", kind: "tools", url: () => `https://www.amazon.com/s?k=${enc("garden tools")}&tag=patchandpot-20` },
  ],
  "canada": [
    { id: "west-coast-seeds", name: "West Coast Seeds", kind: "seeds", url: (q) => `https://www.westcoastseeds.com/search?q=${enc(q + " seeds")}` },
    { id: "home-hardware", name: "Home Hardware", kind: "pots", url: () => `https://www.homehardware.ca/en/search/?q=${enc("planters pots")}` },
    { id: "amazon-ca", name: "Amazon.ca", kind: "tools", url: () => `https://www.amazon.ca/s?k=${enc("garden tools")}` },
  ],
  "australia": [
    { id: "diggers-club", name: "The Diggers Club", kind: "seeds", url: (q) => `https://www.diggers.com.au/catalogsearch/result/?q=${enc(q + " seeds")}` },
    { id: "yates", name: "Yates", kind: "seeds", url: (q) => `https://www.yates.com.au/search?q=${enc(q + " seeds")}` },
    { id: "bunnings", name: "Bunnings", kind: "pots", url: () => "https://www.bunnings.com.au/our-range/garden/pots-planters-hanging-baskets" },
    { id: "amazon-au", name: "Amazon.com.au", kind: "tools", url: () => `https://www.amazon.com.au/s?k=${enc("garden tools")}` },
  ],
  "new zealand": [
    { id: "kings-seeds", name: "Kings Seeds NZ", kind: "seeds", url: (q) => `https://www.kingsseeds.co.nz/search-results.html?Keyword=${enc(q)}` },
    { id: "mitre-10", name: "Mitre 10", kind: "pots", url: () => `https://www.mitre10.co.nz/shop?q=${enc("pots planters")}` },
    { id: "amazon-au-nz", name: "Amazon.com.au", kind: "tools", url: () => `https://www.amazon.com.au/s?k=${enc("garden tools")}` },
  ],
  "germany": [
    { id: "baldur-garten", name: "Baldur-Garten", kind: "seeds", url: (q) => `https://www.baldur-garten.de/search/?text=${enc(q + " samen")}` },
    { id: "dehner", name: "Dehner", kind: "pots", url: () => `https://www.dehner.de/search/?q=${enc("pflanztopf")}` },
    { id: "amazon-de", name: "Amazon.de", kind: "tools", url: () => `https://www.amazon.de/s?k=${enc("garten werkzeug")}` },
  ],
  "france": [
    { id: "vilmorin", name: "Vilmorin", kind: "seeds", url: (q) => `https://www.vilmorin-jardin.fr/catalogsearch/result/?q=${enc(q + " graines")}` },
    { id: "truffaut", name: "Truffaut", kind: "pots", url: () => `https://www.truffaut.com/search?q=${enc("pot jardin")}` },
    { id: "amazon-fr", name: "Amazon.fr", kind: "tools", url: () => `https://www.amazon.fr/s?k=${enc("outils jardinage")}` },
  ],
  "spain": [
    { id: "semillaria", name: "Semillaria", kind: "seeds", url: (q) => `https://semillaria.es/?s=${enc(q)}` },
    { id: "leroy-merlin", name: "Leroy Merlin", kind: "pots", url: () => `https://www.leroymerlin.es/search?q=${enc("macetas jardineras")}` },
    { id: "amazon-es", name: "Amazon.es", kind: "tools", url: () => `https://www.amazon.es/s?k=${enc("herramientas jardin")}` },
  ],
  "italy": [
    { id: "bavicchi", name: "Bavicchi", kind: "seeds", url: (q) => `https://www.bavicchi.it/?s=${enc(q)}` },
    { id: "leroy-merlin-it", name: "Leroy Merlin Italia", kind: "pots", url: () => `https://www.leroymerlin.it/search?q=${enc("vasi fioriere")}` },
    { id: "amazon-it", name: "Amazon.it", kind: "tools", url: () => `https://www.amazon.it/s?k=${enc("attrezzi giardinaggio")}` },
  ],
  "netherlands": [
    { id: "bakker", name: "Bakker", kind: "seeds", url: (q) => `https://www.bakker.com/nl-nl/search?q=${enc(q + " zaden")}` },
    { id: "intratuin", name: "Intratuin", kind: "pots", url: () => `https://www.intratuin.nl/search?q=${enc("potten plantenbak")}` },
    { id: "amazon-nl", name: "Amazon.nl", kind: "tools", url: () => `https://www.amazon.nl/s?k=${enc("tuingereedschap")}` },
  ],
  "belgium": [
    { id: "bakker-be", name: "Bakker", kind: "seeds", url: (q) => `https://www.bakker.com/nl-be/search?q=${enc(q + " zaden")}` },
    { id: "amazon-be", name: "Amazon.com.be", kind: "tools", url: () => `https://www.amazon.com.be/s?k=${enc("tuingereedschap")}` },
  ],
  "sweden": [
    { id: "wexthuset", name: "Wexthuset", kind: "seeds", url: (q) => `https://www.wexthuset.com/sok?q=${enc(q)}` },
    { id: "amazon-se", name: "Amazon.se", kind: "tools", url: () => `https://www.amazon.se/s?k=${enc("tradgard verktyg")}` },
  ],
  "poland": [
    { id: "amazon-pl", name: "Amazon.pl", kind: "tools", url: () => `https://www.amazon.pl/s?k=${enc("narzedzia ogrodnicze")}` },
  ],
  "turkey": [
    { id: "amazon-tr", name: "Amazon.com.tr", kind: "tools", url: () => `https://www.amazon.com.tr/s?k=${enc("bahce aletleri")}` },
  ],
  "mexico": [
    { id: "amazon-mx", name: "Amazon.com.mx", kind: "tools", url: () => `https://www.amazon.com.mx/s?k=${enc("herramientas jardin")}` },
  ],
  "brazil": [
    { id: "amazon-br", name: "Amazon.com.br", kind: "tools", url: () => `https://www.amazon.com.br/s?k=${enc("ferramentas jardim")}` },
  ],
  "united arab emirates": [
    { id: "amazon-ae", name: "Amazon.ae", kind: "tools", url: () => `https://www.amazon.ae/s?k=${enc("garden tools")}` },
  ],
  "saudi arabia": [
    { id: "amazon-sa", name: "Amazon.sa", kind: "tools", url: () => `https://www.amazon.sa/s?k=${enc("garden tools")}` },
  ],
  "singapore": [
    { id: "amazon-sg", name: "Amazon.sg", kind: "tools", url: () => `https://www.amazon.sg/s?k=${enc("garden tools")}` },
  ],
  "japan": [
    { id: "sakata", name: "Sakata Seed", kind: "seeds", url: (q) => `https://sakata-tsushin.com/Form/Product/ProductList.aspx?keyword=${enc(q)}` },
    { id: "cainz", name: "Cainz", kind: "pots", url: () => `https://www.cainz.com/search?keyword=${enc("植木鉢")}` },
    { id: "amazon-jp", name: "Amazon.co.jp", kind: "tools", url: () => `https://www.amazon.co.jp/s?k=${enc("園芸 道具")}` },
  ],
  "china": [
    { id: "tmall-seeds", name: "Tmall", kind: "seeds", url: (q) => `https://list.tmall.com/search_product.htm?q=${enc(q + " 种子")}` },
    { id: "jd-garden", name: "JD.com", kind: "pots", url: () => `https://search.jd.com/Search?keyword=${enc("花盆 园艺")}` },
  ],
  "india": [
    { id: "ugaoo", name: "Ugaoo", kind: "seeds", url: (q) => `https://www.ugaoo.com/search?q=${enc(q + " seeds")}` },
    { id: "amazon-in", name: "Amazon India", kind: "pots", url: () => `https://www.amazon.in/s?k=${enc("garden pots planters")}` },
  ],
};

// Last-resort vendor — always returns *something*. Falls back to Amazon.com
// with the patchandpot-20 US tag so unsupported countries still earn referral
// fees if a visitor buys.
const GLOBAL = [
  { id: "amazon-global", name: "Amazon", kind: "seeds", url: (q) => `https://www.amazon.com/s?k=${enc(q + " seeds")}&tag=patchandpot-20` },
  { id: "etsy-global", name: "Etsy", kind: "pots", url: () => `https://www.etsy.com/search?q=${enc("planter pot")}` },
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
