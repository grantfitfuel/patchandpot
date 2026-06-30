"""Regrow-from-scraps metadata for the curated plant catalogue.

We hand-curate this rather than ask Claude because honesty matters here:
the difference between a 5-star regrow (spring onion: water 2cm of root,
infinite re-harvest) and a 2-star regrow (celery: produces a sad stalky
clump) is what makes Patch & Pot's regrow page NOT another Pinterest
clickbait list.

Schema per row:
    method                  — "water-first" | "soil-only" | "water-only"
                              ("water-first" = root in water then transfer
                               to soil; "water-only" = stays in water as
                               a houseplant; "soil-only" = plant directly)
    instructions            — one or two sentences a beginner can act on
    days_to_first_harvest   — realistic, low-end of the typical range
    yield_summary           — what to actually expect (not what gets you clicks)
    worth_it                — 1–5 stars. 5 = real harvest worth the effort;
                              1 = decorative only / mostly disappointing
    family_friendly         — true when it's visually rewarding for kids
                              within ~7 days
    notes                   — caveats (bolt timing, mould risk, etc.)

`apply_regrow_meta(plants)` is called by core.py after the static and
promoted catalogues are merged, mutating each matching plant dict in place
to add `regrow_from_scrap: True` plus the `regrow` sub-object.
"""

REGROW_DATA: dict[str, dict] = {
    # ────────── Five-star: real harvest, near-foolproof ──────────
    "spring-onion": {
        "method": "water-first",
        "instructions": "Trim off the green tops to eat, then stand the bottom 3 cm (with the white roots intact) in a glass with 1 cm of water on a sunny windowsill. Refresh the water every 2 days. New green shoots appear in 3–4 days.",
        "days_to_first_harvest": 7,
        "yield_summary": "Indefinite — keep snipping the green tops and the same root will regrow for months.",
        "worth_it": 5,
        "family_friendly": True,
        "notes": "After 2–3 cycles flavour fades; move to a small pot of compost to extend life.",
    },
    "welsh-onion": {
        "method": "water-first",
        "instructions": "Same as spring onion — stand the rooted base in 1 cm of water, refresh every 2 days, snip green tops as they appear.",
        "days_to_first_harvest": 7,
        "yield_summary": "Indefinite indoors; perennial once moved to soil.",
        "worth_it": 5,
        "family_friendly": True,
        "notes": "Hardier than spring onion — survives outdoors year-round once planted.",
    },
    "garlic": {
        "method": "soil-only",
        "instructions": "Take a sprouted clove from your kitchen drawer (the ones with green tips). Plant pointy-end-up, 5 cm deep, in any container at least 15 cm deep. Water when the soil dries.",
        "days_to_first_harvest": 30,
        "yield_summary": "Young 'green garlic' shoots in a month; full bulbs in 8–9 months if planted in autumn.",
        "worth_it": 5,
        "family_friendly": True,
        "notes": "Supermarket cloves work — but UK seed garlic gives bigger bulbs.",
    },
    "ginger": {
        "method": "soil-only",
        "instructions": "Choose a plump ginger root with visible 'eye' buds. Soak in warm water overnight, then plant flat — eyes facing up, just below the soil surface — in a wide shallow pot. Keep warm (above 20 °C) and lightly moist.",
        "days_to_first_harvest": 120,
        "yield_summary": "A small homegrown rhizome after 4 months — pretty foliage along the way.",
        "worth_it": 5,
        "family_friendly": True,
        "notes": "Loves humidity. A clear bag over the pot for the first 2 weeks speeds sprouting.",
    },
    "lemongrass": {
        "method": "water-first",
        "instructions": "Use the freshest possible supermarket stalk with the base intact. Stand 5 cm of base in a glass of water on a sunny sill. Roots appear in 7–14 days; pot up in compost once they're 3 cm long.",
        "days_to_first_harvest": 90,
        "yield_summary": "A productive clump within 3 months — snip outer stalks as needed.",
        "worth_it": 5,
        "family_friendly": True,
        "notes": "Frost-tender. Bring indoors in winter or treat as an annual.",
    },
    "basil": {
        "method": "water-first",
        "instructions": "Snip a 10 cm soft-stem cutting just below a leaf node. Strip the bottom leaves, stand in a small glass of water, change water every 2 days. Roots appear in 5–7 days; pot in compost.",
        "days_to_first_harvest": 21,
        "yield_summary": "A fresh basil plant from a single supermarket sprig within 3 weeks.",
        "worth_it": 5,
        "family_friendly": True,
        "notes": "Works with any cultivar — Greek, Thai, purple — but soft (not woody) stems root fastest.",
    },
    "greek-basil": {
        "method": "water-first",
        "instructions": "Same as standard basil — soft-stem cutting, water 5–7 days, pot up.",
        "days_to_first_harvest": 21,
        "yield_summary": "Tighter, smaller plant — perfect for a windowsill pot.",
        "worth_it": 5,
        "family_friendly": True,
        "notes": "Tiny leaves are very fragrant — good kid sniff-test plant.",
    },
    "purple-basil": {
        "method": "water-first",
        "instructions": "Same as standard basil. Cuttings strike well; roots tinge pink in the glass.",
        "days_to_first_harvest": 21,
        "yield_summary": "Decorative AND edible — a striking purple pot in 3 weeks.",
        "worth_it": 5,
        "family_friendly": True,
        "notes": "Slightly slower than green basil — give it an extra week if it looks slow.",
    },
    "thai-basil": {
        "method": "water-first",
        "instructions": "Same as standard basil. Slightly woodier stems — keep cuttings on the young end.",
        "days_to_first_harvest": 21,
        "yield_summary": "A new plant from a single supermarket stem in 3 weeks.",
        "worth_it": 5,
        "family_friendly": True,
        "notes": "Anise scent — strong contrast to standard basil.",
    },
    "mint": {
        "method": "water-first",
        "instructions": "Pop a 10 cm cutting in a glass of water. Roots appear in 5–10 days. Plant in a pot (NOT in the ground — it's an invasive coloniser).",
        "days_to_first_harvest": 14,
        "yield_summary": "A full pot within a month, indefinite supply thereafter.",
        "worth_it": 5,
        "family_friendly": True,
        "notes": "The easiest regrow in the entire catalogue. Truly hard to kill.",
    },
    "peppermint": {
        "method": "water-first",
        "instructions": "Same as mint — 10 cm cutting in water for a week, then pot.",
        "days_to_first_harvest": 14,
        "yield_summary": "Strong menthol mint from a single cutting — indefinite.",
        "worth_it": 5,
        "family_friendly": True,
        "notes": "Keeps coming back from the smallest root fragment.",
    },
    "spearmint": {
        "method": "water-first",
        "instructions": "Same as mint — 10 cm cutting in water.",
        "days_to_first_harvest": 14,
        "yield_summary": "Classic mint flavour, easy as it gets.",
        "worth_it": 5,
        "family_friendly": True,
        "notes": "If you only regrow one mint, this is the one.",
    },
    "chocolate-mint": {
        "method": "water-first",
        "instructions": "Same as mint — cutting in water 5–10 days.",
        "days_to_first_harvest": 14,
        "yield_summary": "Genuinely smells like After Eights — instant kid hit.",
        "worth_it": 5,
        "family_friendly": True,
        "notes": "Less flavourful in tea than spearmint — keep both.",
    },
    "watercress": {
        "method": "water-first",
        "instructions": "Stand supermarket sprigs (with stems intact) in a glass of cold water on a bright sill. Refresh every 2 days. Roots in 3–5 days; pot in damp compost or grow on as a windowsill water plant.",
        "days_to_first_harvest": 14,
        "yield_summary": "Spicy, peppery leaves within 2 weeks — keep cutting.",
        "worth_it": 5,
        "family_friendly": True,
        "notes": "Loves cool weather; bolts in midsummer indoors.",
    },
    "leek": {
        "method": "water-first",
        "instructions": "Save the rooty white base (3 cm). Stand in 1 cm of water, refresh every 2 days. New green growth in a week; pot up after 10 days.",
        "days_to_first_harvest": 21,
        "yield_summary": "Pencil-thin baby leeks for soup in 3 weeks; full leeks if planted out in autumn.",
        "worth_it": 4,
        "family_friendly": True,
        "notes": "Don't expect supermarket-size leeks indoors — but the green tops are usable.",
    },

    # ────────── Four-star: solid harvest, minor caveats ──────────
    "pak-choi": {
        "method": "water-first",
        "instructions": "Stand the trimmed base (the bottom 3 cm with the heart intact) cut-side-up in 1 cm of water. Refresh every 2 days; new central leaves in 4–7 days. Pot in compost after 2 weeks for a longer crop.",
        "days_to_first_harvest": 14,
        "yield_summary": "One or two harvests of small leaves before it bolts.",
        "worth_it": 4,
        "family_friendly": True,
        "notes": "Bolts (flowers) fast in warmth — keep cool for a longer run.",
    },
    "elephant-garlic": {
        "method": "soil-only",
        "instructions": "Treat exactly like normal garlic — sprouted clove, pointy-end-up, 5 cm deep in a 25 cm pot.",
        "days_to_first_harvest": 30,
        "yield_summary": "Mild garlicky green shoots in a month; football-sized bulbs in 9 months.",
        "worth_it": 4,
        "family_friendly": True,
        "notes": "Cloves are 4× the size of regular garlic — start with one.",
    },
    "onion": {
        "method": "water-first",
        "instructions": "Use a sprouted onion from the cupboard. Slice off the bottom 2 cm with the roots intact, stand in 1 cm of water for a week, then plant in a 20 cm pot of compost.",
        "days_to_first_harvest": 30,
        "yield_summary": "Green onion-flavoured shoots (use like spring onion); rarely produces a full bulb again.",
        "worth_it": 3,
        "family_friendly": True,
        "notes": "Honest rating: this is a green-tops crop, NOT a way to regrow whole onions.",
    },

    # ────────── Three-star: lettuces — fast but limited ──────────
    "lettuce": {
        "method": "water-first",
        "instructions": "Keep the bottom 3 cm of a hearted lettuce. Stand cut-side-up in 1 cm of water; refresh every 2 days. New central leaves appear in 3–5 days. Pot in compost after 10 days.",
        "days_to_first_harvest": 10,
        "yield_summary": "10–14 days of small new leaves, then it bolts (sends up a flower stem and turns bitter).",
        "worth_it": 3,
        "family_friendly": True,
        "notes": "Bagged loose-leaf lettuce won't work — you need the rooty heart at the base.",
    },
    "butterhead-lettuce": {
        "method": "water-first",
        "instructions": "Same method as standard lettuce — water-root the base, transfer to soil.",
        "days_to_first_harvest": 10,
        "yield_summary": "Soft, mild leaves for 10–14 days before bolting.",
        "worth_it": 3,
        "family_friendly": True,
        "notes": "Best lettuce for kids — soft, sweet, fast to show new growth.",
    },
    "cos-lettuce": {
        "method": "water-first",
        "instructions": "Same as standard lettuce.",
        "days_to_first_harvest": 10,
        "yield_summary": "Crunchy small leaves for ~2 weeks.",
        "worth_it": 3,
        "family_friendly": True,
        "notes": "Bolts a bit slower than butterhead — slightly longer harvest window.",
    },
    "iceberg-lettuce": {
        "method": "water-first",
        "instructions": "Same as standard lettuce — but a fussier regrow.",
        "days_to_first_harvest": 14,
        "yield_summary": "Loose leaves only; you won't get a second iceberg head.",
        "worth_it": 2,
        "family_friendly": False,
        "notes": "Honest: this one's the most disappointing of the lettuces. Skip in favour of butterhead.",
    },
    "oakleaf-lettuce": {
        "method": "water-first",
        "instructions": "Same as standard lettuce.",
        "days_to_first_harvest": 10,
        "yield_summary": "Pretty frilly leaves for ~2 weeks.",
        "worth_it": 3,
        "family_friendly": True,
        "notes": "Visually rewarding for kids — leaves are clearly oak-shaped.",
    },
    "chives": {
        "method": "water-first",
        "instructions": "If you have a clump with roots attached, stand it in water for 5 days, then pot in compost. Otherwise start from seed — it's cheap.",
        "days_to_first_harvest": 21,
        "yield_summary": "A few snips of fine green tops in 3 weeks; perennial once potted.",
        "worth_it": 3,
        "family_friendly": True,
        "notes": "Better as a once-grown perennial than a true scrap-regrow.",
    },
    "garlic-chives": {
        "method": "water-first",
        "instructions": "Same as chives — root a clump or start from a single garlic-chive plant division.",
        "days_to_first_harvest": 21,
        "yield_summary": "Mild garlicky leaves; perennial.",
        "worth_it": 3,
        "family_friendly": True,
        "notes": "Edible white flowers in summer are a kid bonus.",
    },

    # ────────── Two-star: tops only / mostly decorative ──────────
    "celery": {
        "method": "water-first",
        "instructions": "Save the 5 cm root end of a bunch. Stand in 1 cm of water; refresh every 2 days. New centre leaves in 5–7 days. Pot in compost after 2 weeks.",
        "days_to_first_harvest": 21,
        "yield_summary": "A small clump of stalky leaves — never a supermarket-sized head.",
        "worth_it": 2,
        "family_friendly": True,
        "notes": "Honest verdict: looks like 'regrowing celery' on Pinterest, in real life is a sad stumpy clump. Mostly grown for the joke.",
    },
    "fennel-bulb": {
        "method": "water-first",
        "instructions": "Same method as celery — water the rooty base, then pot on.",
        "days_to_first_harvest": 21,
        "yield_summary": "Fronds for garnish — not a second bulb.",
        "worth_it": 2,
        "family_friendly": True,
        "notes": "The frondy aniseed-flavoured leaves are useful in salads — but no new bulb forms.",
    },
    "cabbage": {
        "method": "water-first",
        "instructions": "Save the core after slicing the head. Stand cut-side-up in 1 cm of water for 10 days; small loose leaves emerge from the centre.",
        "days_to_first_harvest": 14,
        "yield_summary": "Small loose-leaf cabbage greens — no second head.",
        "worth_it": 2,
        "family_friendly": True,
        "notes": "Use the leaves like spring greens, not coleslaw.",
    },
    "red-cabbage": {
        "method": "water-first",
        "instructions": "Same as cabbage — water-root the core.",
        "days_to_first_harvest": 14,
        "yield_summary": "Pretty purple-tinged loose leaves; no head.",
        "worth_it": 2,
        "family_friendly": True,
        "notes": "Visually the most striking of the cabbage regrows.",
    },
    "savoy-cabbage": {
        "method": "water-first",
        "instructions": "Same as cabbage.",
        "days_to_first_harvest": 14,
        "yield_summary": "Crinkly small leaves — no head.",
        "worth_it": 2,
        "family_friendly": True,
        "notes": "Texture is the draw — distinctively veined leaves.",
    },
    "carrot": {
        "method": "water-first",
        "instructions": "Save the 2 cm top with the stem stub. Stand cut-side-down in 1 cm of water; new feathery leaves in 5 days. Pot in compost — but ONLY the leaves grow on, not a new root.",
        "days_to_first_harvest": 10,
        "yield_summary": "Feathery edible carrot-tops for garnish or pesto. No new carrot will grow.",
        "worth_it": 2,
        "family_friendly": True,
        "notes": "Honest verdict: countless Pinterest posts pretend you can 'regrow carrots' — you cannot. The TOPS are useful though.",
    },
    "beetroot": {
        "method": "water-first",
        "instructions": "Save the 2 cm top with the stem stub. Same method as carrot — water-root, then pot.",
        "days_to_first_harvest": 10,
        "yield_summary": "Coloured leaves (chard-like) — no new root.",
        "worth_it": 2,
        "family_friendly": True,
        "notes": "The pink-veined leaves are pretty in salads. Not a route to a new beetroot.",
    },
}


def apply_regrow_meta(plants: list[dict]) -> None:
    """Mutate `plants` in place to attach regrow-from-scraps metadata.

    Adds two fields to matching plants:
      • `regrow_from_scrap: True` — boolean flag used by the
        catalogue filter chip + the /regrow-from-scraps landing page.
      • `regrow: {...}` — the full method/instructions/yield/rating object
        used by PlantDetail's regrow section.

    Non-matching plants are untouched. Idempotent — safe to call multiple
    times (it overwrites with the same data).
    """
    for p in plants:
        meta = REGROW_DATA.get(p.get("id"))
        if not meta:
            continue
        p["regrow_from_scrap"] = True
        p["regrow"] = dict(meta)
