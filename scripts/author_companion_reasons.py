"""Author every missing companion-reason via Claude Haiku, in batches of ~10.

Writes results to `/app/backend/data/companion_reasons.json` — a git-tracked
snapshot the backend loads at startup. Idempotent: existing keys are kept,
only missing pairs are asked for. Safe to re-run.

Cost: 801 pairs × ~£0.001 ≈ £1. Runtime ≈ 3-4 min.
"""
import asyncio
import json
import os
import re
import sys
from pathlib import Path

sys.path.insert(0, "/app/backend")

from core import COMPANIONS, PLANT_INDEX  # noqa: E402
from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402
from dotenv import load_dotenv  # noqa: E402

load_dotenv("/app/backend/.env")
KEY = os.environ["EMERGENT_LLM_KEY"]

OUT_PATH = Path("/app/backend/data/companion_reasons.json")
BATCH_SIZE = 10  # pairs per LLM call
CONCURRENCY = 6


def _canonical_pairs() -> list[tuple[str, str]]:
    seen: set[tuple[str, str]] = set()
    for pid, cids in COMPANIONS.items():
        for cid in cids:
            k = tuple(sorted((pid, cid)))
            seen.add(k)
    return sorted(seen)


def _load_existing() -> dict[str, str]:
    if not OUT_PATH.exists():
        return {}
    try:
        return json.loads(OUT_PATH.read_text())
    except Exception:  # noqa: BLE001
        return {}


def _save(cache: dict[str, str]) -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2, sort_keys=True))


async def _author_batch(batch: list[tuple[str, str]]) -> dict[str, str]:
    """Ask Claude Haiku for one-line reasons for `batch` pairs."""
    system = (
        "You are a gardening companion-planting expert. For each pair of "
        "plants supplied, write ONE short sentence (max 22 words) explaining "
        "why they grow well together. Be specific — reference the actual "
        "pest, nutrient, pollinator, shade, or trap-cropping benefit. Never "
        "start with 'These plants…'. Return ONLY a JSON object mapping "
        "'PAIR_KEY' → 'reason sentence'."
    )
    lines = [
        f"{i+1}. PAIR_KEY: '{a}__{b}'  |  {PLANT_INDEX[a]['name']} + {PLANT_INDEX[b]['name']}"
        for i, (a, b) in enumerate(batch)
    ]
    user = (
        "Write one sentence per pair:\n\n"
        + "\n".join(lines)
        + "\n\nReturn a JSON object. Keys are the PAIR_KEY strings above. "
        "Values are the sentences. JSON only."
    )
    chat = LlmChat(api_key=KEY, session_id=f"comp-{batch[0][0]}",
                   system_message=system)
    chat.with_model("anthropic", "claude-haiku-4-5-20251001")
    chat.with_params(max_tokens=1500)
    resp = await chat.send_message(UserMessage(text=user))
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", resp.strip())
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{[\s\S]*\}", text)
        return json.loads(m.group(0)) if m else {}


async def _run_batch(batch, cache, sem, index, total_batches):
    async with sem:
        try:
            result = await asyncio.wait_for(_author_batch(batch), timeout=90)
            written = 0
            for (a, b) in batch:
                key = f"{a}__{b}"
                sentence = (result.get(key) or "").strip()
                if sentence:
                    cache[key] = sentence
                    written += 1
            print(f"  [{index}/{total_batches}] +{written}/{len(batch)}")
        except Exception as e:  # noqa: BLE001
            print(f"  [{index}/{total_batches}] ✗ {type(e).__name__}: {e}", file=sys.stderr)


async def main():
    cache = _load_existing()
    all_pairs = _canonical_pairs()
    missing = [(a, b) for (a, b) in all_pairs if f"{a}__{b}" not in cache]
    print(f"total pairs: {len(all_pairs)} · already cached: {len(cache)} · to author: {len(missing)}")
    if not missing:
        print("nothing to do.")
        return

    batches = [missing[i:i + BATCH_SIZE] for i in range(0, len(missing), BATCH_SIZE)]
    print(f"batches: {len(batches)} of ~{BATCH_SIZE} each · concurrency={CONCURRENCY}")

    sem = asyncio.Semaphore(CONCURRENCY)
    tasks = [_run_batch(b, cache, sem, i + 1, len(batches)) for i, b in enumerate(batches)]

    # Periodically flush cache so a crash doesn't lose progress.
    async def flusher():
        while True:
            await asyncio.sleep(20)
            _save(cache)
    flush_task = asyncio.create_task(flusher())
    try:
        await asyncio.gather(*tasks)
    finally:
        flush_task.cancel()
        _save(cache)

    print(f"done. cached total: {len(cache)}")


if __name__ == "__main__":
    asyncio.run(main())
