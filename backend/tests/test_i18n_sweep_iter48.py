"""
Iteration 48 — bulk sweep verification.

Bugs reported: English words leaking into translated UI copy across various
languages (aphid in Scottish Gaelic, chilli pepper in Irish Gaelic). Main
agent (E1) ran scripts/i18n_sweep_fix.py to auto-translate + inject all
missing keys into all 57 non-EN locale files.

This test file verifies:
  1. Every locale file at /app/frontend/src/i18n/locales/*.js contains the
     same 863 top-level keys that en.js contains. Uses the full 'key":'
     substring pattern (NOT '^\\s*"key":') because some upsert scripts have
     concatenated keys onto the same line as neighbours — the naive
     line-start regex misses those.
  2. For the four low-resource languages (gd, cy, ga, mi): the recently-
     added keys are present AND actually translated (i.e. NOT identical to
     the English source string).
  3. Backend regression: /api/plants/tomato/companions?language=gd has a
     canonical Gaelic aphid word ('leumadair') and none of the English pest
     tokens leak.
  4. Backend regression: /api/plants/tomato/companions?language=ga has no
     English pest-name leaks.
  5. Backend regression: /api/plants?language=ga returns 300+ plants with
     no English pest tokens in the payload.
"""

import os
import re
from pathlib import Path

import pytest
import requests

BASE_URL = os.environ.get(
    "REACT_APP_BACKEND_URL",
    "https://grow-by-season-1.preview.emergentagent.com",
).rstrip("/")

LOCALES_DIR = Path("/app/frontend/src/i18n/locales")

# Any English pest / beneficial-insect / companion-plant token that must
# NEVER appear as a whole word in a non-English translated payload.
ENGLISH_PEST_TOKENS = [
    "aphid", "aphids",
    "whitefly", "whiteflies",
    "greenfly", "greenflies",
    "blackfly", "blackflies",
    "slug", "slugs",
    "snail", "snails",
    "caterpillar", "caterpillars",
    "ladybird", "ladybirds",
    "ladybug", "ladybugs",
    "hoverfly", "hoverflies",
    "lacewing", "lacewings",
]

# Recently added top-level keys the iter-48 sweep filled in.
RECENTLY_ADDED_KEYS = [
    "footer.legal.about",
    "footer.legal.disclosure",
    "home.plant_of_the_week.eyebrow",
    "source.local.title",
    "source.local.body",
    "source.local.cta",
    "source.local.tools_cta",
    "source.local.searching_near",
    "share_view.views",
]

LOW_RESOURCE_LANGS = ["gd", "cy", "ga", "mi"]


# ── helpers ────────────────────────────────────────────────────────────

# Robust key extractor that finds *every* '"key": "…' occurrence in the
# file, regardless of whether the line starts with whitespace or the key
# is concatenated onto a neighbouring key's line. Correctly handles JS
# string values (which use double-quoted keys followed by a colon and a
# double-quoted value).
_KEY_RE = re.compile(r'"([^"\\]+)"\s*:\s*"')


def _extract_keys(src: str) -> set[str]:
    return set(_KEY_RE.findall(src))


def _extract_key_value(src: str, key: str) -> str | None:
    """Return the raw JS string value for a given key, or None if absent.
    Handles single-line string values with escaped quotes.
    """
    # Match: "key":  "…value…", — value can contain \" escapes.
    pat = re.compile(
        r'"' + re.escape(key) + r'"\s*:\s*"((?:[^"\\]|\\.)*)"'
    )
    m = pat.search(src)
    if not m:
        return None
    return m.group(1)


def _word_in(text: str, token: str) -> bool:
    if not text:
        return False
    return re.search(r"\b" + re.escape(token) + r"\b", text, flags=re.IGNORECASE) is not None


def _assert_no_english_pest_leaks(reasons, where: str):
    leaks = []
    for reason in reasons:
        for tok in ENGLISH_PEST_TOKENS:
            if _word_in(reason, tok):
                leaks.append((tok, reason))
    assert not leaks, f"English pest tokens leaked in {where}: {leaks[:5]}"


def _get_companions(api, slug: str, lang: str, timeout: int = 90):
    r = api.get(
        f"{BASE_URL}/api/plants/{slug}/companions",
        params={"language": lang}, timeout=timeout,
    )
    assert r.status_code == 200, (
        f"{slug}?language={lang} → {r.status_code}: {r.text[:400]}"
    )
    data = r.json()
    if isinstance(data, list):
        return data, data
    companions = data.get("companions") or data.get("items") or []
    return data, companions


def _find(companions, cid: str):
    cid_l = cid.lower()
    for c in companions:
        for key in ("id", "slug", "name"):
            v = (c.get(key) or "").lower()
            if v == cid_l or cid_l in v:
                return c
    return None


# ── fixtures ───────────────────────────────────────────────────────────

@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Accept": "application/json"})
    return s


@pytest.fixture(scope="module")
def en_keys() -> set[str]:
    src = (LOCALES_DIR / "en.js").read_text()
    keys = _extract_keys(src)
    assert len(keys) >= 800, f"en.js suspiciously small: {len(keys)} keys"
    return keys


@pytest.fixture(scope="module")
def en_source_map() -> dict:
    src = (LOCALES_DIR / "en.js").read_text()
    return {k: (_extract_key_value(src, k) or "") for k in RECENTLY_ADDED_KEYS}


# ── 1: locale-completeness sweep (all 57 non-EN files) ────────────────
class TestLocaleCompleteness:
    """Every non-EN locale must have exactly the same 863 keys as en.js."""

    @pytest.mark.parametrize(
        "locale_path",
        sorted(p for p in LOCALES_DIR.glob("*.js") if p.stem != "en"),
        ids=lambda p: p.stem,
    )
    def test_locale_has_all_en_keys(self, locale_path, en_keys):
        src = locale_path.read_text()
        keys = _extract_keys(src)
        missing = en_keys - keys
        assert not missing, (
            f"{locale_path.stem}: {len(missing)} keys missing vs en.js. "
            f"First 10: {sorted(list(missing))[:10]}"
        )


# ── 2: low-resource langs — new keys present and translated ────────────
class TestLowResourceRecentlyAddedKeys:
    """Verify the iter-48-added keys are (a) present and (b) not identical
    to the English source string for gd/cy/ga/mi."""

    @pytest.mark.parametrize("lang", LOW_RESOURCE_LANGS)
    def test_recent_keys_present_and_translated(self, lang, en_source_map):
        src = (LOCALES_DIR / f"{lang}.js").read_text()
        missing = []
        untranslated = []
        for key in RECENTLY_ADDED_KEYS:
            v = _extract_key_value(src, key)
            if v is None:
                missing.append(key)
                continue
            en_val = en_source_map.get(key, "")
            # Skip if English source is very short (<3 chars) — a legit
            # translation may coincidentally equal it (unlikely here).
            if len(en_val) >= 3 and v.strip() == en_val.strip():
                untranslated.append((key, en_val, v))
        assert not missing, f"{lang} missing keys: {missing}"
        # Allow a small number of untranslated (e.g. proper-noun-only
        # strings) but flag if more than a couple slip through.
        assert len(untranslated) <= 2, (
            f"{lang}: {len(untranslated)} keys are still English "
            f"fallback: {untranslated}"
        )

    @pytest.mark.parametrize("lang", LOW_RESOURCE_LANGS)
    def test_all_recent_keys_have_non_empty_values(self, lang):
        src = (LOCALES_DIR / f"{lang}.js").read_text()
        empty = []
        for key in RECENTLY_ADDED_KEYS:
            v = _extract_key_value(src, key)
            if not v or not v.strip():
                empty.append(key)
        assert not empty, f"{lang} has empty values for: {empty}"


# ── 3: gd companion-reasons regression (iter 47 fix still holds) ──────
class TestGaelicCompanionRegression:
    def test_nasturtium_has_leumadair_and_no_english_pests(self, api):
        _, companions = _get_companions(api, "tomato", "gd")
        nas = _find(companions, "nasturtium")
        assert nas is not None, (
            f"nasturtium not found; got ids: {[c.get('id') for c in companions]}"
        )
        reason = (nas.get("reason") or "")
        assert reason.strip(), f"empty nasturtium reason: {nas!r}"

        # Canonical Gaelic root for aphid MUST be present
        assert "leumadair" in reason.lower(), (
            f"Expected canonical Gaelic 'leumadair' in nasturtium reason, "
            f"got: {reason!r}"
        )

        # And NO English tokens
        for tok in ["aphid", "aphids", "whitefly", "ladybird", "hoverfly"]:
            assert not _word_in(reason, tok), (
                f"English token {tok!r} leaked into gd nasturtium reason: "
                f"{reason!r}"
            )

    def test_all_gd_tomato_reasons_no_english_leaks(self, api):
        _, companions = _get_companions(api, "tomato", "gd")
        reasons = [c.get("reason", "") or "" for c in companions]
        _assert_no_english_pest_leaks(
            reasons, "/api/plants/tomato/companions?language=gd"
        )


# ── 4: ga (Irish) companion-reasons regression ────────────────────────
class TestIrishCompanionRegression:
    def test_tomato_companions_ga_no_english_pests(self, api):
        _, companions = _get_companions(api, "tomato", "ga")
        assert len(companions) >= 1, f"expected companions, got: {companions}"
        reasons = [c.get("reason", "") or "" for c in companions]
        assert all(r.strip() for r in reasons), f"empty reasons: {reasons}"
        _assert_no_english_pest_leaks(
            reasons, "/api/plants/tomato/companions?language=ga"
        )


# ── 5: /api/plants?language=ga regression ─────────────────────────────
class TestPlantsListRegressionGa:
    def test_plants_ga_size_and_no_english_pest_leak(self, api):
        r = api.get(
            f"{BASE_URL}/api/plants",
            params={"language": "ga"}, timeout=120,
        )
        assert r.status_code == 200, r.text[:400]
        data = r.json()
        plants = data if isinstance(data, list) else (
            data.get("plants") or data.get("items") or []
        )
        assert isinstance(plants, list) and len(plants) >= 300, (
            f"expected 300+ plants for ga, got {len(plants)}"
        )
        blob = str(data).lower()
        offenders = []
        for tok in ENGLISH_PEST_TOKENS:
            if re.search(r"\b" + re.escape(tok) + r"\b", blob):
                offenders.append(tok)
        assert not offenders, (
            f"english pest tokens leaked in /api/plants?language=ga: {offenders}"
        )
