"""Cut-flower / vase-life metadata for the curated catalogue.

Hand-curated like `plants_regrow.py` because the value is in HONEST data:
the difference between a 5-day cosmos and a 21-day rudbeckia matters at
the kitchen table, and the difference between "sear the stems" (poppies,
euphorbia) and "warm water hold" (zinnias) is what separates a flower
that lasts vs a vase of slime. Most app catalogues skip this entirely.

Schema per row:
    vase_days               — realistic mid-point of vase life, 18-22°C room
    cut_at_stage            — exact bud / bloom stage at which to cut
    conditioning            — "sear" | "warm-water" | "cold-water" | "split-woody" | "none"
    cut_and_come_again      — True for plants that re-bloom heavier the
                              more you cut (cosmos, sweet pea, snapdragon);
                              False for one-shots (peonies, tulips, dahlias if
                              you take the central terminal bud).
    arrangement_role        — "focal" | "spike" | "filler" | "foliage" | "umbel"
    dries_well              — True if it holds shape for everlastings
    notes                   — caveats only — keep it short

`apply_cut_flower_meta(plants)` mutates the catalogue in place: matched
plants get `cut_flower: True` plus a `cut_flower_data: {...}` sub-object.
"""

CUT_FLOWER_DATA: dict[str, dict] = {
    # ────────── Workhorses — long vase life, productive ──────────
    "dahlia": {
        "vase_days": 7,
        "cut_at_stage": "Cut when fully open — dahlias don't open further once cut.",
        "conditioning": "warm-water",
        "cut_and_come_again": True,
        "arrangement_role": "focal",
        "dries_well": False,
        "notes": "Cutting MAKES the plant bloom more — never let dahlias go to seed.",
    },
    "cosmos": {
        "vase_days": 7,
        "cut_at_stage": "Cut when the bud has cracked open and shows colour, not when fully open.",
        "conditioning": "warm-water",
        "cut_and_come_again": True,
        "arrangement_role": "filler",
        "dries_well": False,
        "notes": "The single most productive cut flower per square metre. Cut weekly.",
    },
    "cosmos-cupcakes": {
        "vase_days": 7,
        "cut_at_stage": "Bud just cracked open showing colour.",
        "conditioning": "warm-water",
        "cut_and_come_again": True,
        "arrangement_role": "focal",
        "dries_well": False,
        "notes": "Cup-shaped petals make it more focal than wild cosmos.",
    },
    "cosmos-double-click": {
        "vase_days": 7,
        "cut_at_stage": "Bud just cracked, before petals fully unfurl.",
        "conditioning": "warm-water",
        "cut_and_come_again": True,
        "arrangement_role": "focal",
        "dries_well": False,
        "notes": "Double form gives a peony-ish look at a fraction of the cost.",
    },
    "cosmos-pied-piper": {
        "vase_days": 7,
        "cut_at_stage": "Bud just opening.",
        "conditioning": "warm-water",
        "cut_and_come_again": True,
        "arrangement_role": "filler",
        "dries_well": False,
        "notes": "Fluted petals — unusual silhouette in mixed bouquets.",
    },
    "sweet-pea": {
        "vase_days": 5,
        "cut_at_stage": "Cut when the bottom flower on the stem is fully open and 2–3 buds above show colour.",
        "conditioning": "cold-water",
        "cut_and_come_again": True,
        "arrangement_role": "spike",
        "dries_well": False,
        "notes": "Scent disappears fast — pick in the morning, vase by lunch.",
    },
    "snapdragon": {
        "vase_days": 8,
        "cut_at_stage": "When the bottom 1/3 of florets are open.",
        "conditioning": "warm-water",
        "cut_and_come_again": True,
        "arrangement_role": "spike",
        "dries_well": False,
        "notes": "Stems bend toward light in the vase — turn daily.",
    },
    "zinnia": {
        "vase_days": 10,
        "cut_at_stage": "'Wiggle test' — wiggle the stem; if it flops, leave it. Cut only firm-necked blooms.",
        "conditioning": "warm-water",
        "cut_and_come_again": True,
        "arrangement_role": "focal",
        "dries_well": False,
        "notes": "The wiggle test prevents disappointing droopy stems.",
    },
    "rudbeckia": {
        "vase_days": 14,
        "cut_at_stage": "Fully open — they don't open further once cut.",
        "conditioning": "warm-water",
        "cut_and_come_again": True,
        "arrangement_role": "focal",
        "dries_well": False,
        "notes": "Longest vase life of any common cut flower — workhorse stuff.",
    },
    "sunflower": {
        "vase_days": 8,
        "cut_at_stage": "When petals are halfway unfurled, not fully open.",
        "conditioning": "warm-water",
        "cut_and_come_again": False,
        "arrangement_role": "focal",
        "dries_well": False,
        "notes": "Branching cultivars give multiple cuts; single-stem types are one-shots.",
    },

    # ────────── Spring + bulbs ──────────
    "tulip": {
        "vase_days": 7,
        "cut_at_stage": "Cut when buds are coloured but still closed.",
        "conditioning": "cold-water",
        "cut_and_come_again": False,
        "arrangement_role": "spike",
        "dries_well": False,
        "notes": "Keep growing in the vase — leave 2 cm headroom for stem elongation.",
    },
    "daffodil": {
        "vase_days": 5,
        "cut_at_stage": "'Pencil stage' — when the bud is tilted at 45° and still pale.",
        "conditioning": "cold-water",
        "cut_and_come_again": False,
        "arrangement_role": "focal",
        "dries_well": False,
        "notes": "Sap is toxic to other flowers — condition daffodils alone overnight before mixing.",
    },
    "narcissus": {
        "vase_days": 5,
        "cut_at_stage": "Pencil stage — bud tilted but closed.",
        "conditioning": "cold-water",
        "cut_and_come_again": False,
        "arrangement_role": "focal",
        "dries_well": False,
        "notes": "Same toxic-sap rule as daffodils.",
    },
    "ranunculus": {
        "vase_days": 10,
        "cut_at_stage": "When the bud feels like a soft marshmallow — squeezy, not hard.",
        "conditioning": "cold-water",
        "cut_and_come_again": False,
        "arrangement_role": "focal",
        "dries_well": False,
        "notes": "One of the longest-lasting spring focals — worth the corm.",
    },
    "anemone": {
        "vase_days": 7,
        "cut_at_stage": "When the petals have lifted off the central black eye, before they're fully reflexed.",
        "conditioning": "cold-water",
        "cut_and_come_again": False,
        "arrangement_role": "focal",
        "dries_well": False,
        "notes": "Opens and closes daily in the vase — bring inside in the evening.",
    },

    # ────────── Foliage + fillers ──────────
    "feverfew": {
        "vase_days": 10,
        "cut_at_stage": "When most flowers on the umbel are open.",
        "conditioning": "warm-water",
        "cut_and_come_again": True,
        "arrangement_role": "filler",
        "dries_well": False,
        "notes": "The classic 'wedding filler' — small white daisies that bridge any palette.",
    },
    "ammi-majus": {
        "vase_days": 8,
        "cut_at_stage": "When 75% of the umbel florets are open.",
        "conditioning": "warm-water",
        "cut_and_come_again": True,
        "arrangement_role": "umbel",
        "dries_well": False,
        "notes": "Like wild Queen Anne's Lace — airy, romantic. Cut once for a flush.",
    },
    "daucus-dara": {
        "vase_days": 8,
        "cut_at_stage": "75% of umbel open.",
        "conditioning": "warm-water",
        "cut_and_come_again": True,
        "arrangement_role": "umbel",
        "dries_well": True,
        "notes": "Wine-purple umbels — drama in any bouquet. Dries beautifully.",
    },
    "nicotiana": {
        "vase_days": 7,
        "cut_at_stage": "When 1/3 of the florets are open.",
        "conditioning": "warm-water",
        "cut_and_come_again": True,
        "arrangement_role": "spike",
        "dries_well": False,
        "notes": "Lime-green N. langsdorffii is a wedding-florist favourite.",
    },
    "alchemilla-mollis": {
        "vase_days": 10,
        "cut_at_stage": "When flowers are fully open and have firmed up — not pollen-fresh.",
        "conditioning": "warm-water",
        "cut_and_come_again": True,
        "arrangement_role": "filler",
        "dries_well": True,
        "notes": "Lady's Mantle — chartreuse foam that makes everything look more expensive.",
    },

    # ────────── Big focals ──────────
    "peony": {
        "vase_days": 7,
        "cut_at_stage": "'Marshmallow stage' — bud feels like a soft squishy marshmallow.",
        "conditioning": "warm-water",
        "cut_and_come_again": False,
        "arrangement_role": "focal",
        "dries_well": False,
        "notes": "Pick in cool of the morning. One shot per year per plant — make it count.",
    },
    "lisianthus": {
        "vase_days": 14,
        "cut_at_stage": "When the first floret is fully open and the second is showing colour.",
        "conditioning": "warm-water",
        "cut_and_come_again": True,
        "arrangement_role": "focal",
        "dries_well": False,
        "notes": "Florist's secret — 2-week vase life at a price you cannot beat at home.",
    },
    "hellebore": {
        "vase_days": 5,
        "cut_at_stage": "ONLY mature flowers where the central seed pods have started forming.",
        "conditioning": "sear",
        "cut_and_come_again": False,
        "arrangement_role": "focal",
        "dries_well": False,
        "notes": "If cut too early they will wilt instantly. Sear stems in just-boiled water for 30 s.",
    },

    # ────────── Everlasting / dried specialists ──────────
    "statice": {
        "vase_days": 21,
        "cut_at_stage": "When 75% of the florets are open and colour is at its brightest.",
        "conditioning": "none",
        "cut_and_come_again": True,
        "arrangement_role": "filler",
        "dries_well": True,
        "notes": "Holds its colour for years dried — the everlasting flower.",
    },
    "strawflower": {
        "vase_days": 14,
        "cut_at_stage": "Just as the first ring of petals reflexes open.",
        "conditioning": "none",
        "cut_and_come_again": True,
        "arrangement_role": "focal",
        "dries_well": True,
        "notes": "Hang upside down to dry — colour and shape last 5+ years.",
    },
    "honesty": {
        "vase_days": 10,
        "cut_at_stage": "Fresh — purple-pink florets. For dried seed-pod 'silver dollars', wait until pods are brown then strip the outer skin.",
        "conditioning": "warm-water",
        "cut_and_come_again": False,
        "arrangement_role": "spike",
        "dries_well": True,
        "notes": "Two crops from one plant: spring flowers AND winter silver seed pods.",
    },
}


def apply_cut_flower_meta(plants: list[dict]) -> None:
    """Mutate `plants` in place to attach cut-flower metadata. Mirrors
    `apply_regrow_meta`. Sets `cut_flower: True` + `cut_flower_data: {...}`
    on every matching plant id."""
    for p in plants:
        meta = CUT_FLOWER_DATA.get(p.get("id"))
        if not meta:
            continue
        p["cut_flower"] = True
        p["cut_flower_data"] = dict(meta)
