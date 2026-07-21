"""Batch-render every authored Calm variant for a given voice (Clyde/Nicole).

Runs sequentially — ElevenLabs enforces per-account concurrency, and pydub
mixing is CPU-bound. Writes progress to `/tmp/calm_batch_{voice}.log` so
the main agent can tail it.

Usage:
  python3 scripts/render_calm_voice_batch.py clyde
  python3 scripts/render_calm_voice_batch.py nicole
"""
import asyncio
import os
import sys
import time
from datetime import datetime, timezone

sys.path.insert(0, "/app/backend")

import httpx  # noqa: E402
from dotenv import load_dotenv  # noqa: E402
from motor.motor_asyncio import AsyncIOMotorClient  # noqa: E402

load_dotenv("/app/backend/.env")


async def main(voice_key: str) -> None:
    api_root = os.environ.get("BACKEND_URL_INTERNAL", "http://localhost:8001")
    admin_token = os.environ["ADMIN_TOKEN"]
    mongo_url = os.environ["MONGO_URL"]
    db_name = os.environ["DB_NAME"]

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    # Skip variants that already have this voice rendered — makes the batch
    # resumable if it crashes or ElevenLabs hits a rate limit.
    slugs: list[str] = []
    async for row in db.calm_variants.find({}, {"slug": 1, "blocks": 1, "voices": 1}):
        if not row.get("blocks"):
            continue  # no script authored → skip
        voices = row.get("voices") or {}
        if voices.get(voice_key, {}).get("audio_generated"):
            continue  # already rendered
        slugs.append(row["slug"])
    slugs.sort()

    total = len(slugs)
    log_path = f"/tmp/calm_batch_{voice_key}.log"

    def log(msg: str) -> None:
        stamp = datetime.now(timezone.utc).strftime("%H:%M:%S")
        with open(log_path, "a") as f:
            f.write(f"{stamp} {msg}\n")
        print(f"{stamp} {msg}", flush=True)

    log(f"=== batch start · voice={voice_key} · to_render={total} ===")

    done = 0
    failed: list[str] = []
    started = time.monotonic()
    async with httpx.AsyncClient(timeout=180.0) as http:
        for slug in slugs:
            attempt = 0
            while attempt < 3:
                attempt += 1
                try:
                    t0 = time.monotonic()
                    r = await http.post(
                        f"{api_root}/api/admin/calm/render",
                        params={"slug": slug, "voice": voice_key},
                        headers={"X-Admin-Token": admin_token},
                    )
                    dt = time.monotonic() - t0
                    if r.status_code == 200:
                        done += 1
                        js = r.json()
                        log(
                            f"  ✓ [{done}/{total}] {slug} "
                            f"({dt:.1f}s, {js.get('duration_s')}s audio, {js.get('size_bytes')} bytes)"
                        )
                        break
                    elif r.status_code == 503:
                        log(f"  ! [{done}/{total}] {slug} — BUDGET CAP HIT (503). Aborting batch.")
                        failed.append(slug)
                        return
                    else:
                        log(
                            f"  ✗ [{done}/{total}] {slug} attempt {attempt} "
                            f"→ {r.status_code} {r.text[:200]}"
                        )
                        await asyncio.sleep(5 * attempt)
                except Exception as e:  # noqa: BLE001
                    log(f"  ✗ [{done}/{total}] {slug} attempt {attempt} → {type(e).__name__}: {e}")
                    await asyncio.sleep(5 * attempt)
            else:
                failed.append(slug)

    elapsed = time.monotonic() - started
    log(f"=== batch done · voice={voice_key} · rendered={done}/{total} · failed={len(failed)} · elapsed={elapsed / 60:.1f}min ===")
    if failed:
        log(f"failed slugs: {failed}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: render_calm_voice_batch.py <voice_key>", file=sys.stderr)
        sys.exit(2)
    asyncio.run(main(sys.argv[1]))
