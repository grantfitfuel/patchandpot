/* eslint-disable max-lines */
// Patch & Pot — Masterclass content.
// Three deep, structured courses with 6–8 lessons each. Content is authored
// (not AI-generated) so it stays trustworthy and consistent across sessions.

import { Sprout, Bug, HeartPulse } from "lucide-react";

export const MASTERCLASSES = {
  propagation: {
    slug: "propagation",
    title: "Propagation",
    tagline: "Turn one plant into many — from cuttings, division, layering and seed.",
    icon: Sprout,
    image:
      "https://images.unsplash.com/photo-1580133318324-f2f76d987dd8?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzR8MHwxfHNlYXJjaHwxfHxwbGFudCUyMGxlYWYlMjBjbG9zZSUyMHVwJTIwdGV4dHVyZXxlbnwwfHx8fDE3ODE0NjI5MzJ8MA&ixlib=rb-4.1.0&q=85",
    duration: "About 45 minutes",
    lessons: [
      {
        slug: "intro",
        title: "Why propagate?",
        eyebrow: "Lesson 1",
        body: [
          "Propagation is the quiet heart of gardening. It is how generations of plants have travelled across windowsills, balconies and gardens — passed hand to hand, free.",
          "Once you can propagate, you stop being a buyer of plants and become a *maker* of them. One pelargonium becomes ten. A neighbour's basil becomes your basil. A friend's rosemary is replanted as your hedge.",
          "There are five propagation methods we'll cover in this masterclass: seed, softwood cuttings, semi-ripe cuttings, division, and layering. Each has its season, each has its plants. You won't need fancy kit — most of it can be done in jam jars and yoghurt pots.",
        ],
        boxes: [
          { label: "What you'll learn", items: [
            "How to choose the right method for the plant in front of you",
            "When in the year to attempt each technique",
            "What 'good roots' look like and when to pot on",
            "How to read failure and adjust without losing the next batch",
          ]},
        ],
      },
      {
        slug: "seed",
        title: "Starting from seed",
        eyebrow: "Lesson 2",
        body: [
          "Seed is the cheapest, most miraculous propagation. A packet of basil seeds costs less than a coffee and yields thirty plants.",
          "The principles are simple: a moist, free-draining seed compost; warmth (most edibles want 18–24°C to germinate); light from the moment the first leaf appears; and patience.",
          "The single biggest mistake is sowing too deep. Most seeds want to be covered by no more than their own thickness — fine seeds (basil, lettuce) only need a dusting of compost.",
        ],
        steps: {
          title: "The reliable indoor sowing routine",
          items: [
            "Fill small pots or modules with fresh seed compost; level the surface.",
            "Water from below — sit the pots in a tray of water for 10 minutes until the surface is dark.",
            "Sow 2–3 seeds per cell; cover lightly; press down gently.",
            "Cover with a clear lid or cling film to hold humidity; place somewhere warm (top of fridge or near a radiator).",
            "Check daily. The moment a green shoot appears, remove the cover and move to bright light.",
            "Thin to the strongest seedling per cell once true leaves appear.",
          ],
        },
        tip: "If your seedlings stretch and flop, they want more light, not more water. Move them closer to a window or under a desk lamp.",
      },
      {
        slug: "softwood-cuttings",
        title: "Softwood cuttings",
        eyebrow: "Lesson 3",
        body: [
          "Softwood cuttings are the easiest place for a new propagator to win. You take a flexible, growing tip from a healthy plant in late spring or early summer, pop it in compost, and within a few weeks you have roots.",
          "Best subjects: basil, mint, lemon balm, oregano, pelargoniums, fuchsias, salvias, lavender (semi-ripe), tomatoes (yes — side shoots root in water in days).",
        ],
        steps: {
          title: "Softwood cuttings, step by step",
          items: [
            "Take a non-flowering shoot 8–12 cm long, in the cool of morning.",
            "Snip cleanly just below a node (where leaves emerge).",
            "Strip the lower two-thirds of leaves; if remaining leaves are large, halve them.",
            "Optional: dip the cut end in rooting hormone (water works fine for soft stems).",
            "Push into damp gritty compost (or a jar of water for very soft stems) so half the cutting is buried.",
            "Cover with a clear bag on sticks to hold humidity. Keep out of direct sun.",
            "Check after 2 weeks — a gentle tug that meets resistance means rooted. Pot on once roots are 2–3 cm.",
          ],
        },
        tip: "If leaves wilt and never recover, the cutting was too soft or too thirsty. Take cuttings earlier in the day, with more wood, and shade the propagator.",
      },
      {
        slug: "division",
        title: "Division",
        eyebrow: "Lesson 4",
        body: [
          "Division is the gardener's superpower: split one mature plant into several, and each new section is already a full plant with roots and crown. There's no waiting for cuttings to root or seeds to germinate.",
          "It works for any plant that grows in a clump from the base: chives, mint, lemongrass, lemon balm, oregano, marjoram, day lilies, hostas, hardy geraniums, fennel.",
        ],
        steps: {
          title: "How to divide cleanly",
          items: [
            "Choose a cool, damp day in spring or autumn — divide while the plant is dormant or just waking.",
            "Lift the whole plant; shake off enough soil to see the roots.",
            "Use two forks back-to-back to lever a large clump apart, or cut smaller crowns with a sharp knife.",
            "Each new piece needs at least one growing shoot and a decent root mass.",
            "Replant immediately at the same depth, water in well, keep shaded for a week.",
          ],
        },
        tip: "Divide chives every 2–3 years and you'll have a lifetime supply — they become more flavourful, not less, with fresh soil.",
      },
      {
        slug: "layering",
        title: "Layering",
        eyebrow: "Lesson 5",
        body: [
          "Layering is the technique nature uses on its own — a low branch touches the soil, roots, and becomes a new plant. We just nudge it along.",
          "Best subjects: strawberries (they layer themselves via runners), thyme, rosemary, sage, climbers and ramblers, brambles, blackcurrants. Anything with a flexible stem that can touch the ground.",
        ],
        steps: {
          title: "Simple ground layering",
          items: [
            "Choose a low, flexible stem. Bend it down to a patch of bare soil or a small pot of compost.",
            "Make a small wound (a 2 cm sliver of bark scraped off, or a shallow nick) where the stem touches the soil.",
            "Pin in place with a U-shaped wire (a paperclip works) and cover with 2–3 cm of compost.",
            "Water in. The parent feeds the layer while it roots — no rush.",
            "After 6–12 weeks, gently pull. If it resists, sever from the parent and dig up the new plant.",
          ],
        },
        tip: "Strawberry runners are nature's own propagation lesson — peg the daughter plantlets into small pots while still attached to mum.",
      },
      {
        slug: "aftercare",
        title: "Aftercare — the part everyone forgets",
        eyebrow: "Lesson 6",
        body: [
          "Most propagation failures happen *after* rooting, not before. The newly-rooted plant is fragile; treat it like a hospital patient until it's clearly thriving.",
          "Pot on into a richer, free-draining compost. Keep shaded for a week. Water from below to avoid disturbing fragile roots. Feed only lightly, only after a fortnight.",
          "Resist the urge to overpot. A plant in a pot too big sits in cold, wet compost and sulks. Step up gradually: 7 cm → 9 cm → 1 L → 3 L.",
        ],
        boxes: [
          { label: "The four-week aftercare checklist", items: [
            "Week 1: shaded, humid, no feed. Top-water the surrounding compost, not the plant itself.",
            "Week 2: introduce dappled light; reduce humidity (remove bag for an hour, then two…).",
            "Week 3: half-strength liquid feed; full light by the end of the week.",
            "Week 4: pot on if roots are filling the pot; treat as an adult.",
          ]},
        ],
      },
    ],
  },

  "pest-control": {
    slug: "pest-control",
    title: "Pest Control",
    tagline: "Identify, prevent, and treat the common pests of pots and small gardens — organic-first.",
    icon: Bug,
    image:
      "https://images.unsplash.com/photo-1566249099725-1b0ce8da8c32?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1NzR8MHwxfHNlYXJjaHwyfHxwbGFudCUyMGxlYWYlMjBjbG9zZSUyMHVwJTIwdGV4dHVyZXxlbnwwfHx8fDE3ODE0NjI5MzJ8MA&ixlib=rb-4.1.0&q=85",
    duration: "About 50 minutes",
    lessons: [
      {
        slug: "principles",
        title: "The five principles of organic pest control",
        eyebrow: "Lesson 1",
        body: [
          "Pest control isn't about a final battle — it's about tipping the daily balance away from pests and towards the predators and conditions that keep them in check.",
          "Healthy plants in healthy compost, with airflow, sun and pollinator-friendly companions, will deal with 90% of pest pressure themselves. Most damage we see is the *symptom* of a plant under stress, not the cause.",
        ],
        boxes: [
          { label: "The five principles", items: [
            "1. Identify before you act — the wrong response makes things worse.",
            "2. Strengthen the host — water, feeding, airflow, sun. A vigorous plant outgrows minor damage.",
            "3. Invite the predators — open flowers (calendula, ammi, fennel), water dishes, no broad sprays.",
            "4. Mechanical first — a finger-and-thumb squish, a jet of water, a sticky trap.",
            "5. Targeted treatment only when needed — soap sprays, neem, beer traps, and bacterial sprays (Bt) for caterpillars.",
          ]},
        ],
        tip: "Walk your patch every morning with a cup of tea. Three minutes of looking catches every problem at week one rather than week three.",
      },
      {
        slug: "aphids",
        title: "Aphids — the universal pest",
        eyebrow: "Lesson 2",
        body: [
          "Aphids are tiny, soft, pear-shaped sap-suckers in green, black, grey or pink. They cluster on new shoots and undersides of leaves. They breed astonishingly fast — but they're equally easy to control.",
          "Damage signs: distorted new growth, sticky 'honeydew' on leaves below, sooty mould on the honeydew, ants farming the colony.",
        ],
        steps: {
          title: "A three-step aphid plan",
          items: [
            "Day 1: blast the colony with a strong jet of water from a spray bottle. Repeat morning and evening for two days.",
            "Day 3: if still present, mix 1 tsp mild liquid soap into 500 ml water and spray underside of leaves at dusk (never in sun).",
            "Day 7: encourage natural enemies — plant calendula, ammi, fennel, or buy in lacewing/ladybird larvae from a garden centre.",
          ],
        },
        boxes: [
          { label: "Plants that pull aphid predators", items: [
            "Calendula — hoverflies",
            "Ammi & dill — lacewings",
            "Yarrow & alyssum — ladybirds",
            "Single-flowered marigolds — parasitic wasps",
          ]},
        ],
      },
      {
        slug: "slugs-snails",
        title: "Slugs and snails — the night raiders",
        eyebrow: "Lesson 3",
        body: [
          "Slugs and snails do most of their damage between 10pm and dawn, when it's cool and damp. By morning, all you see is the silver trail and the holes.",
          "They love seedlings, lettuce, hostas, dahlias and most soft new growth. Containers are safer than open ground, but a balcony with damp pots is still fair game.",
        ],
        steps: {
          title: "A layered defence",
          items: [
            "Inspect pots and trays once a week — flip them and pick off any hiding underneath.",
            "Wool pellets or crushed eggshell rings around vulnerable plants — soft slug bellies dislike the texture.",
            "Beer traps: sink a yoghurt pot, fill with cheap lager, refresh every few days. Highly effective for ground beds.",
            "A nightly torch hunt for 4 nights in a row after rain breaks the population.",
            "Last resort: ferric phosphate slug pellets (the organic-approved kind, NOT metaldehyde) under a propped tile.",
          ],
        },
        tip: "Water in the morning, never at dusk. Damp soil at nightfall is a five-star slug hotel.",
      },
      {
        slug: "caterpillars",
        title: "Caterpillars",
        eyebrow: "Lesson 4",
        body: [
          "The cabbage white butterfly's caterpillars can strip a kale plant in 48 hours. Tomato hornworm and cutworm cause similar drama. The good news: caterpillars are slow, visible, and easy to remove by hand.",
        ],
        boxes: [
          { label: "Identify before you treat", items: [
            "Cabbage white — yellow eggs in clusters, pale green caterpillars on brassicas. Crush eggs weekly.",
            "Tomato hornworm — large green caterpillar with a 'horn'. Hand-pick; check daily.",
            "Cutworm — fat brown grub that severs young seedlings at soil level. Place a cardboard collar around stems.",
            "Codling moth — pinkish grub inside apples. Pheromone traps in spring.",
          ]},
        ],
        steps: {
          title: "Caterpillar control toolkit",
          items: [
            "Fine insect mesh from sowing time over brassicas — physical exclusion is the best defence.",
            "Hand-pick adults at dusk; squash eggs weekly during summer.",
            "Bacillus thuringiensis (Bt) — a targeted bacterial spray that only affects caterpillars; safe for pollinators.",
            "Encourage birds — a bird bath and a single perch nearby brings sparrows and tits that eat caterpillars all day.",
          ],
        },
      },
      {
        slug: "fungal",
        title: "Fungal diseases — mildew, blight and rust",
        eyebrow: "Lesson 5",
        body: [
          "Fungal disease is almost always a sign of stagnant air or wet leaves overnight. Containers help because we can move them — open beds we can only prune.",
        ],
        boxes: [
          { label: "Three fungi every grower meets", items: [
            "Powdery mildew — white dust on leaves of courgette, cucumber, basil. Cause: dry roots + humid air.",
            "Tomato/potato blight — brown patches with grey fuzz; spreads in warm wet July weather. Cause: spores on damp leaves.",
            "Rust — orange spots on undersides of leaves of mint, garlic, hollyhocks. Cause: water on foliage, crowded plants.",
          ]},
        ],
        steps: {
          title: "Prevention and rescue",
          items: [
            "Water the soil, never the leaves; water in the morning so leaves are dry by night.",
            "Space plants for airflow — when in doubt, give them more room.",
            "Mulch to keep soil moisture even (mildew loves dry roots and damp air).",
            "Remove and bin (not compost!) any infected leaves at the first sign.",
            "A weekly milk-spray (1 part milk to 9 parts water) is a surprisingly effective preventative for mildew.",
          ],
        },
        tip: "If blight strikes mid-season, cut every leaf off the affected plant. Yes — strip it. Many tomato plants will still finish the fruit they have.",
      },
      {
        slug: "ipm",
        title: "Putting it together — an integrated rhythm",
        eyebrow: "Lesson 6",
        body: [
          "The masterclass closes with the simplest possible weekly routine. Build this into your gardening and you'll catch 95% of problems before they need spraying.",
        ],
        boxes: [
          { label: "The Sunday-morning 10-minute audit", items: [
            "Look under three random leaves per plant — eggs? aphids?",
            "Tip pots, check the underside — slugs, woodlice nests, vine weevil grubs in compost?",
            "Smell the soil — sour smell means waterlogged; let it dry, repot if needed.",
            "Pinch off any yellowing or spotted leaves and bin them.",
            "Refill the bird bath and the wildflower patch saucer.",
          ]},
        ],
      },
      {
        slug: "id-cards",
        title: "Quick ID cards — the 13 pests you'll meet",
        eyebrow: "Lesson 7",
        body: [
          "Identification is half the battle. The same plant under attack by aphids, spider mites or whitefly needs three different responses. Here are the thirteen pests and diseases that account for almost all damage in small-space and container growing — with the signs and the same-day fix.",
        ],
        boxes: [
          { label: "Aphids — sticky, curled tips, ants nearby", items: [
            "Blast with water from a spray bottle; repeat after 2–3 days (undersides).",
            "Mild soapy water wipe; rinse next day on edibles.",
            "Attract ladybirds and hoverflies with dill, fennel and calendula nearby.",
          ]},
          { label: "Spider mites — fine web, speckled leaves, dry air", items: [
            "Mist daily to raise humidity; shower the plant gently once a week.",
            "Wipe leaf undersides with a damp cloth; increase airflow around the pot.",
            "Isolate heavily affected pots so mites don't drift to neighbours.",
          ]},
          { label: "Slugs & snails — big holes, silvery trails", items: [
            "Evening hand-pick; copper tape stuck around pot rims is brilliant.",
            "Beer traps; wool pellets; tidy away damp hiding spots.",
            "Raise pots on feet; avoid heavy watering at dusk.",
          ]},
          { label: "Whitefly — little white cloud, sticky leaves", items: [
            "Yellow sticky cards hung in the canopy.",
            "Wipe with soapy water; rinse next day.",
            "Boost airflow; avoid crowded foliage.",
          ]},
          { label: "Leaf miner — pale snake trails inside the leaf", items: [
            "Remove affected leaves promptly (bin, don't compost).",
            "Use fine insect mesh over susceptible crops (chard, beetroot, leafy greens).",
          ]},
          { label: "Tomato / potato blight — brown patches, blackened stems, rapid collapse", items: [
            "Remove affected growth immediately; bin (do NOT compost).",
            "Water soil only, never leaves; increase spacing and airflow.",
            "Choose earlier or determinate tomato varieties for pots in blight-prone climates.",
          ]},
          { label: "Fungus gnats — tiny flies hovering over wet compost", items: [
            "Let the top 2–3 cm of compost dry out between waterings.",
            "Top-dress with coarse sand or grit to interrupt the life cycle.",
            "Yellow sticky traps placed flat on the soil surface.",
          ]},
          { label: "Powdery mildew — white powder, dry still air", items: [
            "Prune for airflow; never water overhead late in the day.",
            "Remove the worst affected leaves; keep new growth vigorous.",
            "Weekly milk spray (1:9 milk to water) is a strong preventative.",
          ]},
          { label: "Vine weevil — leaf notches by adults, grub damage to roots", items: [
            "Check at night with a torch for the slow black adults; hand-pick.",
            "Repot badly hit plants, washing roots and discarding old compost.",
            "Apply biological nematodes labelled for vine weevil in warm months.",
          ]},
          { label: "Flea beetle — tiny shot-holes, jumps when disturbed", items: [
            "Fine mesh over young brassicas and rocket from sowing.",
            "Keep plants growing fast with even moisture — stress invites them.",
            "Interplant with strong-scented herbs (mint, coriander) to confuse adults.",
          ]},
          { label: "Cabbage white caterpillars — butterflies hovering, green grubs", items: [
            "Fine mesh over brassicas; check undersides for yellow egg clusters weekly.",
            "Hand-pick caterpillars early — they're slow and easy.",
            "Grow decoy nasturtiums nearby to draw the butterflies away.",
          ]},
          { label: "Damping-off — seedlings collapse, brown stem at soil line", items: [
            "Use fresh seed compost and clean trays / pots.",
            "Avoid overwatering; give bright light and gentle airflow.",
            "Sow a little thinner; bottom-water (sit pots in a tray) when possible.",
          ]},
        ],
        tip: "Photograph the damage before you spray. A clear photo lets you compare next week — and confirm whether what you tried actually worked.",
      },
      {
        slug: "nematodes",
        title: "Are nematodes safe? — the gentle nuclear option",
        eyebrow: "Lesson 8",
        body: [
          "Biological controls like nematodes are often misunderstood. They sound technical but they're some of the gentlest, most precisely-targeted tools in the organic toolbox.",
          "Nematodes are microscopic soil-dwelling worms. Different species target different pests — and only those pests. They are widely available by post from garden suppliers in spring through autumn.",
        ],
        boxes: [
          { label: "What's safe, what's targeted", items: [
            "Slug nematodes (Phasmarhabditis) only affect small soil-dwelling slugs. They do NOT harm earthworms, pets, bees or people.",
            "Vine weevil nematodes (Steinernema / Heterorhabditis) attack only the larvae that chew plant roots. Adult weevils still need hand-picking. Pollinators are not affected.",
            "Both products are safe for pollinators — they don't infect bees, butterflies or other garden helpers.",
            "Best results: apply to MOIST soil in warm conditions (10–20°C). Repeat through the season for full effect.",
          ]},
        ],
        tip: "Nematodes have a short shelf life and need refrigerating — order only when you're ready to use within a fortnight, and water in straight away.",
      },
    ],
  },

  "plant-care": {
    slug: "plant-care",
    title: "Plant Care",
    tagline: "Watering, feeding, light, repotting and the seasonal rhythm of caring for plants in pots.",
    icon: HeartPulse,
    image:
      "https://images.unsplash.com/photo-1763741186493-509db18f6a6a?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTF8MHwxfHNlYXJjaHw0fHx1cmJhbiUyMGdhcmRlbmluZyUyMHNtYWxsJTIwc3BhY2UlMjBiYWxjb255JTIwcGxhbnRzfGVufDB8fHx8MTc4MTQ2MjkzMnww&ixlib=rb-4.1.0&q=85",
    duration: "About 40 minutes",
    lessons: [
      {
        slug: "watering",
        title: "Watering — the most misunderstood skill",
        eyebrow: "Lesson 1",
        body: [
          "If you can get watering right, you can grow almost anything. If you can't, no other technique saves you. Most house plants and pot plants die from over-watering, not under.",
          "The reliable test: push a finger 2 cm into the compost. Cool and damp? Wait. Dry to that depth? Water deeply, until water runs out the bottom. Empty the saucer.",
          "Plants in pots dry out faster than plants in the ground because of all the surface area. In hot weather they may need water twice a day; in winter, once a fortnight.",
        ],
        boxes: [
          { label: "Watering rules of thumb", items: [
            "Water the soil, never the leaves (except misting tropical houseplants).",
            "Morning watering is best — leaves dry before night.",
            "Deep, infrequent watering grows deep roots. Shallow daily watering grows shallow ones.",
            "Lift the pot — a heavy pot is wet, a light pot is dry. Learn its full and empty weight.",
            "Tap water rests overnight in a jug before being used for sensitive plants (citrus, blueberry, carnivorous).",
          ]},
        ],
      },
      {
        slug: "feeding",
        title: "Feeding — when, how much, and what with",
        eyebrow: "Lesson 2",
        body: [
          "Compost has 4–8 weeks of feed in it when you buy it. After that, plants in pots are entirely dependent on you for food. The two macro-rhythms: a slow-release granule at potting time, and a weekly liquid feed in the growing season.",
        ],
        boxes: [
          { label: "Reading the leaves", items: [
            "Yellowing lower leaves, pale overall — nitrogen low. Feed weekly with a balanced feed.",
            "Purple leaf undersides on tomatoes/peppers — phosphate low or cold roots. Warm + tomato feed.",
            "Brown leaf edges, weak stems — potassium low. Switch to a tomato or comfrey feed.",
            "Lush green leaves but no flowers — too much nitrogen. Switch to high-potash (tomato) feed.",
          ]},
        ],
        steps: {
          title: "A reliable feeding rhythm",
          items: [
            "Spring potting: mix slow-release organic granules into fresh compost.",
            "Once leaves are growing fast: weekly liquid seaweed at half strength.",
            "When flower buds appear: switch to a high-potash (tomato) feed once a week.",
            "Stop feeding 2 weeks before the first hard frost — let plants harden off.",
            "Winter: no feed. Less water. Cooler, brighter spot if possible.",
          ],
        },
      },
      {
        slug: "light",
        title: "Light — the silent ingredient",
        eyebrow: "Lesson 3",
        body: [
          "Most plant problems are misdiagnosed as 'I forgot to water' when really the plant is starving for light. Stems stretch, leaves pale, flowers don't come — these are light symptoms.",
          "A bright north-facing window in summer can be plenty for leafy crops and most flowering houseplants. A south-facing window in winter at high latitudes is still poor light. Measure: can you read a book by the light at noon, with the lamps off? That's a workable light level.",
        ],
        boxes: [
          { label: "How much light does it want?", items: [
            "Full sun: tomato, basil, chilli, lavender, rosemary, sunflower, zinnia — 6+ hours direct.",
            "Partial sun: lettuce, parsley, mint, viola, calendula — 3–5 hours direct or all-day bright.",
            "Shade-tolerant: chives, kale, spinach, hostas, ferns — 1–3 hours soft sun.",
          ]},
        ],
        tip: "Rotate your pots a quarter turn every week — plants lean towards the light and end up lopsided otherwise.",
      },
      {
        slug: "repotting",
        title: "Repotting — when, why, and how",
        eyebrow: "Lesson 4",
        body: [
          "Plants tell you they need repotting. Roots circling out of the drainage holes; water running straight through the pot without wetting the soil; the plant top-heavy and tipping. These are signals.",
        ],
        steps: {
          title: "How to repot cleanly",
          items: [
            "Water the plant deeply the day before — it slides out of the pot more easily.",
            "Choose a new pot one size up only (a 12 cm to a 15 cm, not to a 25 cm).",
            "Half-fill the new pot with fresh compost mixed with slow-release feed.",
            "Tease the root ball gently — if circling, score the outside with your finger to free roots.",
            "Set the plant so its surface is 1 cm below the new pot rim. Backfill, press firm.",
            "Water in slowly, top up compost if it sinks. Keep shaded for a few days.",
          ],
        },
        tip: "If a plant is too big to repot, refresh the top 3 cm of compost every spring — scrape out the old and replace. It buys you 1–2 years.",
      },
      {
        slug: "pruning",
        title: "Pruning, pinching and dead-heading",
        eyebrow: "Lesson 5",
        body: [
          "Pruning feels brutal at first and then becomes second nature. The principle: cutting back stimulates branching and growth lower down. A plant that's pinched back at the tip becomes bushy.",
        ],
        boxes: [
          { label: "Three small cuts every day", items: [
            "Pinch the tip of basil at six leaves — it becomes a bush, not a stick.",
            "Dead-head sweet peas, calendula, cosmos — flowers keep coming if seeds don't form.",
            "Remove yellowing or damaged leaves the moment you see them — energy goes to healthy growth.",
          ]},
        ],
        steps: {
          title: "Bigger pruning cuts",
          items: [
            "Hard prune lavender, rosemary, sage in late spring — never into bare wood.",
            "Tomato side shoots removed when they appear at leaf axils — keep the plant single-stem and productive.",
            "Cut back perennial herbs by a third after flowering — fresh growth, fresh harvest.",
          ],
        },
      },
      {
        slug: "seasons",
        title: "The annual rhythm of plant care",
        eyebrow: "Lesson 6",
        body: [
          "Plants live a year that you can learn. Once you can feel the rhythm, plant care becomes routine — almost meditative.",
        ],
        boxes: [
          { label: "A year in pots", items: [
            "Late winter / early spring: sow indoors, divide perennials, refresh compost, set up supports.",
            "Spring: pot on, harden off, plant out, first liquid feeds.",
            "Early summer: water daily, weekly feed, pinch and tie in.",
            "High summer: water twice a day in heatwaves, dead-head, take softwood cuttings.",
            "Late summer / early autumn: sow brassicas and winter salads, save seeds, last cuttings.",
            "Autumn: plant spring bulbs, mulch pots for winter, lift tender plants.",
            "Winter: clean tools, plan, dream — and watch the bulbs come up.",
          ]},
        ],
        tip: "Keep a one-line garden diary. Just the date, the weather, and the one thing you did. Look back next year — your future self will be grateful.",
      },
    ],
  },

  "seasonal-planting": {
    slug: "seasonal-planting",
    title: "Seasonal Planting",
    tagline: "Read the year like a gardener — sowing windows, succession, and stretching every season.",
    icon: HeartPulse,
    image:
      "https://images.unsplash.com/photo-1745063537934-e6bf484d72eb?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2OTF8MHwxfHNlYXJjaHwxfHx1cmJhbiUyMGdhcmRlbmluZyUyMHNtYWxsJTIwc3BhY2UlMjBiYWxjb255JTIwcGxhbnRzfGVufDB8fHx8MTc4MTQ2MjkzMnww&ixlib=rb-4.1.0&q=85",
    duration: "About 35 minutes",
    lessons: [
      {
        slug: "reading-seasons",
        title: "Reading the seasons where you live",
        eyebrow: "Lesson 1",
        body: [
          "Generic gardening calendars fail because the year is not the same everywhere. A Sussex grower sows tomatoes in April; a Madrid grower sows them in February; a Sydney grower sows them in August. The trick is to read your own year by the three signals that actually matter: last frost date, average daylight, and soil temperature.",
          "You don't need a weather station — you need to notice. When does forsythia flower locally? When do the first daffodils open? Local frost guidance from a national met service plus a free soil thermometer (£8) will do more for your timing than any month-by-month book.",
        ],
        boxes: [
          { label: "The four signals that drive your year", items: [
            "Last frost date — gates everything tender (tomato, basil, dahlia, courgette).",
            "Average daylight — leafy crops bolt above 14 hours; flowers like cosmos delay below 12.",
            "Soil temperature — most seeds need 10°C+ to germinate; tomatoes and zinnias want 18°C+.",
            "First frost date in autumn — backwards-counts your last harvest window.",
          ]},
        ],
        tip: "Note the date of your last frost each year on the inside cover of your seed box. Within three years you'll have a personal forecast tighter than any almanac.",
      },
      {
        slug: "windows",
        title: "Sowing windows — early, main, late",
        eyebrow: "Lesson 2",
        body: [
          "Most edibles and many cut flowers have three usable sowing windows. Beginners default to one (usually the main spring sow) and lose the year's possibilities.",
        ],
        boxes: [
          { label: "Three windows worth knowing", items: [
            "Early — cool-tolerant crops sown indoors / under cover 6–8 weeks before last frost: lettuce, brassicas, hardy annual flowers (cornflower, ammi), broad beans.",
            "Main — the big spring window. Tender crops indoors, hardy crops direct: tomato, chilli, basil, courgette, sweet pea, cosmos.",
            "Late — mid- to late-summer sowings for autumn / winter cropping: chard, kale, winter lettuce, spinach, autumn carrots, hardy annuals for an early next-year flush.",
          ]},
        ],
        steps: {
          title: "How to find your windows",
          items: [
            "Look up your average last frost date (LFD). Mark it on the calendar.",
            "Count back 6–8 weeks — that's when 'early' sowing under cover begins.",
            "Main sowings = 2 weeks BEFORE to 4 weeks AFTER your LFD.",
            "Look up your first frost date (FFD). Count back the days-to-maturity on a seed packet to find the latest sensible direct-sow date.",
            "Late sowings for autumn / overwintering = mid-summer (July–August in northern hemisphere temperate climates).",
          ],
        },
      },
      {
        slug: "succession",
        title: "Succession — pick instead of waiting",
        eyebrow: "Lesson 3",
        body: [
          "The single biggest leap from beginner to confident grower is succession sowing — sowing the same crop in small batches, two to three weeks apart, instead of in one big sowing.",
          "It works for lettuce, radish, coriander, dill, beetroot, spring onions, salad turnip, baby carrots, and most cut-flower annuals (cosmos, calendula, scabious, cornflower).",
        ],
        steps: {
          title: "A reliable succession rhythm",
          items: [
            "Sow a small batch — half a packet of lettuce, a 30 cm row of radish.",
            "Mark the date on the pot or row tag.",
            "Two weeks later, sow another small batch in fresh soil.",
            "Repeat every 2 weeks until 8 weeks before your first frost.",
            "Stop in midsummer for crops that bolt in heat (coriander, lettuce); restart in autumn for cool-tolerant types.",
          ],
        },
        tip: "It feels wasteful to sow only half a packet. Trust it — by week 8 you'll be harvesting from rows 1–4 simultaneously and never short of salad again.",
      },
      {
        slug: "season-extension",
        title: "Season extension — fleece, cloches, and microclimates",
        eyebrow: "Lesson 4",
        body: [
          "You can buy yourself 4–6 weeks at each end of the season with the simplest equipment: horticultural fleece (£10 for a roll), cloches made from plastic bottles, and a sunny wall.",
          "South-facing brick walls (north-facing in the southern hemisphere) absorb daytime heat and release it overnight — pots against them can be 3–5°C warmer than open ground. This single trick lets temperate balconies grow chilli, basil and aubergine reliably.",
        ],
        boxes: [
          { label: "What buys you what time", items: [
            "Single layer of fleece over pots overnight — protects to about −2°C (3–4 weeks extra in spring/autumn).",
            "Cloche (plastic bottle or glass jar) over individual seedlings — protects to about −1°C.",
            "Cold frame or mini greenhouse — 6–8 weeks extra each side, can grow winter salads.",
            "Sunny sheltered corner against a south wall — effectively one climate zone warmer.",
          ]},
        ],
      },
      {
        slug: "winter-growing",
        title: "Winter growing — the quietly productive season",
        eyebrow: "Lesson 5",
        body: [
          "Winter is the most underused season for home growers. The cool months are perfect for hardy crops that taste BETTER after frost: kale, leeks, winter lettuce, mâche, mizuna, hardy spring onions, garlic.",
          "Bulbs planted in autumn give you the most morale-boosting spring imaginable — tulips, narcissus, alliums, crocus, hyacinths. None of them need any winter care after planting.",
        ],
        boxes: [
          { label: "A winter-grower's wishlist", items: [
            "Hardy leaves: lamb's lettuce / mâche, mizuna, mustards, winter lettuce (Winter Density, Rouge d'Hiver).",
            "Roots & stems: leeks (planted summer), salsify, hardy spring onions, parsnip (sown spring).",
            "Garlic: plant cloves October–November, harvest June–July.",
            "Spring bulbs: plant Sep–Nov for Feb–May colour. Tulips last (Nov–Dec).",
            "Indoor: microgreens trays on a windowsill keep going year-round.",
          ]},
        ],
        tip: "Most winter crops want LESS water than summer ones — heated rooms cause overwatering. Wait until the surface compost is dry to the touch before watering.",
      },
      {
        slug: "the-year",
        title: "The year on a page",
        eyebrow: "Lesson 6",
        body: [
          "Once you know your last frost date, the whole gardening year can fit on a single page. This is the rhythm experienced growers use without thinking — and you'll have it by the end of one season of doing.",
        ],
        boxes: [
          { label: "12 months in one breath (northern hemisphere; flip for southern)", items: [
            "January — plan, order seeds, prune fruit trees, clean tools.",
            "February — sow chillies and aubergines indoors; chit potatoes.",
            "March — sow tomatoes, sweet peas, hardy annual flowers; prune roses.",
            "April — sow main crops under cover; plant first early potatoes; harden off.",
            "May — plant out tender crops after last frost; sow direct beans, squash; pinch dahlias.",
            "June — water deeply; succession-sow salads; dead-head religiously.",
            "July — harvest harvest harvest; sow autumn crops; save sweet pea seed.",
            "August — sow winter salads; lift garlic; take softwood cuttings.",
            "September — sow hardy annuals for next year; plant first spring bulbs.",
            "October — clear summer crops; plant tulips; mulch tender plants.",
            "November — final tulip planting; clean and store tools; bring tender plants under cover.",
            "December — rest, plan, read seed catalogues. The season starts again.",
          ]},
        ],
        tip: "Print this list and tape it inside your shed or seed drawer. After one full year you'll know which months you over- or under-did.",
      },
    ],
  },
};

export const MASTERCLASS_ORDER = ["propagation", "pest-control", "plant-care", "seasonal-planting"];
