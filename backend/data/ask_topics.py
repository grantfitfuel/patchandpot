"""Curated topic taxonomy for /topics/{id} clustering.

DELIBERATELY HAND-CURATED — never auto-generated from user questions.
Every topic here is a well-established, evergreen gardening subject.
Adding a topic requires a code change + review, so we can't accidentally
publish landing pages for whatever weird thing a user asked about.

Each topic carries:
  • id            — url slug ("tomatoes", "pruning")
  • label         — display label ("Tomatoes")
  • blurb         — one-sentence intro for the landing page
  • terms         — the words we'll match against `question_normalized`
                    (case-insensitive; word-boundary regex).

The Ask cache still enforces its own safety filters when we surface a
question inside a topic page (hits >= 1, hidden != True, prior_hash null),
so a topic page can only show Q&As that have ALREADY passed every guard.
Two members + not auto-hidden + not manually hidden = eligible.
"""
from __future__ import annotations

import re
from typing import Iterable


TOPICS: list[dict] = [
    {
        "id": "tomatoes",
        "label": "Tomatoes",
        "blurb": "Everything Nàdar has answered about tomatoes — sowing, pinching out, blight, ripening and end-of-season pulls.",
        "terms": ["tomato", "tomatoes", "tomatillo", "solanum lycopersicum"],
    },
    {
        "id": "pruning",
        "label": "Pruning",
        "blurb": "When and how to cut — from summer pinching to winter framework pruning, without wrecking the plant.",
        "terms": ["prune", "pruning", "pinch out", "pinching out", "cut back", "deadhead", "deadheading"],
    },
    {
        "id": "sowing",
        "label": "Sowing",
        "blurb": "When to sow, depth, spacing, indoor start vs direct — the honest calendar for real UK gardens.",
        "terms": ["sow", "sowing", "seed", "seeds", "seedling", "seedlings", "germinate", "germination", "seed starting"],
    },
    {
        "id": "composting",
        "label": "Composting",
        "blurb": "Turning what you'd throw out into next year's soil — hot heaps, cold heaps, bokashi and honest troubleshooting.",
        "terms": ["compost", "composting", "compost bin", "compost heap", "hot pile", "worm bin", "wormery", "bokashi"],
    },
    {
        "id": "pests",
        "label": "Pests",
        "blurb": "Identifying, deterring and living with garden pests — organic first, chemicals only when nothing else will do.",
        "terms": ["pest", "pests", "aphid", "aphids", "slug", "slugs", "snail", "snails", "caterpillar", "caterpillars", "vine weevil", "whitefly", "spider mite"],
    },
    {
        "id": "watering",
        "label": "Watering",
        "blurb": "How much, how often, and how to keep a summer patch alive through a heat-wave without wasting water.",
        "terms": ["water", "watering", "overwater", "underwater", "drought", "irrigate", "irrigation", "hosepipe"],
    },
    {
        "id": "herbs",
        "label": "Herbs",
        "blurb": "Windowsill herbs, hardy Mediterraneans, harvest without killing the plant, and drying for winter.",
        "terms": ["herb", "herbs", "basil", "parsley", "coriander", "mint", "rosemary", "thyme", "sage", "oregano", "chives"],
    },
    {
        "id": "cut-flowers",
        "label": "Cut Flowers",
        "blurb": "Growing a hand-tied bouquet from your own patch — conditioning, vase life, and honest first-year picks.",
        "terms": ["cut flower", "cut flowers", "bouquet", "vase", "vase life", "flower arrangement", "cutting garden"],
    },
    {
        "id": "soil",
        "label": "Soil",
        "blurb": "What your soil actually is, what to add, and when a raised bed of shop-bought compost beats fighting your ground.",
        "terms": ["soil", "topsoil", "clay soil", "sandy soil", "loam", "ph test", "acid soil", "alkaline soil", "amend soil"],
    },
    {
        "id": "roots",
        "label": "Root Crops",
        "blurb": "Carrots, parsnips, beetroots, potatoes and how to actually get a decent harvest in a container or plot.",
        "terms": ["carrot", "carrots", "parsnip", "parsnips", "beetroot", "beetroots", "potato", "potatoes", "sweet potato", "radish", "radishes", "root crop", "root vegetable"],
    },
]


def get_topic(topic_id: str) -> dict | None:
    for t in TOPICS:
        if t["id"] == topic_id:
            return t
    return None


def _matches(question: str, terms: Iterable[str]) -> bool:
    """Word-boundary, case-insensitive match. Any single hit qualifies."""
    q = (question or "").lower()
    for term in terms:
        pattern = r"\b" + re.escape(term.lower()) + r"\b"
        if re.search(pattern, q):
            return True
    return False


def question_topics(question_normalized: str) -> list[str]:
    """Return the topic ids a given question falls under (0..N)."""
    return [t["id"] for t in TOPICS if _matches(question_normalized, t["terms"])]
