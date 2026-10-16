# Iter57: Regression for Claude Sonnet 4.5 -> claude-sonnet-5-5 model swap across AI features
import os
import sys
import time
import uuid
import asyncio

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/frontend/.env")
load_dotenv("/app/backend/.env")
BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
ADMIN = os.environ.get("ADMIN_TOKEN")
MEMBER = "test-token-pdf-smoke"
RUN = uuid.uuid4().hex[:6]


def _poll(url, done_fn, timeout=240, interval=4, params=None):
    t0 = time.time()
    last = None
    while time.time() - t0 < timeout:
        r = requests.get(url, params=params, timeout=30)
        last = r
        if r.status_code == 200 and done_fn(r.json()):
            return r.json()
        time.sleep(interval)
    raise AssertionError(f"Timed out polling {url}: {last.status_code if last else None} {last.text[:300] if last else ''}")


# Guidance (core._llm_json -> claude-sonnet-5-5)
class TestGuidance:
    def test_guidance_cache_miss_generates(self):
        payload = {
            "region": {"name": f"Edinburgh TEST{RUN}", "country": "United Kingdom",
                       "latitude": 55.95, "longitude": -3.19, "hemisphere": "northern"},
            "month": 3, "language": "en",
        }
        r = requests.post(f"{BASE_URL}/api/guidance", json=payload, timeout=60)
        assert r.status_code in (200, 202), r.text
        if r.status_code == 202:
            job = r.json()["job_id"]
            res = _poll(f"{BASE_URL}/api/guidance/job/{job}",
                        lambda d: d.get("status") in ("done", "error"), timeout=240)
            assert res["status"] == "done", res
            data = res["data"]
        else:
            data = r.json()
        for k in ("plant_now", "harvest_now", "tasks", "pests"):
            assert isinstance(data.get(k), list), k
        assert len(data["plant_now"]) > 0 and len(data["tasks"]) > 0
        assert isinstance(data.get("summary"), str) and data["summary"]
        # Cached now -> 200 sync
        r2 = requests.post(f"{BASE_URL}/api/guidance", json=payload, timeout=30)
        assert r2.status_code == 200
        assert r2.json()["plant_now"] == data["plant_now"]


# Ask Nàdar (haiku, regression) incl. multi-turn
class TestAsk:
    def test_ask_multiturn(self):
        r = requests.post(f"{BASE_URL}/api/ask/message", data={
            "access_token": MEMBER,
            "message": "My name is Fergus. When should I sow broad beans outdoors in Scotland? One short paragraph.",
        }, timeout=120)
        assert r.status_code == 200, r.text
        d = r.json()
        sid = d.get("session_id")
        assert sid, d
        text = (d.get("answer") or "").lower()
        assert len(text) > 50 and ("sow" in text or "bean" in text)
        r2 = requests.post(f"{BASE_URL}/api/ask/message", data={
            "access_token": MEMBER, "session_id": sid,
            "message": "What is my name? Reply with just my name.",
        }, timeout=120)
        assert r2.status_code == 200, r2.text
        assert "fergus" in str(r2.json()).lower()
        requests.delete(f"{BASE_URL}/api/ask/sessions/{sid}", params={"access_token": MEMBER}, timeout=30)


# Masterclass generation (claude-sonnet-5-5)
class TestMasterclass:
    def test_generate_masterclass(self):
        topic = f"Windowsill chilli growing test {RUN}"
        r = requests.post(f"{BASE_URL}/api/masterclass/generate",
                          json={"topic": topic, "language": "en", "access_token": MEMBER}, timeout=60)
        assert r.status_code == 200, r.text
        d = r.json()
        slug = d["slug"]
        if d["status"] == "pending":
            res = _poll(f"{BASE_URL}/api/masterclass/job/{d['job_id']}",
                        lambda x: x.get("status") in ("done", "error"), timeout=280, interval=5)
            assert res["status"] == "done", res
        g = requests.get(f"{BASE_URL}/api/masterclass/generated/{slug}",
                         params={"language": "en", "access_token": MEMBER}, timeout=30)
        assert g.status_code == 200, g.text
        body = g.json()
        mc = body.get("data", body)
        assert mc.get("title")
        assert isinstance(mc.get("lessons"), list) and len(mc["lessons"]) > 0


# Calm script authoring (claude-sonnet-5-5) — calls author_calm_script directly so we
# don't overwrite any of the 96 rendered variants via force_reauthor.
class TestCalm:
    def test_author_calm_script_direct(self):
        sys.path.insert(0, "/app/backend")
        from routers.calm import author_calm_script
        script = asyncio.run(author_calm_script(
            "march", 3, "nh", "Early Spring", 2, os.environ["EMERGENT_LLM_KEY"]))
        assert isinstance(script, dict)
        assert script.get("title")
        assert isinstance(script.get("blocks"), list) and len(script["blocks"]) >= 3

    def test_calm_author_existing_noop(self):
        r = requests.post(f"{BASE_URL}/api/admin/calm/author",
                          params={"month": 3, "hemisphere": "nh", "week": 1, "token": ADMIN}, timeout=30)
        assert r.status_code == 200
        assert r.json().get("already_exists") is True


# Instagram admin preview (caption + tips via claude-sonnet-5-5)
class TestInstagramPreview:
    @pytest.mark.parametrize("fmt", ["CAROUSEL", "SOW"])
    def test_preview(self, fmt):
        r = requests.post(f"{BASE_URL}/api/instagram/preview",
                          params={"token": ADMIN, "media_format": fmt}, timeout=60)
        assert r.status_code == 200, r.text
        pid = r.json()["preview_id"]
        res = _poll(f"{BASE_URL}/api/instagram/preview/{pid}",
                    lambda d: d.get("status") in ("DONE", "ERROR"), timeout=240, interval=5,
                    params={"token": ADMIN})
        assert res["status"] == "DONE", res.get("error")
        result = res["result"]
        print(f"\n[{fmt}] caption: {result['caption'][:400]}")
        assert result["caption"] and "patchandpot.app" in result["caption"]
        content = result["content"]
        print(f"[{fmt}] content keys: {list(content.keys())}")
        if fmt == "CAROUSEL":
            assert isinstance(content.get("tips"), list) and len(content["tips"]) == 3
            print(f"[{fmt}] tips: {content['tips']}")
        else:
            assert isinstance(content.get("plants"), list) and len(content["plants"]) > 0


# Social share captions (share_social_captions -> claude-sonnet-5-5)
class TestShareCaptions:
    def test_captions_json(self):
        r = requests.post(f"{BASE_URL}/api/share/patch", json={
            "patch_name": f"TEST_Balcony {RUN}",
            "region": {"name": "Edinburgh", "country": "United Kingdom", "latitude": 55.95, "longitude": -3.19},
            "plants": [{"id": "tomato", "name": "Tomato"}, {"id": "basil", "name": "Basil"}],
        }, timeout=30)
        assert r.status_code == 200, r.text
        sid = r.json()["share_id"]
        c = requests.get(f"{BASE_URL}/api/share/patch/{sid}/captions.json", timeout=90)
        assert c.status_code == 200, c.text
        caps = c.json().get("captions", c.json())
        print(f"\ncaptions: {caps}")
        for k in ("instagram_square", "instagram_portrait", "reels_story", "youtube_twitter"):
            assert caps.get(k), k
        # Fallback template starts with "Meet <name>" — LLM output should differ
        assert not caps["instagram_square"].startswith(f"Meet TEST_Balcony {RUN}"), "Template fallback used — LLM failed"
