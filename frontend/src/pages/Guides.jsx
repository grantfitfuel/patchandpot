import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft, ArrowRight, Sprout, LayoutGrid, Recycle, Flower2,
  HandHelping, FileDown, Lock, Lightbulb,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { usePaywall } from "@/hooks/usePaywall";
import PaywallModal from "@/components/PaywallModal";
import PageHero from "@/components/PageHero";
import { SeedlingMotif, HarvestMotif } from "@/components/illustrations/VibrantMotifs";

// Resolve at module load so the PDF links go through our backend proxy.
const API_BASE = process.env.REACT_APP_BACKEND_URL || "";

const GUIDES = {
  "first-pot": {
    label: "Begin today",
    title: "Your First Pot",
    icon: Sprout,
    intro: "Everything you need to begin growing today — pot, compost, seeds, light and water.",
    image:
      "https://images.unsplash.com/photo-1763741186493-509db18f6a6a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTF8MHwxfHNlYXJjaHw0fHx1cmJhbiUyMGdhcmRlbmluZyUyMHNtYWxsJTIwc3BhY2UlMjBiYWxjb255JTIwcGxhbnRzfGVufDB8fHx8MTc4MTQ2MjkzMnww&ixlib=rb-4.1.0&q=85",
    sections: [
      { type: "prose", title: "Pick the right pot",
        body: "Drainage matters more than looks. Choose a pot with holes at the base — terracotta breathes well; plastic stays moister. For most herbs and leafy greens a 20 cm-wide pot is enough; tomatoes, peppers and courgettes need 30–40 L of soil to be happy." },
      { type: "prose", title: "Choose a good compost",
        body: "Skip the cheap stuff — peat-free multipurpose compost is the sweet spot. For Mediterranean herbs (rosemary, thyme) mix in a third of horticultural grit to keep things sharp-draining." },
      { type: "prose", title: "Seeds or starter plants?",
        body: "Quick wins start as plug plants (basil, lettuce). Patience pays for tomatoes, chillies and herbs grown from seed — start indoors on a bright sill 6–8 weeks before your local last frost." },
      { type: "prose", title: "Light is the silent ingredient",
        body: "South-facing balconies (north-facing if you're in the southern hemisphere) get the longest sun. If you only have a few hours of direct light, lean towards leaves: lettuce, mint, parsley, chard." },
      { type: "prose", title: "Water with your finger",
        body: "Push a finger an inch into the soil. Dry? Water deeply until it runs out the bottom. Damp? Wait. Most beginner plant deaths are from over-watering, not under." },
    ],
  },

  "space-saving": {
    label: "Small spaces",
    title: "Space-Saving Ideas",
    icon: LayoutGrid,
    intro: "Vertical towers, hanging rails, and crate setups for tiny spaces.",
    image:
      "https://images.unsplash.com/photo-1765558290832-f50b7fab8f36?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTF8MHwxfHNlYXJjaHwzfHx1cmJhbiUyMGdhcmRlbmluZyUyMHNtYWxsJTIwc3BhY2UlMjBiYWxjb255JTIwcGxhbnRzfGVufDB8fHx8MTc4MTQ2MjkzMnww&ixlib=rb-4.1.0&q=85",
    sections: [
      { type: "prose", title: "The honest small-space mindset",
        body: "A 2 m² balcony will never out-yield an allotment — but it can absolutely feed you fresh herbs, salads, soft fruit and a meaningful summer of tomatoes if you stop trying to copy a country garden. The single biggest mistake is putting too many plants in too-small pots. One thriving 30 L tomato in a sunny corner beats five sulky 5 L tomatoes squeezed onto a railing. Pick fewer plants, give them deeper soil, and grow up." },

      { type: "tags", items: ["Grow up, not out", "Vertical wall gardens", "Edges & rails", "Light is the limit", "Deeper > wider"] },

      { type: "tipsgrid", title: "The four ways to find more space",
        items: [
          { t: "Up — climbers & trellis",
            b: "Anything that grows on a vine can climb out of its pot's footprint. Cucumbers, climbing beans, sweet peas and even small squashes will go vertical with a single bamboo wigwam. A 30 cm pot can yield a metre of plant straight up." },
          { t: "Sideways — rails & hooks",
            b: "Railing planters double your growing area without taking floor space. Hooks under window ledges hold hanging baskets for strawberries, tumbling tomatoes and trailing herbs." },
          { t: "Stacked — tiered shelves",
            b: "A simple 3-tier metal plant stand turns one square metre of floor into three square metres of growing area. Put sun-lovers on top, leafy greens on the bottom." },
          { t: "Hidden — windowsills indoors",
            b: "Don't forget the sill inside the kitchen. Microgreens, herbs and chilli plants all crop on a bright indoor windowsill year-round." },
        ],
      },

      { type: "steps", title: "Build a vertical wall garden (the highest-yield small-space build)",
        items: [
          "Pick the wall — a south or west-facing exterior wall, sheltered from the worst wind. Check what's behind it: solid masonry holds anchors; cladding or hollow plasterboard won't.",
          "Choose the system: (a) pocket planters — fabric or felt pouches that hang from a batten, lightest, perfect for renters; (b) modular pots on a rail — rigid, refillable, last for years; (c) horizontal pallet — a heat-treated (HT-stamped) pallet stood upright and lined with weed fabric, biggest yield, free.",
          "Mount a horizontal pressure-treated batten high on the wall with rust-proof screws into anchors rated for at least 30 kg per fixing — a fully-watered wall garden weighs 80–150 kg per square metre.",
          "Line the back with breathable weed fabric or pond liner so water doesn't run down the wall and stain the brickwork. Leave a 2–3 cm air gap between the planter and the wall for airflow (stops mildew and damp).",
          "Fill with a light peat-free compost mix (50% compost, 30% coir, 20% perlite) — heavy soil tears pockets and overloads the wall.",
          "Install drip irrigation along the top row from day one. Hand-watering a wall garden is misery and the bottom plants always die first — a £20 timer-fed drip kit is the difference between thriving and dead.",
          "Plant top rows with shallow-rooted trailers (strawberries, thyme, oregano, alyssum), middle rows with leafy crops (lettuce, mizuna, spinach, chard), and the bottom row with herbs that tolerate wetter feet (mint, parsley, chives — they catch all the drainage above them).",
        ],
        footer: "Renting? Use a freestanding A-frame pallet or a wall-leaning ladder planter — both give you the vertical yield without drilling a single hole. Move the whole thing when you move out.",
      },

      { type: "list", title: "What thrives on a vertical wall (and what to skip)",
        items: [
          "Best: strawberries (everbearing), lettuce, rocket, mizuna, chard, spinach, parsley, thyme, oregano, mint, chives, sage, alyssum, nasturtium, viola.",
          "Good with care: bush basil, dwarf french beans, small chillies, trailing tumbling tomatoes (top row only).",
          "Skip: anything that gets tall and top-heavy (cordon tomatoes, peppers, kale), root crops (carrots, beetroot — not enough soil depth), and Mediterranean herbs that hate the wet feet of a bottom row (rosemary, lavender — pot them separately).",
          "Pollinator strip: dedicate the top row to alyssum + nasturtium + viola. They pull bees and hoverflies in, which then visit your edible rows below.",
        ],
      },

      { type: "table", title: "Container sizes that actually work",
        note: "If you take one thing from this guide: depth matters more than width. Most beginners underpot tomatoes.",
        headers: ["Container", "Soil volume", "Best for", "How many plants"],
        rows: [
          ["Window box", "5–7 L", "Lettuce, radish, chives, parsley, viola", "3–5"],
          ["Round 20 cm pot", "3–4 L", "One basil, one chilli, one mint, herb cuttings", "1"],
          ["Round 30 cm pot", "10–12 L", "Bush tomato (small), salad bowl, pepper", "1"],
          ["Round 40 cm pot", "25–30 L", "Cordon tomato, courgette, climbing bean wigwam", "1 (or 1 tomato + 1 basil)"],
          ["Trough 60 × 25 cm", "20 L", "Cut-and-come-again salads, herb collection", "5–6"],
          ["Grow bag (40 L)", "40 L", "Two cordon tomatoes or one courgette", "1–2"],
          ["Half-barrel (60 cm)", "80–100 L", "Compact apple, dwarf peach, blueberry pair", "1 shrub or 2 cordons"],
          ["Hanging basket 30 cm", "8–10 L", "Tumbling tomato, trailing thyme, strawberries", "3–5"],
        ],
      },

      { type: "list", title: "Crops that genuinely earn their pot space",
        items: [
          "Salad leaves (loose-leaf, oak-leaf, mizuna) — sown every 3 weeks, cut-and-come-again, 6+ harvests per pot per season.",
          "Soft herbs (basil, coriander, parsley, mint) — fresh herbs cost £2 a packet at the shop; a pot pays for itself in 3 weeks.",
          "Chillies & sweet peppers — handle small pots well, ornamental, productive, dry well for winter use.",
          "Bush cherry tomatoes — sized for pots, faster than cordons, a single plant gives 80–120 fruit.",
          "Strawberries (everbearing) — perfect in hanging baskets; fruit June through October.",
          "Climbing French beans — vertical, prolific, beautiful flowers, pick young and they keep producing.",
          "Spring onions & radish — fast, shallow-rooted, ideal between bigger plants as 'gap fillers'.",
        ],
      },

      { type: "list", title: "Crops that struggle in pots (skip or scale down)",
        items: [
          "Sweetcorn — needs a block of 9+ plants for pollination; no room.",
          "Brussels sprouts & full-size cabbages — top-heavy, slow, need huge soil volume and a long season.",
          "Maincrop potatoes — possible in big tubs but you'll get a meal, not a winter store. Skip unless it's purely for the joy.",
          "Pumpkins & big winter squashes — one plant covers 6 m² on the ground; not balcony-friendly.",
          "Asparagus & rhubarb — beautiful perennials but they need a permanent dedicated bed.",
        ],
      },

      { type: "steps", title: "Build a 2-pot vertical wigwam (cucumbers, beans, sweet peas)",
        items: [
          "Choose a 30–40 cm pot with deep drainage holes. Fill ¾ with peat-free compost and a handful of slow-release feed.",
          "Push 4 × 1.8 m bamboo canes into the soil, evenly spaced around the rim. Tie the tops together with garden twine to form a wigwam.",
          "Sow 2 seeds or plant 2 plug plants at the base of each cane (thin to one per cane after they sprout).",
          "Train the first 2 leaves of each plant gently around the cane. Self-clinging crops (sweet peas, cucumbers) take over after that; runner beans need re-tying weekly.",
          "Water deeply 2× per week (daily in heatwaves). A 40 L pot at full vine load drinks roughly 2 L per day in midsummer.",
        ],
        footer: "Stability matters: on a windy balcony, wedge bricks against the windward side of the pot or lash the wigwam to a railing.",
      },

      { type: "steps", title: "Set up a railing planter (the small-space cheat code)",
        items: [
          "Pick a railing planter with a proper saddle bracket — not just hooks. A 5 L box full of soil weighs ~7 kg wet.",
          "Always hang on the INSIDE of a balcony rail (gravity pulls them onto your floor, not 4 floors below).",
          "Fill with a 50:50 mix of peat-free compost and coir for lightness. Add slow-release fertiliser at the recommended dose.",
          "Plant trailing edges (thyme, oregano, alyssum, tumbling tomato) and tall centres (basil, chives, parsley) for a 3-D effect.",
          "Water in the morning, never the evening — wet leaves overnight invite mildew.",
        ],
        footer: "Local rules: some flats and councils ban window-side planters. Check your lease before you mount one over a public pavement.",
      },

      { type: "list", title: "Hanging basket — the right way",
        items: [
          "Pick a 30 cm minimum diameter basket. Smaller ones dry out in hours and yields collapse.",
          "Use a coir liner, NOT a moss liner — coir holds moisture longer and rots less.",
          "Plant 3–5 plants: one trailing edible (tumbling tomato or strawberry), 2 trailing fillers (thyme, oregano), 1–2 upright centres (basil, chilli).",
          "Add water-retaining gel crystals at planting (a pinch goes a long way). Lifesaver in hot weeks.",
          "Lift the basket every 2–3 days — if it feels light, soak it in a bucket of water for 5 minutes rather than top-watering.",
        ],
      },

      { type: "prose", title: "Light: the one thing you cannot fake",
        body: "Most edible crops need 6+ hours of direct sun to fruit (tomatoes, peppers, courgettes, beans). 4–6 hours will produce mixed results — small fruit, late ripening. Below 4 hours, switch to leafy crops only: lettuce, spinach, chard, kale, mint, parsley, chives. North-facing balconies (south-facing in the southern hemisphere) get the least light — and that's OK. Lean into it: build a beautiful shade-tolerant salad garden instead of a mediocre tomato corner. Track your sun by leaving a plate or chalk mark on the balcony for a sunny day, then mark where it stays bright at 10am, 1pm and 4pm. That's your map." },

      { type: "table", title: "Crops by light level",
        headers: ["Sun hours", "Best crops", "Won't work well"],
        rows: [
          ["6+ hours direct", "Tomatoes, peppers, chillies, courgettes, beans, basil, strawberries", "—"],
          ["4–6 hours direct", "Salads, chard, beetroot, dwarf french beans, peas, mint, parsley, chives", "Tomatoes (small/late), peppers, basil (leggy)"],
          ["2–4 hours direct", "Lettuce, spinach, mizuna, kale, mint, parsley, sorrel, chives, microgreens", "Anything that fruits"],
          ["Bright shade (no direct)", "Mint, parsley, chervil, microgreens, hostas (edible shoots), wild garlic", "Everything that fruits or sweetens"],
        ],
      },

      { type: "table", title: "Watering rhythm by container size",
        note: "Hot, windy balconies dry pots 2–3× faster than sheltered ones. Always finger-test before watering.",
        headers: ["Container", "Cool weather", "Warm weather", "Heatwave"],
        rows: [
          ["Hanging basket 30 cm", "Daily", "1–2× per day", "2× per day + soak"],
          ["20 cm pot", "Every 2–3 days", "Daily", "1–2× per day"],
          ["40 cm pot / grow bag", "Twice a week", "Every 2 days", "Daily"],
          ["Half-barrel 60 cm", "Once a week", "Twice a week", "Every 2 days"],
        ],
      },

      { type: "list", title: "Wind, weight & balcony safety",
        items: [
          "A 40 L pot full of wet soil weighs ~50 kg. Check your balcony load rating before clustering multiple big tubs.",
          "Use pot feet to stop puddling on tiles — saves the surface and the downstairs neighbour.",
          "On exposed balconies, group pots in clusters (they shelter each other) and stake any climbers low and tight.",
          "Saucers under pots are great in summer (water reservoir), terrible in winter (root rot). Lift them off in October.",
          "If your balcony is a wind tunnel, build a windbreak with a tall climbing screen (sweet peas, runner beans) on the windward side — the plants themselves become your shelter.",
        ],
      },

      { type: "table", title: "Troubleshooting — when small spaces fight back",
        headers: ["Symptom", "Cause", "Fix"],
        rows: [
          ["Tomato leaves curl up and go pale", "Pot too small or root-bound; soil temperature swings", "Re-pot one size up; add a 2 cm mulch layer to even out heat."],
          ["Lettuce bolts in 3 weeks", "Pot in full afternoon sun; soil drying repeatedly", "Move to a 2–4 hour spot; sow successionally every 3 weeks for fresh leaves."],
          ["Hanging basket goes crispy by noon", "Basket too small / no water-retentive gel", "Soak the whole basket weekly; switch to a 35 cm basket; add coir + gel crystals."],
          ["Tall climbers fall over in wind", "Pot too light at the base", "Wedge bricks inside the pot's bottom for ballast; lash the cane wigwam to the rail."],
          ["Powdery mildew on cucumber leaves", "Wet evenings + poor airflow", "Water in the morning only; thin out leaves; pinch tips to open the canopy."],
          ["Chilli flowers but no fruit forms", "Not enough pollinator visits on a high balcony", "Tap the flower stems gently at midday, or use a soft brush to dab between flowers (hand-pollinate)." ],
        ],
      },

      { type: "prose", title: "The 4-pot starter plan (if you only have a tiny balcony)",
        body: "Pot 1 — 40 L: one cordon tomato + basil at the base (best summer crop in a small space). Pot 2 — 30 cm hanging basket: tumbling tomato or strawberries (steals zero floor space). Pot 3 — 60 cm trough on a railing: cut-and-come-again salads, sown in 3 patches 3 weeks apart for a 4-month harvest. Pot 4 — 30 cm pot: a single chilli or sweet pepper plant (ornamental, productive, freezes well). Total cost: ~£40. Total food: enough fresh salad and herbs from May to October, plus 80+ tomatoes and a year's worth of chilli — for less than a single weekly veg-box delivery." },

      { type: "list", title: "Five small-space rules worth remembering",
        items: [
          "Deeper pots beat wider pots — root depth = drought resilience.",
          "Grow up before you grow out. Vertical is free real estate.",
          "Pick fewer crops, treat them better. One healthy tomato beats four sad ones.",
          "Water in the morning. Wet leaves overnight is mildew's invitation.",
          "Match the crop to the light, not the other way around. You can't make a north-facing balcony grow tomatoes.",
        ],
      },

      { type: "cta",
        href: "/plants",
        eyebrow: "Browse 332 plants",
        title: "Find plants sized for your space",
        body: "Every plant in the catalogue is tagged with the smallest pot size that still produces well. Filter by herb, leafy, fruit, or special collections and pick what fits your sunniest corner.",
        cta: "Open the plant library",
      },
    ],
  },

  regrow: {
    label: "Zero waste",
    title: "Regrow from Scraps",
    icon: Recycle,
    intro: "Save money and reduce waste by regrowing from kitchen scraps.",
    image:
      "https://images.unsplash.com/photo-1580133318324-f2f76d987dd8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w8NjA1NzR8MHwxfHNlYXJjaHwxfHxwbGFudCUyMGxlYWYlMjBjbG9zZSUyMHVwJTIwdGV4dHVyZXxlbnwwfHx8fDE3ODE0NjI5MzJ8MA&ixlib=rb-4.1.0&q=85",
    sections: [
      { type: "cta",
        href: "/regrow-from-scraps",
        eyebrow: "Browse the catalogue",
        title: "31 plants, hand-graded for honesty",
        body: "Every plant in this guide is rated 1–5★ on whether it's actually worth the windowsill space. Browse all 31 with method, expected yield and days-to-first-harvest.",
        cta: "Open the regrow catalogue",
      },

      { type: "prose", title: "What 'regrow' actually means",
        body: "Most kitchen scraps will sprout — it's keeping them alive past the novelty week that separates a real harvest from a sad bowl of slime. There are three honest paths: stems that root in water and transfer to soil (basil, mint), bases that resprout new leaves from a stub (lettuce, spring onion, celery), and rhizomes or eyes that grow a whole new plant from a node (potato, ginger, garlic). The trick is matching the right method to the right scrap." },

      { type: "tipsgrid", title: "Setting up — three things you need",
        items: [
          { t: "A clean glass jar or jam jar", b: "Cloudy water is bacteria; bacteria is why most cuttings rot. Scrub the jar with hot soapy water before you start, and rinse it out every time you change the water." },
          { t: "Bright, indirect light", b: "South-facing sill if you live in the north hemisphere. Avoid direct hot afternoon sun on a glass jar — it cooks roots and grows algae. East-facing is perfect." },
          { t: "Tepid filtered or rested water", b: "Cold tap water shocks the cut; chlorinated water inhibits root growth. Fill a jug, leave overnight, then use. Change the water every 2–3 days." },
        ],
      },

      { type: "table", title: "Honest method ratings — top 12 to actually grow",
        note: "Ratings combine effort vs. yield vs. how long the plant keeps producing. 5★ = better than buying. 1★ = a cute experiment but not a meal.",
        headers: ["Plant", "Method", "First harvest", "Worth it"],
        rows: [
          ["Spring onion (scallion)", "Water then soil", "5–7 days", "★★★★★"],
          ["Basil cutting", "Water then soil", "10–14 days roots", "★★★★★"],
          ["Mint cutting", "Water then soil", "7–10 days roots", "★★★★★"],
          ["Lettuce base", "Soil only", "10–14 days", "★★★☆☆"],
          ["Celery base", "Water then soil", "14–21 days", "★★★☆☆"],
          ["Pak choi / bok choy base", "Water then soil", "10–14 days", "★★★★☆"],
          ["Coriander stems", "Water then soil", "10–14 days roots", "★★★★☆"],
          ["Garlic clove (sprouted)", "Soil only", "10–14 days (green)", "★★★☆☆"],
          ["Ginger rhizome", "Soil only", "21–30 days", "★★★☆☆"],
          ["Potato (sprouted eye)", "Soil only", "8–10 weeks", "★★★★☆"],
          ["Sweet potato slip", "Water then soil", "14–21 days", "★★★★☆"],
          ["Pineapple top", "Soil only", "18–24 months", "★☆☆☆☆"],
        ],
      },

      { type: "steps", title: "The water-then-soil method (basil, mint, coriander, scallions)",
        items: [
          "Pick a healthy 8–12 cm tip cutting with at least 3 leaf nodes; snip just below a node with sharp clean scissors.",
          "Strip the lower 2/3 of leaves so only the top 2–4 stay. Submerged leaves rot fast and ruin the water.",
          "Stand the cutting in a glass jar with 4–5 cm of tepid water. Change every 2–3 days.",
          "Wait for roots to reach 3–5 cm — usually 7–14 days. Don't rush; weak roots fail in soil.",
          "Transplant into a 9 cm pot of peat-free compost. Water in deeply, keep humid for the first week (a clear bag over the top helps).",
        ],
        footer: "Why two stages? Water roots are fragile and white; soil roots are tougher and brown. Letting them grow in water first means you can SEE progress before committing to a pot.",
      },

      { type: "steps", title: "The base-resprout method (lettuce, celery, pak choi)",
        items: [
          "Keep the bottom 3–4 cm of the head intact, including the woody core.",
          "Sit it cut-side up in a shallow saucer with just 1 cm of water — enough to touch the base, not submerge it.",
          "Place on a bright sill and refresh the water daily. You'll see new green leaves in the centre within 4–7 days.",
          "Once the new leaves are 3–4 cm tall, plant the whole base in shallow soil with the new shoots above ground.",
          "Harvest cut-and-come-again style from the outside leaves — one base will give 2–3 small harvests before it bolts.",
        ],
        footer: "Honest note: a regrown lettuce won't ever match a fresh seed-grown plant for volume — but it gets you garnish-sized leaves in 10 days, for free.",
      },

      { type: "list", title: "Best kid-friendly regrows (fast wins)",
        items: [
          "Spring onion in a shot glass — visible green within 48 hours, eaten in a week.",
          "Avocado pit suspended on toothpicks — takes a month but the visual is magic.",
          "Sweet potato slips on a windowsill — the leaves alone are edible and trail beautifully.",
          "A sprouted garlic clove — sturdy green shoots that taste like mild garlic, perfect for snipping into pasta.",
          "Lentil microgreens (technically not a scrap, but uses dried lentils from the cupboard) — green shoots in 4 days.",
        ],
      },

      { type: "table", title: "Troubleshooting — when it goes wrong",
        headers: ["Symptom", "Cause", "Fix"],
        rows: [
          ["Water turns cloudy in a day", "Bacterial bloom from submerged leaves or old water", "Strip more leaves, rinse the jar with hot water, switch to bottled water for the first week."],
          ["Stem rots at the waterline", "Stem damaged when cut, or jar too warm", "Re-cut 2 cm above the rot with a clean knife. Move to a cooler spot out of direct sun."],
          ["White fuzzy mould on cutting", "High humidity + low airflow", "Throw it out. Don't try to save it — the mould has already reached the inner stem."],
          ["Roots form but plant dies in soil", "Transplant shock — water roots can't drink from soil", "Pot up sooner (3 cm roots, not 10 cm). Cover with a clear bag for 4–5 days. Keep out of direct sun for 2 weeks."],
          ["Slow / no roots after 3 weeks", "Cutting too woody, or no node in water", "Re-cut just below a node. Soft green cuttings root 3–4× faster than woody ones."],
          ["Lettuce base goes slimy", "Water level too high", "Only 1 cm of water — the base wicks moisture up; it doesn't need to sit in a puddle."],
        ],
      },

      { type: "prose", title: "What WON'T work (sorry Pinterest)",
        body: "Mango pits sprout but take 5–8 years to fruit indoors and rarely produce. Apple seeds sprout but the resulting tree is genetically random and almost always inedible. Tomato seeds from a supermarket tomato will sprout but most are F1 hybrids — the fruit, if any, won't match the parent. Onion bulbs from the bag will sprout green but the bulb itself is done; you'll get scallion-sized shoots, not new onions. Save your sill space for things that pay you back." },

      { type: "list", title: "Pro moves for serious regrowers",
        items: [
          "Rotate your sill — every plant prefers a different intensity. Basil wants bright; lettuce wants cool.",
          "Use rainwater or filtered water for water-stage rooting if your tap water is heavily chlorinated.",
          "Once a cutting roots, keep the parent and use it as a 'mother' for endless future cuttings — one good basil plant can spawn 30 new ones across a season.",
          "Keep a rooting jar going year-round. Even in winter, you'll always have something fresh to snip into a meal.",
        ],
      },

      { type: "prose", title: "The honest takeaway",
        body: "Regrowing is at its best for soft herbs, alliums and leafy bases — the things you use a little of, often, and pay over the odds for at the shop. It's a fun hobby for tomatoes and pineapples but not a real food source. Pick three workhorses (spring onion, basil, mint), nail them, and you'll save more than the cost of every gardening book you ever bought." },

      { type: "cta",
        href: "/regrow-from-scraps",
        eyebrow: "Browse all 31",
        title: "See every plant ranked by yield",
        body: "Now you've read the theory — see all 31 regrowable plants in the catalogue, each with full method, expected yield, days-to-harvest, and an honest 1–5★ rating.",
        cta: "Open the regrow catalogue",
      },
    ],
  },

  "cut-flowers": {
    label: "Bring colour home",
    title: "Cut Flowers",
    icon: Flower2,
    intro:
      "Compact, container-friendly cut flower growing — soil mixes, sowing timings, bulb lasagnes, arranging tips and simple colour palettes.",
    image:
      "https://images.unsplash.com/photo-1745063537934-e6bf484d72eb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTF8MHwxfHNlYXJjaHwxfHx1cmJhbiUyMGdhcmRlbmluZyUyMHNtYWxsJTIwc3BhY2UlMjBiYWxjb255JTIwcGxhbnRzfGVufDB8fHx8MTc4MTQ2MjkzMnww&ixlib=rb-4.1.0&q=85",
    pdfs: [
      { label: "Cut Flower Journal (PDF)", href: `${API_BASE}/api/guide-pdf/cut-flower-journal` },
      { label: "Arranging & Colour Guide (PDF)", href: `${API_BASE}/api/guide-pdf/arranging-and-colour-guide` },
    ],
    sections: [
      { type: "cta",
        href: "/cut-flowers",
        eyebrow: "Browse the catalogue",
        title: "22 vase-tested cut flowers",
        body: "Every flower in the catalogue has honest vase-life in days, the exact stage to cut at, and how to condition each stem — sorted by longest-lasting first.",
        cta: "Open the cut-flower catalogue",
      },

      { type: "prose", title: "Why grow cut flowers?",
        body: "Flowers brighten rooms, mark the seasons, and offer mindful, steady routines — sow, water, pick, arrange. They also feed bees and hoverflies, making edible crops nearby more productive." },
      { type: "tags", items: ["Low-cost joy", "Pollinator-friendly", "Mindful routine", "Any space works"] },

      { type: "vasetips", title: "What to add to your vase (and what to skip)",
        intro: "There's a real chemistry to keeping cut flowers fresh — sugar to feed the bloom, a mild acid to keep water flowing up the stem, and a touch of bleach to stop the bacteria that block it. Skip the pennies, vodka and hairspray you'll see online — none of it outperforms what's already in your kitchen.",
        items: [
          { t: "Make your own flower food",
            b: "Per litre of cool water: 1 tsp sugar (food), 1 tsp white vinegar OR 2 tsp lemon juice (acid, helps stems drink), and ¼ tsp household bleach (kills the bacteria that clog stems). It outperforms most sachets and costs nothing." },
          { t: "Refresh every 2 days",
            b: "Empty the vase, rinse off any slime, refill with fresh food-and-water. Cloudy water is bacteria — and bacteria is the single biggest reason flowers wilt early." },
          { t: "Re-cut stems at a 45° angle",
            b: "Cut 1–2 cm off every stem at a 45° angle under running water before they go in the vase, and again every refill. The angle gives more surface area to drink; an underwater cut stops air bubbles blocking the stem." },
          { t: "Strip any leaves below the water",
            b: "Submerged leaves rot fast and turn the water into bacterial soup within a day. Take everything off the bottom third of the stem — even if it feels brutal." },
          { t: "Keep them cool",
            b: "Out of direct sun, away from radiators, off the top of the TV. Florists store flowers at 2–5 °C overnight; mimic this by moving the vase to a cool hallway or porch before bed." },
          { t: "Away from the fruit bowl",
            b: "Ripening fruit (bananas, apples, tomatoes especially) gives off ethylene — a gas that signals petals to age. A bouquet next to a fruit bowl can die in half the time." },
          { t: "Spring bulbs like cold water",
            b: "Tulips, daffodils, hyacinths and ranunculus last longest in cold water — and tulips will keep growing in the vase, so leave room for them to stretch 5–10 cm taller." },
          { t: "Start with a spotless vase",
            b: "Scrub the vase with hot soapy water (or a quick swish of bleach solution) before every arrangement. Last week's bacteria film is invisible — and it'll halve the life of your fresh stems." },
        ],
        footer: "One caveat: daffodil and narcissus stems leak a sap that's toxic to other flowers. Stand them on their own for 6 hours in fresh water before adding to a mixed arrangement, and don't re-cut once mixed.",
      },

      { type: "prose", title: "Grow anywhere: containers beyond pots",
        body: "Improvised and upcycled containers work beautifully — sturdy tins and food buckets with 4–6 drainage holes, wooden fruit crates lined with hessian, colanders and old drawers, even guttering runs on fences for trailing violas and alyssum. Stability first: use wide bases and ties for balconies and rails, and add bricks in the bottom for wind safety." },

      { type: "table", title: "Container sizes that work",
        headers: ["Container", "Best for", "Count"],
        rows: [
          ["Window box 3–5 L", "Calendula, cornflower, nigella", "3–5"],
          ["10 L bucket", "Snapdragon dwarf, scabious", "3"],
          ["20 L tub", "Cosmos tall, rudbeckia", "3"],
          ["40 L tub", "Single dahlia or tall sunflower (stake)", "1–2"],
          ["80–100 cm trough", "Mixed annuals + mesh support", "8–12"],
        ],
      },

      { type: "prose", title: "Soil mix & feeding",
        body: "A reliable container mix: 60% peat-free compost, 30% fine bark or composted wood fibre, 10% perlite or grit for drainage, plus slow-release fertiliser (10–12 weeks). Feeding rhythm: water only for the first 4 weeks, then weekly liquid feed at half strength. Heavy feeders like dahlia and zinnia want twice-weekly feeds in hot spells. Top-dress mid-season with 1–2 cm of fresh compost." },

      { type: "list", title: "What to grow — compact, pot-friendly",
        items: [
          "Hardy annuals (cool-tolerant): calendula, cornflower, nigella, ammi, scabious, dill, larkspur. Autumn sow in mild regions; spring sow elsewhere.",
          "Half-hardy: cosmos, snapdragon, rudbeckia, zinnia (warm), celosia (very warm), dwarf sunflowers. Plant out when nights stay above 8–10°C.",
          "Perennial & biennial stars: salvias (nemorosa, microphylla), wallflowers, lavender, sweet William, compact foxglove. Salvias bring long bloom and pollinators; wallflowers bring spring scent.",
        ],
      },

      { type: "list", title: "Bulbs, corms & tubers",
        items: [
          "Spring: tulips (plant November for tall stems), narcissus, alliums.",
          "Summer: lilies (stake), gladioli (stagger plantings every 2 weeks), dahlias (1 per 40 L tub).",
          "Drainage: pot feet and deep soaks — never let them sit in water.",
        ],
      },

      { type: "steps", title: "Bulb lasagne — one pot, months of colour",
        items: [
          "Choose a 30–40 cm deep pot with large drainage holes.",
          "Base layer: 10–12 cm compost, then your largest bulbs (tulips), points up.",
          "Middle layer: 5–7 cm compost, mid bulbs (narcissus).",
          "Top layer: 5–7 cm compost, small bulbs (crocus, muscari).",
          "Finish with 5–7 cm compost, water in, and add winter violas on top if you like.",
        ],
        footer: "Stagger bloom times: early crocus → mid narcissus → late tulip for a rolling show.",
      },

      { type: "list", title: "All-year colour",
        items: [
          "Spring: tulips, narcissus, wallflowers, early alliums.",
          "Summer: sweet peas, cosmos, cornflower, calendula, salvias.",
          "Autumn: dahlias, rudbeckia, late salvias, chrysanthemums.",
          "Winter: berried stems, evergreen foliage, hellebores in pots.",
        ],
      },

      { type: "palettes", title: "Simple colour palettes",
        items: [
          { name: "Pastel Meadow", swatches: ["#F5C6C6", "#F4D9A6", "#E5E7CD", "#C9D6E2"],
            notes: "Sweet peas (pinks), cosmos 'Apricot Lemonade', nigella, scabiosa." },
          { name: "Hot & Happy", swatches: ["#E0492C", "#E89712", "#C9303E", "#8E2D2D"],
            notes: "Zinnia mix, rudbeckia, calendula 'Indian Prince', salvia 'Hot Lips'." },
          { name: "Cool Calm", swatches: ["#4F6FA8", "#EFEFEA", "#7AA37E", "#6A6BA0"],
            notes: "Cornflower, ammi, white cosmos, lavender, salvia nemorosa." },
        ],
        footer: "Pick one base + one accent + one highlight and repeat across containers for cohesion.",
      },

      { type: "list", title: "Arranging — from mini to statement",
        items: [
          "Mini jars & posies: sweet peas, violas, small cosmos, herbs. Cut in the cool; strip leaves below the water line.",
          "Kitchen jug: cosmos, salvias, calendula, wallflowers, ammi. One 'air' element (ammi, grasses) keeps it light.",
          "Statement vase: dahlias, gladioli, lilies. Add foliage structure first. Odd numbers (3, 5, 7) of focal stems work well.",
          "Conditioning: re-cut stems under water, rest 2–4 hours cool. A pinch of sugar + citric acid + tiny bleach makes a passable preservative.",
        ],
      },

      { type: "table", title: "Sowing & planting calendar",
        note: "Shift timings 2–3 weeks later in colder/windy regions, or 2–3 weeks earlier in mild conditions or under cover.",
        headers: ["Plant", "Sow indoors", "Sow direct", "Plant out", "Bulb / tuber", "Notes"],
        rows: [
          ["Calendula", "Feb–Apr", "Mar–Jun; Sep*", "Apr–Jun", "—", "*Autumn sow only in mild areas."],
          ["Cornflower", "Feb–Apr", "Mar–May; Sep", "Apr–May", "—", "Full sun; good drainage."],
          ["Nigella", "Feb–Apr", "Mar–May; Aug–Sep", "Apr–May", "—", "Hates root disturbance — sow in final pot."],
          ["Ammi majus", "Feb–Apr", "Mar–May; Sep", "Apr–May", "—", "Stake early; cool-tolerant."],
          ["Scabiosa", "Feb–Apr", "Apr–May", "May–Jun", "—", "Guard against slugs."],
          ["Cosmos", "Mar–Apr", "May–Jun*", "Late May–Jun", "—", "Pinch at 15 cm for bushier plants."],
          ["Zinnia", "Apr", "Late May–Jun (warm)", "Late May–Jun", "—", "Heat lovers; nights > 10°C."],
          ["Snapdragon", "Jan–Mar", "Apr–May (south)", "May–Jun", "—", "Cool-tolerant blooms."],
          ["Sunflower (dwarf)", "Mar–Apr", "Apr–May", "May–Jun", "—", "Stake from planting; 1 per 20 L+ tub."],
          ["Wallflower", "Jun–Jul", "Jun–Jul", "Sep–Oct", "—", "Scented spring."],
          ["Sweet William", "Jun–Jul", "Jun–Jul", "Sep–Oct", "—", "Great for spring cutting."],
          ["Salvia nemorosa", "Feb–Apr", "—", "May–Jun", "—", "Trim after each flush; bee magnet."],
          ["Lavender", "Feb–Mar", "—", "Apr–May", "—", "Gritty mix; full sun."],
          ["Tulips", "—", "—", "—", "Oct–Dec", "Plant 2–3× bulb depth; 20 cm+ pot."],
          ["Narcissus", "—", "—", "—", "Sep–Nov", "Compact types excel in pots."],
          ["Allium", "—", "—", "—", "Sep–Oct", "Deep pots; underplant with violas."],
          ["Lilies", "—", "—", "—", "Feb–Apr", "Stake early; free-draining."],
          ["Gladioli", "—", "—", "—", "Apr–Jun (stagger)", "Plant in 2-week waves."],
          ["Dahlias", "Feb–Apr", "—", "May–Jun", "Apr–May", "1 per 40 L; lift in cold regions."],
        ],
      },

      { type: "prose", title: "Shortcut",
        body: "When in doubt, sow later. A strong May planting often beats a weak early start." },

      { type: "cta",
        href: "/cut-flowers",
        eyebrow: "Browse all 22",
        title: "See every cut flower with full vase-life data",
        body: "Now you've read the theory — see all 22 vase-tested cut flowers, each with honest vase-life in days, the exact stage to cut at, and how to condition each stem.",
        cta: "Open the cut-flower catalogue",
      },
    ],
  },

  companion: {
    label: "Plants helping plants",
    title: "Companion Planting",
    icon: HandHelping,
    intro:
      "Match water and light needs, invite pollinators, and steer pests away with clever pairings — perfect for pots and small spaces.",
    image:
      "https://images.unsplash.com/photo-1566249099725-1b0ce8da8c32?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzR8MHwxfHNlYXJjaHwyfHxwbGFudCUyMGxlYWYlMjBjbG9zZSUyMHVwJTIwdGV4dHVyZXxlbnwwfHx8fDE3ODE0NjI5MzJ8MA&ixlib=rb-4.1.0&q=85",
    sections: [
      { type: "list", title: "Great combos",
        items: [
          "Tomato + Basil — flavour and shared care.",
          "Chilli + Marigold (tagetes) — pulls pollinators and confuses pests.",
          "Kale + Chives — where aphids lurk.",
          "Carrot + Spring onion — muddle carrot fly with onion scent.",
          "Strawberry + Thyme — bee traffic and dry-loving partners.",
          "French beans + Nasturtiums — lure aphids away and give edible flowers.",
        ],
      },
      { type: "list", title: "Things to avoid",
        items: [
          "Overcrowding — blocks airflow and invites mildew.",
          "Mismatched thirst — rosemary with basil rarely ends well.",
          "Deep roots with shallow in tiny pots — they compete hard.",
          "Tomatoes with potatoes in containers — disease crossover and space clash.",
        ],
      },
      { type: "prose", title: "Pollinator boost",
        body: "Add edible flowers — nasturtiums, calendula, violas. Let a few herbs bloom (basil, chives, oregano, thyme). Keep sprays away: try hand removal, water blasts and sticky cards first." },

      { type: "table", title: "Container pairings by pot size",
        headers: ["Pot", "Plant together", "Why it works", "Skip"],
        rows: [
          ["Window box 5–7 L", "Parsley + Chives + Viola", "Shallow, frequent snips; bee-friendly faces.", "Tomato — too thirsty/top heavy."],
          ["10–12 L", "Chilli + Basil OR Salad + Radish", "Warmth lovers that share watering rhythm.", "Mint — spreads aggressively."],
          ["20 L", "Tomato (bush) + Basil + Marigold", "Classic trio; flowers bring pollinators.", "Potato — blight risk."],
          ["40 L tub", "Courgette + Nasturtiums (edge)", "Nasturtiums trail, draw aphids, and you can eat the flowers.", "A second courgette."],
        ],
      },

      { type: "list", title: "Mini 'guilds' by goal",
        items: [
          "Pest deterrence: Brassicas + chives/garlic chives; Beans + nasturtiums; Lettuce + dill (hoverflies).",
          "Flavour & yield: Tomato + basil; Strawberry + thyme; Cucumber + dill.",
          "Shade & living mulch: Chilli + oregano (drapes and cools); Courgette + low nasturtiums.",
          "Nutrient helpers: Peas/beans followed by leafy greens in the same tub after top-up.",
        ],
      },
      { type: "prose", title: "Rotation & hygiene in pots",
        body: "Don't grow tomatoes in the same tub two years running — follow with salads or flowers and refresh a third of the mix. Lift tired roots after harvest, top up with fresh compost and a small handful of slow-release feed. Wipe stakes and clips before re-using, especially after blight or mildew." },

      { type: "prose", title: "Rule of thumb",
        body: "If two plants enjoy the same sun and watering routine, they're good candidates to share a pot. Healthy space beats the 'right' combo squashed in." },
    ],
  },
};

const ORDER = ["first-pot", "space-saving", "regrow", "cut-flowers", "companion"];

// Map guide slugs to their matching home.feature.* i18n key prefix.
const GUIDE_I18N_KEY = {
  "first-pot": "first_pot",
  "space-saving": "space_saving",
  "regrow": "regrow",
  "cut-flowers": "cut_flowers",
  "companion": "companion",
};

export default function GuidesPage() {
  const { slug } = useParams();
  const { t } = useI18n();

  if (!slug) {
    return (
      <div className="animate-fade-up">
        <PageHero
          variant="forest"
          eyebrow={t("guides.eyebrow")}
          title={t("guides.title")}
          blurb={t("guides.intro")}
          Motif={SeedlingMotif}
        />
        <div className="container-narrow py-10 md:py-14">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ORDER.map((id) => {
            const g = GUIDES[id];
            const Icon = g.icon;
            const i18nId = GUIDE_I18N_KEY[id];
            const cardLabel = i18nId ? t(`home.feature.${i18nId}.label`) : g.label;
            const cardTitle = i18nId ? t(`home.feature.${i18nId}.title`) : g.title;
            const cardBlurb = i18nId ? t(`home.feature.${i18nId}.blurb`) : g.intro;
            return (
              <Link
                key={id}
                to={`/guides/${id}`}
                data-testid={`guide-card-${id}`}
                className="card-flat overflow-hidden flex flex-col"
              >
                <div className="aspect-[4/3] overflow-hidden">
                  <img src={g.image} alt={cardTitle} className="object-cover w-full h-full" />
                </div>
                <div className="p-6 flex flex-col flex-1">
                  <div className="flex items-center gap-3">
                    <Icon strokeWidth={1.5} className="w-4 h-4 text-terracotta" />
                    <span className="overline">{cardLabel}</span>
                  </div>
                  <h3 className="font-serif text-3xl text-forest mt-3">{cardTitle}</h3>
                  <p className="text-sm text-ink/70 mt-3 flex-1">{cardBlurb}</p>
                  <span className="mt-6 inline-flex items-center gap-2 text-forest text-sm tracking-wider uppercase">
                    {t("home.feature.open_guide")} <ArrowRight strokeWidth={1.5} className="w-4 h-4" />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
        </div>
      </div>
    );
  }

  const guide = GUIDES[slug];
  if (!guide) {
    return <div className="container-narrow py-16 text-terracotta">{t("guides.not_found")}</div>;
  }
  const Icon = guide.icon;
  const i18nId = GUIDE_I18N_KEY[slug];
  const headerLabel = i18nId ? t(`home.feature.${i18nId}.label`) : guide.label;
  const headerTitle = i18nId ? t(`home.feature.${i18nId}.title`) : guide.title;
  const headerIntro = i18nId ? t(`home.feature.${i18nId}.blurb`) : guide.intro;

  return (
    <article className="animate-fade-up">
      <PageHero
        variant="forest"
        eyebrow={headerLabel}
        title={headerTitle}
        blurb={headerIntro}
        Motif={HarvestMotif}
        actions={
          <Link
            to="/guides"
            data-testid="back-to-guides"
            className="inline-flex items-center gap-2 py-2.5 px-4 border border-sand/40 text-sand hover:bg-sand/10 transition-colors text-sm"
            style={{ borderRadius: "9999px" }}
          >
            <ArrowLeft strokeWidth={1.5} className="w-4 h-4" /> {t("guides.all_guides")}
          </Link>
        }
      />
      <div className="container-narrow py-10 md:py-14 max-w-4xl">

      <div className="aspect-[16/9] overflow-hidden border border-border mb-10">
        <img src={guide.image} alt={headerTitle} className="object-cover w-full h-full" />
      </div>

      {guide.pdfs && guide.pdfs.length > 0 && (
        <div className="border border-border bg-surface p-5 mb-10 flex flex-wrap gap-3">
          <p className="overline w-full">{t("guides.downloads")}</p>
          {guide.pdfs.map((p) => (
            <LockedPdfButton key={p.href} href={p.href} label={p.label} />
          ))}
        </div>
      )}

      <div className="space-y-10">
        {guide.sections.map((s, i) => (
          <SectionBlock key={`${s.type}-${s.title || i}`} section={s} />
        ))}
      </div>
      </div>
    </article>
  );
}

function SectionBlock({ section }) {
  if (section.type === "tags") {
    return (
      <div className="flex flex-wrap gap-2">
        {section.items.map((t) => (
          <span key={t} className="text-xs px-3 py-1.5 border border-border bg-surface text-moss tracking-wider uppercase">
            {t}
          </span>
        ))}
      </div>
    );
  }

  if (section.type === "table") {
    return (
      <section>
        {section.title && <h2 className="font-serif text-3xl text-forest mb-3">{section.title}</h2>}
        {section.note && <p className="text-sm text-moss mb-4 italic">{section.note}</p>}
        <div className="overflow-x-auto border border-border">
          <table className="w-full text-sm">
            <thead className="bg-surface">
              <tr>
                {section.headers.map((h) => (
                  <th key={h} className="text-left font-medium text-forest px-4 py-3 border-b border-border tracking-wider uppercase text-xs">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {section.rows.map((row, idx) => (
                <tr key={`row-${row[0] || idx}`} className="border-b border-border last:border-b-0">
                  {row.map((cell, ci) => (
                    <td key={`cell-${ci}`} className={`px-4 py-3 ${ci === 0 ? "font-medium text-ink" : "text-ink/80"}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    );
  }

  if (section.type === "list") {
    return (
      <section>
        {section.title && <h2 className="font-serif text-3xl text-forest mb-4">{section.title}</h2>}
        <ul className="space-y-3">
          {section.items.map((it) => (
            <li key={it} className="flex gap-3 text-ink/80 leading-relaxed">
              <span className="text-terracotta mt-1.5 w-1 h-1 bg-terracotta rounded-full flex-shrink-0" />
              <span>{it}</span>
            </li>
          ))}
        </ul>
      </section>
    );
  }

  if (section.type === "steps") {
    return (
      <section>
        {section.title && <h2 className="font-serif text-3xl text-forest mb-4">{section.title}</h2>}
        <ol className="space-y-4">
          {section.items.map((it, i) => (
            <li key={it} className="flex gap-4 leading-relaxed">
              <span className="font-serif text-2xl text-terracotta flex-shrink-0 w-8">{i + 1}</span>
              <span className="text-ink/80 pt-1">{it}</span>
            </li>
          ))}
        </ol>
        {section.footer && <p className="text-sm text-moss mt-5 italic">{section.footer}</p>}
      </section>
    );
  }

  if (section.type === "palettes") {
    return (
      <section>
        {section.title && <h2 className="font-serif text-3xl text-forest mb-5">{section.title}</h2>}
        <div className="grid sm:grid-cols-3 gap-5">
          {section.items.map((p) => (
            <div key={p.name} className="card-flat p-5">
              <h3 className="font-serif text-2xl text-forest">{p.name}</h3>
              <div className="flex gap-1.5 mt-4 mb-4">
                {p.swatches.map((c) => (
                  <span key={c} className="w-8 h-12 border border-border" style={{ backgroundColor: c }} />
                ))}
              </div>
              <p className="text-sm text-ink/75 leading-relaxed">{p.notes}</p>
            </div>
          ))}
        </div>
        {section.footer && <p className="text-sm text-moss mt-5 italic">{section.footer}</p>}
      </section>
    );
  }

  if (section.type === "vasetips") {
    // Numbered grid of tips — used for the "What to add to your vase" section.
    return (
      <section className="border-y border-border py-10" data-testid="guide-vasetips">
        <div className="flex items-center gap-3 mb-2">
          <Lightbulb strokeWidth={1.4} className="w-5 h-5 text-terracotta" />
          <p className="overline">Make flowers last longer</p>
        </div>
        {section.title && (
          <h2 className="font-serif text-3xl md:text-4xl text-forest tracking-tight mb-3">
            {section.title}
          </h2>
        )}
        {section.intro && (
          <p className="text-ink/75 max-w-2xl leading-relaxed mb-8">{section.intro}</p>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-8 gap-y-6">
          {section.items.map((tip, i) => (
            <div key={tip.t} className="flex gap-3">
              <span className="font-serif text-2xl text-terracotta flex-shrink-0 w-7 leading-none mt-1">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <h3 className="font-serif text-lg text-forest leading-snug">{tip.t}</h3>
                <p className="text-sm text-ink/75 mt-1.5 leading-relaxed">{tip.b}</p>
              </div>
            </div>
          ))}
        </div>
        {section.footer && (
          <p className="text-xs text-moss mt-8 italic max-w-2xl">{section.footer}</p>
        )}
      </section>
    );
  }

  if (section.type === "tipsgrid") {
    // Compact 3-up tip cards — used inside Regrow for "Setting up" etc.
    return (
      <section>
        {section.title && <h2 className="font-serif text-3xl text-forest mb-5">{section.title}</h2>}
        <div className="grid sm:grid-cols-3 gap-5">
          {section.items.map((tip) => (
            <div key={tip.t} className="card-flat p-5">
              <h3 className="font-serif text-xl text-forest leading-snug">{tip.t}</h3>
              <p className="text-sm text-ink/75 mt-3 leading-relaxed">{tip.b}</p>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (section.type === "cta") {
    // Inline CTA panel that links to the rich data catalogue page.
    return (
      <section className="bg-forest text-sand px-6 py-8 sm:px-8 sm:py-10" data-testid={`guide-cta-${(section.href || '').replace(/\//g, '')}`}>
        {section.eyebrow && (
          <p className="overline text-sand/70">{section.eyebrow}</p>
        )}
        <h2 className="font-serif text-3xl md:text-4xl text-sand tracking-tight mt-2">
          {section.title}
        </h2>
        {section.body && (
          <p className="text-sand/85 leading-relaxed mt-3 max-w-2xl">{section.body}</p>
        )}
        <Link
          to={section.href}
          className="mt-6 inline-flex items-center gap-2 bg-sand text-forest px-5 py-3 text-sm tracking-wider uppercase hover:bg-white transition-colors"
        >
          {section.cta || "Open"}
          <ArrowRight strokeWidth={1.5} className="w-4 h-4" />
        </Link>
      </section>
    );
  }

  // prose (default)
  return (
    <section>
      {section.title && <h2 className="font-serif text-3xl text-forest mb-3">{section.title}</h2>}
      <p className="text-ink/80 leading-relaxed text-lg">{section.body}</p>
    </section>
  );
}

function LockedPdfButton({ href, label }) {
  const { paid } = usePaywall();
  const [showModal, setShowModal] = useState(false);
  const testId = `pdf-${href.split("/").pop()}`;

  if (paid) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        data-testid={testId}
        className="inline-flex items-center gap-2 btn-forest"
      >
        <FileDown strokeWidth={1.5} className="w-4 h-4" /> {label}
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        data-testid={testId}
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-2 btn-forest opacity-90"
      >
        <Lock strokeWidth={1.5} className="w-4 h-4" /> {label}
      </button>
      {showModal && (
        <PaywallModal
          onClose={() => setShowModal(false)}
          onUnlocked={() => setShowModal(false)}
        />
      )}
    </>
  );
}

