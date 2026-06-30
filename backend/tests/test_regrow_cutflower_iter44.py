"""Iter44: Regrow from Scraps + Cut Flowers feature backend verification."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://grow-by-season-1.preview.emergentagent.com").rstrip("/")


@pytest.fixture(scope="module")
def plants_en():
    r = requests.get(f"{BASE_URL}/api/plants?language=en", timeout=30)
    assert r.status_code == 200
    data = r.json()
    return data if isinstance(data, list) else data.get("plants", data)


@pytest.fixture(scope="module")
def plants_de():
    r = requests.get(f"{BASE_URL}/api/plants?language=de", timeout=30)
    assert r.status_code == 200
    data = r.json()
    return data if isinstance(data, list) else data.get("plants", data)


# ---------------- Regrow feature ----------------

class TestRegrow:
    def test_at_least_30_regrow_plants(self, plants_en):
        regrow = [p for p in plants_en if p.get("regrow_from_scrap")]
        assert len(regrow) >= 30, f"Expected >=30 regrow plants, got {len(regrow)}"

    def test_regrow_object_shape(self, plants_en):
        required = {"method", "instructions", "days_to_first_harvest", "yield_summary", "worth_it"}
        regrow = [p for p in plants_en if p.get("regrow_from_scrap")]
        missing_obj = [p["id"] for p in regrow if "regrow" not in p]
        assert not missing_obj, f"Plants flagged regrow but missing regrow obj: {missing_obj}"
        for p in regrow:
            got = set(p["regrow"].keys())
            assert required.issubset(got), f"{p['id']} missing regrow fields: {required - got}"

    def test_basil_has_regrow(self, plants_en):
        basil = next((p for p in plants_en if p.get("id") == "basil"), None)
        assert basil is not None
        assert basil.get("regrow_from_scrap") is True
        assert "regrow" in basil
        assert basil["regrow"].get("method")
        assert basil["regrow"].get("instructions")


# ---------------- Cut flower feature ----------------

class TestCutFlower:
    def test_at_least_20_cut_flower_plants(self, plants_en):
        cf = [p for p in plants_en if p.get("cut_flower")]
        assert len(cf) >= 20, f"Expected >=20 cut flower plants, got {len(cf)}"

    def test_cut_flower_object_shape(self, plants_en):
        required = {"vase_days", "cut_at_stage", "conditioning", "cut_and_come_again", "arrangement_role"}
        cf = [p for p in plants_en if p.get("cut_flower")]
        missing = [p["id"] for p in cf if "cut_flower_data" not in p]
        assert not missing, f"Cut flag set but data missing: {missing}"
        for p in cf:
            got = set(p["cut_flower_data"].keys())
            assert required.issubset(got), f"{p['id']} missing cf fields: {required - got}"

    def test_dahlia_has_cut_flower_data(self, plants_en):
        d = next((p for p in plants_en if p.get("id") == "dahlia"), None)
        assert d is not None
        assert d.get("cut_flower") is True
        assert "cut_flower_data" in d


# ---------------- Negative case ----------------

class TestTomatoNegative:
    def test_tomato_has_neither(self, plants_en):
        t = next((p for p in plants_en if p.get("id") == "tomato"), None)
        assert t is not None
        assert not t.get("regrow_from_scrap")
        assert not t.get("cut_flower")
        assert "regrow" not in t
        assert "cut_flower_data" not in t


# ---------------- i18n preservation ----------------

class TestI18nPreservation:
    def test_de_preserves_regrow_obj(self, plants_de):
        regrow = [p for p in plants_de if p.get("regrow_from_scrap")]
        assert len(regrow) >= 30
        # at least 95% retain the regrow sub-object
        with_obj = [p for p in regrow if "regrow" in p]
        assert len(with_obj) == len(regrow), f"DE lost regrow obj on {len(regrow)-len(with_obj)} plants"

    def test_de_preserves_cut_flower_data(self, plants_de):
        cf = [p for p in plants_de if p.get("cut_flower")]
        assert len(cf) >= 20
        with_obj = [p for p in cf if "cut_flower_data" in p]
        assert len(with_obj) == len(cf)


# ---------------- Regression ----------------

class TestRegression:
    def test_total_plant_count(self, plants_en):
        assert len(plants_en) >= 330, f"Expected >=330 plants, got {len(plants_en)}"

    def test_cherry_tomato_still_curated(self, plants_en):
        ct = next((p for p in plants_en if p.get("id") == "cherry-tomato"), None)
        assert ct is not None
