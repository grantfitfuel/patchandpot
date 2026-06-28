"""Patch & Pot — plant lifecycle & hardiness metadata.

Adds two fields to every plant entry at module-load time:
    lifecycle  →  "annual" | "biennial" | "perennial"
    hardiness  →  "hardy"  | "half-hardy" | "tender" | "indoor"

Lifecycle reflects how the plant is most commonly grown in the UK / cool
temperate setting (carrots are biologically biennial but treated as annual;
we use the BIOLOGICAL lifecycle so the gardener understands the plant).

Hardiness reflects UK overwintering reality:
    hardy       → survives the winter outdoors
    half-hardy  → needs a frost-free start; may overwinter in mild gardens
    tender     →  killed by any frost; treat as annual or bring indoors
    indoor     →  windowsill / no outdoor use (sprouts)
"""

# Map plant_id → (lifecycle, hardiness)
_META = {
    # ── Original 32 ──────────────────────────────────────────────────
    # Edibles
    "tomato": ("annual", "tender"),
    "basil": ("annual", "tender"),
    "lettuce": ("annual", "hardy"),
    "mint": ("perennial", "hardy"),
    "chilli": ("annual", "tender"),
    "strawberry": ("perennial", "hardy"),
    "radish": ("annual", "hardy"),
    "spinach": ("annual", "hardy"),
    "carrot": ("biennial", "hardy"),
    "rosemary": ("perennial", "hardy"),
    "thyme": ("perennial", "hardy"),
    "chives": ("perennial", "hardy"),
    "kale": ("biennial", "hardy"),
    "cucumber": ("annual", "tender"),
    "courgette": ("annual", "tender"),
    "spring-onion": ("annual", "hardy"),
    "coriander": ("annual", "half-hardy"),
    "parsley": ("biennial", "hardy"),
    "beetroot": ("biennial", "hardy"),
    "garlic": ("perennial", "hardy"),
    # Original flowers
    "nasturtium": ("annual", "half-hardy"),
    "calendula": ("annual", "hardy"),
    "sunflower": ("annual", "half-hardy"),
    "marigold": ("annual", "half-hardy"),
    "lavender": ("perennial", "hardy"),
    "cosmos": ("annual", "half-hardy"),
    "viola": ("biennial", "hardy"),
    "sweet-pea": ("annual", "hardy"),
    "zinnia": ("annual", "half-hardy"),
    "borage": ("annual", "hardy"),
    "geranium": ("perennial", "tender"),
    "chamomile": ("perennial", "hardy"),

    # ── Cut flowers (72) ─────────────────────────────────────────────
    "dahlia": ("perennial", "half-hardy"),
    "sweet-william": ("biennial", "hardy"),
    "snapdragon": ("annual", "half-hardy"),
    "larkspur": ("annual", "hardy"),
    "stock": ("annual", "hardy"),
    "ranunculus": ("perennial", "half-hardy"),
    "anemone-coronaria": ("perennial", "half-hardy"),
    "rudbeckia": ("perennial", "hardy"),
    "scabiosa": ("annual", "hardy"),
    "dianthus": ("perennial", "hardy"),
    "cornflower": ("annual", "hardy"),
    "gypsophila": ("annual", "hardy"),
    "statice": ("annual", "half-hardy"),
    "lisianthus": ("annual", "tender"),
    "ammi-majus": ("annual", "hardy"),
    "nigella": ("annual", "hardy"),
    "tulip": ("perennial", "hardy"),
    "narcissus": ("perennial", "hardy"),
    "allium-globemaster": ("perennial", "hardy"),
    "sweet-sultan": ("annual", "hardy"),
    "achillea": ("perennial", "hardy"),
    "china-aster": ("annual", "half-hardy"),
    "delphinium": ("perennial", "hardy"),
    "lupin": ("perennial", "hardy"),
    "eremurus": ("perennial", "hardy"),
    "gladiolus": ("perennial", "half-hardy"),
    "asiatic-lily": ("perennial", "hardy"),
    "oriental-lily": ("perennial", "hardy"),
    "calla-lily": ("perennial", "half-hardy"),
    "iris-bearded": ("perennial", "hardy"),
    "iris-dutch": ("perennial", "hardy"),
    "freesia": ("perennial", "half-hardy"),
    "hyacinth": ("perennial", "hardy"),
    "amaryllis": ("perennial", "tender"),
    "carnation": ("perennial", "hardy"),
    "wallflower": ("biennial", "hardy"),
    "sweet-rocket": ("biennial", "hardy"),
    "honesty": ("biennial", "hardy"),
    "forget-me-not": ("biennial", "hardy"),
    "sweet-alyssum": ("annual", "hardy"),
    "lobelia": ("annual", "half-hardy"),
    "petunia": ("annual", "half-hardy"),
    "impatiens": ("annual", "half-hardy"),
    "tuberous-begonia": ("perennial", "tender"),
    "crocosmia": ("perennial", "hardy"),
    "agapanthus": ("perennial", "half-hardy"),
    "canna": ("perennial", "tender"),
    "nerine": ("perennial", "hardy"),
    "tithonia": ("annual", "half-hardy"),
    "strawflower": ("annual", "half-hardy"),
    "craspedia": ("annual", "half-hardy"),
    "amaranthus": ("annual", "half-hardy"),
    "celosia": ("annual", "tender"),
    "salvia-horminum": ("annual", "hardy"),
    "bells-of-ireland": ("annual", "hardy"),
    "phlox-annual": ("annual", "half-hardy"),
    "monarda": ("perennial", "hardy"),
    "coreopsis": ("perennial", "hardy"),
    "liatris": ("perennial", "hardy"),
    "veronica": ("perennial", "hardy"),
    "nicotiana": ("annual", "half-hardy"),
    "cleome": ("annual", "half-hardy"),
    "orlaya": ("annual", "hardy"),
    "didiscus": ("annual", "half-hardy"),
    "salpiglossis": ("annual", "half-hardy"),
    "matricaria": ("annual", "hardy"),
    "eucalyptus-cinerea": ("perennial", "half-hardy"),
    "dusty-miller": ("perennial", "half-hardy"),
    "peony": ("perennial", "hardy"),
    "heliopsis": ("perennial", "hardy"),
    "trachelium": ("annual", "half-hardy"),
    "ornamental-poppy": ("biennial", "hardy"),

    # ── Pollinator flowers (14) ──────────────────────────────────────
    "echinacea": ("perennial", "hardy"),
    "verbena-bonariensis": ("perennial", "hardy"),
    "salvia-amistad": ("perennial", "half-hardy"),
    "sedum-autumn-joy": ("perennial", "hardy"),
    "ajuga": ("perennial", "hardy"),
    "agastache": ("perennial", "hardy"),
    "eryngium": ("perennial", "hardy"),
    "foxglove": ("biennial", "hardy"),
    "hellebore": ("perennial", "hardy"),
    "hollyhock": ("biennial", "hardy"),
    "primrose": ("perennial", "hardy"),
    "snowdrop": ("perennial", "hardy"),
    "crocus": ("perennial", "hardy"),
    "scilla": ("perennial", "hardy"),

    # ── Veg (18) ─────────────────────────────────────────────────────
    "runner-bean": ("annual", "half-hardy"),
    "french-bean": ("annual", "half-hardy"),
    "broad-bean": ("annual", "hardy"),
    "pea": ("annual", "hardy"),
    "mangetout": ("annual", "hardy"),
    "sugar-snap-pea": ("annual", "hardy"),
    "leek": ("biennial", "hardy"),
    "shallot": ("biennial", "hardy"),
    "onion": ("biennial", "hardy"),
    "fennel-bulb": ("biennial", "hardy"),
    "celery": ("biennial", "hardy"),
    "celeriac": ("biennial", "hardy"),
    "swiss-chard": ("biennial", "hardy"),
    "pak-choi": ("annual", "hardy"),
    "rocket": ("annual", "hardy"),
    "watercress": ("perennial", "hardy"),
    "sweetcorn": ("annual", "tender"),
    "asparagus": ("perennial", "hardy"),

    # ── Brassicas (6) ────────────────────────────────────────────────
    "broccoli": ("biennial", "hardy"),
    "cauliflower": ("biennial", "hardy"),
    "cabbage": ("biennial", "hardy"),
    "brussels-sprout": ("biennial", "hardy"),
    "kohlrabi": ("biennial", "hardy"),
    "romanesco": ("biennial", "hardy"),

    # ── Squash (4) ───────────────────────────────────────────────────
    "pumpkin": ("annual", "tender"),
    "butternut-squash": ("annual", "tender"),
    "melon": ("annual", "tender"),
    "gherkin": ("annual", "tender"),

    # ── Patio fruit (12) ─────────────────────────────────────────────
    "blueberry": ("perennial", "hardy"),
    "raspberry": ("perennial", "hardy"),
    "blackberry": ("perennial", "hardy"),
    "gooseberry": ("perennial", "hardy"),
    "blackcurrant": ("perennial", "hardy"),
    "redcurrant": ("perennial", "hardy"),
    "fig": ("perennial", "hardy"),
    "lemon": ("perennial", "tender"),
    "dwarf-apple": ("perennial", "hardy"),
    "dwarf-pear": ("perennial", "hardy"),
    "dwarf-cherry": ("perennial", "hardy"),
    "rhubarb": ("perennial", "hardy"),

    # ── Herbs (10) ───────────────────────────────────────────────────
    "sage": ("perennial", "hardy"),
    "oregano": ("perennial", "hardy"),
    "lemon-balm": ("perennial", "hardy"),
    "dill": ("annual", "hardy"),
    "fennel-herb": ("perennial", "hardy"),
    "lemongrass": ("perennial", "tender"),
    "tarragon": ("perennial", "hardy"),
    "bay": ("perennial", "hardy"),
    "lovage": ("perennial", "hardy"),
    "chervil": ("annual", "hardy"),

    # ── Sprouting (6) ────────────────────────────────────────────────
    "microgreens": ("annual", "indoor"),
    "pea-shoots": ("annual", "indoor"),
    "mustard-cress": ("annual", "indoor"),
    "sprouting-broccoli": ("annual", "indoor"),
    "baby-leaf-mix": ("annual", "indoor"),
    "alfalfa-sprouts": ("annual", "indoor"),

    # ── Shrubs / climbers (8) ────────────────────────────────────────
    "rose-shrub": ("perennial", "hardy"),
    "hydrangea": ("perennial", "hardy"),
    "clematis": ("perennial", "hardy"),
    "jasmine": ("perennial", "hardy"),
    "wisteria": ("perennial", "hardy"),
    "camellia": ("perennial", "hardy"),
    "box-hedge": ("perennial", "hardy"),
    "honeysuckle": ("perennial", "hardy"),
}


def apply_meta(plants: list[dict]) -> None:
    """Mutate the catalogue in place — add lifecycle & hardiness fields.

    Plants missing from _META get sensible defaults so the schema is
    always present (avoids KeyError on the frontend).
    """
    for p in plants:
        lc, hd = _META.get(p["id"], ("annual", "hardy"))
        p["lifecycle"] = lc
        p["hardiness"] = hd
