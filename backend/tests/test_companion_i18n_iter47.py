"""
Iteration 47 — follow-up to iter 46.

Bug: LLM was fabricating a fake Scottish Gaelic word 'dhìobhran-dhubha'
for "aphid" (resembles 'dòbhran' = otter). Fix:
  (a) companion-reason translation now uses full Sonnet via _llm_json
      (not Haiku via _llm_json_cheap),
  (b) hand-curated LOW_RESOURCE_GLOSSARY injected into the prompt for
      gd/cy/ga/mi so canonical published vocabulary is used,
  (c) cache key bumped v2 → v3 and pre-v3 rows purged from mongo.

Regression coverage:
  1. gd tomato companions: Nasturtium reason contains 'leumadair' AND does
     NOT contain the fabricated 'dhìobhran-dhubha' or the root 'dòbhran'.
  2. gd tomato Marigold reason: contains a Gaelic whitefly term
     (cuileag-gheal / cuileag geal / cuileagan-geala).
  3. Cache-hit: same body across two calls.
  4. Welsh (cy): no English pest tokens leak.
  5. French (fr, not low-resource): no English pest tokens; expect
     'puceron' (or 'pucerons') somewhere in the reasons.
  6. English (en): Nasturtium reason still contains 'aphid'/'aphids'.
  7. /api/plants?language=gd smoke test: 300+ plants and no english
     pest tokens leak in the payload.
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://grow-by-season-1.preview.emergentagent.com",
).rstrip("/")

ENGLISH_PEST_TOKENS = [
    "aphid", "aphids",
    "whitefly", "whiteflies",
    "greenfly", "greenflies",
    "blackfly", "blackflies",
    "slug", "slugs",
    "snail", "snails",
    "caterpillar", "caterpillars",
    "ladybird", "ladybirds",
    "hoverfly", "hoverflies",
]


def _word_in(text: str, token: str) -> bool:
    if not text:
        return False
    return re.search(r"\b" + re.escape(token) + r"\b", text, flags=re.IGNORECASE) is not None


def _substr_in(text: str, token: str) -> bool:
    """Case-insensitive substring test — used for fake-word (dòbhran root)
    detection where word boundaries around apostrophes/accents are unreliable."""
    if not text:
        return False
    return token.lower() in text.lower()


def _assert_no_english_pest_leaks(reasons, where):
    leaks = []
    for reason in reasons:
        for tok in ENGLISH_PEST_TOKENS:
            if _word_in(reason, tok):
                leaks.append((tok, reason))
    assert not leaks, f"English pest tokens leaked in {where}: {leaks}"


def _get_companions(api, slug, lang, timeout=90):
    r = api.get(f"{BASE_URL}/api/plants/{slug}/companions",
                params={"language": lang}, timeout=timeout)
    assert r.status_code == 200, f"{slug}?language={lang} → {r.status_code}: {r.text[:400]}"
    data = r.json()
    if isinstance(data, list):
        return data, data
    companions = data.get("companions") or data.get("items") or []
    return data, companions


def _find(companions, cid):
    cid_l = cid.lower()
    for c in companions:
        for key in ("id", "slug", "name"):
            v = (c.get(key) or "").lower()
            if v == cid_l or cid_l in v:
                return c
    return None


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Accept": "application/json"})
    return s


# ── 1 & 2: Scottish Gaelic canonical vocabulary ───────────────────────
class TestGaelicCanonicalVocabulary:
    def test_nasturtium_reason_has_leumadair_and_no_fabricated_otter_word(self, api):
        _, companions = _get_companions(api, "tomato", "gd")
        nas = _find(companions, "nasturtium")
        assert nas is not None, f"nasturtium not in companions: {[c.get('id') for c in companions]}"
        reason = nas.get("reason", "") or ""
        assert reason.strip(), f"empty nasturtium reason: {nas!r}"

        # Canonical Gaelic root for 'aphid' MUST be present
        assert "leumadair" in reason.lower(), (
            f"Expected canonical Gaelic 'leumadair' (root for aphid) in "
            f"nasturtium reason, got: {reason!r}"
        )

        # The fabricated word (iter 46 bug) MUST NOT be present.
        # Also block the 'dòbhran' (otter) root that the LLM was garbling.
        forbidden = ["dhìobhran-dhubha", "dhìobhran", "dòbhran", "dobhran"]
        for bad in forbidden:
            assert not _substr_in(reason, bad), (
                f"Fabricated/incorrect Gaelic token {bad!r} still present in "
                f"nasturtium reason: {reason!r}"
            )

    def test_marigold_reason_has_whitefly_gaelic_term(self, api):
        _, companions = _get_companions(api, "tomato", "gd")
        mar = _find(companions, "marigold")
        assert mar is not None, f"marigold not in companions: {[c.get('id') for c in companions]}"
        reason = (mar.get("reason", "") or "").lower()
        assert reason.strip(), f"empty marigold reason: {mar!r}"

        # Any of the acceptable published Gaelic whitefly forms
        acceptable = [
            "cuileag-gheal",
            "cuileag geal",
            "cuileagan-geala",
            "cuileagan geala",
            "cuileag gheal",
        ]
        assert any(a in reason for a in acceptable), (
            f"Expected a Gaelic whitefly term (one of {acceptable}) in marigold "
            f"reason, got: {mar.get('reason')!r}"
        )


# ── 3: Cache-hit path ─────────────────────────────────────────────────
class TestCacheHit:
    def test_gd_tomato_two_calls_identical(self, api):
        r1 = api.get(f"{BASE_URL}/api/plants/tomato/companions",
                     params={"language": "gd"}, timeout=90)
        r2 = api.get(f"{BASE_URL}/api/plants/tomato/companions",
                     params={"language": "gd"}, timeout=90)
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json() == r2.json(), "cache-hit responses must be identical"


# ── 4: Welsh — no English leaks ───────────────────────────────────────
class TestWelsh:
    def test_tomato_companions_cy_no_english_pests(self, api):
        _, companions = _get_companions(api, "tomato", "cy")
        assert len(companions) >= 1, f"expected companions, got: {companions}"
        reasons = [c.get("reason", "") or "" for c in companions]
        assert all(r.strip() for r in reasons), f"empty reasons: {reasons}"
        _assert_no_english_pest_leaks(
            reasons, "/api/plants/tomato/companions?language=cy"
        )


# ── 5: French — no English leaks + expect 'puceron' ───────────────────
class TestFrench:
    def test_tomato_companions_fr_no_english_and_has_puceron(self, api):
        _, companions = _get_companions(api, "tomato", "fr")
        assert len(companions) >= 1
        reasons = [c.get("reason", "") or "" for c in companions]
        _assert_no_english_pest_leaks(
            reasons, "/api/plants/tomato/companions?language=fr"
        )
        # Nasturtium (capucine) reason should mention pucerons in French
        combined = " ".join(reasons).lower()
        assert ("puceron" in combined), (
            f"Expected French 'puceron'/'pucerons' somewhere in fr reasons, got: {reasons}"
        )


# ── 6: English still natural ──────────────────────────────────────────
class TestEnglish:
    def test_tomato_companions_en_nasturtium_mentions_aphid(self, api):
        _, companions = _get_companions(api, "tomato", "en", timeout=60)
        nas = _find(companions, "nasturtium")
        assert nas is not None
        reason = (nas.get("reason", "") or "").lower()
        assert reason.strip()
        assert ("aphid" in reason) or ("aphids" in reason), (
            f"English nasturtium reason should mention aphid(s), got: {reason!r}"
        )


# ── 7: /api/plants?language=gd regression ─────────────────────────────
class TestPlantsListRegressionGd:
    def test_plants_gd_size_and_no_english_pest_leak(self, api):
        r = api.get(f"{BASE_URL}/api/plants", params={"language": "gd"}, timeout=120)
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        plants = data if isinstance(data, list) else (
            data.get("plants") or data.get("items") or []
        )
        assert isinstance(plants, list) and len(plants) >= 300, (
            f"expected 300+ plants, got {len(plants)}"
        )
        blob = str(data).lower()
        for tok in ENGLISH_PEST_TOKENS:
            assert not re.search(r"\b" + re.escape(tok) + r"\b", blob), (
                f"english pest token {tok!r} leaked in /api/plants?language=gd"
            )
