"""
Tests for companion-reasons i18n fix (iteration 46).

Bug context: LLM translation for /api/plants/{slug}/companions?language=gd
previously leaked English pest words (aphid, whitefly, etc). Fix bumped the
cache key to v2 and strengthened the prompt. This module verifies that:

  1. gd / fr / cy no longer contain English pest tokens in `reason` strings
  2. Nasturtium tomato-companion reason (the exact reported bug) is clean
  3. English endpoint still works and reads naturally
  4. Cache-hit path returns identical response body
  5. /api/plants?language=gd smoke check: no english pest leaks across all plants
"""
import os
import re
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://grow-by-season-1.preview.emergentagent.com").rstrip("/")

# Case-insensitive tokens whose presence would indicate the bug
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


def _tokenize_contains(text: str, token: str) -> bool:
    """Return True if `token` appears as a standalone word in `text` (case-insensitive)."""
    if not text:
        return False
    pattern = r"\b" + re.escape(token) + r"\b"
    return re.search(pattern, text, flags=re.IGNORECASE) is not None


def _assert_no_english_pest_leaks(reasons: list[str], where: str) -> None:
    leaks = []
    for reason in reasons:
        for tok in ENGLISH_PEST_TOKENS:
            if _tokenize_contains(reason, tok):
                leaks.append((tok, reason))
    assert not leaks, f"English pest tokens leaked in {where}: {leaks}"


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Accept": "application/json"})
    return s


# ── Companion reasons: Scottish Gaelic ────────────────────────────────
class TestCompanionReasonsGaelic:
    def test_tomato_companions_gd_no_english_pests(self, api):
        r = api.get(f"{BASE_URL}/api/plants/tomato/companions", params={"language": "gd"}, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        # Response might be a list or an object with a companions key
        companions = data if isinstance(data, list) else data.get("companions") or data.get("items") or []
        assert isinstance(companions, list) and len(companions) >= 1, f"expected companions list, got {data}"
        reasons = [c.get("reason", "") for c in companions]
        # Every reason present
        assert all(isinstance(r_, str) and r_.strip() for r_ in reasons), f"empty reasons: {reasons}"
        _assert_no_english_pest_leaks(reasons, "/api/plants/tomato/companions?language=gd")

    def test_tomato_nasturtium_reason_no_aphid(self, api):
        """Exact regression for reported bug."""
        r = api.get(f"{BASE_URL}/api/plants/tomato/companions", params={"language": "gd"}, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        companions = data if isinstance(data, list) else data.get("companions") or data.get("items") or []
        nas = next((c for c in companions if (c.get("id") or c.get("slug") or "").lower() == "nasturtium"
                    or "nasturtium" in (c.get("name") or "").lower()), None)
        assert nas is not None, f"nasturtium not found among companions: {[c.get('id') or c.get('slug') or c.get('name') for c in companions]}"
        reason = nas.get("reason", "")
        assert reason.strip(), f"empty nasturtium reason: {nas}"
        assert not _tokenize_contains(reason, "aphid"), f"'aphid' leaked into nasturtium gd reason: {reason!r}"
        assert not _tokenize_contains(reason, "aphids"), f"'aphids' leaked into nasturtium gd reason: {reason!r}"

    def test_nasturtium_companions_gd_no_english_pests(self, api):
        r = api.get(f"{BASE_URL}/api/plants/nasturtium/companions", params={"language": "gd"}, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        companions = data if isinstance(data, list) else data.get("companions") or data.get("items") or []
        assert isinstance(companions, list) and len(companions) >= 1
        reasons = [c.get("reason", "") for c in companions]
        _assert_no_english_pest_leaks(reasons, "/api/plants/nasturtium/companions?language=gd")


# ── Companion reasons: another non-English language ───────────────────
class TestCompanionReasonsOtherLangs:
    @pytest.mark.parametrize("lang", ["cy", "fr"])
    def test_tomato_companions_other_lang_no_english_pests(self, api, lang):
        r = api.get(f"{BASE_URL}/api/plants/tomato/companions", params={"language": lang}, timeout=90)
        assert r.status_code == 200, r.text
        data = r.json()
        companions = data if isinstance(data, list) else data.get("companions") or data.get("items") or []
        assert isinstance(companions, list) and len(companions) >= 1
        reasons = [c.get("reason", "") for c in companions]
        _assert_no_english_pest_leaks(reasons, f"/api/plants/tomato/companions?language={lang}")


# ── English path still works ──────────────────────────────────────────
class TestCompanionReasonsEnglish:
    def test_tomato_companions_en_has_readable_reasons(self, api):
        r = api.get(f"{BASE_URL}/api/plants/tomato/companions", params={"language": "en"}, timeout=60)
        assert r.status_code == 200, r.text
        data = r.json()
        companions = data if isinstance(data, list) else data.get("companions") or data.get("items") or []
        assert isinstance(companions, list) and len(companions) >= 1
        reasons = [c.get("reason", "") for c in companions]
        # English path is expected TO contain the word 'aphid' in nasturtium reason
        assert all(isinstance(r_, str) and len(r_.strip()) > 5 for r_ in reasons), f"reasons look empty/short: {reasons}"
        combined = " ".join(reasons).lower()
        # sanity: english is english
        assert any(w in combined for w in ("aphid", "pest", "attract", "companion", "away", "help", "deter")), \
            f"english reasons don't look english: {reasons}"


# ── Cache-hit path: two calls return identical body ───────────────────
class TestCompanionReasonsCache:
    def test_gd_tomato_cache_hit_identical(self, api):
        url = f"{BASE_URL}/api/plants/tomato/companions"
        r1 = api.get(url, params={"language": "gd"}, timeout=90)
        r2 = api.get(url, params={"language": "gd"}, timeout=90)
        assert r1.status_code == 200 and r2.status_code == 200
        assert r1.json() == r2.json(), "cache hit should return identical response body"


# ── Full plants list regression ───────────────────────────────────────
class TestPlantsListRegression:
    def test_plants_list_gd_size_and_no_pest_leak(self, api):
        r = api.get(f"{BASE_URL}/api/plants", params={"language": "gd"}, timeout=120)
        assert r.status_code == 200, r.text
        data = r.json()
        plants = data if isinstance(data, list) else data.get("plants") or data.get("items") or []
        assert isinstance(plants, list), f"expected list, got {type(data)}"
        assert len(plants) >= 300, f"expected 300+ plants, got {len(plants)}"
        # Smoke check: pest words 'aphid'/'whitefly' shouldn't appear anywhere in payload
        blob = str(data).lower()
        # aphid substring is fine within some translated word? Use word boundary check on whole payload
        for tok in ("aphid", "aphids", "whitefly", "whiteflies"):
            assert not re.search(r"\b" + re.escape(tok) + r"\b", blob), \
                f"english token {tok!r} leaked somewhere in /api/plants?language=gd payload"
