# RCA — patchandpot.app (grow-by-season-1) — Instagram REEL generation never completes in prod

## Summary
REEL generation (publish-now background task and the Friday `/api/instagram/preview`) is killing the backend pods with **OOMKilled (exit 137)**, not a Python exception. The synchronous, memory-heavy `_compose_reel` render exceeds the pod's **512Mi memory limit** (tier_0 Starter). The OS SIGKILLs the process mid-render, so the `_run_post` background task never reaches its `except → status=ERROR` handler — which is exactly why the `ig_posts` rows stay stuck at `COMPOSING` forever. FEED/CAROUSEL are unaffected because they are lightweight.

## Evidence
- **Tier / limits (get_tier):** tier_0 "Starter" — `cpu: 50m`, `cpu_limit: 250m` (0.25 vCPU), `memory: 200Mi`, `memory_limit: 512Mi`, 2 replicas, no HPA/VPA.
- **Pod events (get_pod_events, active run `1e5c65be…`):** both replicas OOMKilled around the incident window:
  - pod `…-khn8m`: `last terminated: OOMKilled (exit 137) at 2026-10-09T23:00:58Z, restarts=2`, now in `CrashLoopBackOff`.
  - pod `…-m2zr2`: `last terminated: OOMKilled (exit 137) at 2026-10-09T22:59:32Z, restarts=3`.
  - Liveness/Readiness/Startup probes failing with **HTTP 503** and `connection refused` from ~22:53 through ~23:00 — i.e. the event loop was blocked / the process was being killed exactly while the two REELs were composing.
- **DB (mongo_query, db `grow-by-season-1-test_database`, collection `ig_posts`):** exactly two rows stuck at `COMPOSING`, both `media_format: REEL`, created `2026-10-09T22:53:33.520Z` and `2026-10-09T22:55:05.098Z`, no `updated_at` progression. Matches the two publish-now calls.
- **App logs (loki, filtered):** the two `POST /api/instagram/publish-now … 200 OK` calls are present (they return 200 immediately because the work is fired via `asyncio.create_task`). No `ffmpeg` binary/codec error and no Python traceback appears — consistent with the process being **SIGKILLed mid-render**, not an application-level failure. FEED and CAROUSEL previews return 200.

## Why each symptom happens
1. **Rows stuck at COMPOSING:** OOMKill is `SIGKILL (137)` — it does not raise a catchable Python exception, so the `try/except` in `_run_post` never runs and the status is never moved to ERROR. The "task died silently" observation is literally the process being killed.
2. **Safari "The string did not match the expected pattern." on Preview (REEL, Fridays):** `_compose_reel` runs **synchronously inside the event loop**. During a REEL preview the pod either (a) blocks the event loop so the `/health` liveness probe returns 503 and/or (b) gets OOMKilled. The ingress/gateway then returns a non-JSON 502/503 HTML body; the frontend's `response.json()` (or a URL/JSON parse) throws that Safari `SyntaxError`. It is not a JSON contract bug — it's a gateway error page from a dying pod.
3. **Preview is ~12s on 8 CPUs but never finishes in prod:** prod has a `250m` CPU limit (~0.25 vCPU → roughly 30x slower CPU-wise) AND a `512Mi` memory ceiling. 120 frames of 1080×1920 RGB (~6.2MB raw each) plus PIL Gaussian-blur intermediates — if frames are buffered rather than streamed to ffmpeg, peak RSS easily blows past 512Mi long before encoding finishes. The memory ceiling is the hard wall; CPU throttling just makes the window long enough to guarantee the hit.

## Root cause
A CPU- and memory-bound REEL render (`backend/routers/instagram.py::_compose_reel`) runs **synchronously in the FastAPI event loop** and holds too much image data in memory, while the pod is capped at **512Mi memory / 250m CPU (tier_0)**. The render exceeds the memory limit → OOMKilled → background task killed before it can record ERROR → rows stuck at COMPOSING; the same render blocks/kills the pod during preview → gateway returns non-JSON → Safari pattern error.

## Recommended fixes (both parties must act)

### Platform / account (User) — raise resources
- The confirmed proximate cause is the **512Mi memory ceiling** of tier_0. Even with code fixes, 1080×1920×120-frame x264 encoding wants more headroom than 512Mi / 0.25 vCPU. Raise the tier in **Deployment Panel → Resources** (tier_2/tier_3 give materially more CPU+memory) so REEL rendering has room, then redeploy. This alone will stop the OOMKills for a single concurrent render; it does not fix concurrency or the stuck-row bookkeeping.

### Code (E1 applies in source) — `backend/routers/instagram.py`
1. **Get the render off the event loop.** `_compose_reel` is CPU-bound and synchronous; running it in the loop blocks `/health` and all other requests on that worker. Offload it with `await asyncio.to_thread(_compose_reel, …)` or, better, a separate worker process / job queue so a crash can't take down request serving. For the **preview** path specifically, do not render inline on the request — return a job id and poll, or enforce a strict timeout and return structured JSON on timeout so the client never receives an HTML gateway error.
2. **Stop buffering all frames in memory.** Stream frames directly into the ffmpeg/imageio writer one at a time (generate frame → write → discard) instead of building a list of 120 PIL images. This is the change that actually keeps RSS under the limit. Reuse buffers, call `img.close()`, and downscale/encode incrementally.
3. **Crash-recovery / stuck-row reaper.** Because an OOMKill can never run the `except` block, add a startup sweep (and/or a periodic job) that finds `ig_posts` with `status=COMPOSING` older than N minutes and moves them to `ERROR` with a reason, so a killed render self-heals instead of hanging forever. Also persist a heartbeat/`updated_at` during composition to detect stalls.
4. **Serialize/limit concurrent REEL renders** (e.g. a semaphore of 1 per pod) so two publish-now calls (as happened at 22:53 and 22:55) don't attempt two simultaneous heavy renders on one small pod.
5. **Manually reap the two stuck rows** (`_id` `6ac970c957f56d1842394ff2`, `6ac9706dceaf7746396e0adc`) — set them to ERROR so the UI/state is clean.

## Verification note
Not reproduced in an eph sandbox: the sandbox is provisioned with more CPU/memory than the tier_0 pod and has no app secrets, so a 512Mi OOMKill will not reproduce there and the render path needs live inputs. Diagnosis is from pod kill findings (OOMKilled exit 137 on both replicas), tier limits, and the two matching stuck REEL rows — high confidence.
