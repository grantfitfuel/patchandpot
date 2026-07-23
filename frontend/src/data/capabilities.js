/**
 * Marketing content for every "capability" landing page.
 *
 * Each entry powers one indexable route at `/capabilities/<slug>` and
 * feeds:
 *   - Helmet <title>, <meta description>, <link rel="canonical">
 *   - Open Graph + Twitter cards
 *   - JSON-LD `Product` / `BreadcrumbList`
 *   - The visible hero + feature blocks + CTA on the page
 *
 * Keep copy crisp: crawlers reward clear, specific value props over
 * generic marketing fluff. Every headline is a plain-English promise.
 */
export const CAPABILITIES = {
  "ask-nadar": {
    slug: "ask-nadar",
    label: "Ask Nàdar",
    tagline: "Your always-on AI gardening mentor.",
    title: "Ask Nàdar — AI gardening mentor for your patch",
    description:
      "Get personalised gardening advice from Nàdar, the AI mentor that knows your climate, region, season and space. Ask any question, get a friendly, expert answer in seconds.",
    hero:
      "Nàdar is your always-on gardening mentor. Ask any question — 'why are my tomato leaves yellow?', 'what should I sow this weekend in Glasgow?', 'how do I stop slugs eating my hostas?' — and get a friendly, region-aware answer in seconds.",
    features: [
      { title: "Regional to the postcode", body: "Nàdar knows your climate zone, average frost dates and rainfall, so the advice fits where you actually live." },
      { title: "Photo-aware diagnosis", body: "Upload a picture of a struggling plant. Nàdar reads the leaf, spots pests, and prescribes the fix." },
      { title: "Journal + pin the best answers", body: "One-tap pin every answer worth keeping. Filter by tag or download the whole notebook as a printable PDF." },
    ],
    ctaLabel: "Ask a gardening question",
    ctaTo: "/ask",
  },
  "calm": {
    slug: "calm",
    label: "2-Minute Calm",
    tagline: "Seasonal mindfulness for gardeners.",
    title: "2-Minute Calm — gardener's mindfulness audio (weekly, 6 voices)",
    description:
      "Two-minute mindfulness audios written for the gardening year — one for every week of every month, in your hemisphere. Choose from six narrators including Scottish, American and British voices.",
    hero:
      "A two-minute mindfulness audio for every week of the gardening year. Written to the season, narrated by one of six voices. Slow the day, then head back to the patch.",
    features: [
      { title: "192 seasonal tracks", body: "One per week × 12 months × two hemispheres. Auto-rotates so it never gets repetitive." },
      { title: "Six voices", body: "Lily, George, Clyde, Nicole, Daisy and Robert — British, American and Scottish narrators. Sample each before choosing." },
      { title: "Procedural ambience", body: "Rain, birdsong, wind and fireside layered under every session — the mix shifts with the month." },
    ],
    ctaLabel: "Start today's session",
    ctaTo: "/calm",
  },
  "monthly-guide": {
    slug: "monthly-guide",
    label: "Monthly Guide",
    tagline: "What to do in the garden right now.",
    title: "Monthly Regional Gardening Guide — sow, plant, harvest, prune",
    description:
      "A month-by-month gardening guide that adapts to your climate zone. Know exactly what to sow, plant, harvest and prune this week — no guessing, no generic advice.",
    hero:
      "A month-by-month guide that adapts to your climate zone. See exactly what to sow, plant, harvest and prune this week — sized to whatever space you have.",
    features: [
      { title: "Climate-aware", body: "Northern hemisphere, Southern hemisphere, tropical or temperate — the guide re-shapes itself for your latitude." },
      { title: "Broken into 15-min tasks", body: "Every entry is a doable weekend job with clear tools and timings — no overwhelm." },
      { title: "Compare month-to-month", body: "See where you'll be in six weeks. Plan holidays, seed orders and successive sowings ahead." },
    ],
    ctaLabel: "See this month's guide",
    ctaTo: "/calendar",
  },
  "plants": {
    slug: "plants",
    label: "Plant Database",
    tagline: "300+ plants with living care guides.",
    title: "Plant Database — 300+ care guides for edibles, herbs and flowers",
    description:
      "Browse 300+ plants with care guides tailored to your climate and space. Sowing dates, spacing, watering, pests, companion planting and harvest windows — all in one place.",
    hero:
      "Browse over three hundred plants — edibles, herbs, cut flowers, climbers, natives. Every guide adapts to your climate, your space and your experience level.",
    features: [
      { title: "Companion Insights", body: "See exactly which plants pair well and why — 812 hand-authored companion notes, not generic tables." },
      { title: "Every space, every plant", body: "'Grow anywhere' tags every plant with which containers, walls, ladders or plots it thrives in." },
      { title: "AI-generated deep dives", body: "Any plant not in the core library? Nàdar writes a fresh guide on demand, cached forever for the next visitor." },
    ],
    ctaLabel: "Browse the plant library",
    ctaTo: "/plants",
  },
  "masterclasses": {
    slug: "masterclasses",
    label: "Masterclasses",
    tagline: "AI-tutored courses for any topic.",
    title: "AI Gardening Masterclasses — personalised courses on any topic",
    description:
      "Ask for any gardening topic and receive a full, multi-lesson masterclass in minutes — written for your climate, your space and your level. Companion plants, cut flowers, no-dig, seed saving — pick anything.",
    hero:
      "Tell the AI Masterclass creator what you want to learn — 'no-dig for a small garden', 'seed saving from tomatoes', 'attracting bees to a balcony' — and a full multi-lesson masterclass is written just for you.",
    features: [
      { title: "Personalised, not templated", body: "Each masterclass is shaped around the climate, space and experience you told us about." },
      { title: "Lifetime library", body: "Every masterclass you generate is saved to your library. Come back, share, or fork into a new one." },
      { title: "Founding members: unlimited", body: "One-off support unlocks unlimited masterclasses forever." },
    ],
    ctaLabel: "Explore masterclasses",
    ctaTo: "/masterclasses",
  },
  "recipes": {
    slug: "recipes",
    label: "Seasonal Recipes",
    tagline: "Cook what your patch just gave you.",
    title: "Seasonal Recipes — cook what's ready in your garden right now",
    description:
      "Recipes matched to what's actually ready in your garden this week — no more staring at a glut of courgettes. Simple, seasonal, region-aware.",
    hero:
      "Recipes matched to what's actually ready in your garden this week. A glut of courgettes, a first handful of raspberries, an unexpected fennel — Nàdar knows what to do with it.",
    features: [
      { title: "Matches your patch", body: "Only surfaces recipes for what you told us you're growing this month." },
      { title: "Foolproof timings", body: "Prep + cook times, difficulty stars, and swaps for missing ingredients." },
      { title: "One-tap shopping list", body: "The gaps in your patch become a compact shopping list you can screenshot." },
    ],
    ctaLabel: "See tonight's recipe",
    ctaTo: "/recipes",
  },
  "bouquet": {
    slug: "bouquet",
    label: "Bouquet Designer",
    tagline: "Cut-flower bouquets from your own patch.",
    title: "Bouquet Designer — cut-flower bouquets from your own garden",
    description:
      "Design bouquets from the cut flowers your garden is producing right now. Pick a palette, a season, an occasion — Nàdar arranges the stems and tells you when to snip.",
    hero:
      "Design bouquets from the cut flowers your patch is producing right now. Pick a palette, an occasion, a season — Nàdar arranges the stems and tells you when to snip.",
    features: [
      { title: "AI floral illustrations", body: "See a watercolor of your bouquet before you cut a single stem — no wasted flowers." },
      { title: "Season-aware", body: "Every suggestion only uses flowers that are actually in bloom in your patch this week." },
      { title: "Share as an image", body: "Export the bouquet + recipe as a shareable image for gift tags or Instagram." },
    ],
    ctaLabel: "Design a bouquet",
    ctaTo: "/bouquet",
  },
  "grow-anywhere": {
    slug: "grow-anywhere",
    label: "Grow Anywhere",
    tagline: "Balcony, windowsill, wall, ladder — anywhere.",
    title: "Grow Anywhere — balcony, windowsill and vertical garden walkthroughs",
    description:
      "Step-by-step walkthroughs for every gardening setup — balconies, windowsills, ladder planters, pallet walls, gutter gardens, trellis towers, hanging baskets and more. Ten container-sizes, hundreds of plant matches.",
    hero:
      "Whatever space you have — a north-facing balcony, a shady kitchen windowsill, a ladder against a fence — there's a way to grow food and flowers. Eighteen walkthroughs, each matched to the plants that actually thrive there.",
    features: [
      { title: "Eighteen situations", body: "From a jam-jar of water to a full raised bed, we cover every realistic setup — including five new vertical-garden walkthroughs." },
      { title: "Plants filtered by space", body: "Every plant in the library is tagged with which situations it loves — no more failed hanging basket disappointments." },
      { title: "DIY-friendly", body: "Repurposed pallets, stacked gutters, old ladders — get productive without a big shed budget." },
    ],
    ctaLabel: "Find your space",
    ctaTo: "/grow-anywhere",
  },
  "journal": {
    slug: "journal",
    label: "Wellbeing Journal",
    tagline: "Your gardening year, one page at a time.",
    title: "Wellbeing Journal — pin, tag and export your gardening notes",
    description:
      "A journal of every gardening question you've asked Nàdar. Pin your favourites, tag by plant, filter from the sidebar, and download the whole thing as a printable PDF.",
    hero:
      "A journal of every question you've asked Nàdar. Pin the answers worth keeping, tag by plant, filter from the sidebar — and download the whole notebook as a printable PDF for the potting shed.",
    features: [
      { title: "Pin your favourites", body: "One-tap pin every answer worth remembering. Everything else stays searchable underneath." },
      { title: "Tag & filter", body: "Group by plant, project or season. The sidebar makes a lifetime of answers navigable." },
      { title: "Print-ready PDF", body: "One click and every pinned answer prints into a keepsake booklet, tag by tag." },
    ],
    ctaLabel: "Open your journal",
    ctaTo: "/journal",
  },
  "topics": {
    slug: "topics",
    label: "Topic Feeds",
    tagline: "What gardeners around the world are asking.",
    title: "Ask Nàdar Topics — trending gardening questions with RSS feeds",
    description:
      "Explore the questions gardeners around the world are asking Nàdar — grouped by topic, updated in real time, and available as RSS or JSON feeds for aggregators and gardening blogs.",
    hero:
      "See what gardeners around the world are asking Nàdar — grouped by topic, updated as new questions come in. Every topic is also an RSS or JSON feed, ready to plug into your own reader or blog.",
    features: [
      { title: "Twelve living topics", body: "Tomatoes, roses, houseplants, no-dig, seed saving — each topic surfaces the freshest, most-asked questions." },
      { title: "Public RSS + JSON feeds", body: "Every topic exposes an RSS 2.0 and a JSON Feed 1.1 — subscribe with any reader or auto-post to a blog." },
      { title: "Real questions, real answers", body: "Everything you see is a real question a real member asked — with Nàdar's expert answer beneath." },
    ],
    ctaLabel: "Explore the topics",
    ctaTo: "/topics",
  },
};

export const CAPABILITY_ORDER = [
  "ask-nadar", "monthly-guide", "masterclasses", "calm",
  "plants", "grow-anywhere", "recipes", "bouquet",
  "journal", "topics",
];
