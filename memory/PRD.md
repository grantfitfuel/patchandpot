### Iteration 61 (2026-02-20): ✅ — Instagram Watercolour Backgrounds
User asked for higher-quality graphics on the Instagram cards, specifically "maybe even using the watercolour garden images" — nodding to the existing `/shared/patches/*` kit that uses Gemini Nano Banana for painterly backgrounds.

- **New `_get_or_generate_bg(db, slug, orientation)`**: generates (and caches in `ig_bg_watercolours`) a Nano-Banana watercolour per content slug. Prompts are hand-crafted per topic:
  - masterclass.propagation → "glass jars with pothos cuttings rooting in water on a bright windowsill…"
  - masterclass.pest-control → "ladybirds on sunlit nasturtium leaves and companion marigolds…"
  - masterclass.no-dig → "a hand lifting dark crumbly compost over a mulched vegetable bed…"
  - masterclass.weather → "rain softly beading on broad kale leaves…"
  - masterclass.flower-arranging → "a stoneware vase on a weathered wooden bench holding freshly-cut dahlias, cosmos and sweet peas…"
  - seasonal.(Jan–Dec) → one scene per month (e.g. February "chitting seed potatoes in egg trays on a bright, cold windowsill").
  Cached by `(slug, orientation=square|vertical, v=1)` so three posts a week only ever pay the Nano-Banana cost once per content × shape pair.
- **`_compose_card` (now async)**: paints the Nano-Banana PNG as the full background, applies a tint-only full-frame darken (ink @ 55/255 alpha, blur=0 keeps the painting crisp), then a stronger blurred warm panel (forest @ 160/255, blur=14) on the bottom 48% where the body + footer sit. Text now carries a 2-px ink drop-shadow for legibility over any painting.
- **`_compose_reel` (now async)**: same watercolour background but with a subtle Ken Burns zoom (0 → 4%) + diagonal pan over the 5-second clip, so the painting feels alive rather than static. Falls back to the flat-palette version on LLM failure.
- **`_blur_overlay(blur=0)`**: new tint-only mode so a translucent darken can be applied without blurring the detail beneath.
- **Preview + worker**: all callers updated to `await _compose_*(db, slug, …)`.
- **Visual regression test**: generated a Propagation Reel — mid-frame shows crisp painterly pothos-cuttings-in-glass-jars scene with sharp "MASTERCLASS" eyebrow + "Propagation" title + body on a moss panel + patchandpot.app in butter.
- **Performance**: first post for a new slug pays ~15-20s Nano-Banana + ~15s MP4 encode (reel) / 1-2s JPEG encode (card); subsequent posts in the same slug skip the LLM entirely.
- **sw.js** bumped to `patchpot-v111`.


### Iteration 60 (2026-02-20): ✅ — Instagram Reels + Hashtag Optimizer
Follow-up to iteration 59. User picked the two "Next Action Items": Reels variant + rotating hashtag pools.

- **Reels renderer** (`_compose_reel`): PIL frame-by-frame animation assembled via `imageio` → H.264 MP4 → `ffmpeg` mux adds silent AAC audio track (Reels require audio). Output: 1080×1920, 24fps, 5s, ~150 KB. Animation: terracotta bar fades in → butter eyebrow fades up → title slides in word-by-word → body paragraph fades → drifting butter radial glow throughout.
- **Media rotation**: `ROTATION` tuples now carry media format too — `(masterclass, FEED)` Mon, `(seasonal, FEED)` Wed, `(masterclass, REEL)` Fri. Reels get 3-5× Instagram reach, so Friday carries the week's traffic punch.
- **Publish flow** branches on `media_format`: Reels use `media_type=REELS` + `video_url` + `share_to_feed=true`, poll container up to 5 min (video takes longer to transcode). Feed posts unchanged.
- **Public video route** `/api/public-video/{public_id}` serves the MP4 straight from `ig_posts.video_b64` with `Accept-Ranges: bytes` so Meta can range-request.
- **Hashtag optimizer** (`_build_hashtags`): per-post RNG picks 2 anchors (always `#PatchAndPot #UKGardening`) + 2 random from `HASHTAG_COMMON` + 3 random from content-specific pool (propagation / pest-control / no-dig / weather / flower-arranging / seasonal) + 1 random from the current season (spring/summer/autumn/winter sub-pools). Result: 7 hashtags per post, naturally varied.
- **LLM caption** no longer generates hashtags — it only writes the paragraph. Hashtags are composed from pools afterwards (`_assemble_caption`) so the feed looks hand-written, not algorithmic.
- **Admin UI**: preview renders `<video>` for Reels, `<img>` for Feed, with "📹 Reel" / "🖼 Feed" labels on preview and in the recent-posts list. Media-size badge shows KB.
- **Deps**: added `imageio==2.38.1` and `imageio-ffmpeg==0.6.0` to requirements. Bundled ffmpeg binary used — no system install needed.
- **Verified**: preview produced valid Instagram-compliant MP4 (`isom`, `avc1`, `yuv420p`, `1080x1920`, `24 fps`, silent AAC 44.1kHz, 5.00s), served over `/api/public-video/*` 200, admin UI played it inline.
- **sw.js** bumped to `patchpot-v110`.


### Iteration 59 (2026-02-20): ✅ — Instagram Auto-Publishing (Mon/Wed/Fri 9am UK)
User asked: "Can you post instagram on a regular basis". Chose a mix of masterclass teaser + seasonal highlight, 3x/week, fully automated, mini-paragraph caption with 5-8 hashtags and patchandpot.app link.

- **Backend router** `/app/backend/routers/instagram.py`:
  - OAuth: `GET /api/instagram/oauth/start` (admin-gated) → Meta login URL; `GET /api/instagram/oauth/callback` → exchanges code → short-lived → long-lived user token → `/me/accounts` → stores Page token + IG Business user ID in `ig_connection`.
  - Admin: `GET /api/instagram/status`, `POST /api/instagram/preview` (dry-run returns composed card + Claude caption), `POST /api/instagram/publish-now`.
  - Cron: `POST /api/instagram/cron/post` (bearer-auth via `WEBHOOK_CRON_SECRET`, dedupes by `X-Webhook-Id`, immediate 2xx + background task).
  - Public image: `GET /api/public-image/{token}` serves JPEG straight from `ig_posts.image_b64` (24-char URL-safe token, no auth) so Meta can fetch.
- **Composition**: 1080×1080 brand card built with PIL — forest/moss/terracotta/sand palette, butter accent, dotted texture, terracotta accent bar, patchandpot.app footer. ~90 KB JPEG, well under Meta's 8 MB limit.
- **Caption**: Claude Sonnet via `emergentintegrations`, warm informative 60-100 word gardening tip + "📖 Full guide at patchandpot.app" + 5-8 UK-flavoured hashtags including `#PatchAndPot`. Graceful fallback if LLM times out.
- **Content rotation**: Mon = masterclass teaser (cycles across 5 masterclasses by ISO week), Wed = current-month seasonal highlight (built-in 12-month digest), Fri = masterclass again.
- **Scheduler**: `/app/.emergent/crons.yml` — three entries `ig-mon-9am` / `ig-wed-9am` / `ig-fri-9am` at `0 9 * * 1/3/5` in `Europe/London`.
- **Admin UI**: `/admin/instagram` (new) + a tile on `/admin` hub. Shows connection state, preview-today, publish-now, 20-post history with status chips (COMPOSING/CONTAINER_CREATED/PUBLISHED/ERROR).
- **Env**: added `META_APP_ID`, `META_APP_SECRET`, `META_API_VERSION`, `META_OAUTH_REDIRECT`, `WEBHOOK_CRON_SECRET` to `backend/.env`.
- **Verification**: cron endpoint tested (401 unauth, 200 queued with auth), background flow composed + captioned + hit "Instagram not connected" gracefully, public image served `image/jpeg` 200, admin UI renders.
- **sw.js** bumped to `patchpot-v109`.
- **Operator next step (one-time)**: visit `/admin/instagram` after deploy, click **Connect Instagram**, grant the 4 scopes in Meta's dialog. First automatic post will fire Monday 9am UK.


### Iteration 58 (2026-02-20): ✅ — i18n Hardcoded-String Sweep
User flagged (after Scottish Gaelic + French audit): several UI strings weren't translating because they were hardcoded in JSX instead of going through `t()`. This affected both newly-added strings (from the recent vibrant redesigns) **and** some older ones.

- **67 new keys added to `en.js`** covering:
  - Wellbeing: `wellbeing.calm_cta`
  - Calm hero: `calm.hero.{eyebrow,title,blurb}`
  - Journal paywall benefits tiles (8 keys)
  - Ask paywall + perks tiles + paid hero + empty-state starters (16 keys)
  - DeepDiveSection (6 keys)
  - Guides vase-tips eyebrow
  - AIMasterclass reader labels (13 keys: back, loading, all_masterclasses, eyebrow, lesson_of, lesson_n, masterclass_label, progress, mark_complete, marked_complete, next_lesson, prev, next)
  - Home.jsx: hero_title/blurb/meta_description, ask_question CTA, 5 AI value-prop fragments, 4 ethos band keys
  - PaywallModal now reuses existing `paywall.title` / `paywall.body` keys (was duplicating English in JSX)
- **JSX refactor**: 10 files updated to call `t("…")` instead of embedding English prose: Wellbeing, Calm, Journal, Ask, Home, PaywallModal, DeepDiveSection, Guides, AIMasterclass.
- **Translation**: new script `/app/scripts/translate_vibrant_redesign_sweep.py` fans 67 keys out to all 57 non-EN locales via Claude/openai-mini. 56/57 succeeded on first run; Gujarati rerun succeeded on retry; one post-run fix needed on `gd.js` where the LLM injected a literal newline into `ask.empty.intro` (patched manually).
- **Verification**: screenshots confirmed FR + GD now render every previously-hardcoded string in-language (Wellbeing, Calm, Journal paywall, Ask paywall, Home hero).
- **Service worker** bumped to `patchpot-v108`.


### Iteration 57 (2026-02-20): ✅ — Discovery-Page Vibrant Redesign
User brief: "address these ones next — Ask Nàdar · Guides · Masterclasses index · AIMasterclass reader · Cut Flowers · Bouquet · Regrow From Scraps · Grow Anywhere · Topics".

- **9 discovery pages revamped** with the shared `PageHero` + vibrant motifs:
  - `/topics` (index) — moss hero + BeeMotif.
  - `/topics/[id]` (detail) — moss hero + SeedlingMotif, RSS icon moved to hero actions.
  - `/grow-anywhere` — moss hero + WindowsillMotif.
  - `/regrow-from-scraps` — moss hero + SeedlingMotif, Pinterest CTA promoted to hero actions.
  - `/cut-flowers` — terracotta hero + PoppyMotif, Pinterest CTA in hero.
  - `/bouquet` — terracotta hero + PoppyMotif on STEP_PICK only (result step keeps the arrangement title inside the body for readability).
  - `/guides` (index) — forest hero + SeedlingMotif.
  - `/guides/[slug]` (detail) — forest hero + HarvestMotif, back-to-guides button in hero.
  - `/masterclasses` (index) — terracotta hero + PoppyMotif.
  - `/ask` — moss hero + SeasonsMotif on paywall path, plus a new 3-tile colour-blocked "What members get" section (7 questions / Snap a photo / Threaded follow-ups) below the hero. Paid path gets compact moss hero + BeeMotif.
- **AIMasterclass reader** intentionally untouched — user preference "readability-first for body content" on long-form reader pages.
- **Also carved out of this batch**: Account/Marketing pages (About, Patrons, Capabilities Index, Learn Landing, Checkout Success, Shared Patch, Terms) — pending.
- **Service worker** bumped to `patchpot-v107`.
- **Backend tweak**: added `SUBJECT_OVERRIDES` + `IN_SOIL_STYLE` / `HARVEST_STYLE` prompt-pair system in `/app/backend/routers/plants.py` so AI plant images for 10 awkward plants (asparagus, rhubarb, potato, garlic, onion, ginger, turmeric, horseradish, jerusalem artichoke, sweet potato) render in their recognisable harvestable form. Asparagus specifically renders as individual spears emerging from soil with natural spacing (user feedback: "that's generally not how it grows — more separation"). Cache key versioned to `:v3` so production regenerates on first visit after deploy.
- **Testing**: testing_agent iteration_56 — 100% on all 19 pages (9 new + 8 regressed + 2 topic variants + 1 guide detail). No console errors. No action items.


### Iteration 56 (2026-02-20): ✅ — Vibrant Core-Page Redesign (sweep)
User brief: "Home page looks really good now; all pages need to look just as good and bright and colourful. Less like a journal or almanac." Explicit flag: Wellbeing is "shite" with "stale motifs and depressing".

- **New `PageHero` component** (`/app/frontend/src/components/PageHero.jsx`): reusable colour-blocked top band with 4 variants (forest/moss/terracotta/sand), optional Motif, action chips, and a built-in warm radial glow + dotted texture. Rhythm matches the Home page bands exactly.
- **New `VibrantMotifs` module** (`/app/frontend/src/components/illustrations/VibrantMotifs.jsx`): 8 filled-colour SVG motifs — SunriseMotif, BeeMotif, PoppyMotif, SeedlingMotif, HarvestMotif, WateringMotif, WindowsillMotif, SeasonsMotif. Replaces the stroke-only line illustrations that were flagged as stale. All motifs use the brand palette with butter/coral/sky accent swatches.
- **Tailwind config**: added `butter: #F4C96B`, `coral: #E78A6F`, `sky: #CFE1D5` so colour-blocked tiles can use utility classes.
- **Core pages redesigned** (hero bands + lighter touches, body kept on cream/sand per user preference for readability):
  - `/wellbeing` — terracotta hero (PoppyMotif), moss "mindful moment" band (SunriseMotif), 5 colour-blocked sense tiles alternating forest/sand/moss/terracotta/sand, forest "soul" band (BeeMotif with coral radial), colour-tinted mood faces, 3 colour-blocked principle tiles (moss/terracotta/forest), mood-colour left-border on history entries.
  - `/calendar` — forest hero + SeasonsMotif wheel.
  - `/pests` — moss hero + BeeMotif.
  - `/plants` — moss hero + SeedlingMotif.
  - `/garden` — forest hero + WateringMotif (redesigned to center-balance).
  - `/journal` — forest hero + PoppyMotif. Paywall state now has a 3-tile benefits section (Pin/Tag/Download) below the hero.
  - `/calm` — moss hero + SunriseMotif.
  - `/recipes` — terracotta hero + HarvestMotif.
- **Service worker**: version bumped to `patchpot-v106`.
- **Testing**: testing_agent iteration_55 reported 100% success on 8-page smoke test; one soft suggestion to fill the paywall-journal empty space was then addressed (3-tile benefits section added).


### Iteration 55 (2026-02-19): ✅ — SEC-002 completed (headers everywhere)
- **Full SEC-002 remediation**: every auth token now travels in headers, not URL query strings, so credentials no longer leak into access logs / Referer headers / browser history.
- **Member access token**: `Authorization: Bearer <token>` attached automatically by the axios interceptor on every `/api/*` request (already wired in iter 54).
- **Admin token**: new `X-Admin-Token: <token>` header attached automatically by the same interceptor on `/admin/*` and `/affiliate/*` paths. Reads from either `localStorage['pp-admin-token']` (AdminAiUsage/Geo/Calm/AskReview) or `sessionStorage['patchpot-admin-token']` (Revenue).
- **Middleware bridge** (`server.py::_accept_bearer_access_token`): reads both headers and injects them into the ASGI scope's `query_string` as `access_token=` / `token=` so every downstream route signature (`token: str = Query(...)`) keeps working unchanged. Explicit query params still win (audio player fallback).
- **Frontend rewrites**: `Ask.jsx` (6 raw fetches → `api` axios), `AdminAiUsage.jsx` (POST body flow for clear-usage), `Revenue.jsx`, `AdminGeo.jsx`, `AdminAskReview.jsx`, `AdminCalm.jsx` (all raw fetch/axios → shared `api` client), `api.js` masterclass helpers (dropped `token`/`access_token` from URL params).
- **Backend endpoint refactor**: `POST /api/admin/ask/clear-usage` now takes `_ClearUsageBody` JSON (target member `access_token` inside the body, no longer in URL). `GET /api/masterclass/library` `access_token` param made optional (Bearer-supplied).
- **Documented exception**: `GET /api/calm/{slug}/audio.mp3` intentionally retains `?access_token=` since HTML `<audio>` elements cannot send custom headers. Called out in `api.js` + `Calm.jsx` comments.
- **Testing**: iteration_54.json — 17/17 backend pytest assertions + 5/5 admin pages + `/ask` + `/calm` all verified. Zero regressions. Legacy `?token=`/`?access_token=` still accepted for backwards compat (verified via curl).
- **Test credentials doc**: updated with header-based curl examples.
- Service worker bumped v72 → v73.

---

### Iteration 54 (2026-02-19): ✅ — Security audit + SEC-001 (HIGH) fix
- Ran security audit on the deployed codebase. Findings summary:
  - **SEC-001 (HIGH)**: `/app/backend/routers/calm.py` had a hard-coded fallback admin token AND no budget-cap check before ElevenLabs spend. **FIXED**: calm.py now uses the shared `require_admin` from `routers.admin._shared` (which reads `ADMIN_TOKEN` env, no fallback), and every ElevenLabs- or LLM-spending endpoint (`/admin/calm/render`, `/render-sample`, `/author`) now calls `_enforce_budget_or_503()` first.
  - **Token rotation**: The `ADMIN_TOKEN` in `.env` was the same string as the previously-hardcoded fallback — that string is now considered leaked. Rotated to a fresh 32-byte urlsafe secret (`ppa_...`). Updated `.env` + `/app/memory/test_credentials.md`. Old string returns 403; new token returns 200 (verified).
  - **SEC-002 (MEDIUM)**: access tokens in URL query strings leak via logs / referrer headers — deferred, needs header-based auth migration.
  - **SEC-003 (MEDIUM)**: anonymous vote-brigading can auto-hide public SEO Q&A after 3 down-votes — deferred, needs vote de-dup.
  - **SEC-LOW-001 & LOW-002**: CORS wildcard + `dangerouslySetInnerHTML` on legal pages — noted for future.
- **Testing**: 15/17 backend tests PASSED via testing_agent iteration_52, 2 skipped (only informational). Zero regressions.
- Service worker bumped v70 → v71.


### Iteration 53 (2026-02-19): ✅ — Weekly rotation (4× monthly variants), tightened Claude prompt
- **Full weekly rotation shipped**: every month × hemisphere × voice now has 4 distinct weekly variants (w1–w4) with progression-aware content (Claude prompt tells it "start-of-month / mid-early / mid-late / end-of-month" so w4 crocuses are open where w1 crocuses were just pushing).
- **Slug format** changed from `{month}-{hemisphere}` to `{month}-{hemisphere}-w{1..4}`. Migrated 24 existing DB rows + 96 audio files under the new naming. Current-slug picker uses day-of-month formula (days 1-7 → w1, 8-14 → w2, 15-21 → w3, 22+ → w4).
- **Total content shipped**: 96 scripts, 192 mixed audio tracks (96 Lily + 96 George), plus 192 voice-only masters. On disk: 604MB.
- **Claude prompt tightened** with hard caps (10–14 blocks, pause budget 55–85 s, total duration 100–150 s) after the initial batch overshot to 4–5 minutes. Re-authored and re-rendered all w2/w3/w4 tracks.
- **Frontend UX**: month grid now shows one card per month with a W1/W2/W3/W4 chip row that appears under the currently-active month. Hero shows current week ("HIGH SUMMER · WEEK 3"). Auto-selects the current week on visit.
- **Backend fix**: ElevenLabs synth + pydub mix now run in a thread executor (`asyncio.get_event_loop().run_in_executor`) so the FastAPI event loop stays responsive to `/list` / `/current` / `/serve` requests during long batch renders.
- **Voice sample previews** (from earlier this session): 6-second ~1s inline preview button per voice option in the picker.
- **Free previews**: `march-nh-w1` (Early Spring) + `september-sh-w1` (Southern Early Spring). All other 190 tracks members-only.
- **Total spend** across iterations: ~£43 (before quota recharge), then further recharge for the ~92 tracks re-rendered after ElevenLabs limit hit mid-batch. Service worker bumped v66 → v70.


### Iteration 52 (2026-02-19): ✅ — Calm dual-voice + slower pacing
- **Two curated voices** now selectable per member: `lily` (velvety British female, default) and `george` (warm British male). Preference persisted in `localStorage.patchpot.calm.voice.v1`. On months where the picked voice hasn't been rendered yet, the player transparently falls back to Lily.
- **George rendered** for all 24 slugs (12 NH + 12 SH). Total ElevenLabs cost this iteration: ~£7.20.
- **Slower, more measured delivery**: (1) `voice_settings.stability` bumped 0.55 → 0.72 for calmer prosody; (2) Claude system prompt rewritten with strict pacing rules (short blocks, generous `pause_after_s` values); (3) all mixed MP3s time-stretched by 6% at mix step via pydub `_spawn` frame-rate trick (free — no ElevenLabs re-render needed).
- **New endpoints**: `GET /api/calm/voices` (public — voice options + slugs_ready per voice), `POST /api/admin/calm/render?voice=lily|george`, `POST /api/admin/calm/remix?voice=lily|george`.
- **Storage layout**: Lily uses legacy `{slug}.mp3` + `{slug}.voice.mp3`; George uses namespaced `{slug}.george.mp3` + `{slug}.george.voice.mp3`. 48 mixed tracks + 24 voice-only masters on disk (~85MB total).
- Service worker bumped v66 → v68.


### Iteration 51 (2026-02-19): ✅ — Calm enhancements: ambience bed, SH content, header pill
- **Ambience bed**: pydub-generated season-specific ambient texture layered under the voice for all 12 NH tracks. Spring=high-pass shimmer, Summer=warm mid + shimmer, Autumn=rain-like broadband, Winter=filtered brown noise + slow LFO. Voice-only stored as `.voice.mp3`; final mixed stored as `.mp3`. New `POST /api/admin/calm/remix` regenerates the mix without ElevenLabs cost.
- **Southern Hemisphere content**: 12 dedicated SH scripts + audios (`january-sh` through `december-sh`) authored via Claude with region-appropriate imagery — July SH is now "Winter Light Through Gum Leaves" (deep winter with Aussie gum-tree references), January SH is "Heat and Stillness" (high summer). SH free preview: `september-sh` (Early Spring). Slug routing updated to always use `{month}-{hemisphere}`.
- **Weekly "NEW" pill**: subtle terracotta badge in the hamburger nav (data-testid=`nav-calm-pill`) next to "2-Minute Calm". Shows when the current-month audio hasn't been played on this browser; clears on `<audio>` play event via localStorage `patchpot.calm.played.v1`.
- **Testing**: 22/22 backend pytest + all 5 frontend flows pass (`test_reports/iteration_51.json`).
- Content stats: 24 mixed MP3s (~42MB total), 12 voice-only MP3s (~21MB), all on disk. Total ElevenLabs cost this iteration: ~£3.60 (SH renders only — NH tracks were remixed offline).
- Service worker bumped v65 → v66.


### Iteration 50 (2026-02-19): ✅ — 2-Minute Calm
- Shipped the **/calm** feature: 12 monthly, AI-scripted (Claude Sonnet), AI-voiced (ElevenLabs voice `Lily`, `pFZP5JQG7iQjIQuC4Bku`) 2-minute mindful breathing tracks. NH content mirrored transparently for SH visitors.
- **Backend**: `/api/calm/current`, `/api/calm/list`, `/api/calm/{slug}` (GET + HEAD on audio), `/api/admin/calm/author` (Claude script authoring), `/api/admin/calm/render` (ElevenLabs → pydub → MP3 stitching). Storage: `/app/backend/data/calm/{slug}.mp3` + `calm_variants` Mongo collection.
- **Frontend**: `/calm` (native audio player + transcript + monthly grid with paywall gating), `/admin/calm` (author + render controls). Header nav + Wellbeing cross-link + AdminHome card.
- **Content**: All 12 NH tracks authored + rendered on disk (`january-nh` through `december-nh`, ~2:20–2:55 each, 1.6–2.0MB per MP3, total ~21MB).
- **Free preview**: `march-nh` ("First Green Light") — unlocked for anonymous visitors. Every other month requires the £5 lifetime paywall token.
- **New env**: `ELEVENLABS_API_KEY`, optional `ELEVENLABS_VOICE_ID` (defaults to Lily).
- **New deps**: `elevenlabs==2.58.0`, `pydub==0.25.1`, system `ffmpeg` (apt).
- **Testing**: 15/15 backend + frontend tests pass (`test_reports/iteration_50.json`). Only follow-up was HEAD support on audio.mp3 — added.
- Service worker bumped v64 → v65.


### Iteration 49 (2026-02-19): ✅ — Admin Ask Review Queue + Journal Pinning/Tagging + 37-key i18n sweep
- **i18n sweep — 37 new keys x 57 non-EN locales** shipped via 2 idempotent scripts:
  - `scripts/translate_topics_feedback_journal_keys.py` — 28 keys (topics.*, feedback.*, journal.*)
  - `scripts/translate_journal_pin_tag_keys.py` — 9 new keys for pin/tag UI chrome
  - Fixed ka.js `feedback.prompt` English leak identified by testing agent (translated to Georgian)
- **Admin Review Queue** — new `/admin/ask-review` (AdminHome card + AdminTokenGate). Lists every `ask_cache` row with `pending_review: true` and provides one-tap Approve (unhide) or Permanent-hide, both of which clear the review flag. Backend: `GET /api/admin/ask/pending-review`, `POST /api/admin/ask/review/{key}?decision=unhide|hide`.
- **Journal Pinning + Plant Tagging** — `/journal` now supports unlimited pins (pinned entries float to top with terracotta ring) and free-form tags with My-Garden plant name suggestions via `<datalist>`. Tag filter dropdown surfaces once ≥ 1 tag exists. All UI strings fully i18n'd. Backend: new `ask_journal_meta` collection keyed on `(access_token, user_message_id)`, endpoints `GET /api/ask/journal/meta` + `POST /api/ask/journal/meta`. `DELETE /api/ask/sessions/{id}` now cascades to metadata cleanup.
- **Testing** — 14/14 backend pytest passes (`/app/backend/tests/test_ask_review_journal_iter49.py`); frontend flows end-to-end verified by testing agent v3 iteration_49.
- Service worker bumped v59 → v61.


# Patch & Pot – PRD

## Original Problem Statement
> Take https://patchandpot.com and create a gardening app with all the features on that, with
> seasonal monthly updates on planting, pest control and tasks for that month — regional-aware
> regardless of where in the world. Cover food and flowers (incl. cut flowers + PDFs).
> Iteration 2: also add multi-language, pest reference gallery, companion suggestions,
> a "Get this month's update" button with download/print, and PWA offline mode.

## Growth & Backlog (prioritised)

### Growth ideas (sharing surfaces)
- ✅ **Plant-level OG cards** (iter 28).
- ✅ **Embeddable widget** (iter 28).
- ✅ **Garden QR sticker** (iter 28).
- ✅ **View counter + Most-loved patches wall** (iter 28).
- ✅ **"Plant of the week" homepage rail** (iter 30) — closes the loop between plant OG cards and homepage discovery.
- ✅ **SEO foundations bundle** (iter 31) — dynamic `/api/sitemap.xml` + `/api/robots.txt` honouring `x-forwarded-host`; JSON-LD Article schema on PlantDetail + WebPage schema on SharedPatch; Pinterest "Save" button on plant pages; "Email a friend" mailto button on share page.
- **P4: Weekly digest emails** — needs Resend/Postmark integration + unsubscribe handling. Defer until user demand is proven.
- **P4: Harvest-photo brag cards** — needs photo uploads, storage, moderation. Defer.

### Refactor backlog
- ✅ **Modularise `/app/frontend/src/i18n/index.jsx`** (iter 28) — split into 58 per-locale files lazy-loaded via dynamic imports. 38,082 lines → 244 lines.
- ✅ **React-key anti-pattern in `LearnLanding.jsx` + `AIMasterclass.jsx`** (iter 29) — all index-only keys replaced with content-based stable keys.
- **P4: FastAPI `@app.on_event` → modern `lifespan` context manager.**
- **P4: Consolidate `PlantDetail.jsx` + `AIPlantDetail.jsx` into one component.**

### Blocked
- **P1: Real Amazon affiliate codes in `vendors.js`** — ✅ Amazon.co.uk (`patchandpot-21`) + Amazon.com (`patchandpot-20`) wired in iter 43. Remaining: DE/FR/IT/ES/CA/AU/JP/IN tags pending user signing up for those Associates programmes.

### Iteration 68 (2026-07-19): ✅ — Topic Clusters + Feedback + Nàdar Journal (triple ship)

User picked THREE items in one message:
1. Topic Clusters (safe edition)
2. Nàdar Journal
3. Was-this-helpful widget with auto-flagging

**1. Topic Clusters — `/topics` + `/topics/{id}`**
- **`/app/backend/data/ask_topics.py`** — 10 hand-curated topics (Tomatoes · Pruning · Sowing · Composting · Pests · Watering · Herbs · Cut Flowers · Soil · Root Crops). Each has an id, label, blurb, and a `terms` list matched by word-boundary regex. **Never auto-generated** — adding a topic requires a code change so we can't accidentally publish landing pages for whatever weird thing a user asked about.
- **`GET /api/ask/topics`** — public, cache-friendly. Returns each topic with a live count of eligible questions (hits >= 1, not hidden, first-turn) — matches what a visitor will see.
- **`GET /api/ask/topics/{id}`** — public. Returns the topic metadata + all matching questions with pre-computed slugs.
- Sitemap now emits `/topics/{id}` for every curated topic (10 URLs).
- Frontend `/topics` index (tile grid with counts) + `/topics/{id}` detail (hero + Q&A list linking through to `/ask/popular/{slug}`).

**2. Feedback Widget + Auto-flag**
- **`POST /api/ask/popular/{slug}/vote`** with `{vote: "up"|"down"}` — public, rate-limited only client-side via `localStorage`.
- **Auto-flag rule**: when `down_votes >= 3 AND down_votes > up_votes * 2` the entry gets `hidden=True` and `pending_review=True`. Quality curates itself; admin sees flagged entries via `/api/admin/ask/cache-stats`.
- **`AskFeedbackWidget.jsx`** — thumbs up / down chips below the answer on `/ask/popular/{slug}`. Named to avoid clash with the existing plant `FeedbackWidget.jsx`. Silent success once voted; localStorage guards double-voting.
- Verified: three consecutive down-votes on our test question auto-hid it (topic count dropped 1 → 0, sitemap dropped the URL, single-slug endpoint returned 404). Admin `hide=false` restored everything.

**3. Nàdar Journal — `/journal`**
- Members-only view of every question the user has ever asked. Pulls existing `ask_sessions` + `ask_sessions/{id}/messages` endpoints (no new storage), flattens to chronological Q&A entries with the date, question and full answer.
- Client-side search across question + answer, empty state with a link to `/ask` for first-timers.
- Paywall gate for non-members with a proper `become a member` CTA.

**i18n** — ~28 new keys added to `en.js` (topics.* · feedback.* · journal.*). Locale sweep queued via existing translate infrastructure (not blocking).

**Cache**
- `sw.js` VERSION bumped `v58 → v59`.

**Compounding SEO surface** now has three axes:
- Every popular question → its own `/ask/popular/{slug}` URL with FAQPage JSON-LD
- Every curated topic → `/topics/{id}` landing page
- Every user session → private `/journal` retention hook
All while the `hidden` flag + auto-flag threshold + word-boundary term match combine to keep the public surface curated without editorial overhead.


### Iteration 67 (2026-07-19): ✅ — Popular Q&A sitemap + per-question pages + safety rails

User: **"Auto-add every popular question URL to /sitemap.xml so search engines discover new evergreen content as it accumulates"** — but explicitly asked for safety rails before we open the door to arbitrary user-generated URLs.

**Safety rails (backend, `routers/ask.py`)**
1. **`hidden` field** on every `ask_cache` entry (default `false`). Filters out every public surface: `/api/ask/popular`, `/api/ask/popular/{slug}`, and the sitemap URL list.
2. **`should_auto_hide(question, answer)`** heuristic runs at cache-save time:
   - Answer starts with (or contains near the start) one of a curated set of refusal markers ("I can't help", "I don't know", "as an AI", "outside gardening", "I cannot answer", …) → `hidden=True`. LLM refusals aren't useful evergreen content and often signal an off-topic ask.
   - Question contains any keyword from a small blocklist (profanity, crypto/politics, self-harm markers) → `hidden=True`.
3. **Higher sitemap threshold**: sitemap ships only `hits >= 2` (asked by 3+ members). The public `/ask/popular` list still uses `hits >= 1`, but the sitemap is intentionally more curated — a stronger signal to Google that the intent is genuinely evergreen.
4. **Admin `POST /api/admin/ask/hide/{key}?token=…&hide=true|false`** to manually flip an entry's `hidden` flag for cases the auto-guards missed (personal-info leakage, weirdly skewed answers, etc.). Confirmed end-to-end that hiding an entry immediately drops it from the sitemap + public list + slug endpoint.

**Sitemap** (`routers/seo.py`)
- `make_router(db=None)` — takes the Mongo handle so it can query `ask_cache` for popular URLs.
- Static routes list extended with the recent flagship pages: `/grow-anywhere`, `/recipes`, `/bouquet`, `/ask/popular`.
- Popular question URLs auto-added (up to 500, ordered by hits desc). Each is `/ask/popular/{slug}` where `slug = question_slug(question_normalized, key)` = kebab of first 60 chars + 6-char key prefix.
- Wrapped in a try/except so a missing collection never breaks the sitemap.

**Per-question landing** (frontend, `pages/AskPopularQuestion.jsx`)
- New route `/ask/popular/:slug`. Fetches from the new `GET /api/ask/popular/{slug}` endpoint (same safety filters applied server-side).
- **FAQPage JSON-LD schema** injected into `<head>` on mount, torn down on unmount — one clean structured-data node per question, so Google can render a rich result. Verified: `{"@context":"https://schema.org","@type":"FAQPage","mainEntity":[...]}` present in the served HTML.
- 404 state with a proper "not found" landing that bounces back to `/ask/popular`.
- Big h1 with question, "asked N times" chip, full answer with `whitespace-pre-wrap`, "Ask your own question" CTA.
- Doc `<title>` and `<meta description>` set from the question + first 155 chars of the answer.

**AskPopular.jsx** — every expanded card now shows a small "Open this question on its own page" permalink that routes to the new per-slug page. Slug shipped via the list-endpoint response.

**Admin `cache-stats`** now includes a `hidden_entries` count and each row's `hidden` flag so the operator can see moderation state at a glance.

**i18n** — 4 new keys added to `en.js` (`askpop.permalink`, `askpop.single.{back, not_found_title, not_found_blurb}`) and sweeping into all 57 non-EN locales via `/app/scripts/translate_askpop_single_keys.py`.

**Cache**
- `sw.js` VERSION bumped `v57 → v58`.

**Verified end-to-end**
- Sitemap includes `/ask/popular` + one `/ask/popular/how-do-i-prune-tomatoes-703928` after bumping `hits` to 3.
- `GET /api/ask/popular/how-do-i-prune-tomatoes-703928` returns the full 1181-char answer; bogus slug → 404.
- Admin `hide=true` → slug endpoint 404s, `/api/ask/popular` count drops to 0, sitemap loses the entry. `hide=false` restores everything.
- `should_auto_hide()` catches: "I can't help" (true), "As an AI, I cannot answer" (true), "best crypto to buy" question (true), normal pruning Q&A (false).
- FAQPage JSON-LD present in the rendered per-question HTML.

**Topic clustering deferred**: user was open to it *with safety measures*, so the same `hidden` flag + auto-hide guard will apply when we build clustered topic landing pages — no dilution risk from unvetted questions.


### Iteration 66 (2026-07-19): ✅ — Public "Common questions" page at /ask/popular

User: **"pipe the top_reused_questions output into a public 'Common questions' page at /ask/popular — instant answers with zero LLM cost, huge SEO surface area, and it turns the cache into a compounding content asset."** Built exactly that.

**Backend** (`/app/backend/routers/ask.py`)
- New `GET /api/ask/popular?limit=N` — **PUBLIC, no paywall**. Serves top cached Q&A pairs by hit count.
- Two safety rules baked into the query:
  1. `hits >= 1` — only surfaces questions asked by at least two different members. One-off, personal, or idiosyncratic questions never leak.
  2. `prior_hash == null` — only first-turn questions. Follow-ups are context-dependent and don't make sense in isolation.
- Response is browser + CDN cacheable for 1 hour with `stale-while-revalidate: 24h` — the list barely changes minute to minute, and this is meant to be an SEO surface.

**Frontend** (`/app/frontend/src/pages/AskPopular.jsx`, new route `/ask/popular`)
- Hero: eyebrow "COMMON QUESTIONS" + h1 *"What everyone asks Nàdar"* + honest intro copy ("Every one here has been asked at least twice — no fluff, no one-offs — just the honest gardening problems people actually run into. Free to browse, no sign-up.")
- Search box (client-side filter over question + answer text) with clear button.
- Expand-all / Collapse-all controls.
- Each Q renders as a collapsible card — icon + question (first-letter capitalised, trailing "?" ensured), "asked N times" chip, click-to-expand answer with `whitespace-pre-wrap` so markdown-lookalike bullets survive.
- Empty state distinguishes "no popular questions yet" vs "nothing matches your search".
- Big CTA at the bottom: *"Ask your own question — become a member"* → `/ask`.
- Reverse link too: the `/ask` paywall page now has "Or browse common gardening questions people have already asked" pointing to `/ask/popular` so non-members have a free entry point.
- Proper `<title>` + `<meta name="description">` for SEO.

**i18n** — 15 new `askpop.*` keys added to `en.js` and swept into all 57 non-EN locales via `/app/scripts/translate_askpop_keys.py`.

**Cache**
- `sw.js` VERSION bumped `v56 → v57`.

**Compounding content asset:** every future cache hit is one more count on the "asked N times" chip, and every unique question threshold-crossed is a new evergreen SEO page — zero marginal LLM cost, zero editorial effort.


### Iteration 65 (2026-07-19): ✅ — Global Q&A cache for Ask Nàdar

User: **"Remember every question and answer to reduce repeat LLM calls"** — added a persistent, global (all-users) Q&A cache that shortcircuits Claude when someone asks a question the app has already answered.

**Backend** (`/app/backend/routers/ask.py`)
- New Mongo collection `ask_cache` — `{key, question_normalized, prior_hash, answer, model, hits, first_asked_at, last_asked_at}`. Unique index on `key`, secondary index on `hits` for observability.
- `_normalize_question(text)` — aggressively lowercases / collapses whitespace / strips trailing punctuation so trivial cosmetic changes don't blow the cache.
- `_cache_key(prior_user_texts, question)` — SHA-1 hash of ALL prior user turns + the current question (24-char short-hash). This means the cache serves follow-ups too — as long as the sequence of user questions matches verbatim, the same answer is safe to reuse.
- **Safety rule: skip cache when ANY image is involved** in the current turn or anywhere in the session history. Photos of leaves / pests are unique per user, so answers keyed on text alone would be wrong.
- **Cache still bumps daily quota** — a member asking the same question a second time still uses one of their 7 daily credits. Cache reduces backend LLM cost, not user throughput. Explicit design decision.
- LLM call and cache save wrapped in one branch; cache hit branch runs an atomic `$inc` on `hits` and stamps `last_asked_at`.
- Indexes added in `server.py` startup: `ask_cache.key` (unique) + `ask_cache.hits` (desc, for "top reused questions").

**Admin observability** (`routers/admin/_maintenance.py`)
- `GET /api/admin/ask/cache-stats?token=…` — returns `{total_entries, total_llm_calls_avoided, top_reused_questions[20]}`.
- `POST /api/admin/ask/clear-cache?token=…` — nukes the cache. Documented as "use sparingly" since every entry is a paid LLM call.

**Verified end-to-end**
- 1st Q ("how do I prune tomatoes"): **4907 ms** — real Claude call, 1181-char answer.
- 2nd Q ("How  do I PRUNE tomatoes?" — different case, extra space, trailing ?): **150 ms** cache hit, identical 1181-char answer. **33× speedup, zero LLM cost.**
- 3rd Q ("When should I sow basil?"): fresh LLM call, new cache entry — no collision.
- Cache stats: `{total_entries: 2, total_llm_calls_avoided: 1}`.
- Daily usage still at 3/7 after all three (quota respected).


### Iteration 64 (2026-07-19): ✅ — Ask reframed as "Ask Nàdar"

User: **"Reframe Ask the Garden as ask Nàdar"** — the AI Q&A feature now has a proper persona and name (Nàdar = Scottish Gaelic for "nature").

**Backend** (`/app/backend/routers/ask.py`)
- `SYSTEM_PROMPT` rewritten to introduce Nàdar as the persona: "You are Nàdar (pronounced NAA-dar — Scottish Gaelic for 'nature'), the friendly, knowledgeable in-house gardening companion for Patch & Pot… you have the patient, unhurried voice of a seasoned gardener who has seen the same seasons come round for decades." Explicit guard against the model constantly announcing its own name.
- 402 paywall error string updated: "Ask the Garden is a paid feature" → "Ask Nàdar is a paid feature".

**Frontend**
- **`Ask.jsx`** — all three "Ask the Garden" strings replaced with "Ask Nàdar". Paywall + member landing both now show a small subtitle line *"Nàdar · Nature, in Scottish Gaelic"* under the h1, and the paywall intro copy is reframed as *"A patient, knowledgeable garden mentor — Nàdar answers questions… with the voice of someone who has seen the same seasons come round for decades."* Document title, placeholder text, and starter blurb ("Ask Nàdar anything garden-related…") all updated.
- **`AdminAiUsage.jsx`** — admin counter-reset label updated too.

**i18n** — `nav.ask` set to "Ask Nàdar" (verbatim, kept identical across every locale — it's a persona / brand name). Wrote `/app/scripts/translate_ask_nadar_keys.py` which upserts the label directly without an LLM call so the persona is stable across all 58 locales including CJK / RTL scripts.

**SW** bumped `v55 → v56`.


### Iteration 63 (2026-07-19): ✅ — Recipes as a feature: "A real reason to grow"

User picked: **"All and more. Make it a feature. A real reason to grow"** + **"Preserves to carry through winter"** — turned the modest recipes list into a proper flagship feature that connects growing↔cooking in both directions.

**Content (`/app/frontend/src/data/recipes.js`)** — 11 → **38 recipes** across 5 sections.
- Salads: +4 (Nasturtium & Cucumber Ribbon · Warm Lentil & Chard · Radish/Pea Shoot/Feta · Panzanella)
- Mains: +6 (One-Pan Herby Chickpeas · Kale-Garlic-Chilli Spaghetti · Roast Squash & Sage Traybake · Chard & Ricotta Tart · Sweet Potato Rösti · Pea Shoot & Mint Frittata · Garden Tomato Shakshuka)
- Sides & Soups: +4 (Nettle & Potato Soup · Wild Garlic Butter · Roasted Cherry Tomato Confit · Silky Courgette Soup)
- Sweet & Snacks: +4 (Elderflower Cordial · Rhubarb & Ginger Compote · Lavender Shortbread · Nasturtium Pesto)
- **NEW SECTION: Preserves for Winter (11 recipes)** — the emotional core of the feature. Herb oil cubes · Basil pesto cubes · Oven-dried tomatoes in oil · Tomato passata · Green tomato chutney · Chilli jam · Chilli vinegar · Bramble jelly · Rhubarb & ginger jam · Herb salt · Beetroot pickle · Rosehip syrup. Explicitly framed as "bottle summer while it's cheap — every jar is a reason to plant more next spring".
- Every recipe now carries a `season` array (spring/summer/autumn/winter/all) and a `uses` array of plant ids for cross-linking. Preserves are pinned as always-in-season because either you're making them from a glut or eating them out of the pantry.

**Frontend feature build**
- **`Recipes.jsx`** — hero reframed ("A real reason to grow"). New two-row filter bar:
  1. **Show**: All / In season now (auto-detects the current month → season) / From my garden (intersects `uses[]` with `useMyGarden`)
  2. **Diet**: All / V / VG / GF / DF
- New `?ingredient=<plant_id>` URL param filter with a dismissible chip at the top ("Showing recipes that use basil ×")
- New "Preserves for Winter" section with a subhead blurb about carrying summer through January
- Empty state when no recipes match a combined filter set
- **`PlantDetail.jsx`** — new **CookWithThisSection** below the Grow-Anywhere panel. Every curated plant now shows a grid of up to 6 recipes that use it, with a "See all N recipes →" cross-link to `/recipes?ingredient=<id>`. Confirmed with basil → 6 shown, 8 total.

**i18n** — 13 new/reworded keys in `en.js` (recipe.eyebrow reframed, recipe.section.preserves, recipe.section.preserves_blurb, recipe.filter.{show, in_season, my_garden, ingredient, clear}, recipe.empty, plants.cook_with.{heading, subheading, see_all}). Swept all 57 non-English locales via `/app/scripts/translate_recipe_feature_keys.py`.

**Cache**
- `sw.js` VERSION bumped `v54 → v55`.

**Verified**
- 42 recipe cards rendered on `/recipes` (38 recipes × their sections)
- "In season now" (Feb → winter) narrowed to 31 (winter recipes + preserves + all-season staples)
- `?ingredient=basil` deep-link filtered to 8 recipes with visible dismiss chip
- Basil plant page shows the new Cook With This grid


### Iteration 62 (2026-07-19): ✅ — Recipe images: native browser cache across refreshes

User said: **"Recipe images keep them in cache so they don't recost on refresh"** — worried each page refresh was re-downloading the ~1 MB base64 blobs (LLM cost was already zero on repeat via Mongo, but bandwidth cost was still recurring).

**Backend** (`/app/backend/routers/recipes.py`)
- Kept the existing `POST /api/recipes/{id}/image` for warming (needs the recipe body to build the prompt) — now used only when the GET 404s.
- Added `GET /api/recipes/{id}/image.jpg` which reads the cached data-URL from Mongo, decodes the base64 back to raw bytes, and returns them as an `image/jpeg` `Response` with `Cache-Control: public, max-age=2592000, immutable`. 404 if not yet warmed.

**Frontend** (`components/RecipeImage.jsx` — full rewrite)
- Uses the GET url as `<img src>` directly instead of POSTing for a base64 JSON blob.
- Placeholder now overlays the img via absolute-positioning instead of using `display:none` — the previous version was stopping the browser from fetching at all when combined with `loading="lazy"`.
- On img-error (which will happen the first time a recipe image is ever requested), fires ONE warm POST with the full recipe body, then re-sets `src` with a `?v=<timestamp>` cache-buster to trigger a fresh GET. `tried` state guards against retry loops.

**Cache stack (in production only — preview ingress strips Cache-Control)**
1. Service worker RUNTIME_CACHE (stale-while-revalidate) — already caches all GET /api/* except the NEVER_CACHE prefixes.
2. Browser HTTP cache — respects `public, max-age=2592000, immutable` for a full month.
3. Mongo `image_cache` — still the source of truth for the generated JPEG bytes; survives server restarts and shared across all users.

Verified via localhost:8001 that the origin serves the correct headers (`cache-control: public, max-age=2592000, immutable · content-type: image/jpeg · content-length: ~1 MB`) and that a fresh page load renders the golden-beet salad image correctly.

**SW** bumped `v53 → v54`.


### Iteration 61 (2026-07-19): ✅ — Bouquet From Your Patch (with in-bloom confirmation)

User picked: **"Bouquet From Your Patch: Add an in-bloom picker that arranges a bouquet from what you can cut right now and generates a watercolour share card"** and explicitly added: **"Rely on confirmation of what actually is in bloom"** — we do NOT guess from month/region; the user has to tick what's currently blooming.

**Backend**
- **`/app/backend/routers/bouquet.py`** — New router exposing `POST /api/bouquet/image`. Builds a Nano-Banana watercolour illustration prompt from the user's confirmed plant list ("A soft, loose watercolour illustration of a hand-tied garden bouquet in a low stoneware jug on cream linen…"), cached under `bouquet-image:<hash>` where hash is SHA-1 of the sorted plant list — so identical bouquets from different users share one image.
- Reuses the existing `POST /api/arrangement/suggest` for the copy (title, intro, stems, build steps, tip) — we just pass the confirmed-in-bloom subset as `my_garden` so the arrangement is guaranteed to use ONLY what the user says is blooming.

**Frontend**
- **`/app/frontend/src/pages/Bouquet.jsx`** — Two-step flow at `/bouquet`:
  1. **Pick** — a candidate grid seeded from user's My Garden ∩ (cut-flower ∪ flower) plants, falling back to the full cut-flower catalogue if their garden is empty. Each candidate is a tap-to-toggle card with terracotta highlight when selected. A live "N confirmed in bloom" counter, and a freeform "Add another (dill flower, weed, herb…)" input so foraged / weed / herb-flower stems that aren't in the catalogue can still be added.
  2. **Result** — big watercolour image at top, arrangement title + intro, vase & mechanic cards, stems (with role, count, cutting tip), numbered build steps, tip. Buttons: "Try a different arrangement" (regenerates via existing arrangement endpoint with `regenerate=true`), "Share this bouquet" (Web Share API with image attached when supported, clipboard fallback), "Explore cut-flower plants" back-link.
- Registered `/bouquet` route in `App.js`, added top-nav link in `Header.jsx`.
- Added `fetchBouquetImage(plants)` helper in `/lib/api.js`.

**i18n**
- Added ~24 new keys to `en.js` (`nav.bouquet`, `bouquet.eyebrow`, `bouquet.pick.*`, `bouquet.result.*`) and swept all 57 non-English locales via `/app/scripts/translate_bouquet_keys.py`.

**Cache**
- `sw.js` VERSION bumped `v52 → v53`.

**Design note:** the "confirm what's in bloom" copy is deliberately explicit ("We won't guess. Tick the plants you can actually cut in your garden today") because the whole differentiator is trust — we're not another AI that hallucinates a July peony in a November garden.



User picked: **"expand the grow anywhere theme"** (P3 pot litres/depth broadened into a full space-first browse hub) + **"Include recipe page like patchandpot.com/recipes.html"** + **"pictures with the recipes use nano banana with the ingredients list"** + iteratively refined the golden-beet recipe image ("thin round slices cut by a sharp knife or mandolin" → also for the orange). Follow-on P3 pot-litre/depth work is now fully absorbed into this.

**Backend**
- **`/app/backend/plants_grow_anywhere.py`** — New meta module attaching THREE fields to every plant at load time: `grow_anywhere` (list of ideal-situation ids), `min_pot_litres`, `min_pot_depth_cm`. 13 canonical situations: `windowsill · workplace · balcony · rooftop · shady-corner · hanging-basket · wall-crevice · vertical-wall · grow-bag · bucket · crate · raised-bed · water-jar`. Rules-based (category × tags × sun × water × lifecycle) plus a hand-curated `_OVERRIDES` dict for special cases (tomato → bucket/grow-bag, sunflower NOT windowsill, rosemary → wall-crevice, etc.). Applied in `core.py` right after regrow/cut-flower meta AND in `merge_promoted_plant()`.
- **`/app/backend/routers/recipes.py`** — New router exposing `POST /api/recipes/{id}/image`. Uses `make_cached_image(db)` (same helper as PlantImage/PestImage) to generate Nano Banana editorial food-photo images cached in `image_cache` under `recipe-image:<id>`. Prompt is built server-side from title + first-8 ingredients + `plating` hint or first method step, so the image renders the dish the way the recipe tells you to make it. Registered in `server.py`.

**Frontend**
- **`/app/frontend/src/data/growAnywhere.js`** — Mirror of backend SITUATIONS list with lucide icons + section groupings (small_indoors / outdoors_small / creative / bigger / no_soil).
- **`/app/frontend/src/pages/GrowAnywhere.jsx`** + `App.js` route → new `/grow-anywhere` landing hub. Hero + 5 grouped tile sections. Each tile is a link to `/plants?situation=<id>` with live plant counts derived client-side from `/api/plants`. `?highlight=<id>` from PlantDetail cross-links puts a terracotta ring on the tile.
- **`Plants.jsx`** — Reads `?situation=` from URL and filters the plant grid by `p.grow_anywhere.includes(situation)`. New compact "Grow where?" chip row above the special-collection chips with all 13 situations + "All spaces" clear + "Explore the plant library" link back to `/grow-anywhere`.
- **`PlantDetail.jsx`** — Two new cells in the spec grid (`SMALLEST POT: {n} L`, `ROOT DEPTH: {n} cm`) and a new `GrowAnywhereSection` panel below Companions showing every ideal situation with icon + i18n blurb, each linking to `/grow-anywhere?highlight=<id>`.
- **`/app/frontend/src/data/recipes.js`** — 11 hand-curated recipes across 4 sections (Quick Salads · Simple Mains · Soups & Sides · Sweet & Snacks). Each recipe carries id, section, title, time, serves, kcal, macros, diet tags (V/VG/GF/DF/can-gf), ingredients, method, `uses[]` (plant ids for cross-links) and optional `plating` override for image generation.
- **`/app/frontend/src/pages/Recipes.jsx`** + `App.js` route + Header nav → new `/recipes` page: hero, diet filter chips (V/VG/GF/DF/All), grouped recipe cards each with Nano-Banana image at top, meta bar, ingredients + method columns, diet tags, "From your patch" plant cross-link chips. Allergen key + waste-less tips at the bottom.
- **`/app/frontend/src/components/RecipeImage.jsx`** — Mirrors `PlantImage.jsx` shape: IntersectionObserver lazy load, in-memory + in-flight caches, ChefHat placeholder while generating. `?id=` deep-linkable so plant→recipe → back works.
- **`Header.jsx`** — Added top-nav links for **Grow Anywhere** and **Recipes**.

**i18n**
- Added ~65 new keys to `en.js` (nav, plants.grow_where.*, plants.pot_*, grow.*, recipe.*) and swept all 57 non-English locales via `/app/scripts/translate_grow_anywhere_and_recipes_keys.py`.

**Cache**
- `sw.js` VERSION bumped `v51 → v52`.

**Notable QA loop:** the golden-beet salad image was iterated twice — first pass showed rustic wedges, then thin mandolin rounds of beetroot only, final version shows both the beetroot AND orange sliced paper-thin into alternating overlapping circles. The prompt logic (method step → image plating cue) is now generic across all recipes.


### Iteration 60 (2026-07-19): ✅ — Grow Anywhere hub + Recipes with Nano-Banana food photos

User picked: **"First expand the grow anywhere theme. Not just regular pots"** + all situation options (windowsill, workplace, balcony, rooftop, buckets, crates, wall crevices, water-jar, hanging basket, vertical, raised bed, grow-bag, shady corner), rules-based + AI-fill data population, dedicated landing page, then explicitly added **"Include recipe page like patchandpot.com/recipes.html"** and **"Pictures with the recipes use nano banana with the ingredients list"**.

**Backend**
- `/app/backend/plants_grow_anywhere.py` — new meta module attaching `grow_anywhere[]`, `min_pot_litres`, `min_pot_depth_cm` to every plant. 13 canonical situations. Rules by category × tags × sun × water × lifecycle plus `_OVERRIDES` for edge cases (tomato → bucket/grow-bag, sunflower NOT windowsill, rosemary → wall-crevice, carrot → deep pots only).
- `/app/backend/routers/recipes.py` — new `POST /api/recipes/{id}/image` endpoint using Nano Banana. Prompt built from title + first-8 ingredients + method step or `plating` hint, cached under `recipe-image:<id>`.

**Frontend**
- `pages/GrowAnywhere.jsx` + `/grow-anywhere` route — hero + 5 grouped situation tile sections with live plant counts.
- `Plants.jsx` — reads `?situation=` from URL, filters library, adds compact chip row above special collections.
- `PlantDetail.jsx` — adds "SMALLEST POT: {n} L" and "ROOT DEPTH: {n} cm" spec cells + a `GrowAnywhereSection` panel with per-situation blurbs cross-linking back to `/grow-anywhere?highlight=<id>`.
- `pages/Recipes.jsx` + `/recipes` route — 11 hand-curated recipes across 4 sections, each with lazy Nano-Banana image cover, meta bar, ingredients/method columns, diet chips, "From your patch" plant cross-links, allergen key + waste-less tips.
- `data/recipes.js` — recipe corpus with optional `plating` field for image control.
- `components/RecipeImage.jsx` — mirror of PlantImage (IntersectionObserver lazy load + in-memory cache).
- `Header.jsx` — added Grow Anywhere and Recipes top-nav links.

**i18n** — ~65 new keys in `en.js`, swept all 57 non-EN locales via `/app/scripts/translate_grow_anywhere_and_recipes_keys.py`.

**SW** bumped `v51 → v52`.


### Iteration 59 (2026-06-30): ✅ — Regrow from Scraps + Cut Flowers (full ship)




**Backend** (already wired in prior session): `/app/backend/plants_regrow.py` (34 entries) + `/app/backend/plants_cut_flower.py` (27 entries), consumed by `apply_regrow_meta()` / `apply_cut_flower_meta()` in `core.py`. The merged catalogue exposes 31 plants with `regrow_from_scrap: True` + a `regrow{}` sub-object (method, instructions, days_to_first_harvest, yield_summary, worth_it 1–5★, family_friendly, notes) and 22 plants with `cut_flower: True` + a `cut_flower_data{}` sub-object (vase_days, cut_at_stage, conditioning, cut_and_come_again, arrangement_role, dries_well, notes).

**Frontend** (this iteration)
- **`Plants.jsx`** — Added a third "Special collections" chip row beneath the lifecycle row with two terracotta-accented toggle buttons: `data-testid="special-regrow"` and `data-testid="special-cut-flower"`. Independent of group/sub-filter (a Veg user can find regrowable veg without leaving the Edibles group). Clicking the same chip toggles it off; clicking the other one replaces the active filter. `RecommendedRail` now also hides while a special filter is active.
- **`PlantDetail.jsx`** — Two new section components below `CompanionsSection`:
  - `RegrowSection` (`data-testid="plant-regrow-section"`) — 4-cell spec grid (method · first harvest · ⭐ rating · kid-friendly) plus full instructions, expected yield and an "Honest note" callout. Renders only when `!isAi && plant.regrow`.
  - `CutFlowerSection` (`data-testid="plant-cutflower-section"`) — 4-cell spec grid (vase days · conditioning · arrangement role · cut & come again) plus the exact stage to cut at, optional "Dries well" line, and an "Honest note" callout. Renders only when `!isAi && plant.cut_flower_data`.
- **`/regrow-from-scraps` landing page** (`pages/RegrowFromScraps.jsx`) — H1 + intro, 4 method filter chips (all / water-first / water-only / soil-only), grid sorted by 5★ first. Cards show the method overline, name, ⭐ rating, yield summary, days-to-first-harvest meta line, optional Kid-friendly corner badge.
- **`/cut-flowers` landing page** (`pages/CutFlowers.jsx`) — H1 + intro, 6 role filter chips (all / focal / spike / filler / foliage / umbel), sort dropdown (longest vase life ↓ default · A→Z), grid of 22 cards. Each card shows role overline, name, `{N} days · {conditioning}` meta line, cut-at-stage description, optional "Dries well" footer line, optional terracotta "Cut & come again" corner badge.
- **`App.js`** — Two new routes registered: `/regrow-from-scraps` and `/cut-flowers`.

**i18n** — 60 new keys in `en.js` (`plants.special.*` × 5, `regrow.*` × 22, `cut.*` × 33). Translation script `/app/scripts/translate_regrow_and_cutflower_keys.py` reuses the standard LOCALES + translate_keys_for + upsert_into_locale_file pipeline. All 57 non-EN locales successfully translated and injected (verified DE: `regrow.title="Wachstum aus Abfällen"`, `cut.title="Schnittblumen"`; verified JA: `regrow.title="スクラップから再生"`, `cut.title="切り花"`).

**SW** bumped `patchpot-v32` → `patchpot-v33`.

**Verified end-to-end** via `testing_agent_v3_fork` iter44: **backend 11/11 pytest PASS** (regrow/cut-flower data shapes, DE locale preserves sub-objects, regression on cherry-tomato + 333 plants total), **frontend Playwright PASS** on every acceptance scenario (special chips toggle 333→31/22, dahlia detail shows cut-flower section, basil detail shows regrow section, tomato shows neither, /regrow-from-scraps shows 31 cards default with sort by ★, /cut-flowers shows 22 cards default with sort by vase-life, sort dropdown re-orders alphabetically, i18n keys present in de.js). Zero functional issues. One cosmetic testid naming collision flagged and fixed (`cut-card-vase-{id}` → `cut-card-meta-{id}`).


### Iteration 58 (2026-02-26): ✅ — Structured event logging

User: *"A"* (chose structured JSON logging from the menu, dropped weekly email digest from roadmap).

**New helper** `/app/backend/eventlog.py` (53 lines)
- `emit(event_name, **fields)` writes a one-line JSON record to a dedicated `pp.events` logger. Inherits root log config so events stream to the same stdout uvicorn captures — any future log aggregator (Datadog / Logtail / Better Stack) can scoop them out with one filter.
- Auto-coerces datetimes, lists, dicts, ObjectId-likes to JSON-safe primitives. Never crashes a request — wrapped fallback emits printf-style line if `json.dumps` chokes.
- No new dependency. Stays a no-op in tests (uses standard `logging`, captured by `caplog`).

**Wired event emission at 7 business-significant sites**:
- `ai.plant_guide.generated` — every successful Sonnet generation of a new AI plant guide (slug, query, language, gen_today_after, limit).
- `ai.plant_guide.rate_limited` — 429 returned after daily limit hit.
- `ai.budget.over` — edge-triggered on the FIRST refresh that observes the breach (spam-proof — doesn't fire every check while still over).
- `ai.budget.recovered` — when the cap is lifted or rolls over.
- `admin.promote.ok` — plant promoted to curated library.
- `admin.unpromote.ok` — promotion reversed.
- `admin.regenerate.cache_cleared` — "Regenerate guide" admin action.
- `admin.backfill.ai_plant_stats` — backfill ran (seeded / skipped counts).
- `checkout.created` — Stripe checkout session opened.
- `checkout.paid` — first transition from `access_granted: false → true` (idempotent — fires once per session).

**Verified end-to-end**: triggered each event type via curl + admin endpoints; all four observed events emitted as one-line JSON with timestamp and structured fields. Lint clean.


### Iteration 57 (2026-02-26): ✅ — P3 + P4 refactor pass

User: *"P3: Refactor routers/admin.py + pdf_seasonal.py. P4: Migrate @app.on_event → lifespan."*

**P4 — Lifespan migration** (`server.py`: 312 → 213 lines)
- Replaced the deprecated `@app.on_event("startup")` + `@app.on_event("shutdown")` decorators with a single `@asynccontextmanager` `lifespan` function passed to `FastAPI(lifespan=...)`. Modern FastAPI pattern, no behavioural change.
- Extracted index-creation into a private `_ensure_db_indexes()` helper and the weekly view-count decay job into `_decay_weekly_views()` so the lifespan body stays readable.
- Verified no `DeprecationWarning` in startup logs; all initial state messages match pre-refactor output.

**P3a — `pdf_seasonal.py` refactor** (273 → 311 lines, mostly docstrings)
- The 170-line `build_seasonal_pdf` is now a 30-line composition of six named section builders (`_section_cover`, `_section_plant_now`, `_section_harvest`, `_section_tasks`, `_section_pests`, `_section_my_notes_grid`, `_footer`). Each takes a shared `story` list and a `styles` dict — adding a new section is now one line in the main function.
- Verified end-to-end via direct `build_seasonal_pdf(...)` call: 13348-byte PDF with valid `%PDF-` magic header generated from a sample guidance dict.

**P3b — `routers/admin.py` split into package** (613 single-file lines → 5 files, max 297 lines each)
- Converted `routers/admin.py` into `routers/admin/` package. Externally invisible — `from routers import admin as admin_router; admin_router.make_router(db)` still works because Python prefers the package over a same-named module.
- Sub-modules grouped by intent:
  - `_shared.py` (39 lines): `require_admin` + `PromotePlantPayload`
  - `_maintenance.py` (73): refresh-guidance, cron-status, seed-deep-dives, prune, prewarm
  - `_observability.py` (297): ai-usage, referrals, profit-margin
  - `_curation.py` (228): ai-searches, promote-plant, unpromote-plant, reload, clear-cache, backfill
  - `__init__.py` (36): `make_router(db)` composer that wires each `register_*_routes()` onto the same router
- Verified all 5 endpoints still respond 200 (ai-usage, referrals, profit-margin, ai-searches, cron-status) post-refactor. Backend startup clean, lint clean.


### Iteration 56 (2026-02-26): ✅ — Homepage "Popular plants" rail + 58-locale translation

User: *"Yes"* (to my suggestion of a public popular-plants rail as the next sensible follow-up to the rate limit). Drives discovery toward already-cached AI content (cheap traffic) and creates a flywheel.

**Component** `src/components/PopularPlants.jsx`
- Reads `/api/plants/popular?language={lang}&limit=8` (endpoint already existed, fed by the same `plant_stats.view_count_7d` counter that powers `<PlantOfTheWeek>`).
- 4-column responsive grid (2 on mobile, 4 on desktop), uses `<PlantImage>` for thumbnails, displays per-card view count as a small eye-icon badge.
- Hides itself if fewer than 4 plants have view data — so a quiet week doesn't show a lonely rail. (Loading state also renders nothing rather than skeleton spinners; the rail just appears when ready.)
- Mounted on `Home.jsx` between `<PlantOfTheWeek>` and `<MostLovedPatches>` — placed deliberately *before* the patches rail so plant discovery comes first.

**i18n**
- New keys: `home.popular.{eyebrow|title|body|more|views_label}`.
- Translated into all 57 non-EN locales using a new script `/app/scripts/translate_home_popular_keys.py` (reuses the same Claude helper + per-locale injector as the previous translation runs). 57/57 succeeded. Lint passed on all 58 files. Verified DE, FR, JA, AR sound natural.

**Verified live** in preview: rail rendered 7 cards (Tomato 10 views, Basil 8, Chamomile 6, Marigold 1, Dahlia 1, Lavender 1, Strawberry 1) with proper view counts + category/difficulty metadata.

**SW bumped** `patchpot-v31` → `patchpot-v32`.


### Iteration 55 (2026-02-26): ✅ — Daily rate limit on new AI plant guides

User: *"A"* (after confirming circuit-breaker had tripped at £16.77 / £15.00 on production from real engagement plus some dev testing). Picked the 25/day-conservative option.

**Backend** (`routers/plants.py`, `routers/admin.py`, `server.py`)
- Hard ceiling on novel `/plant-guide` Sonnet generations: max **25 new uncached guides per UTC day**. Cache hits, curated lookups, and Haiku translations into other languages all skip the counter (they're free or near-free).
- Limit configurable via `AI_PLANT_GUIDE_DAILY_LIMIT` env var (default 25).
- New collection `ai_plant_gen_log` records `{day, slug, language, created_at}` per successful Sonnet generation. TTL index expires rows after 7 days.
- Over-limit returns HTTP 429 with friendly detail: *"We've hit today's AI plant-guide limit (25 new plants). Existing plant pages still work — try again tomorrow, or pick a plant from the catalogue."* — surfaces directly through `formatApiError` to the Plants page UI without any frontend changes.
- Side-effect-free: the counter only increments on a *successful* Sonnet call (the `unknown: true` early-return path skips it so misspellings don't burn slots).
- `/admin/ai-usage` now returns a `plant_guide_daily: {used_today, limit, remaining, day_key_utc}` block.

**Frontend** (`AdminAiUsage.jsx`)
- Added a "Today's new AI plant guides" mini-section below the monthly budget bar showing `used_today / limit`. Surfaces the daily ceiling at a glance so a viral day is visible before it hits the cap.

**Verified end-to-end**:
- With `AI_PLANT_GUIDE_DAILY_LIMIT=2`: first 2 novel plants generated normally; 3rd + 4th returned the friendly 429; cached plants still served 200; curated plants still served 200; admin dashboard showed `{used_today: 2, limit: 2, remaining: 0}`.
- Reset env to default 25 after testing. Cleaned up test rows (cache + stats + image).


### Iteration 54 (2026-02-26): ✅ — Net-margin row on `/admin/revenue`

User: *"Wire up profit margin"* — after I flagged that Stripe fees eat more than AI does at current volume.

**Backend** — new endpoint `GET /api/admin/profit-margin?token=&days=30` (token-gated, default 30 days, capped at 365). Returns:
- `stripe`: `{gross_gbp, fees_gbp, transaction_count, tip_gbp, fee_pct, fee_flat_gbp}` — fees estimated from UK Standard pricing (1.5% + £0.20 per txn), overrideable via `STRIPE_FEE_PCT` / `STRIPE_FEE_FLAT_GBP` env vars.
- `affiliate_earnings_gbp` — sum of `affiliate_earnings.amount` whose `period_end` falls in the window.
- `ai_spend_gbp` — Sonnet/Haiku/image cache-row counts × per-row weights from `core.py` (same algorithm as the budget circuit-breaker, just parameterised on `days`).
- `ai_calls` breakdown.
- `gross_total_gbp` / `net_profit_gbp` / `margin_pct`.

**Frontend** — Added a "Net margin" section at the top of `/admin/revenue` (above the per-network rollup). Renders 5 columns: Stripe gross · Affiliate · Stripe fees · AI spend · **Net profit** (large + bold + tone-aware colour). Verified live: gross £35 (1 founding sale), −£0.73 fees, −£5.53 AI, **net £28.74 → 82.1% margin** on the 90-day window.

**SW bumped** `patchpot-v30` → `patchpot-v31`.


### Iteration 53 (2026-02-26): ✅ — Backfill queue · Unified plant detail · SharePatch refactor

User asked for **A → E → B**: backfill the AI-promote queue from existing cache, consolidate the two plant-detail pages, refactor the giant SharePatchModal.

**A · Backfill AI-promote queue** (`routers/admin.py`)
- New endpoint `POST /api/admin/backfill-ai-plant-stats` — scans `guidance_cache` for `plant-guide:ai-*:en` rows, seeds `ai_plant_stats` with 1 synthetic view each (uses the cached guide's `name` as the query and the row's `created_at` as the first-viewed timestamp). Marks them `backfilled: true` so admin can tell synthetic rows from real traffic.
- Idempotent: rows that already have a `view_count` are skipped. Verified: first run seeded 1 + skipped 2; second run seeded 0 + skipped 3.

**E · Unified `PlantDetail.jsx`** (`src/pages/PlantDetail.jsx`)
- Single page now handles BOTH `/plants/:id` (curated) AND `/plants/ai/:slug` (AI-generated). The component inspects `useParams()` — `params.slug` ⇒ AI flow, `params.id` ⇒ curated flow — and branches accordingly:
  - Curated: `fetchPlant`, `<PlantImage>`, lifecycle + hardiness specs, Pinterest button, SEO meta + JSON-LD Article schema, `<CompanionsSection>` (DB-curated).
  - AI: `fetchCachedPlantGuide` (with `?q=` fallback to `fetchPlantGuide`), `<TopicImage>` (Gemini watercolour), AI badge, growing tips, seasonality, problems, AI companion names, warnings, safety disclaimer, `<FeedbackWidget>`, wrapped in `<PremiumGate>`.
- Sub-components `PlantDetailHero` + `AIPlantExtras` keep the file readable.
- Deleted `src/pages/AIPlantDetail.jsx` (230 lines). Both routes in `App.js` now point at the unified page.
- Verified both `/plants/cherry-tomato` (curated) and `/plants/ai/ai-yarrow` (AI): correct sections render, JSON-LD present only on curated, AI badge present only on AI, Pinterest button present only on curated.

**B · `SharePatchModal.jsx` refactor** — 745 → 211 lines
- Extracted `useSharedPatch` hook (192 lines) covering state, localStorage persistence, URL builders (shareUrl, embedUrl, qrPdfUrl, socialKitUrl), `createOrUpdate`/`removeShare` API calls, and the auto-save-on-toggle effect.
- Three new sub-components under `src/components/share/`:
  - `ShareLinkRow.jsx` (106) — URL field + Copy / Open / Native-share / Refresh.
  - `ShareSocialGrid.jsx` (213) — X / FB / WhatsApp / Pinterest / Email / Stories buttons. Holds the iOS-Facebook unfurl workaround comments + Tweet caption sanitiser + Web Share API Level 2 probe for the Stories button.
  - `ShareAdvancedBlock.jsx` (104) — `<details>` disclosure with embed snippet, QR PDF, social-kit ZIP.
- `SharePatchModal.jsx` is now just composition: header, no-region banner, error banner, create CTA, and the three sub-components.
- Verified end-to-end via browser: open modal → create link → all 12 testids present → expand advanced → open embed → snippet generated. Backend share-preview + og.png still return 200.

**SW bumped** `patchpot-v29` → `patchpot-v30`.


### Iteration 52 (2026-02-26): ✅ — "Recommended for me" rail + 58-locale translation

User: *"P1: Build Recommended for me rail … P2: Translate plants.sort.* keys"*. Shipped both:

**P1 — `RecommendedRail` component** (`src/components/RecommendedRail.jsx`)
- Pure client-side scoring on top of the existing `/api/plants` payload — no extra network call, paints instantly with the page.
- Inputs: `plants`, `region`, `month` (optional override; defaults to current month), `excludeIds` (plant IDs already in the user's active patch), `variant` ("default" | "compact"), `count` (default 4).
- Region → hemisphere → season mapping (NH/SH). Score blends season-tag match (+5), helpful-trait bonuses (cool-season + winter, drought + summer, autumn bulbs, evergreen, year-round, long-bloom), easy-win signals (beginner, very-easy, fast, productive), and a hard penalty for tender plants in winter so we don't recommend tomatoes in February to a London garden. Excludes plants already in the active patch.
- Deterministic seeded shuffle (seed = year × 100 + month + hemisphere offset) so the rail rotates monthly without breaking the top score-rank.
- **Verified**: June (NH London) → Cherry Tomato, Chickpea, Cos Lettuce, Melon. February (NH London) → Camellia, Celeriac, Leek, Parsnip. Winter picks correctly drop tender summer crops.
- **Mounted on**:
  - `Calendar.jsx` (Monthly Guide) — between MonthSelector and GuidanceView. Tracks `month` from the MonthSelector so picks update as the user scrubs months.
  - `Plants.jsx` (Library) — only on the unfiltered default view (`group === "all" && !subFilterKey && !lifecycle && !query.trim()`) so it doesn't fight a user who's already drilled into a category. Uses the compact variant.

**P2 — 58-language translation**
- New i18n keys: `recommended.eyebrow / title / subtitle / subtitle_no_region / more / season.{spring|summer|autumn|winter}`.
- Wrote `/app/scripts/translate_recommended_and_sort_keys.py` — reuses the LOCALES + LLM helper from the older `translate_new_keys.py`, but speaks the *new* per-locale layout (`src/i18n/locales/{code}.js`) instead of the legacy monolithic `index.jsx`. Replaces existing key rows or inserts before the closing `};`.
- Translated all 57 non-EN locales in a single run (57/57 success) — plus the four `plants.sort.*` keys that were carrying English fallback.
- Sanity-checked DE, FR, JA, ZH, AR, UR, HI, GD, KO, RU. Verified the `{season}` placeholder survived in every locale. Lint passed on all 58 files.
- **Verified DE in browser**: "EMPFOHLEN FÜR DICH" / "Gute Auswahl für Sommer" / picks named in German.

**SW bumped** `patchpot-v28` → `patchpot-v29`.


### Iteration 51 (2026-02-26): ✅ — Admin "Promote AI search" tool

User: *"a like I asked"* (Option A: finish the AI-promote tool that was queued mid-session). Built the full workflow:

**Backend** (`routers/plants.py`, `routers/admin.py`, `core.py`, `server.py`)
- `_record_ai_plant_view(db, slug, query, fp)` helper in `routers/plants.py` — 24h fingerprint-debounced counter for `ai-*` slug fetches. Wired into the `/plant-guide` POST handler so every successful guide fetch (cache hit AND fresh generation) bumps `view_count` + `view_count_7d` on `ai_plant_stats` keyed by slug. TTL collection `ai_plant_views` guards against single-user inflation. Bot UAs skipped.
- New endpoints in `routers/admin.py` (all token-gated):
  - `GET  /api/admin/ai-searches?limit=&include_promoted=` — joins `ai_plant_stats` with the cached EN guide JSON for the review modal.
  - `POST /api/admin/promote-plant` — body is the (edited) curated row; upserts into `promoted_plants` collection, mutates in-memory PLANTS list via `merge_promoted_plant`, flags the source `ai_plant_stats` row as promoted, and invalidates translated `plants:{lang}` catalogues so non-EN responses rebuild with the new plant.
  - `POST /api/admin/unpromote-plant?plant_id=` — reverses a promotion.
  - `POST /api/admin/reload-promoted-plants` — re-reads from Mongo without a supervisor restart.
- `core.py`: introduces `PROMOTED_PLANT_IDS` set + `load_promoted_plants(db)` / `merge_promoted_plant(plant)` / `remove_promoted_plant(plant_id)` helpers. All in-place mutations so other modules that did `from core import PLANTS, PLANT_INDEX` keep working — no rebinding.
- `server.py` startup: calls `load_promoted_plants(db)`, ensures TTL/unique indexes for `ai_plant_views`, `ai_plant_stats`, `promoted_plants`, and adds `ai_plant_stats.view_count_7d` to the weekly Monday decay job (alongside `shared_patches` + `plant_stats`).

**Frontend** (`pages/AdminAiSearches.jsx`, `App.js`, `lib/api.js`)
- New page `/admin/ai-searches` with token gate, **Candidates / Promoted** tabs, sortable list ranked by 7-day views, **Preview** + **Promote…** / **Unpromote** actions per row.
- `PromoteModal` — full editable form (Curated ID, Common name, Botanical name, Summary, Category, Difficulty, Sun, Water, Soil, Edible part, Tags, Container-friendly). Pre-fills from the cached AI guide with sensible defaults; defaults the curated ID to the slug stripped of its `ai-` prefix so URLs stay clean.
- Cross-links from `/admin/ai-usage` ("→ Promote AI searches") for navigation between admin dashboards.
- API helpers: `fetchAdminAiSearches`, `promoteAiPlant`, `unpromoteAiPlant`.

**Side-fix**: `AdminTokenGate.jsx` had `<title>{title} — Patch & Pot</title>` which produces multiple Helmet children and crashed the page through the ErrorBoundary (existing bug — `/admin/referrals` was also affected). Wrapped in a template literal so it's a single string child.

**SW bumped** `patchpot-v26` → `patchpot-v27`.

**Verified end-to-end (UI + curl)**:
1. AI plant guide fetch increments view count → row appears in `/admin/ai-searches`.
2. Promote modal saves → toast confirms → row moves to Promoted tab → plant appears in `/api/plants?language=en` immediately (no restart).
3. Unpromote → plant disappears from `/api/plants` → row moves back to Candidates.


### Iteration 50 (2026-02-26): ✅ — Library 182 → 332 + Cloudflare cache header fix

**Part A — +150 plants**: 50 edibles (tomato/pepper variants, lettuce varieties, Asian greens, herb cultivars, root veg, perennial veg), 50 pollinator flowers (asters, hardy geraniums, salvias, more lavenders, alliums, bulbs, hellebores), 50 cut flowers (dahlia/sunflower/sweet pea/tulip/peony variants, pollinator-friendly cut flowers).
- New file `/app/backend/plants_extra_v2.py` (`EXTRA_PLANTS_V2` + `EXTRA_COMPANIONS_V2`).
- `plants_meta.py` extended with 150 lifecycle/hardiness + 150 botanical names.
- Wired into `core.py`. Total: **332 plants, 0 missing metadata, 0 broken refs**.

**Support email action item**: Added `CDN-Cache-Control: max-age=60` to `/api/share/patch/{share_id}/og.png` response in `routers/share.py:461`. Tells Cloudflare's edge to honour the cache for proxied `/api/*` images (the platform-level Cache-Control header wasn't being respected by Cloudflare for proxied responses).

**Deferred to next turn**: Part B — admin "Promote AI search" tool with review modal (user confirmed option b).

Service worker bumped `patchpot-v24` → `patchpot-v25`. Lint clean.


### Iteration 49 (2026-02-26): ✅ — Sub-filters + lifecycle + hardiness across all 182 plants

User: *"…also a further filter for type vegetable root gourd squash"* → tag/category-based sub-filter row. Then *"important with flowers to know if annual biennial or perennial and also if hardy half-hardy or otherwise"* → enriched all 182 plants with `lifecycle` + `hardiness` metadata, displayed on card subtitle + detail page + as a lifecycle chip row.

**Filter rows shipped (3-tier hierarchy)**
1. **Group chips** (8): All / Edibles / Herbs / Fruit / Flowers / Cut flowers / Shrubs & climbers / Sprouting.
2. **Sub-filter chips** (per-group): for *Edibles* → Veg/Brassica/Legume/Squash/Leafy/Allium/Root; for *Flowers* → Bulbs/Drought/Shade/Edible petals/Fragrant; for *Cut flowers* → Bulbs & corms/Spires/Fillers/Fragrant/Everlasting/Perennials; for *Shrubs & climbers* → Shrub/Climber. Mix of category-based and tag-based matching.
3. **Lifecycle chips** (Annual/Biennial/Perennial) — shown only when the current slice has ≥2 lifecycles present (auto-hides for e.g. patio fruit which are all perennial).

**Data model additions**
- New `/app/backend/plants_meta.py` exporting `apply_meta(PLANTS)` — maps every plant id to `lifecycle` (annual/biennial/perennial) and `hardiness` (hardy/half-hardy/tender/indoor). Curated for UK-temperate cultivation reality (tomato = tender annual, dahlia = half-hardy perennial, snowdrop = hardy perennial bulb, etc.).
- Mutates `PLANTS` in place after `EXTRA_PLANTS` are merged in `core.py`. Zero schema drift on the API response.

**Display**
- Plant card subtitle: "Half-hardy perennial" / "Hardy annual" etc. under the plant name on every catalogue card.
- Plant detail page: two additional info pills (LIFECYCLE / HARDINESS) alongside sun/water/soil/difficulty/container/edible-part.
- Sprouts get `hardiness: indoor` → renders "Indoor annual" (no claim about frost behaviour).

**i18n** — 27 new keys translated across all 57 non-English locales via three injector scripts:
- `inject_plant_subfilter_locales.py` — 9 sub-filter labels.
- `inject_plant_lifecycle_locales.py` — 12 lifecycle/hardiness keys.
- Each script is idempotent and regex-anchored to an existing locale entry.

**Backend regression caught & fixed**
- Old cached translated plant catalogues (`db.guidance_cache` key prefix `plants:`) didn't include the 150 new plants → 404 for new plant detail pages in any non-English language that had been visited before.
- Cleared 5 stale cached translations (`plants:de/fr/ja/ar/...`).
- Translation function now **chunks 182 plants into 50-plant batches and calls `_llm_json_cheap` in parallel via `asyncio.gather`** (was a single LLM call that exceeded the 60s ingress timeout). FR catalogue re-translates cold in ~49s, then hits cache.

**Service worker** bumped to `patchpot-v21`. Plant pytest suite still 15/15 pass. Lint clean.


### Iteration 48 (2026-02-26): ✅ — Plant filter grouped + 57-locale translation injection

**Grouped filter (`Plants.jsx`)**
Filter chips reduced from 15 flat categories to 8 high-level groups: All / Edibles / Herbs / Fruit / Flowers / Cut flowers / Shrubs & climbers / Sprouting. Each group maps to one or more underlying `category` values. Fits in one row on desktop and wraps cleanly on mobile. Per-card category badges now run through `catLabel()` (was using raw English).

**Group label keys** added to `en.js`: `plants.group.{all,edibles,herbs,fruit,flowers,cut-flowers,shrubs,sprouts}` (8 keys).

**57-locale translation injection**
Wrote a one-shot Python tool at `/app/scripts/inject_plant_category_locales.py` that:
- Holds curated translations for the 7 `plants.category.*` keys (cut-flower, brassica, legume, squash, sprouts, shrub, climber) AND the 8 `plants.group.*` keys across all 57 non-English locales.
- Uses a regex anchor on the existing `"plants.category.flower"` line to insert the new block immediately after it — preserves file formatting & is idempotent.
- All 57 locales updated successfully (`{'ok': 57, 'skip-exists': 0, 'no-anchor': 0}`).

Verified live: DE/JA/AR/FR locales all render translated group chips and per-card category badges. Lint clean across locales/ and Plants.jsx. Service worker bumped to `patchpot-v19`.


### Iteration 47 (2026-02-26): ✅ — Plant library expanded 32 → 182 (150 new entries)

User: *"Expand current plant library"* → chose option C (~100 more), then *"Add another 50 cut flowers on top of the 100 additions overall."* → final spec **150 new plants** with full companion data.

**Split shipped**
- Cut flowers: 72 (dahlia, snapdragon, ranunculus, anemone, lisianthus, ammi, nigella, tulip, narcissus, gladiolus, lilies, iris, freesia, hyacinth, amaryllis, carnation, wallflower, stock, larkspur, scabiosa, sweet william, sweet rocket, honesty, forget-me-not, sweet alyssum, lobelia, petunia, impatiens, tuberous begonia, crocosmia, agapanthus, canna, nerine, tithonia, strawflower, craspedia, amaranthus, celosia, salvia horminum, bells of ireland, annual phlox, monarda, coreopsis, liatris, veronica, nicotiana, cleome, orlaya, didiscus, salpiglossis, matricaria, eucalyptus cinerea, dusty miller, peony, heliopsis, trachelium, iceland poppy, allium globemaster, china aster, gypsophila, statice, sweet sultan, achillea, delphinium, lupin, eremurus, dianthus, cornflower, rudbeckia)
- Pollinator/wildlife flowers: 14 (echinacea, verbena bonariensis, salvia 'amistad', sedum 'autumn joy', ajuga, agastache, eryngium, foxglove, hellebore, hollyhock, primrose, snowdrop, crocus, scilla)
- Veg: 18 (legumes, leeks, shallots, onions, fennel bulb, celery, celeriac, chard, pak choi, rocket, watercress, sweetcorn, asparagus)
- Brassicas: 6 (broccoli, cauliflower, cabbage, brussels, kohlrabi, romanesco)
- Squash: 4 (pumpkin, butternut, melon, gherkin)
- Patio fruit: 12 (blueberry, raspberry, blackberry, gooseberry, currants, fig, lemon, dwarf apple/pear/cherry, rhubarb)
- Herbs: 10 (sage, oregano, lemon balm, dill, fennel-herb, lemongrass, tarragon, bay, lovage, chervil)
- Sprouting/windowsill: 6 (microgreens, pea shoots, mustard cress, broccoli sprouts, baby leaf, alfalfa)
- Shrubs/climbers: 8 (rose-shrub, hydrangea, clematis, jasmine, wisteria, camellia, box, honeysuckle)

**Architecture**
- New file `/app/backend/plants_extra.py` exporting `EXTRA_PLANTS` (150 entries, same schema as core) and `EXTRA_COMPANIONS` (companion id list per new plant; references resolve to both original 32 and new 150).
- `core.py`: extends `PLANTS` and `COMPANIONS` in-place immediately after the original lists, then rebuilds `PLANT_INDEX`. Diff is 9 lines in `core.py`, keeping the curated 32 readable.
- Frontend `/plants/Plants.jsx`: `CATEGORIES` array expanded with new chips (Cut flower, Brassica, Legume, Squash, Sprouts, Shrub, Climber). `en.js` adds 7 new `plants.category.*` keys; other 57 locales fall back to English chip labels via the existing 3-tier `t()` fallback.

**Validation**
- `/api/plants` returns 182 entries (verified via curl + Counter).
- All 182 companion-reference targets resolve to real plant ids — **0 broken refs**.
- Existing plant pytest suite (`test_plants_i18n.py`, `test_plant_of_the_week.py`) — **15/15 pass**, no regressions.
- Plants page filter chips render; clicking "Cut flower" returns the expected 72 cards. Dahlia detail page loads with full schema (sun/water/soil/etc), watercolour image, "Plants well with" section.
- Service worker bumped patchpot-v17 → patchpot-v18.

**Known cost note**: New plant cards lazy-generate watercolour images via Gemini Nano Banana on first view. Each ~$0.04, cached forever in MongoDB. Worst case if the entire library is browsed once: ~$6 one-time. Cheap and self-limiting.


### Iteration 46 (2026-02-26): ✅ — Ask the Garden cost-optimised (Haiku 4.5 + 7/day cap)

User confirmed the threaded paywalled AI Q&A feature was loss-making at Claude Sonnet 4.5 pricing against the £2.99/mo tier. Three changes shipped:

1. **Model swap**: `/app/backend/routers/ask.py:29` ASK_MODEL changed from `claude-sonnet-4-5-20250929` → `claude-haiku-4-5-20251001`. Vision (photo plant-ID, leaf disease) preserved.
2. **Daily cap reduced** 10 → 7 in `ask.py:28` (DAILY_QUESTION_CAP) + `Ask.jsx:24` default state + paywall gate copy ("up to 7 questions per day") + frontend page docstring.
3. **Model name hidden** from all user-facing copy — no more "Claude Sonnet 4.5 vision" leaks in docstrings or UI. Gives freedom to swap providers in future without notice.

Service worker bumped to `patchpot-v15` for cache invalidation. Verified end-to-end with `testing_agent_v3_fork` (iteration_43.json): 12/12 backend pytest (`/app/backend/tests/test_ask_iter43.py`) + 4/4 frontend Playwright scenarios — paywall gate copy + zero model-name leaks, paid UI render + counter, text send + decrement + sidebar, image upload + preview + assistant reply. No bugs. Advisory notes from test agent: (a) consider TTL index on `ask_usage.date` for housekeeping, (b) consider explicit AssistantMessage replay for stronger threading contract, (c) consider catching Anthropic 'Could not process image' upstream error and surfacing a clearer 400 instead of 503 — all backlogged, not blocking.


### Iteration 45 (2026-02-25): ✅ — Sovrn Commerce wired + global Amazon storefronts + share-preview saga closed

**Sovrn Commerce (VigLink) auto-affiliate**
- JS snippet installed in `/app/frontend/public/index.html` head, publisher key `20a9d01be27f18461a707e10511c35bc`.
- Exclude list: `['amazon.com', 'amazon.co.uk']` only — so all other Amazon storefronts route via Sovrn at ~75% commission instead of earning 0% with no direct tag.
- Farmer Gracy Sovrn smart link `https://sovrn.co/18v2elc` wired into a new "Trusted partners" section on `/about` so Sovrn's reviewer can click-verify. First click registered, review clock ticking (3-5 business days).
- Sovrn named in `/terms#affiliates` disclosure copy.

**Global Amazon coverage** in `/app/frontend/src/data/vendors.js`
- Added Amazon.de, .fr, .it, .es, .nl, .be, .se, .pl, .tr, .ca, .com.au, .co.jp, .com.mx, .com.br, .sg, .ae, .sa entries as `kind: "tools"` in their respective country lists.
- 18 new country/region keys added: Belgium, Sweden, Poland, Turkey, Mexico, Brazil, UAE, Saudi Arabia, Singapore (plus Amazon storefront added to existing Canada/AU/NZ/DE/FR/IT/ES/NL/JP).
- All non-UK/US Amazon links are non-tagged; user can swap `&tag=patchandpot-XX` in per storefront as they sign up for each Associates programme.

**Share preview saga — finally closed**
- After 14 days of iteration and an Emergent support escalation, root causes identified:
  1. og.png endpoint was rendering letterpress, NOT watercolour (iter 44 fix).
  2. Cloudflare CDN had cached the 40 KB letterpress for 24h; bumped Cache-Control from 86400 → 60s.
  3. `/p/{share_id}` SPA prerender service was an "experimental platform feature" silently decommissioned by Emergent after a redeploy — broke OG meta injection for bots.
- Workaround shipped: all share modal intents now route through `/api/share/preview/{share_id}` (proper server-rendered OG, ~5 KB HTML with og:title + og:image + twitter:card). Verified live on prod with curl + Facebook Sharing Debugger.
- Static brand-fallback OG card added at `/api/share/og/brand.png` + declared in `index.html` for any manually-pasted `/p/{id}` URL.
- Support recommended Next.js migration as "the only fix" — user rejected on cost/risk grounds. Position formally held. Support eventually conceded the technical points and escalated complaint to Product & Engineering leadership. 200 ECU goodwill credit issued.
- Service worker bumped iter40 → patchpot-v13.

### Iteration 44 (2026-02-25): ✅ — Share assets ACTUALLY watercolour now (root-cause fix)

User feedback across multiple iterations: "still line drawing", "Facebook just opens Facebook", "Pinterest is line art", "Twitter has two URLs", "email has the ugly api URL". Every complaint was a symptom of one or both of these:

1. **112 stale watercolour cache documents** in MongoDB from when the LLM key was budget-blocked. Cache key didn't include `render_version`, so stale bytes kept being served. **Fix**: wiped collection + added `render_version` to find AND upsert filter in `_get_or_generate_watercolour` (`routers/share.py:478, 547`).
2. **og.png was rendering letterpress, NOT the watercolour.** When the iter37 redesign wired the watercolour into the 4 social-kit ZIP sizes + the standalone story.png, it MISSED the 1200×630 OG card endpoint — which is what Facebook, iMessage, WhatsApp, LinkedIn, Pinterest, Twitter Cards and Slack ALL unfurl from. So every "normal" share showed letterpress. **Fix**: added `og_card` layout to `_LAYOUTS` (1200×630, panel_top_frac=0.34) + new `render_share_og_card()` public function that reuses the existing `_compose_watercolour()` compositor + routed `og.png` endpoint through it with watercolour bytes + render_version cache key.

**Other fixes folded in:**
- SharePatchModal: split `shareUrl` (pretty `/p/{id}` shown to humans, used in clipboard / email body / WhatsApp body) from `crawlerUrl` (`/api/share/preview/{id}` passed to FB/Twitter sharer intents so platforms scrape proper OG meta).
- Twitter intent: strips inline `patchandpot.app` URLs from the AI caption so the tweet doesn't carry a duplicate link.
- FB + WhatsApp: native `navigator.share()` on mobile (sidesteps iOS Facebook universal-link interception that was dropping the URL param).
- Service worker bumped to `patchpot-v9` so iOS Safari pulls in the new JS.
- Cache `RENDER_VERSION` bumped to `iter44-watercolour-v2` (forces fresh re-render across every existing share link in prod on first view after redeploy).

**Other changes in this session:**
- Amazon Associates tags wired: `patchandpot-21` (UK) + `patchandpot-20` (US) into vendors.js (`amazon-uk` and `amazon-us` entries + GLOBAL fallback).
- Awin publisher ID (`2954417`) saved in vendors.js with `awinLink(mid, url)` helper ready for Crocus / Sarah Raven / Farmer Gracy / T&M / Suttons / Marshalls / Dobies merchant IDs.
- SourceLinks.jsx picker fixed: now prefers `kind === "tools"` for the third slot (was picking Suttons / Botanical Interests over Amazon).
- About page (`/about`) shipped with editorial process, trust & compliance copy, owner identity (Grant Cameron Anthony, Barrhead).
- Affiliate disclosure section added to `/terms#affiliates` with verbatim Amazon Associates statement.
- Footer: new Disclosure + About links.
- Pricing corrected on Terms / Privacy: 5 tiers (£2.99 / £5 / £9 / £15 / £50) — was stale £5/£25 in EN + Kannada locales.

### Iteration 43 (2026-02-25): ✅ — Amazon Associates tags wired (UK + US)

User supplied two tags. Wired into `/app/frontend/src/data/vendors.js`:
- `amazon-uk` (kind=tools) added to United Kingdom vendor list with `&tag=patchandpot-21`.
- `amazon-us` (kind=tools) added to United States vendor list with `&tag=patchandpot-20`.
- GLOBAL fallback's Amazon.com link now carries `&tag=patchandpot-20` (was placeholder).
- India Amazon entry: stripped `&tag=YOUR_AFFILIATE` placeholder (no IN tag yet, kept link clean).
- All other locales (DE/FR/IT/ES/CA/AU/JP/IN) remain non-affiliated until owner signs up.

Click tracking already in place via `navigator.sendBeacon → POST /api/affiliate/click`. Cards carry `rel="sponsored noopener noreferrer"`.

### Iteration 42 (2026-02-25): ✅ — SharePatchModal UX refactor + RENDER_VERSION cache-busting VERIFIED

User: *"The buttons should package and share pre-built stories/reels/posts with the link. Not just a zip of useless never-asked-for crap... share appears way down the middle of the screen, not the top."*

**Refactor**
- `SharePatchModal.jsx`: ZIP/embed/QR demoted into a collapsible `<details data-testid="share-patch-advanced">`. One-tap social buttons promoted as primary CTAs: Tweet, Facebook, WhatsApp, Pinterest, Email, Instagram Story.
- Modal layout: `items-start sm:items-center pt-10 sm:p-10` — anchors near top on mobile, centred on desktop. No more "way down the middle on phones".
- `share-patch-story` button gated on `navigator.canShare({files})` — only visible on mobile capable browsers (iOS Safari, Chrome Android). Desktop users see Tweet/FB/WhatsApp/Pinterest/Email.

**Cache invalidation**
- `share_social_kit.py:40` adds `RENDER_VERSION = "iter37-watercolour-v1"`.
- `routers/share.py` story.png + social-kit.zip endpoints now key `find_one` AND `update_one` cache writes by `(share_id, render_version)`. Bumping `RENDER_VERSION` forces fresh AI watercolor renders site-wide, no DB wipe needed.

**Test report**: `/app/test_reports/iteration_42.json` — backend 13/13 (7 new + 6 regression), frontend 11/11 acceptance points. Zero bugs.

**Cost analysis** (delivered to user inline):
- Marginal cost per active user: $0.05–$0.45/mo (Nano Banana cached per share, Claude Sonnet cached per region/month).
- Stripe Premium @ £35/lifetime founding tier or recurring subs — net ~95% gross margin.
- Break-even at ~6 paying users against Emergent hosting baseline.

### Iteration 40 (2026-02-25): ✅ — Pydantic 422 detail rendering crash class CLOSED

User: *"Just fix it. No room for crashes."* Reconfirmed by iter38/39 testing-agent: nine call-sites across the frontend rendered `e?.response?.data?.detail` directly inside JSX, crashing React with *"Objects are not valid as a React child (found: object with keys {type, loc, msg, input, url})"* whenever FastAPI returned a 422 (validation error → `detail` is an ARRAY of pydantic error objects, not a string).

**Fix** — single shared helper `/app/frontend/src/lib/formatApiError.js`. Handles every observed shape:
- string → returns as-is
- pydantic v2 array `[{type, loc, msg, input, url}]` → `loc.field: msg`, body-prefix stripped, capped at 3 items joined with ` · `
- generic object `{message|error|msg}` → that string
- circular object → outer try/catch returns fallback
- non-axios `Error` → `err.message`
- everything else → caller-supplied fallback

Total function — wrapped in an outer try/catch so even malformed input returns the fallback rather than throwing.

**Replaced all 9 callsites** in one pass: `SharePatchModal` (×2), `AIPlantDetail`, `PatronsManage` (×2), `Plants`, `SharedPatch`, `ArrangementSuggester`, `GuidanceView`, `PatronOptInCard`. `FoundingClaimModal` uses an enriched-Error pattern instead — also hardened with `JSON.stringify` in a try/catch.

**SW VERSION bumped** patchpot-v6 → patchpot-v7 (iter convention).

**Tests** — testing_agent_v3 iter40: **backend 31/31 regression + frontend 100%**. Four distinct 422 variants exercised via `page.route` injection (missing plants + empty patch_name; short patch_name; long patch_name; null region) — every one renders as a clean human-readable string inside `[data-testid=share-patch-error]`, modal stays mounted, no React #31, no ErrorBoundary. Happy path + three other consumer pages confirmed regression-free. Report: `/app/test_reports/iteration_40.json`. *"No outstanding crash classes from iters 37–40 remain."*



User-reported P3: iter37 testing-agent surfaced `GuidanceView.jsx:28` TypeError `Cannot read properties of undefined (reading 'toLowerCase')` when the garden array contained items shaped `{id, name_en}` (the older schema). First fix attempt (iter38) added local normalisation inside `GuidanceView` — verified working for object-shape corruption, but iter38's broader test (undefined/null/'' entries) surfaced a SECOND crash in `MyGardenPage.jsx:82` (`p.id.startsWith('ai-')` on the raw localStorage array).

**Iter39 final fix** — centralised at the boundary inside `useMyGarden.readGarden()`:

```js
if (!Array.isArray(raw)) return [];
return raw.filter((p) =>
  p && typeof p === "object" && typeof p.id === "string" && p.id.length > 0
);
```

Every consumer (`MyGardenPage`, `GuidanceView`, `ArrangementSuggester`, `SharePatchModal`) now gets a pre-filtered list for free. The per-component `GuidanceView` normaliser stays as defence-in-depth for `SharedPatch.jsx` which receives a server-fed plants array (not the localStorage-backed hook).

- **Tests**: testing_agent_v3 iter39 — 100% frontend across all 3 scenarios (corrupted full 7-shape seed, happy path with `{id, name, category}`, iter37 schema with only `{id, name_en}`) + 18/18 backend regression. Report: `/app/test_reports/iteration_39.json`.

**Cosmetic follow-up** flagged by testing-agent (NOT a crash): `MyGarden.jsx:93` reads `{p.name}` directly so iter37 schema cards show an empty title. Add `p.name || p.name_en || p.id` fallback when convenient — non-urgent.

**Reconfirmed pre-existing bug** (now fixed in iter40 above): `SharePatchModal` renders FastAPI 422 `detail` (an array of pydantic error objects) as a raw React child → "Objects are not valid as a React child" console error when the share endpoint rejects an empty plants payload.



### Iteration 38–39 (2026-02-25): ✅ — GuidanceView + MyGardenPage crash fix (defensive garden normaliser)

User-reported P3: iter37 testing-agent surfaced `GuidanceView.jsx:28` TypeError `Cannot read properties of undefined (reading 'toLowerCase')` when the garden array contained items shaped `{id, name_en}` (the older schema). Iter38 added local normalisation inside `GuidanceView`, then iter39 centralised the fix inside `useMyGarden.readGarden()`:

```js
if (!Array.isArray(raw)) return [];
return raw.filter((p) =>
  p && typeof p === "object" && typeof p.id === "string" && p.id.length > 0
);
```

Every consumer (`MyGardenPage`, `GuidanceView`, `ArrangementSuggester`, `SharePatchModal`) now gets a pre-filtered list for free. GuidanceView's local normaliser stays as defence-in-depth for `SharedPatch.jsx` which receives a server-fed plants array.

**Tests**: testing_agent_v3 iter39 — 100% frontend across all 3 scenarios + 18/18 backend regression. Report: `/app/test_reports/iteration_39.json`.



### Iteration 37 (2026-02-25): ✅ — Social Media Kit aesthetic redesign (AI watercolours)

User saw iter33's letterpress kit and gave the honest feedback: *"social media download kit is going to need better pictures very boring and dull looking."* After rendering three sample designs side-by-side (bold-type, AI watercolour, stock photo) and grading each with an AI critic on stop-the-scroll potential / brand fit / uniqueness, the user picked **B — AI watercolour**.

- **`backend/share_social_kit.py`** rewritten. New `_compose_watercolour()` composes text over the AI image with a **two-stage gradient** (`0–60%` of panel: alpha 0 → 230 with `t**0.55` curve; `60–100%`: solid 252 alpha) — guarantees text legibility on any painted background. `_prepare_bg()` crops/extends the source square watercolour to each of the four aspect ratios *without ever stretching brush strokes* — centre-crop for 4:5 and 16:9, top-bias crop for 9:16 with a sampled-colour fade-down for the edge case where the scaled square is shorter than target height. `_wordmark_chip()` renders PATCH & POT in a forest pill with a sand stroke — ironclad legibility on any background. `_compose_letterpress()` kept as a fallback path.
- **`backend/routers/share.py`** — new `_get_or_generate_watercolour(share_id, doc)` helper. Calls **Gemini Nano Banana** (`gemini-3.1-flash-image-preview`) with a prompt that includes the patch's region + top 5 plants. Caches PNG bytes in MongoDB collection `shared_patch_watercolour` keyed on `(share_id, version=updated_at)`. Returns `None` (never raises) on missing key, LLM exception, missing images list, or malformed base64. Both `/story.png` and `/social-kit.zip` use it — single Gemini call per snapshot version regardless of which surface triggers.
- **Cost envelope**: ~$0.04 in Gemini credits per snapshot version, cached forever. Cold-cache timing: `/story.png` ~14s, `/social-kit.zip` ~25-35s. Warm hit: <2s. Snapshot edit busts both caches automatically via the `version` key.
- **Bulletproof fallbacks**: per-layout try/except in `_compose_watercolour` — a single corrupt watercolour falls back to letterpress for that specific aspect ratio only, never 500s the whole kit. Verified by `test_corrupt_bg_image_falls_back_silently_per_layout`.
- **SW VERSION bumped** patchpot-v5 → patchpot-v6 (per the iter36 convention) so users' browsers aggressively evict the iter33-era social-kit ZIP bytes on next deploy and see the new aesthetic.
- **Tests**: `backend/tests/test_watercolour_iter37.py` (5/5 green: kit ZIP PNGs >400KB watercolour-sized, exact pixel dimensions per layout, watercolour cache shared between `/story.png` and `/social-kit.zip` ZIP-build <12s when both caches warm, letterpress fallback when `bg_image_bytes=None`, per-layout fallback on corrupt bytes). testing_agent_v3 iter37: **backend 18/18 green** including 13 iter33/34/35 regression + 5 new iter37 + an additional direct-endpoint suite the agent wrote covering cache invalidation. Report: `/app/test_reports/iteration_37.json`.

**Pre-existing bug surfaced by testing-agent (now fixed in iter38–39 above): `GuidanceView` crashes with `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` when the garden array contains items with only `{id, name_en}` and no `name` field.

### Iteration 36 (2026-02-25): ✅ — Service-worker version bump (patchpot-v4 → v5)

User reported on production: *"Only Pinterest shows. Social kit not appearing."* Investigation showed the new iter33-35 testids and API endpoints ARE deployed to prod (`main.8c90cf32.js` contains them, `/social-kit.zip` + `/captions.json` + `/story.png` return 404 only for unknown share_ids — routes registered). Root cause: user's browser was serving stale runtime cache from the `patchpot-v4` service worker which activated between iter32 (v3→v4 bump) and iter33/34/35 (no SW bump).

**Fix**: bumped `VERSION` to `patchpot-v5` in `/app/frontend/public/sw.js`. The `activate` handler evicts every cache key not starting with the current VERSION → user's next visit after deploy wipes the v4 runtime cache automatically.

**Convention going forward**: bump `sw.js` `VERSION` on every release that adds new API surfaces or changes user-facing UI.



### Iteration 35 (2026-02-25): ✅ — [Share to Stories / Reels] one-tap mobile share

The mobile-native counterpart to iter34's Tweet button. Uses Web Share API Level 2 (`navigator.share({files,text,url})`) to invoke the OS share sheet on iOS/Android — putting Instagram Stories, Reels, TikTok, WhatsApp Status, Messages, Mail, etc. one tap away. Desktop browsers and older mobiles silently hide the button via `canShare()` feature detection.

- **`backend/routers/share.py`** — new `GET /api/share/patch/{share_id}/story.png` endpoint. Lazily renders the 9:16 teaser using `share_social_kit.render_kit_images()` (shared render path with the ZIP endpoint → output is byte-identical to the ZIP's `reels_story.png`, verified by test). Caches in `shared_patch_story_png` collection keyed on `(share_id, version=updated_at)`.
- **`frontend/src/components/SharePatchModal.jsx`** — new `canNativeShareFiles` useMemo probes `navigator.canShare({files: [1-byte File]})` once at mount. New `onShareStory()` handler runs `Promise.all` for `/story.png` + `/captions.json` in parallel, wraps the PNG blob in a `File` and calls `navigator.share({files,text=reels caption,url=shareUrl,title=patch_name})`. Gracefully swallows `AbortError` (user dismissed sheet) without surfacing as error. Button (`data-testid=share-patch-story`) is wrapped in `{canNativeShareFiles && ...}` so it's literally absent from the DOM on unsupporting browsers — clean feature detection, no greyed-out button noise.
- **i18n**: new key `share_patch.story.action` → translated to all 57 non-English locales via `/app/scripts/translate_story_key.py`. Stories/Reels kept as English loanwords per the established Instagram brand-name treatment.
- **Tests**: `backend/tests/test_story_image_iter35.py` (4/4 green: valid PNG signature + 1080×1920 dimensions, cached on second call, 404 on unknown share, byte-identical to ZIP's reels_story.png). testing_agent_v3 iter35: **backend 13/13 + frontend 100%** including stubbed Web Share API flow (file+text+url+title verified), feature-detection hide-when-unsupported, locale label, regression on all prior share buttons. Report: `/app/test_reports/iteration_35.json`.

The share-modal toolkit is now complete: ZIP (considered marketing), Tweet (impulse share to X), Story (impulse share to IG/TikTok/WhatsApp), QR sticker (physical-world), Embed (blog/website).



### Iteration 34 (2026-02-25): ✅ — [Tweet this patch] one-click X intent button

Tiny but high-leverage follow-up to iter33: lets the patch owner post a real Twitter Card preview to X in a single click, with the AI-tuned caption auto-filled. The 4-image ZIP is great for considered marketing, but the friction is real — most users won't open the ZIP, pick an image, write a tweet, attach the image. The intent URL bypasses all of that.

- **`backend/routers/share.py`** — extracted `_format_region()` and `_get_or_generate_captions()` helpers from the social-kit endpoint into shared nested functions. Both the new captions endpoint and the existing ZIP endpoint now read/write the same `shared_patch_captions` MongoDB cache keyed on `(share_id, version=updated_at)`, so the LLM call fires once per snapshot version regardless of which surface triggers it first. Cache-Control: public, max-age=86400.
- **New endpoint `GET /api/share/patch/{share_id}/captions.json`** — returns the four platform captions as `{"captions": {"instagram_square": str, "instagram_portrait": str, "reels_story": str, "youtube_twitter": str}}`. Used by the frontend tweet button.
- **`frontend/src/components/SharePatchModal.jsx`** — new `[Tweet this patch]` button (`data-testid=share-patch-tweet`) beside the social-kit download. `onTweet()` fetches `/captions.json`, then opens `https://x.com/intent/tweet?text=<youtube_twitter_caption>&url=<share_url>` in a sized popup (with `window.location.href` fallback if popups are blocked). Text param does NOT inline the URL — that's deliberate; X needs `&url=` separately to unfurl the OG card. `tweeting` state drives spinner + disabled while the captions fetch resolves.
- **i18n**: new key `share_patch.tweet.action` → translated to all 57 non-English locales via `/app/scripts/translate_tweet_key.py`. French manually polished from "Tweeter ce patch" → "Tweeter cette parcelle" to match the surrounding FR locale terminology (per testing-agent feedback).
- **Tests**: `backend/tests/test_captions_iter34.py` (4/4 green: returns 4 platforms, cached identically on second call, warms ZIP cache so captions match verbatim, 404 on unknown share_id). testing_agent_v3 iter34: backend 22/22 + frontend assertions all met. Report: `/app/test_reports/iteration_34.json`.

Together with iter33, this closes the social-marketing surface: ZIP for thoughtful posts, one-click button for impulse shares.



### Iteration 33 (2026-02-25): ✅ — Social Media Kit (ZIP download)

Closes the long-deferred P2 "Social Media Kit" request — the user can now download a single ZIP that includes one teaser image per major social aspect ratio plus an AI-written, on-brand caption for each. Targeted use case: "I want to share my patch on Instagram/Reels/TikTok without screenshotting my dashboard or hiring a designer."

- **`backend/share_social_kit.py`** (NEW): Pillow-based renderer producing four layouts from a `_LAYOUTS` tuple of frozen `_Layout` dataclasses — `instagram_square` (1080×1080, 1:1), `instagram_portrait` (1080×1350, 4:5), `reels_story` (1080×1920, 9:16), `youtube_twitter` (1920×1080, 16:9). Reuses the OG card palette, font helpers and `_draw_botanical` motif from `share_og.py` for visual consistency. `build_kit_zip()` bundles the four PNGs + `captions.txt` + `README.txt` into a single archive.
- **`backend/share_social_captions.py`** (NEW): generates one platform-tuned caption per layout via Claude Sonnet 4.5 (Emergent LLM key), with platform-specific length / hashtag / emoji hints embedded in the prompt. Wraps the call in a try/except — on any LLM failure or missing key, falls back to deterministic templates so the user always gets a usable kit. Captions backfill: any missing key in the LLM response is filled from the template so the ZIP always has all four.
- **`backend/routers/share.py`**: new `GET /api/share/patch/{share_id}/social-kit.zip` endpoint. Caches the rendered ZIP in MongoDB collection `shared_patch_social_kit` keyed on `(share_id, version=updated_at)` — every snapshot edit (patch_name change, plant added/removed) automatically busts the cache. Cache-Control: public, max-age=86400. Content-Disposition: attachment with the share_id in the filename.
- **`frontend/src/components/SharePatchModal.jsx`**: new "Download Social Media Kit (ZIP)" anchor (`data-testid=share-patch-social-kit`) next to the existing QR-sticker download, with a one-line help paragraph (`data-testid=share-patch-social-kit-help`) explaining the four aspect ratios and the cold-cache delay. Uses `ImageDown` from lucide-react.
- **`frontend/src/i18n/locales/en.js`** + all 57 non-English locales via `/app/scripts/translate_social_kit_keys.py`: 2 new keys (`share_patch.social_kit.download`, `share_patch.social_kit.help`). German was manually polished from "Soziale Medien-Kit" → "Social-Media-Kit" (the established loanword) per testing-agent feedback.
- **Tests**: `backend/tests/test_social_kit_iter33.py` (5/5 green) + testing-agent-written `test_social_kit_iter33_extras.py` (4/4 green) covering ZIP structure, byte-identical cache hits, cache invalidation on patch_name edit, long-unbreakable-name regression (width-aware re-fit loop in `_compose`), 404 path, fallback-template path, and full iter28/iter31 endpoint regression.

**Cost envelope**: first kit download per snapshot costs ~$0.003 (4 short Claude Sonnet calls). Every subsequent download from the same snapshot version is free (cached bytes).



### Iteration 32 (2026-02-25): ✅ — Targeted code-quality remediation (audit pass)

Applied bounded, low-risk fixes from a static-analysis audit. Larger items (92 React hook-deps, localStorage→httpOnly cookies, complexity refactors of `admin.py`/`checkout.py`/`GuidanceView.jsx`) **intentionally deferred** as architectural changes that warrant separate planning to avoid destabilising prod.

- `backend/share_qr.py` — split 9 semicolon-chained statements onto own lines (ruff E702). PDF byte-for-byte identical output verified.
- `backend/tests/test_share_patch.py` — promoted inline `"bogus-secret-xx"` test fixture to module-level `BOGUS_OWNER_SECRET` constant with `# noqa: S105` so static analysers stop flagging an obvious test value as a leaked production credential.
- `backend/tests/test_vendor_blurbs.py` — `for k in d.keys()` → `for k in d` (ruff SIM118).
- `components/illustrations/MonthlyIllustrations.jsx` — 7 array-index React keys replaced with content-derived stable keys (the SVG `d` string itself; angle integers like `ray-${i*30}`; coordinate tuples like `${cx}-${cy}`).
- `components/ArrangementSuggester.jsx` — 2 array-index keys → `${plant}-${i}` and `step-${i}-${preview}`. List order is server-driven & stable per response so idx fallback is safe.
- `hooks/useRegion.js` — bare `/* ignore */` catch upgraded with explicit `void e;` + comment so the swallow is observable in lint reports.
- testing_agent_v3 iter32: backend 23/23 pytest green; frontend regression all green (Mar/Jul/Dec calendar illustrations, /plants/tomato JSON-LD + Pinterest, /p/y997txhsnkmt mailto: button). Report: `/app/test_reports/iteration_32.json`.

**Audit items intentionally NOT actioned (need future planning, not silent triage):**
- 92 `react-hooks/exhaustive-deps` warnings — many are deliberate (single-fire effects, infinite-loop avoidance). Bulk-fixing without per-callsite analysis risks introducing infinite re-renders or stale-closure bugs that are harder to detect than the warnings themselves.
- localStorage → httpOnly cookies for auth — Patch & Pot uses **passwordless token auth** stored locally by design; switching to cookies requires a coordinated backend + Stripe-checkout-redirect overhaul.
- High-cyclomatic-complexity refactors (`pdf_seasonal.py:build_seasonal_pdf`, `routers/admin.py`, `core.py:_climate_context`, `routers/checkout.py`, `GuidanceView.jsx`, `AIMasterclassSuggest.jsx`) — listed in P4 backlog; they touch hot paths and need their own test coverage uplift first.
- 55 `console.*` statements — every one inspected is in an error/diagnostic branch (e.g. Sentry init failure, localStorage quota exceeded). Stripping them would hurt production observability more than it helps security.
- Type-hint coverage uplift — incremental work; new code added in iter31/32 already includes annotations.


### Iteration 31 (2026-02-25): ✅ — SEO foundations bundle (+ Email-a-friend)

- **`/app/backend/routers/seo.py`**: new dynamic `GET /api/sitemap.xml` (urlset with 12 evergreen static routes + per-plant URLs sourced from `core.PLANTS`) and `GET /api/robots.txt` (returns directives + `Sitemap:` line). Both reconstruct the public origin via `x-forwarded-proto` / `x-forwarded-host` so production serves canonical `patchandpot.app` URLs. Mounted at `/api` prefix in `server.py`.
- **`/app/frontend/public/robots.txt`**: static CRA fallback for crawlers that fetch `/robots.txt` directly.
- **`PlantDetail.jsx`**: injects a `<script type="application/ld+json" data-jsonld="plant-jsonld">` Article schema (headline, description, image, author=Patch & Pot, datePublished, dateModified) so plant guides surface as Google rich results. Adds a Pinterest "Save" anchor (`data-testid=plant-pinterest-save`) hitting `pinterest.com/pin/create/button/` with `url=/api/plants/preview/<id>` (bot-friendly HTML wrapper) and `media=/api/plants/<id>/og.png`.
- **`SharedPatch.jsx`**: injects a `<script type="application/ld+json" data-jsonld="share-jsonld">` WebPage schema with `primaryImageOfPage` pointing at the cache-busted OG card.
- **`SocialShareRow.jsx`**: new "Email a friend" mailto button (`data-testid=share-view-social-email`). `<ShareIconLink>` refactored to accept `targetBlank` prop so the email link opens the user's mail client in-place rather than a new tab.
- **i18n**: 5 new English keys (`plant.pin_to_pinterest`, `plant.pin_description`, `share_view.social.email`, `share_view.social.email_subject`, `share_view.social.email_body`) translated to all 57 non-English locales via `/app/scripts/translate_plant_pin_keys.py` and `/app/scripts/translate_email_share_keys.py`.
- **Tests**: testing_agent_v3 iter31 → 12/12 backend pytest green + frontend regression all green after the `targetBlank` fix. Report: `/app/test_reports/iteration_31.json`. New backend tests: `/app/backend/tests/test_seo_iter31.py`.


### Iteration 30 (2026-02-24): ✅ — "Plant of the week" homepage rail (closes the growth loop)

- **Shared visit-tracking helpers** extracted to `core.py`: new `is_visit_bot(request)` and `viewer_fingerprint(request)`. Removed the duplicates from `routers/share.py`; now both `share.py` and `plants.py` debounce visits identically.
- **`routers/plants.py` — view tracking**: new `_record_plant_view(db, plant_id, fp)` mirrors the `shared_patch_views` pattern. `plant_views` collection (TTL on `expires_at`) for 24h dedup; `plant_stats` collection holds the rolling `view_count_7d` + all-time `view_count`. Catches `pymongo.errors.DuplicateKeyError` specifically rather than swallowing all exceptions (testing-agent code-review fix).
- **New endpoints**: `GET /api/plants/of-the-week?language={code}` — single most-viewed plant in last 7 days, hydrated for the active locale; returns `{plant: null}` when empty. `GET /api/plants/popular?limit=N&language={code}` — top N. Both registered BEFORE `/plants/{plant_id}` to avoid route shadowing.
- **`server.py`** now ensures `plant_views.expires_at` TTL + `plant_stats.plant_id` unique index at startup, and the weekly Monday-03:00-UTC scheduler resets `view_count_7d` on BOTH `shared_patches` and `plant_stats`.
- **Frontend `PlantOfTheWeek.jsx`**: new homepage hero section between `EmbedFoundingSnippet` and `MostLovedPatches`. Left half (md:col-span-7) is the big plant OG card as the hero image (clickable, links to the plant guide). Right half: plant name h2, summary, 4 facts grid (category / difficulty / sun / water), "Read the {name} guide" terracotta CTA, social-proof line ("N gardeners reading this week" with singular/plural inflection). Returns null while loading or when empty so the homepage stays tidy in the first days.
- **i18n**: 5 new English keys (`home.plant_of_the_week.{eyebrow,image_alt,cta,views,views_one}`). 47/58 locales fully translated; the 11 stragglers (cy, hr, bg, et, lt, uk, ja, fr, tl, mi, ru) fall back to English UI text — Emergent LLM key budget exceeded mid-run. **Re-running `python /app/scripts/translate_pow_keys.py cy hr bg et lt uk ja fr tl mi ru` after a top-up will fill them in.**
- **Tests**: testing_agent_v3 iter30 → **31/31 backend pytest + 100% frontend Playwright, 0 issues**. 6 new iter30 tests + 13 share-patch regression + 12 iter28 regression all green.

### Iteration 29 (2026-02-24): ✅ — React-key anti-pattern refactor
- **`LearnLanding.jsx`** — replaced array-index keys at lines 196 (intro paragraphs), 205 (intro-box bullets), 233 (lesson titles) with content-based keys. Paragraphs use `${i}-${p.slice(0,40)}` to keep keys distinct even if two paragraphs happen to share a prefix.
- **`AIMasterclass.jsx`** — replaced array-index keys at lines 148 (body paragraphs), 153 (boxes — now keyed by `${bi}-${box.label}`), 157 (box bullets), 171 (numbered step items). The `lessons.map` at line 112 was already using `key={l.slug}`; the `, i` there is only for the "Lesson N" label and was left intact.
- Verified live on `/learn/propagation` — 5 lesson list items + 5 intro paragraphs render with zero pageerrors. Lint clean. No `key={i|ii|bi|idx|index}` references remain in either file.

### Iteration 28 (2026-02-23): ✅ — Five growth/quality items shipped in order

**(a) Plant-level OG cards.** Generalised `share_og.py` into a `_compose_card()` helper now powering both shared-patch and plant cards. New `render_plant_og_png(name, category, difficulty, sun, water)` produces a 1200×630 letterpress card per plant — visually rated 9/10 by analyze_file_tool. Backend endpoints `GET /api/plants/{id}/og.png` and `GET /api/plants/preview/{id}` (HTML wrapper with og:title="How to grow {name}", canonical SPA URL, redirect for humans). `PlantDetail.jsx` injects matching og:image / twitter:card meta tags for JS-executing crawlers. Works for both curated PLANT_INDEX entries and AI-generated `ai-*` slugs from guidance_cache.

**(b) Embeddable widget.** New `/embed/p/:shareId` route at `/app/frontend/src/pages/EmbedPatch.jsx` — compact card sized for ≤640px iframes, brand-on, no header/footer chrome. `App.js` now uses `AppShell()` inside `<BrowserRouter>` to drop the chrome for any `/embed/*` path. All links target=_top so clicks escape the iframe. `SharePatchModal` adds a collapsed "Get the embed code" section with a copyable `<iframe>` snippet (HTML-escaped via new `escapeAttr` helper) and a "Preview embed" link.

**(c) Garden QR sticker.** `/app/backend/share_qr.py` — new Pillow + reportlab module. `GET /api/share/patch/{id}/qr.pdf` returns a printable A6 PDF (105×148 mm) with the brand frame, italic-serif patch name auto-ellipsised, region line, 50×50mm QR code (`ERROR_CORRECT_H` for 30% redundancy — survives print smudges), human-readable URL underneath, and a terracotta "SCAN TO SEE WHAT'S GROWING →" CTA. The QR encodes the clean `/p/{id}` URL (direct SPA nav from a phone scan, no wrapper redirect blip). Surfaced in SharePatchModal via a new "Download garden-gate QR sticker (PDF)" link.

**(d) View counter + Most-loved patches wall.** `routers/share.py` now increments `view_count` (and `view_count_7d`) on each public GET, with 24h debounce per (IP, UA) fingerprint via a new `shared_patch_views` collection that has a Mongo TTL index on `expires_at`. Bot UAs (facebookexternalhit, twitterbot, whatsapp, slackbot, googlebot, etc.) are skipped entirely. New opt-in `list_publicly` field on the snapshot model, auto-saved on toggle via the modal. `GET /api/share/patches/popular` returns top OPT-IN snapshots sorted by `view_count_7d`. New homepage `MostLovedPatches.jsx` renders a 3-up card grid (silently returns null when empty). New APScheduler job `shared_patch_weekly_view_decay` resets `view_count_7d` every Monday 03:00 UTC so the wall actually reflects "this week" rather than all-time.

**(e) i18n bundle-splitting refactor.** `/app/frontend/src/i18n/index.jsx` went from **38,082 lines (~3.3 MB)** to **244 lines (~7.7 KB)**. The 58 per-locale dictionaries are now under `/app/frontend/src/i18n/locales/{code}.js` — English is statically imported as the fallback so the UI never flashes raw keys, every other locale is dynamically `import('@/i18n/locales/<code>.js')`'d on demand. Webpack code-splits each into its own chunk (`i18n-de-js.chunk.js` etc.). Used a one-shot splitter script `/app/scripts/split_i18n_locales.py` to extract the locales cleanly. New iter28 translation script translated 14 new UI keys across all 57 non-EN locales (57/57 pass).

**Bonus polish from testing-agent code review.** Pluralisation fix for "1 visit this week" vs "{n} visits this week". Popular-wall sort now actually uses `view_count_7d` to match the "this week" title.

### Iteration 27 (2026-02-23): ✅ — Social-share row on `/p/:shareId`
- **New `SocialShareRow.jsx`** under the patch header on every shared-patch preview. One-tap buttons for **X**, **WhatsApp**, **Pinterest** (with `media` param pointing at the OG card so pins include the visual), plus a **Copy link** button. Each propagates the bot-friendly `/api/share/preview/{id}` URL — so re-shares from the public preview unfurl rich cards in chats too. Subtle styling (9×9 outlined icon buttons with brand-specific hover colours: X turns ink, WhatsApp #25D366, Pinterest #E60023). Pre-filled `tagline` text: "{patch_name} in {region} — see what's growing on Patch & Pot." Brand glyphs inlined as SVG because lucide-react dropped brand icons in 2024.
- **Full 58-locale i18n coverage** via `/app/scripts/translate_social_keys.py`. 8 new keys (label, x, whatsapp, pinterest, copy, copied, tagline, tagline_region) × 57 non-EN locales — all 58/58 translated on first pass.
- **Testids**: `share-view-social-row`, `share-view-social-x`, `share-view-social-whatsapp`, `share-view-social-pinterest`, `share-view-social-copy`. Verified live: hrefs are correctly URL-encoded with patch name + wrapper URL, hover-state brand colours fire on X.

### Iteration 26 (2026-02-23): ✅ — OG share image (rich chat/social previews) + region-name resilience
- **OG card renderer** `/app/backend/share_og.py` — pure-Pillow, no AI cost. Letterpress-style 1200×630: sand/forest/terracotta brand palette, big italic serif patch name with auto-fit shrink-to-2-lines, region line, plant count, hand-composed botanical leaf sprig, "OPEN THE GARDEN →" CTA. ~50ms render, ~85KB output. Visually rated 8.5/10 by analyze_file_tool.
- **Two new backend endpoints in `routers/share.py`**:
  - `GET /api/share/patch/{share_id}/og.png` — renders + caches in `shared_patch_og` collection keyed by `(share_id, version=updated_at)`. Returns `image/png` with `Cache-Control: public, max-age=86400`.
  - `GET /api/share/preview/{share_id}` — bot-friendly HTML wrapper. Includes og:title, og:description, og:image (with sha1-hashed `?v=` cache-buster from updated_at), og:image:width/height, og:image:alt, og:site_name, twitter:card=summary_large_image. Humans get redirected to `/p/{share_id}` via both `<meta http-equiv="refresh">` and `window.location.replace()` (belt + braces for privacy-strict browsers).
- **`SharePatchModal` now copies the bot-friendly URL** (`/api/share/preview/{id}`) so chat/DM/social previews always unfurl into a real card. "Open preview" button still uses the clean `/p/{id}` URL for the owner's direct nav.
- **`SharedPatch.jsx` SPA also injects og:image** + twitter:card via useEffect (with matching sha1 cache-buster) so modern JS-executing crawlers (Slack, Discord, Telegram) also unfurl the card when given the clean URL.
- **Bug fix — PDF no longer says "Your location"**: root cause was `routers/regions.py` writing the literal string `"Your location"` into `region.name` whenever Open-Meteo's `/v1/reverse` returned empty (which was ~always — that upstream silently 404s). Fixed by (a) new `_resolve_name()` cascade `city → admin → country → "Near {lat}°N, {lon}°W"`, (b) Nominatim (OSM) as working reverse-geocode fallback, (c) defensive scrub in `pdf_seasonal.build_seasonal_pdf` that replaces any leaked bad string with "your garden", (d) one-shot client migration in `useRegion` that auto-clears any stale localStorage entry holding the bad name.
- **Tests**: 15/15 backend pytest pass (13 original + 2 iter-23 cache-invalidation), 5/5 frontend Playwright pass. testing_agent v3 iter23 report green; the two minor cache-buster precision nits it surfaced were both addressed.

### Iteration 25 (2026-02-23): ✅ — Share my Patch (public read-only preview, SEO entry point)
- **Backend router** `/app/backend/routers/share.py` with `POST /api/share/patch` (create or update by `share_id` + `owner_secret`), public `GET /api/share/patch/{share_id}` (no auth, never leaks owner_secret), and `DELETE /api/share/patch/{id}?owner_secret=` (403 on mismatched secret). Profanity filter, 30-char patch name cap, 100-plant cap, 12-char base32 share_id (no l/o/0/1).
- **`SharePatchModal`** (`/app/frontend/src/components/SharePatchModal.jsx`) — opens from `My Garden` next to Download. Caches `{share_id, owner_secret}` per active patch in `patchpot.share.<patchId>.v1` so re-sharing the same patch updates the URL the user already pasted in chat (no link churn). Copy-to-clipboard, native Web Share API when available, "Update with my latest plants" refresh, and delete-with-confirm.
- **Public preview page** `/p/:shareId` (`/app/frontend/src/pages/SharedPatch.jsx`) — read-only patch name + region + plant grid + AI "This month in {region}" forecast (reuses `GuidanceView` with `readOnly`). Sets `<title>` and `<meta name="description">`/`og:title`/`og:description`/`og:type` dynamically for SEO. Top + bottom "Create your own patch" CTAs. Missing snapshots render a friendly 404 state with a CTA back to `/`.
- **Full 58-language coverage**: added `share_patch.*` (25 keys) + `share_view.*` (15 keys) to the English block, then ran a new `/app/scripts/translate_share_keys.py` (clone of `translate_session_keys.py`) across all 57 non-EN locales. Two stragglers (`ml`, `az`) hand-retried; final count = 58/58 for every key.
- **Tests**: backend `/app/backend/tests/test_share_patch.py` — 8/8 PASS (create, fetch, update-preserves-URL, wrong-secret-falls-through, 404, profanity 422, >100 plants 422, delete-requires-secret, delete-then-404). Testing agent iter22 Playwright walk-through — 24/24 PASS covering modal open, create-link, copy/open/refresh/delete testids, public preview render with dynamic title, re-share preserves URL after adding a plant, missing share id state, post-delete 404.

## Architecture
- **Backend**: FastAPI on :8001 + MongoDB (cache: guidance_cache, image_cache).
  Routes prefixed `/api`. `emergentintegrations.llm.chat.LlmChat` for Claude Sonnet 4.5
  (text) and Gemini 3.1 Nano Banana (images). All AI responses cached in Mongo
  (cache key includes language for guidance).
- **Frontend**: React 19 + React Router 7, Tailwind 3 with earthy palette
  (sand, forest, terracotta, moss). Cormorant Garamond + Outfit fonts.
  Custom `I18nProvider` (EN/DE/FR/JA/ZH) with localStorage persistence and browser-lang detection.
- **PWA**: `/manifest.json` + `/sw.js` (stale-while-revalidate for /api/*, cache fallback for shell).
  Registered only in production (CRA dev skips SW).

## Core Features
1. Region picker (auto-detect via browser geo + manual search via Open-Meteo).
2. Monthly guide — AI generates plant_now/harvest_now/tasks/pests per region+month+language.
3. Plant database (32 plants: 20 edibles + 12 flowers).
4. Companion planting suggestions per plant (curated pairs with reasons).
5. Pest reference gallery — AI-generated reference photos per pest, cached.
6. My Garden — saved plants + personalized monthly tasks (localStorage).
7. Multi-language — EN/DE/FR/JA/ZH UI strings + AI guidance in chosen language.
8. "Get this month's update" → /print/:month page with browser print → save as PDF.
9. Rich guides: First Pot, Cut Flowers (+ 2 patchandpot PDFs), Space-Saving, Companion Planting, Regrow.
10. PWA manifest + service worker.

## Status
- **Iteration 1**: 12/12 backend + 100% frontend ✅
- **Iteration 2**: 25/25 backend + 100% frontend ✅ (i18n, companions, pest gallery, print/download, PWA)
- **Iteration 3**: 100% frontend ✅ (3 Foundation masterclasses with progress tracking)
- **Iteration 4**: 100% frontend ✅ (12 per-flower masterclasses)
- **Iteration 5** (current): ✅
  - **Content**: enhanced Pest Control with 2 new lessons (13-card pest ID guide + nematodes safety, sourced from patchandpot.com); added new Seasonal Planting Foundation masterclass (6 lessons on reading seasons, sowing windows, succession, season extension, winter growing, the year-in-a-page)
  - **AI lesson hero images** via Nano Banana on `/api/topic-image` — every lesson gets a context-aware botanical photograph (cached)
  - **Real flower images** via Nano Banana — 12 flower masterclass cards now use specific AI-generated portraits keyed to each species
  - **"Apply to my region" CTA** on Pest Control, Plant Care, Seasonal Planting — uses Claude Sonnet 4.5 via `/api/lesson-adapt` to rewrite lesson content for the user's region/hemisphere/climate (cached)
  - **Auto-translation** of lesson prose when UI language ≠ English (DE/FR/JA/ZH), same endpoint
  - **Share card on completion** — finishing a masterclass opens a modal with a Nano Banana bloom backdrop + canvas-composited title/region/date, downloadable as 1080×1080 PNG via `/api/share-image`
- **Iteration 6** (2026-02-16): ✅
  - **Home page "This month in your garden" preview card** (`/app/frontend/src/components/ThisMonthCard.jsx`): surfaces 2 sow/plant items + 2 tasks + 1 pest for the current month, pre-warmed against the default London region so it never shows empty. Localised in EN/DE/FR/JA/ZH. CTA links to `/calendar`.
  - **useRegion cross-component sync fix** (`/app/frontend/src/hooks/useRegion.js`): converted from per-component `useState` to a module-level singleton store backed by `useSyncExternalStore`. Picking a region in the modal now updates the home pill, the preview card, and any future consumer instantly — and stays in sync across browser tabs via the `storage` event.
  - **ESLint sweep**: silenced the new `react-hooks/set-state-in-effect` rule in `craco.config.js` (CRA's bundled plugin doesn't define it; the project's standalone linter does). Fixed a stray duplicated `monthLabel` block in `i18n/index.jsx`.
- **Iteration 7** (2026-02-16): ✅
  - **Code review fixes**: array-index keys → stable name/title-derived keys in `GuidanceView` and `AIPlantDetail`; `task:` IDs derived from title so completion state survives region/month changes; `is True` → `== True` (with E712 noqa) in tests; `assert climate` belt-and-braces in `reverse_geocode`. Verified backend ruff clean and /calendar still works (toggle aria-pressed flips, content renders).
  - **Region-aware affiliate "Where to source" section** (`/app/frontend/src/components/SourceLinks.jsx` + `/app/frontend/src/data/vendors.js`): 3-card grid (Seeds / Pots & Compost / Tools) on every plant-detail page (catalogued and AI-generated), per-country vendor mapping for UK, IE, US, CA, AU, NZ, DE, FR, ES, IT, NL, JP, CN, IN, with Amazon+Etsy global fallback. Plant name pre-populates each vendor's search URL. FTC-compliant disclosure shown. Anchors carry `rel="sponsored noopener noreferrer"` and `target="_blank"`. Localised in EN/DE/FR/JA/ZH. Affiliate-tag placeholders ready to swap to real codes. Testing-agent verified 100% across UK/AU/US/DE/FR/global-fallback paths.
- **Iteration 8** (2026-02-16): ✅
  - **AI-generated "why we pair these vendors" micro-blurbs** under each Source card. New backend endpoint `POST /api/vendor-blurbs` (batch — one LLM call per page-view) returns `{blurbs: {<vendor_id>: <sentence>}, cached: bool}`. Powered by Claude Sonnet 4.5 via Emergent LLM key; max 18 words per blurb, region + plant + climate-aware (e.g. "Thompson & Morgan offers tomato seeds with blight-resistant varieties suited to London's cool, damp summers"). Cached in MongoDB `guidance_cache` keyed by `vendor-blurbs:<plant>|<country>|<lang>|<sorted-vendor-ids>` so the same combo never re-bills the LLM.
  - **Fail-soft contract**: if the LLM throws (budget, network, parse error), the endpoint returns `{blurbs:{}, cached:false}` → UI silently falls back to the existing static sub-text. Output is filtered to known vendor ids and truncated to 220 chars, defending against prompt-leak / oversized response.
  - **Slot-based unique testids**: `data-testid="source-card-{slot}"` and `data-testid="source-blurb-{slot}"` where `slot ∈ {seeds, pots, tools}`, fixing the iteration-7 ambiguity where two seed-kind vendors (e.g. Australia: Diggers + Yates) shared the same testid.
  - **Verified**: 35/35 pytest backend tests pass (10 new vendor-blurbs + 25 regression), 100% frontend success across UK/AU/DE locales, region switch, cached reload, and home/calendar/garden regressions. New test file: `/app/backend/tests/test_vendor_blurbs.py`.
- **Iteration 9** (2026-02-16): ✅
  - **Big localisation push**: total supported languages went from 5 → **14**. Added in this iteration: Spanish (`es`), Scottish Gaelic (`gd`), Welsh (`cy`), Irish (`ga`), Danish (`da`), Norwegian Bokmål (`nb`), Swedish (`sv`), Icelandic (`is`), Finnish (`fi`). Existing: English, German, French, Japanese, Simplified Chinese.
  - All 9 new locales registered in backend `LANG_NAMES`. Each ships a full ~110-key UI dictionary in `/app/frontend/src/i18n/index.jsx`. LANGUAGES dropdown exposes every option with its native label.
  - **MonthSelector chip fix for Gaelic** (`/app/frontend/src/components/MonthSelector.jsx`): added a `shortMonth()` helper that strips leading articles ("Am ", "An t-", "An ", "A' ") before slicing to 3 chars, so Scottish Gaelic chips show meaningful abbreviations. No-op for other languages.
- **Iteration 10** (2026-02-16): ✅
  - **Affiliate click tracking** (`POST /api/affiliate/click`, `GET /api/affiliate/stats`): every outbound vendor card click is logged via `navigator.sendBeacon` (graceful fetch+keepalive fallback) into MongoDB `affiliate_clicks` with shape `{vendor_id, vendor_name, plant_name, country, language, slot, ts}`. No IP stored, fire-and-forget — tracking never blocks the user's click-through.
  - **Stats endpoint** (`GET /api/affiliate/stats?days=N&token=...`) returns `{since, days, total_clicks, top_vendors, top_countries, top_plants, top_languages, top_slots}` aggregated via MongoDB pipeline. Protected by the existing `ADMIN_TOKEN` env var (`patchpot-admin-d3f8a2b9c4`); endpoint is open if the env var is unset.
  - **Verified end-to-end**: 4 seed POSTs all returned 204, stats endpoint correctly aggregates top vendors / countries / plants / languages / slots; Playwright click test confirmed both card clicks trigger `sendBeacon` to the correct URL.
- **Iteration 12** (2026-02-16): ✅ **Hardcoded-JSX i18n sweep**
  - User reported "far too many areas not being translated into chosen language" — root cause: previous iteration only padded the i18n dictionary but never wrapped raw English JSX strings in `t('key')` calls.
  - **+ ~70 new i18n keys × all 31 languages** generated via batched Claude Sonnet 4.5 calls. Wired through `t()` across Home, AIPlantDetail, PlantDetail, Guides, Masterclasses, MasterclassDetail, ShareCard and FeedbackWidget. i18n file: 1408 → 7563 lines.

- **Iteration 13** (2026-02-16): ✅ **Phase 1 (lesson titles) + Phase 2 (static plant data) + browser-detected language banner**
  - **Phase 1 — Lesson titles**: Extracted 86 lesson titles across all 16 masterclasses. Translated to all 30 non-English languages via batched Claude calls. Wired through `t(`mc.lesson.${classSlug}.${lessonSlug}`)` in `MasterclassDetail.jsx` sidebar + article H1.
  - **Phase 2 — Static plant data**: Backend now translates the entire 32-plant catalogue at request time via Claude and caches per language in `db.guidance_cache` (`key: "plants:<lang>"`). Endpoints `/api/plants`, `/api/plants/{id}`, `/api/plants/{id}/companions` accept a `language` query parameter; frontend `fetchPlants` / `fetchPlant` / `fetchCompanions` pass current `lang`; pages re-fetch on lang change. First request per new language ~10-25s; subsequent <100ms from cache. English requests bypass Claude entirely. Soft-fallback to English on any Claude/JSON error (broadened from `HTTPException` to generic `Exception` per iter-10 minor finding).
  - **Companion plant reasons**: Short companion-pair reason strings also translated and cached separately (`key: "companion-reasons:<lang>:<sorted-ids>"`).
  - **Language-detected banner**: New `<LanguageDetectedBanner/>` component. On first visit, if browser lang matches a supported non-English locale, the app auto-switches AND shows a polite forest-green banner at bottom centre with **Keep {Language}** / **Switch back to English** / **X**. StrictMode-safe (persistent `patchpot.lang.auto_detected.v1` flag so double-init doesn't lose state).
  - **i18n file size**: 7,563 → 10,414 lines.
  - **Tests**: testing agent iteration 10 PASS 12/12 (9/9 backend pytest + 4/4 frontend Playwright). Plant-translation caches `plants:de`, `plants:fr`, `plants:ja` warmed during testing.

- **Iteration 14** (2026-02-17): ✅ **Seasonal Growing Journal PDF (paywalled)**
  - Implemented dynamic, region- and language-aware A4 PDF inspired by the patchandpot.com journal. Backend `/app/backend/pdf_seasonal.py` builds the PDF via `reportlab` (BaseDocTemplate + Frame, A4 portrait/landscape, custom palette: forest/terracotta/moss/sand). Sections: **Sow & plant this month**, **Harvest now**, **Tasks**, **Pest watch** — pulled straight from the cached `/api/guidance` JSON (already region+month+language-aware). KeepTogether per item, escaped paragraphs, header rule + footer.
  - **Endpoint**: `POST /api/seasonal-pdf` (server.py L684-738). Body: `{region, month, language, orientation, my_garden, access_token}`. Paywalled — looks up `db.access_grants` and returns **402 'Access required — pay £5 once to unlock'** for missing / bogus tokens. Month outside 1–12 → 400. Returns `application/pdf` with `Content-Disposition: inline` so the new tab can render directly.
  - **Frontend** (`/app/frontend/src/pages/Calendar.jsx`): "Download Seasonal PDF" button (`data-testid="download-seasonal-pdf"`) sits next to the region pill. Unpaid → opens `PaywallModal`; paid → POST returns blob → `window.open(blobUrl)`. Icon swaps Lock (unpaid) ↔ Download (paid) ↔ Loader2 (busy). Blob URL revoked after 60s.
  - **Tests**: testing-agent iter 11 PASS 12/12 — 8 backend pytest (`/app/backend/tests/test_seasonal_pdf.py`: valid PDF for EN/portrait + FR/landscape, all 4 section headings present via pypdf, 402 for bogus token, 400 for month=13, regression on /api/guidance + /api/plants); 4 frontend Playwright flows (button visible, unpaid → PaywallModal opens with zero /api/seasonal-pdf fetches, paid → POST 200 + window.open(blob:), icon swaps correctly).
  - **Note on localStorage keys**: actual paywall keys are `patchpot.access.v1` (token) + `patchpot.access.paid.v1` (cache flag) — *not* `pp_access_token` as the previous handoff implied. test_credentials.md updated.

- **Iteration 15** (2026-02-17): ⚠️ **Partial — 3/27 missing-language UI dictionaries translated, budget capped**
  - Wrote `/app/scripts/translate_i18n.py` — parses the EN dict (378 keys) and uses Claude Sonnet 4.5 via Emergent LLM key to translate the whole UI chrome per target language, then patches the `xx: {},` empty blocks in `/app/frontend/src/i18n/index.jsx` directly. Persists after every language so partial runs are recoverable; auto-skips already-populated locales on re-run; 90s per-call timeout.
  - **Translated**: Indonesian (`id`), Hindi (`hi`), Bengali (`bn`) — 378 keys each, native scripts verified, lint clean. i18n file 11,518 → 12,655 lines.
  - **Stopped**: Emergent LLM key budget exceeded at run-time (`Current cost: 18.47 / Max budget: 18.4`). The remaining 24 languages (te, mr, ta, gu, ur, kn, ml, pa, ms, vi, th, ko, tl, mi, ar, tr, ru, be, kk, uz, az, ky, hy, ka) are still served via English fallback in the UI.
  - **Resume**: once the user lifts the budget cap (Profile → Universal Key → Add Balance), simply re-run `python3 /app/scripts/translate_i18n.py` — the script auto-detects already-populated blocks and only fetches the remaining 24.

- **Iteration 16** (2026-02-17): ✅ **All 27 missing-language UI dictionaries translated** — total supported locales now **58/58 fully localised**.
  - Translated the remaining 24 languages (`te, mr, ta, gu, ur, kn, ml, pa, ms, vi, th, ko, tl, mi, ar, tr, ru, be, kk, uz, az, ky, hy, ka`) via `/app/scripts/translate_i18n.py` after the user topped up the Universal Key. Switched the script from Claude Sonnet 4.5 (~$0.50/lang) to **gpt-4o-mini** (≈30× cheaper, perfectly adequate for ~378 UI strings) so the whole batch fit comfortably under the LLM budget.
  - Script is **chunked** (100 keys × 3-4 batches per language) for reliability + **idempotent** (skips already-populated locales on re-run) + persists per-language so partial runs are recoverable.
  - File grew 12,655 → 21,751 lines (+9,096 lines of translations). Lint clean.
  - **Verified end-to-end with Playwright**: Arabic loads with `dir=rtl`, `lang=ar`, hero h1 "ازرع في أي مكان، بطريقتك" (= "Grow anywhere, your way."), nav fully Arabic, language-detected banner translated, no console errors. RTL layout intact.

- **Iteration 17** (2026-02-18): ✅ **SEO landing pages — `/learn/:topic`** (hybrid Option C)
  - **New route `/learn/:topic`** (`/app/frontend/src/pages/LearnLanding.jsx`) renders the free intro lesson with rich Open Graph + Twitter Card tags via `react-helmet-async` — turns every masterclass into an evergreen, shareable acquisition channel.
  - **Static + AI sources unified**: Local registry (foundation + flower masterclasses already in the bundle) resolves instantly; AI-generated topics fall back to backend cache.
  - **New backend endpoint** `GET /api/og/learn/{topic}` (`server.py` ~L1252-1336) returns OG metadata as JSON for both static (via `STATIC_MASTERCLASS_OG` registry) and AI-cached (via `generated_masterclasses` collection) topics. 404 on unknown topics; language fallback to English if requested locale not cached. `_first_paragraph()` trims to ~280 chars for clean `og:description`.
  - **HelmetProvider** wired in `/app/frontend/src/index.js`; canonical, Twitter `summary_large_image`, and JSON-LD Article schema all populated client-side. Site-wide OG/Twitter card defaults added to `public/index.html` so even JS-disabled scrapers see something useful.
  - **Free intro + soft paywall**: Unpaid visitors read Lesson 1 in full, then meet a "Continue the full masterclass" CTA that opens the existing two-tier (£5 annual / £25 lifetime) `PaywallModal`. Paid users get a straight "Open the full masterclass" CTA.
  - **Tests**: testing-agent iter 12 PASS 100% — 7/7 backend pytest + Playwright flows for static + AI + 404 + head meta + paywall modal launch.

- **Iteration 19** (2026-02-19): ✅ **Flower-arranging masterclass + per-flower depth expansion + "What's in your garden right now" suggester**
  - **New ground-up masterclass**: *The Art of Flower Arranging* (`/app/frontend/src/data/arranging-masterclass.js`) — 10 lessons, ~3,500 words, principles → tools → conditioning → vase-water recipe → mechanics → step-by-step → seasonal recipes → drying. Lives in its own "Floristry & Arranging" section between Foundations and By-Flower. Registered in `STATIC_MASTERCLASS_OG` so `/learn/flower-arranging` has rich OG tags.
  - **Per-flower expansion**: all 12 flower courses brought up to foundation depth. Avg words/course **272 → 511**, extras/course **1.4 → 6.3**, every course now has 6+ lessons (chrysanthemum has 7). New shared `VASE_WATER_BOX` constant (sugar + lemon juice/vinegar + bleach drops per litre) injected into every cutting/vase lesson so the advice stays consistent and updatable in one place.
  - **MasterclassDetail.jsx** now falls back to `lesson.title` from the data file when no i18n translation key exists — new masterclasses no longer need a sprawling i18n migration to render.
  - **"What's in your garden right now" suggester**:
    - Backend: `POST /api/arrangement/suggest` accepts `region/month/my_garden/language`, returns Claude-generated arrangement with title, climate-aware intro, vase + mechanic recommendation, 6–10 stems (each with role + count + cutting tip), 5–7 build steps in the masterclass's foliage-line-focal-filler-accent order, plus a pithy tip. Cached per (sorted-garden + month + region + language); `?regenerate=true` forces a fresh suggestion.
    - Frontend: new `ArrangementSuggester.jsx` component wired into My Garden page. Colour-coded role tags (focal=terracotta, filler=moss, line=forest, accent=ink, foliage=forest/80). Generate / Regenerate / Read-the-masterclass CTAs. Empty-garden and no-region states handled gracefully.
  - **Tests**: 4/4 pytest in `tests/test_arrangement.py` (shape, empty-garden 400, cache idempotency, regenerate bypass). Playwright verified the My Garden page renders the suggester, generates a "Midsummer jug with rose and sweet pea" arrangement from a 6-plant seed, 6 stems + 7 build steps + tip all rendering correctly.

- **Iteration 18** (2026-02-19): ✅ **Monthly /api/guidance cache cron + Share-masterclass button**
  - **Monthly cron** — APScheduler `AsyncIOScheduler` runs in-process; cron trigger `day=1, hour=2, minute=0, tz=UTC` on app startup. The job (`/app/backend/cache_refresh.py:refresh_monthly_guidance`) reads popular (region, language) pairs from `guidance_cache` (deduplicated via Mongo aggregation), generates the *current* month's guidance for each, and prunes rows older than ~18 months. `MAX_PAIRS_PER_RUN=40` caps the monthly LLM bill.
  - **Refactored `/api/guidance`** to call a reusable `_generate_and_cache_guidance(req, force=False)` so the cron and the HTTP handler share one code path. Cache rows now also persist `region/month/language/my_garden/kind` for replay.
  - **Admin endpoints** (token-gated by existing `ADMIN_TOKEN` env): `POST /api/admin/refresh-guidance` (manual trigger) and `GET /api/admin/cron-status` (last-run snapshot). Bad/missing token → 403.
  - **Share-masterclass button** (`/app/frontend/src/components/ShareLessonButton.jsx`) added to both `MasterclassDetail.jsx` and `AIMasterclass.jsx`. Uses Web Share API on mobile + clipboard fallback on desktop. Writes the OG-rich `/learn/{slug}` URL so social cards unfurl into rich link previews. Shows brief "Link copied" confirmation.
  - **i18n**: three new EN keys (`share.share_masterclass`, `share.link_copied`, `share.copy_prompt`); other locales fall back to EN.
  - **Tests**: testing-agent iter 13 PASS 100% — 4/4 pytest in `tests/test_cache_refresh.py` (warm-pair dedup, current-month skip, status persistence, stale prune) + 6/6 live-HTTP regression in `tests/test_admin_cron.py` (auth, idempotency in <2s, /api/guidance row shape) + 3/3 Playwright (share button on static + AI + clipboard payload). No issues found.

## Prioritised Backlog

> **🛑 RULE FOR THIS PROJECT (learned the hard way 2026-02-17):**
> NEVER ask the user to test third-party redirect flows (Stripe Checkout, OAuth, Google Maps auth, anything that leaves our origin) **in the Emergent in-app preview pane**. iOS WKWebView strips third-party cookies → Stripe Checkout shows a blank screen, OAuth fails silently. Either:
> 1. Test it yourself end-to-end with Playwright on a mobile-sized viewport, or
> 2. Direct the user to **open the preview URL in real Mobile Safari** (paste into Safari address bar) rather than the Emergent app's preview tool.
> Tests inside the in-app preview are valid for *our own* UI only, not for anything that loads `checkout.stripe.com`, `accounts.google.com`, etc.

### Iteration 34 (2026-02-23): ✅ — Stripe live key rotation + paywall modals pinned to top
- **Root cause of production checkout 502s**: Stripe rotated/expired the user's live secret API key (`sk_live_…bzKpA3`). The `/api/admin/test-stripe` diagnostic endpoint surfaced the exact Stripe error (`AuthenticationError: Expired API Key provided`) which let the user generate a new live key in their Stripe dashboard and update `STRIPE_API_KEY` env var on production. Checkout now works on preview + live.
- **Reverted noisy in-flight changes** that were complicating debugging:
  - `routers/checkout.py` and `server.py` rolled back to commit `4e2af37` — removes the structured try/except wrapping, `_sanitize_ref`, ring-buffer + global exception handler, `/api/admin/test-stripe`, `/api/admin/config-check`, `/api/admin/recent-errors`. (These diagnostic endpoints earned their keep tonight; can be re-added cleanly later if needed.)
  - `core.py` `CheckoutRequest` reverted (no more `ref` field).
  - `frontend/src/lib/api.js` `createCheckout` reverted (no longer pipes `ref` from localStorage).
  - **Kept intact**: `useReferralCapture` hook still captures `?ref=` to localStorage; `/admin/referrals`, `/admin/ai-usage`, Patrons page, embed widget, FoundingClaimModal, FoundingBanner — all stable.
- **Both paywall modals now pin to top** of viewport on every screen size (iPhone → desktop): `PaywallModal.jsx` changed from `items-start sm:items-center` to `items-start` only. `FoundingClaimModal.jsx` already top-pinned. Verified the change applies to every page that uses the components (Home, Calendar, Guides, LearnLanding, PremiumGate, AIMasterclassSuggest).
- **Found while debugging** (not fixed, just noted): Emergent's managed Stripe integration routes API calls through `integrations.emergentagent.com/stripe/v1/...` rather than `api.stripe.com` directly. If that proxy ever becomes unreachable, all checkout fails with no obvious clue. Worth keeping in mind for future outages.

### Iteration 33 (2026-02-22): 🐞→📩 — Production Stripe 502 traced to expired API key
- User reported persistent HTTP 500/502/520 errors on `/api/checkout/session` on production (patchandpot.app) across iPhone/iPad/iPad incognito — even though preview worked. After several iterations of progressive error capture (structured route exceptions, in-memory error ring buffer, redacted config-check endpoint, direct Stripe test endpoint), I probed production directly from preview:
  - GET `/api/admin/config-check` → 200, valid JSON, `STRIPE_API_KEY = sk_live_...KpA3` (real live key, len 107).
  - POST `/api/checkout/session` → HTTP 502, `server: cloudflare`, `cf-ray: a0fe99c8f8a52911-ORD`, `retry-after: 60`, body title `emergent.cloud | 502: Bad gateway`.
- **Root cause confirmed**: Cloudflare/Emergent edge is returning 502 *before* the request reaches the production backend — meaning either the production container has no outbound HTTPS connectivity to api.stripe.com, or the edge times out on long-running POST endpoints. This is a platform-level network/firewall config, not a code bug.
- **Code shipped this iteration to enable future diagnosis without redeploys**:
  - `/api/admin/recent-errors?token=…` — 50-entry in-memory ring buffer + global exception handler captures every unhandled backend exception (type, message, traceback tail, UA, origin).
  - `/api/admin/config-check?token=…` — redacted env-var fingerprint (length + last4 + Stripe key prefix). Safe to share.
  - `/api/admin/test-stripe?token=…` — one-shot Stripe Checkout creation that returns the full Stripe error message + class + traceback in JSON (skip the modal flow).
  - All Stripe + Mongo calls in `routers/checkout.py` wrapped in try/except with structured 502/503/500 HTTPExceptions that ALSO write to the shared ring buffer via `core.record_error` (wired at app startup in `server.py`).
- **User next step**: emailed template provided to support@emergent.sh asking platform team to verify outbound HTTPS access from the production container to api.stripe.com.


- **Bug 1 (preview)**: clicking "Continue to Stripe" inside Emergent's preview wrapper iframe loaded Stripe inside the wrapper iframe → Stripe refuses to render inside iframes (X-Frame-Options DENY) → blank skeleton page. **Fix**: added `target="_top"` to the `<a>` element in `FoundingClaimModal.jsx` so the link always escapes ANY wrapping iframe (preview wrapper, future external embed, etc.) and navigates the top-level browser context.
- **Bug 2 (production iOS Safari Private)**: `POST /api/checkout/session` was failing silently with no actionable signal. **Fixes**:
  - Frontend `FoundingClaimModal` now extracts the HTTP status + backend detail from the error and renders a small `Diagnostic: HTTP 502: StripeAuthenticationError` line under the error message. Lets the user (or me from a screenshot) see exactly what failed.
  - Backend `POST /api/checkout/session` now wraps `_stripe_checkout()`, `create_checkout_session()`, and the Mongo insert in try/except. Each failure is logged with `exc_info=True` and returns a structured `HTTPException`:
    - 503 `Stripe client init failed: <ExceptionType>` (likely STRIPE_API_KEY env issue)
    - 502 `Stripe API error: <ExceptionType>` (likely auth/network/rate-limit from Stripe)
    - DB write failures are logged but don't break the user's checkout (Stripe session is still valid; webhook will re-create the txn row).
- **Verified**: happy path returns Stripe URL on preview; unknown package returns 400 as expected.

### Iteration 31 (2026-02-22): ✅ — FoundingBanner moved to top of `/learn/:topic`
- **User feedback (preview)**: the Founding offer was rendering at the bottom of SEO landing pages, far below the fold — visitors had to scroll past the entire intro lesson, image and lessons grid before seeing it.
- **Fix in `LearnLanding.jsx`**: render `<FoundingBanner />` above the `container-narrow` wrapper so it's full-bleed and immediately visible (now at y≈79px on iPhone, right below the nav). Removed the old bottom mount that was inside the negative-margin trick.
- **Verified**: smoke test on iPhone-sized viewport — banner is at the top, "Claim my spot" CTA above the fold, page content renders cleanly below.

### Iteration 30 (2026-02-22): ✅ — Self-service `/patrons/manage` page
- **Why**: privacy policy promised one-click removal; new self-service surface lets patrons edit/remove their listing using the Stripe session_id from their on-screen receipt. No inbound email needed.
- **Product decision (user, 2026-02-22)**: no transactional email service will be wired. Token persistence relies on the on-screen copy + localStorage `patchpot.access.v1`. Losing the tab on a fresh device = losing self-service access; that tradeoff is accepted.
- **Backend**: `GET /api/patrons/me?session_id=…` returns `{listed, display_name, package_id, tier_label}`. 404 for unknown sessions. Session_id is the bearer credential (same as access token), so no separate login is needed.
- **Frontend** (`/patrons/manage`):
  - No `?session_id` → friendly gate with input + lookup button.
  - Found, not opted-in → add form (reuses the same opt-in pattern as PatronOptInCard).
  - Found, opted-in → shows listed name in big serif type with "Change name" + "Remove me" buttons. Edit opens the form prefilled. Remove confirms inline.
  - All errors surface in dedicated test-id blocks.
  - `noindex` meta tag set on the managed view.
- **Patrons page footer** and **privacy policy section** both updated to link to the new self-service URL.
- **Verified end-to-end via screenshot tool**: gate → lookup → opt-in → edit → remove all green; tier label is correctly resolved server-side.

### Iteration 29 (2026-02-22): ✅ — Patrons page (opt-in supporter wall)
- **New public page** at `/patrons` — gratitude wall listing supporters who explicitly opted in. Grouped by tier (Founding Members → Lifetime → Annual → 6-month → 3-month → Monthly → Tippers). Founding Members get prominent serif typography; lower tiers a tighter grid. Empty state shows a "Be the first" CTA back to the Founding offer.
- **Opt-in surface**: `PatronOptInCard` mounted on `/checkout/success` for both `success` and `tip_success` phases. Collapsed-by-default soft invite ("Want a thank-you mention on our Patrons page?"). Expands to a form with a 30-char name input + explicit consent checkbox. Submit disabled until both filled. Success state shows the listed name + a one-click "Remove my listing" button.
- **Backend** (`/app/backend/routers/patrons.py`):
  - `POST /api/patrons/opt-in` — requires consent=true, validates name (1-30 chars, allowed charset, word-start profanity filter so "Scunthorpe"/"Fuchsia" pass while "fuckface"/"shit happens" are blocked), verifies the session_id is a paid transaction.
  - `POST /api/patrons/opt-out` — idempotent 200 (friendly UX, doesn't leak session existence).
  - `GET /api/patrons` — public, returns `{total, groups:[{tier,label,count,names}]}` sorted alphabetically within tier. Dedupes names, hides empty tiers.
- **GDPR posture**:
  - Default OFF (no listing without explicit ticked consent box on the success screen).
  - Display name only — never email, country, amount, session_id.
  - One-click removal from the success page; email fallback.
  - Consent timestamp logged for audit trail.
  - Privacy policy updated with a dedicated "Patrons page" section (Article 6(1)(a) explicit consent as lawful basis).
- **Verified**: testing agent iteration_18 reports 100% pass — 8/8 backend pytest cases + frontend opt-in/opt-out flow + footer link + empty state CTA. Profanity filter fix verified against gardening-relevant false positives ("Scunthorpe", "Fuchsia", "Mitsushita" all pass).

### Iteration 28 (2026-02-22): ✅ — Founding checkout-URL cache + in-flight dedup
- **Problem**: every modal open fired a fresh `POST /api/checkout/session` — a curious visitor opening the modal 5× before paying meant 5 abandoned Stripe sessions + 5 ref-tagged `payment_transactions` rows polluting `/admin/referrals`.
- **Fix in `FoundingClaimModal.jsx`**:
  - **sessionStorage cache** (`pp-checkout-url:<package_id>`) with a 10-min TTL stores the Stripe URL after first creation. Reopens within the same tab serve from cache → zero API calls. Cache dies with the tab so stale URLs don't survive browser sessions.
  - **In-flight Map dedup**: if two effects fire concurrently (React 18 Strict Mode in dev, or a user double-tapping), both await the same promise instead of firing parallel POSTs. The single resolved URL is shared and written to cache.
  - **Retry clears cache** so a genuine network-failure retry actually gets a fresh session, not the stale cached one (which would also be failed).
- **Verified end-to-end**: cold open = 1 call · reopen = 0 calls · expired cache = 1 call (verified by forcing `exp` to the past in sessionStorage).

### Iteration 27.5 (2026-02-22): ✅ — Embed deep-link auto-opens FoundingClaimModal
- Visitors arriving at `/?founding=1` (the embed widget's CTA target) now have the FoundingClaimModal auto-open on page load — no second tap needed.
- `?founding=1` is stripped from the URL via `history.replaceState` after open, so refresh doesn't re-open and the cleaned URL is shareable without forcing the modal on others.
- `?ref=embed-…` is preserved through the strip → referral attribution still works.

### Iteration 27 (2026-02-22): 🐞→✅ — iOS Safari "Claim my spot" silent fail + Founding paywall confirmation
- **Bug reported** (user on iPhone Safari Private Browsing): tapping "Claim my spot" on FoundingBanner did nothing. **Root cause**: the handler did `await createCheckout(...); window.location.href = url;` — iOS Safari treats a cross-origin navigation assigned AFTER an `await` as not user-initiated and silently blocks it. PaywallModal already documented this exact iOS quirk (line 7-11 comment) and used a real `<a href>`; FoundingBanner had not been updated.
- **Fix**: new `FoundingClaimModal.jsx` opens synchronously on tap (preserves user gesture chain), kicks off `createCheckout` in the background, and renders the result as a real `<a href={checkoutUrl}>Continue to Stripe →</a>`. The user's second tap on that anchor IS a fresh user gesture so iOS happily honours it. Modal shows £35 vs £50 price, 5-item feature list, 30-day refund line, Retry button on network failure. ESC + backdrop click + X close.
- **Bonus UX**: also delivers the "paywall confirmation" the user wanted — visitors now see what they're buying (price, features, refund) before being dropped on stripe.com.
- **Verified**: testing agent iteration_17 reports 100% pass on desktop AND 390×844 iPhone-sized viewport. Confirmed via `tagName==='A'` + `getAttribute('href')` that the Continue button is a real anchor pointing at `https://checkout.stripe.com/c/pay/cs_test_*`.

### Iteration 26.5 (2026-02-22): ✅ — Embed referral attribution pipeline
- **Widget CTA** (`GET /api/founding-status/widget`) now appends `?ref=embed-<embedder-host>` derived from the iframe's `Referer` header (sanitised; our own host stripped).
- **Frontend capture** (`useReferralCapture` hook in App.js): persists `?ref=` to `localStorage['pp-ref']`. First-touch wins.
- **Checkout pipe-through**: `createCheckout` auto-includes the stored ref. Backend stores it on `payment_transactions.ref` AND in Stripe `metadata.ref`. On grant (poll OR webhook) the ref is copied to `access_grants.ref`.
- **New endpoint** `GET /api/admin/referrals?token=...&days=30`: aggregates paid checkouts by ref, returns total purchases, total revenue £, per-source ranked table (purchases, revenue £, top tier, last-sale date). `(direct)` bucket for ref-less traffic.
- **New admin dashboard** at `/admin/referrals` — top sources by revenue, ranked table, links across to /admin/ai-usage. Shared `AdminTokenGate` component used by both admin pages.
- Verified end-to-end via curl + seeded mongo data.

### Iteration 26 (2026-02-22): ✅ — Homepage embed snippet + Admin AI usage UI
- **Homepage embed snippet** (`/app/frontend/src/components/EmbedFoundingSnippet.jsx`). New section on `/` for non-paid visitors, mounted only while the Founding cohort is active. Shows the iframe code block (`<iframe src=".../api/founding-status/widget" …>`) and a one-click "Copy embed code" button (clipboard API + execCommand fallback). Includes a "Preview the embed" deep-link. Disappears with the cohort the moment spots sell out — same gating as the banner.
- **Admin AI usage dashboard** (`/app/frontend/src/pages/AdminAiUsage.jsx`, mounted at `/admin/ai-usage`). Token-gated UI for the existing `GET /api/admin/ai-usage` endpoint: budget card with progress bar (£X / £cap with status pill — Healthy / Approaching cap / Circuit breaker tripped / Cap disabled), per-engine cards (Sonnet · Haiku · Images) with sub-breakdowns, total LLM calls + relative cost units, 7d/30d/90d window switcher, refresh, sign-out. Token persists in `localStorage['pp-admin-token']`. Not linked from public nav; `noindex` meta tag set.
- **API helper added**: `fetchAdminAiUsage(token, days)` in `/app/frontend/src/lib/api.js`.
- **Verified**: testing agent iteration_16 reports 100% pass — backend (3 window sizes + 422/403 negative cases) and frontend (gate, invalid-token error, valid-token dashboard, all required data-testids, window switcher, sign-out) all green.

### Iteration 25 (2026-02-22): ✅ — `/learn/:topic` blank-screen fix + embeddable Founding widget
- **P0 fix — `LearnLanding.jsx` crash.** A recent merge referenced `<FoundingBanner />` in the JSX without importing the component, so React threw `FoundingBanner is not defined` on first render and blanked the page. Added the import; `/learn/propagation`, `/learn/pest-control`, etc. now render H1 + intro lesson + paywall CTA + Founding banner cleanly. Lint clean, no console errors.
- **Embeddable Founding widget at `GET /api/founding-status/widget`.** Self-contained HTMLResponse external sites can drop into an iframe: branded card, live "X of 30 spots left" count, single-click CTA deep-linking into `/?founding=1` on the public domain. Returns **204** when sold out so embedders hide the iframe gracefully. Headers: `Content-Security-Policy: frame-ancestors *` for cross-origin embedding, `Cache-Control: public,max-age=60`. CTA host resolved from `X-Forwarded-Host` (falls back to `Host`, then `patchandpot.app`).
- **Verified**: testing agent iteration_15 reports 100% pass — 4/4 backend pytest, `/learn/propagation` + `/learn/pest-control` + PaywallModal click flow all green.

### Iteration 24 (2026-02-22): ✅ — Subsidy guardrails: Founding offer, AI cap, Tip jar
- **A. Founding Member tier** (`lifetime_founding` £35, capped at 30 sales): new banner on Home (non-paid users only) with live "X of 30 remaining" count from `/api/founding-status`. Once full, the banner disappears AND any in-flight `lifetime_founding` checkout silently downgrades to regular `lifetime` £50 — so a stale browser tab can't sell a 31st spot. **One weekend of buzz can lock in £1,050 net (~£35×30) — covers ~3 years of infra upfront.**
- **C. AI budget circuit breaker**. New env var `AI_MONTHLY_BUDGET_GBP` (0 = unlimited, the default). When set and rolling 30-day estimated spend ≥ cap, every fresh LLM call returns 503 with a friendly *"AI quota for the month is full"* message. Cache hits keep serving normally so the app stays useful. Cost estimate uses cheap row counts in `guidance_cache`, `arrangement_cache`, `generated_masterclasses`, `image_cache` × per-call cost factors. Refreshed on startup, on every `/admin/ai-usage` request, and (cheaply, in-memory) before each LLM call. **Verified live**: with cap set to £0.01, background guidance worker correctly aborts with the friendly message; resetting cap to 0 returns to permissive mode.
- **E. Tip jar**. New `tip` package (£3, `duration_days: 0`) — Stripe checkout works, but the checkout-status + webhook handlers explicitly skip `access_grants` insertion for tips so no token leaks out. New `TipJar` button in the footer (next to Privacy / Terms / Contact). Discoverable but never competes with the paywall — pure gratitude path for users who want to support without committing to a tier.
- **Backend exports**: `FOUNDING_TOTAL`, `AI_MONTHLY_BUDGET_GBP`, `refresh_ai_budget_state`, `_enforce_budget_or_503`. `/admin/ai-usage` now includes a `budget` block (cap, current 30d estimate, over_budget flag).
- **Verified**: 31/31 router tests pass; live frontend smoke confirms banner copy, claim button, tip jar, and £50 lifetime card all render correctly.

### Iteration 23 (2026-02-22): ✅ — Five-tier pricing live
- **New ladder**: £2.99/month · £5/3-months · £9/6-months · £15/12-months · £50/lifetime. Old tiers (£5/yr, £25/lifetime) replaced everywhere.
- **Why these prices**: per-month curve drops cleanly with commitment (£2.00 → £1.67 → £1.50 → £1.25); lifetime breaks even with annual at 3.3 years (good for both sides); £2.99 sets the monthly fee above the Stripe-fee pain threshold (10% net vs 13.5% at £2).
- **Backend** — `core.py PAYWALL_PACKAGES` now has 5 entries with duration_days each (31 / 92 / 183 / 365 / None). `DEFAULT_PACKAGE_ID` switched to `"annual"` (the headline tier). All 5 verified live writing the right amount to Stripe sessions.
- **Frontend** — `PaywallModal.jsx` redesigned: vertical 5-row tier picker (better than 5-col grid on mobile) with radio-button affordance, per-month maths in muted text, "Most Popular" badge on annual, "Best Value" on lifetime. Pay button label updates as user picks ("Pay £9 — 6 months"). All 5 testids exposed: `paywall-tier-monthly|quarterly|biannual|annual|lifetime`.
- **Home.jsx pricing card** updated to lead with £50 lifetime, "from £2.99/month" subline.
- **Terms / Privacy pages** updated to list all 5 tiers (£2.99/mo to £50/lifetime). "Annual" language softened to "time-limited memberships" so future re-pricing doesn't trigger a Terms rewrite.
- **AIMasterclassSuggest** micro-copy: "from £2.99/month" instead of "£5 once".
- Tests all 31/31 router-refactor passing.

### Iteration 22 (2026-02-22): ✅ — AI cost slashed via two-pass i18n + Haiku
- **Two-pass guidance generation.** Originally every (region × month × language × garden) tuple ran a full Claude Sonnet 4.5 call. Now:
  1. EN pass: Sonnet 4.5 (creative, expensive) — runs ONCE per (region, month, garden) and caches result.
  2. Non-EN pass: Claude Haiku 4.5 (~4× cheaper) — translates that JSON in ~3-10s. Cached per (region, month, language, garden).
  3. If Haiku errors, we fall back gracefully to the EN content so the UI never breaks.
- **Knock-on switches to Haiku** (mechanical translation jobs that don't need Sonnet's creativity):
  - `/api/plants` catalogue translation
  - `/api/plants/{id}/companions` companion-reason translation
  - `/api/plant-guide` — now also two-pass (EN guide cached, other languages translated cheaply)
  - `/api/lesson-adapt` (translates an existing lesson — perfect for Haiku)
  - `/api/vendor-blurbs` (short region-specific blurbs — perfect for Haiku)
- **Backstop**: `_llm_json_cheap` in core.py auto-falls back to `_llm_json` (Sonnet) on any Haiku error, so quality is never a regression.
- **Measured live (Madrid/April, cold)**:
  - EN: ~42s, full Sonnet (unchanged)
  - DE: ~10s, Haiku translating cached EN — "Tomate / Später Frühling / Blattläuse / Härte die Setzlinge ab" (idiomatic horticultural German)
  - FR: ~12s, Haiku translating cached EN — "Tomate / Fin du printemps" (idiomatic French)
  - Any re-request: <200ms cache hit
- **Bill impact (estimated)**: hot regions (London/NYC/Sydney) viewed in 10+ languages now cost ~1× Sonnet + 10× Haiku ≈ 1× Sonnet + 2× Sonnet = 3× Sonnet, vs the old 11× Sonnet → **~73% reduction** on those regions. Cold/single-language regions cost the same as before.

### Iteration 26 (2026-02-23): ✅ — Home bundle localised + patch dedupe + footer/badge clearance
- **Home `home-bundle-cta` block fully i18n-ised** (~21 new keys: eyebrow, title, body, 5 feature rows × 2, "Best value" tag, lifetime/monthly labels, blurb, CTAs, guarantee). All translated to all 57 non-EN locales via the new `scripts/translate_bundle_keys.py` (forked from `translate_session_keys.py`). The "🛡 30-day money-back guarantee. No subscriptions, no auto-renewal, no email lists." line now reads in the user's language.
- **PatchSwitcher add-patch now dedupes auto-names**: if a user picks a region twice (e.g. defaults to "London" or "Home"), the second patch is silently renamed to "Home (2)", "Home (3)" etc, with the suffix counted against the 30-char name cap so display never overflows. Implemented in `usePatches.addPatch` — `renamePatch` is intentionally untouched so users remain free to choose any name they want explicitly.
- **Footer / Emergent badge overlap fixed**: the legal strip in `Footer.jsx` now has `pb-20` on mobile / `md:pr-44` on desktop, giving the floating "Made with Emergent" platform badge ~64px of clearance at the bottom-right so it never sits on top of the Patrons / Privacy / Terms / Contact links. Verified at 414×800 mobile viewport.
- Lint clean across all touched files. No new tests required — translations covered by existing iter21 frontend i18n smoke; dedupe and footer changes are minor.

### Iteration 25 (2026-02-23): ✅ — Compare patches + Wellbeing feature + 58-language coverage
- **Compare patches** (`/calendar/compare`): two-column dual-region monthly guidance side by side. Free users see column A in full, column B is rendered as a static skeleton (zero LLM cost) under a backdrop-blur with an "🔒 Unlock side-by-side compare" CTA opening the existing PaywallModal. Paid users pick either column from any of their patches via dropdowns; a Swap pill flips columns. Added a "Compare patches" link to `/calendar`.
- **GuidanceView readOnly prop**: tasks render as static squares (no toggle) inside the compare columns so toggling there doesn't mutate the active patch's task state.
- **`<WellbeingPage/>` at `/wellbeing`** — a full wellbeing journal:
  - Hero + new nav link (`Wellbeing`).
  - **Mindful moment** card with a rotating monthly prompt (12 seasonal cards, one per month, all in the i18n layer).
  - **Sit and notice** sensory immersion section: 5 cards (Listen / Watch / Breathe in / Touch / Taste) with vivid copy invoking the rustle of ornamental grasses, bees in lavender, hoverflies on daisies, butterflies on buddleia, the smell of a tomato vine after rain, etc.
  - **Soul band** ("You don't only grow food, or the transient beauty of flowers. You grow yourself and your soul.") — the deeper "why".
  - **Today's check-in**: 5-mood scale + a 280-char gratitude note. Saved per-patch in localStorage at `patchpot.patch.<active>.wellbeing.v1`. Form re-seeds on patch switch (was a state-staleness bug flagged by tests, now fixed).
  - **Three principles**: Notice / Slow / Nourish.
  - **History**: timeline of past entries with delete, plus a `window.print()` "booklet" export.
- **Home wellbeing band** ("Grow food. Grow yourself.") added below the editorial quote on the home page, with the 3 principles + a CTA into `/wellbeing`.
- **i18n at session scale**: added ~140 new keys spanning multi-patch UI, compare view, retro-patron CTA, and the entire wellbeing feature. Translated to all 57 non-English locales using a forked `translate_session_keys.py` script (`gpt-4o-mini` via the Emergent LLM key). Plus a follow-up patch (`translate_session_patch.py`) re-translated 4 keys after copy edits ("no purpose apart from simply being and relaxing", "transient beauty of flowers / soul"). Two locales (gu, th) had AI-generated unescaped quotes that mangled the i18n file — surgically hand-cleaned. Lint passes; iter21 frontend testing agent confirmed FR/DE/ES/JA/AR all render translated copy and AR is RTL.
- **Per-patch wellbeing isolation** verified via tests — switching patches swaps history + form pre-fill correctly; nothing bleeds between gardens.
- **Tests**: testing agent iter21 — 16/16 frontend scenarios PASS at first sweep including i18n smoke for 5 langs + Arabic RTL, persistence on reload, history delete, print invocation, and per-patch isolation.

### Iteration 24 (2026-02-23): ✅ — Multi-patch paid tier (1a + 2b)
- **Backend constants** `FREE_PATCH_LIMIT=5` / `PAID_PATCH_LIMIT=25` added to `core.py` and re-exported in `__all__`.
- **`POST /api/access/check` extended** to return `patch_limit` (5 if no/expired/bogus grant, 25 if any active paid grant — monthly through founding-lifetime). Server is the source of truth; the frontend defaults to 5 only as an optimistic fallback before the first verify.
- **`usePaywall` exposes `patchLimit`** alongside `paid` / `loading` / `refresh`.
- **`usePatches(limit?)`** now accepts a runtime cap; `canAdd`, `addPatch` and the legacy `MAX_PATCHES` alias all respect the passed-in cap. The free-tier constant `FREE_PATCH_LIMIT` is exported for components that need to know the cutoff for paywall-CTA copy.
- **`<PatchSwitcher/>` and `<PatchTabStrip/>`** read `patchLimit` from `usePaywall`, pass it to `usePatches`, and swap the disabled-add affordance for an "🔒 Unlock up to 25 patches" CTA when an unpaid user hits 5. Clicking opens `<PaywallModal/>`; `onUnlocked` calls `refreshPaywall()` so the cap lifts immediately without a page reload. Paid users hitting 25 see "email hello@patchandpot.com if you need more" copy instead.
- **Tests** (`backend/tests/test_patch_limit.py`): 5/5 pass — empty/bogus token → 5, valid lifetime grant → 25, expired grant → paid=false + 5, constants sanity.
- **Honest threat-model note**: patches themselves still live entirely in localStorage (no server-side storage), so a determined power-user could edit JSON to add a 6th patch — but the canonical cap value is server-authoritative and the UX is gated. Acceptable for a UI feature; no server resource at risk.

### Iteration 23 (2026-02-23): ✅ — Multi-patch (home + holiday cottage) + retrospective patrons + backend regression fix
- **New `usePatches` hook** (`/app/frontend/src/hooks/usePatches.js`) — module-level singleton (`useSyncExternalStore`) holding the patches index `{active_id, patches:[{id,name,created_at}]}` in `patchpot.patches.v1`. Each patch owns its own namespaced slots `patchpot.patch.<id>.region.v1`, `.garden.v1`, `.tasks.v1`. MAX_PATCHES = 5 (will be lifted under a paid tier later). Cross-tab sync via the `storage` event.
- **Auto-migration of pre-patch users**: if `patchpot.patches.v1` is missing AND any of `patchpot.region.v1` / `patchpot.garden.v1` / `patchpot.tasks.v1` exist on first read, they are wrapped into a single auto-named "Home" patch (or named after the saved region) and the legacy keys deleted. No data loss; users keep the exact same view they had.
- **Refactored `useRegion` / `useMyGarden` / `useCompletedTasks`** to delegate to the active patch's namespaced storage slot. The public APIs are unchanged so every existing call site (Header, Calendar, GuidanceView, plant pages, etc.) keeps working with zero edits. `onActiveChange` notifier re-syncs each hook the instant the active patch flips.
- **New `<PatchSwitcher/>` header pill** replaces the old region pill — dropdown listing patches (data-testid `patch-switcher-item-<id>`), "Change region for this patch", "Add another patch" (calls `RegionPicker` in `onPick` mode), and a link to `/garden` for full management. Shows 5-patch-limit copy once full.
- **New `<PatchTabStrip/>` on `/garden`** — one tab per patch with inline rename, "Set region", and a guarded delete (refuses to remove the last patch). Add-patch button visible while < 5.
- **`<RegionPicker/>` extended** with an optional `onPick` prop so the add-patch flow can intercept the picked region (create patch first, *then* assign region) instead of always writing into the active slot.
- **Retrospective Patrons CTA** on `/patrons` (`data-testid='patrons-retro-cta'`) — bordered band linking to `/patrons/manage` for paid users who didn't tick the opt-in box at checkout. Renders unconditionally (even if `/api/patrons` errors) so the self-add path is never hidden behind a list-loading failure.
- **Backend regression fixed**: the `patrons` router had been dropped from `/app/backend/server.py`'s import block + `include_router` calls (`/api/patrons` was returning 404). Re-registered (router self-prefixes with `/api`).
- **Code Quality cleanup carried over from iteration 22** (empty `catch` → `console.warn`, stale `eslint-disable` directives removed across 9 files, unescaped apostrophes fixed in `CheckoutSuccess.jsx` and `PatronOptInCard.jsx`).
- **Founding spots confirmed sold-out-gated only**: no time deadline anywhere; `/api/founding-status` exposes `active: available > 0` and banner/widget/embed gate on it.
- **Tests**: testing agent iter19 — 11/12 multi-patch frontend scenarios PASS (header dropdown, RegionPicker onPick add-patch flow, switch via dropdown, inline rename, guarded delete, persistence across reload, per-patch data isolation, 5-patch limit, legacy-user migration). Scenario 12 (retro CTA visibility) was the one that uncovered the patrons-router regression — re-verified visible after fix.

### Iteration 22 (2026-02-23): ✅ — Code Quality sweep
- **Empty catch blocks** in localStorage/sessionStorage wrappers now log via `console.warn` for better DevTools visibility while preserving the defensive ignore semantics for browser quota / privacy-mode failures. Files: `AdminAiUsage.jsx`, `AdminTokenGate.jsx`, `AIMasterclass.jsx`, `FoundingClaimModal.jsx`, `usePaywall.js`.
- **Stale `eslint-disable react-hooks/exhaustive-deps`** removed from `MasterclassDetail.jsx` (deps array is already correct; the disable comment was no longer suppressing anything). Same cleanup in `GuidanceView.jsx`, `SourceLinks.jsx`, `ThisMonthCard.jsx`, `Print.jsx`, `sentry.js`, and stale `max-lines` disables in 3 `data/*-masterclasses.js` files.
- **Unescaped apostrophes** fixed in `CheckoutSuccess.jsx` and `PatronOptInCard.jsx`.
- **Confirmed**: Code Review's "React hook dependency issues" were already fixed in earlier iterations — lint sweep on `CheckoutSuccess.jsx`, `AIPlantDetail.jsx`, `MasterclassDetail.jsx` produces zero exhaustive-deps warnings.
- Frontend lint now clean across all non-shadcn-ui files. Smoke screenshot on `/` confirms the app still renders.

### Iteration 21 (2026-02-22): ✅ — All loading copy translated to 58 languages
- Created `/app/scripts/translate_loading_keys.py` — a thin wrapper around the existing `translate_new_keys.py` that overrides `NEW_KEYS` so we only translate the 4 new loading strings (no re-translation of 80 unrelated keys).
- Ran successfully across all 57 non-EN locales. Idempotent — re-running safely upserts.
- **Verified live in German UI**: stage *"Wähle, was im März für Bonn gepflanzt werden soll…"* + reassurance *"Frische Regionen benötigen beim ersten Mal etwa 30–60 Sekunden. Zukünftige Besuche sind sofort."* {month}/{region} interpolation works correctly.
- All 58 locales (EN + 57) now carry `guidance.loading.starting/.generating/.almost/.cold_note`.

### Iteration 20 (2026-02-22): ✅ — Geo-detect actually works + cache prewarm
- **Real reason geo-detect was flaky for the user**: 8s timeout, no IP fallback, plus `enableHighAccuracy` default (slow on mobile, useless for city-level region lookup). Fixed: timeout 8s → 15s; `enableHighAccuracy: false`, `maximumAge: 600000` (cached coords up to 10min ok). When GPS denied/timeout/unavailable, we now silently try the new backend endpoint instead of showing an error.
- **New endpoint `GET /api/regions/ip-detect`**: uses Cloudflare edge headers (`cf-iplatitude/longitude/country`) when available, falls back to ipapi.co (free, no key, 1000/day) using the request's `x-forwarded-for` IP. Returns the same shape as `/regions/reverse` so the UI is interchangeable. Confirmed live — IP detect from preview origin correctly returned "Council Bluffs, Iowa, United States".
- **Cache prewarm**: `useRegion.setRegion` now fire-and-forgets `POST /api/guidance` for the current month the instant any region is committed — geo-detect, IP fallback, manual search, even "use London default". By the time the user clicks "Monthly Guide", the cache is already warm. Errors swallowed so prewarm never blocks the UI.
- **Verified live**: real-browser smoke clicked "Detect my location" → GPS unavailable in headless → IP detect succeeded → region set to Council Bluffs → 6 prewarm calls fired to `/api/guidance` (each idempotent upsert). Header shows "Council Bluffs". All 45 backend tests still pass.

### Iteration 19 (2026-02-22): ✅ — Graceful loading state for cold AI generation
- **Problem reported live**: even after the async-polling fix shipped to prod, users on cold-cache regions saw the page hang on a generic spinner for 30-60s — close enough to "broken" to feel broken. (Plus during the initial deploy window users got Cloudflare errors from the cached-by-SW old bundle.)
- **Fix 1 — Stage-aware loading**. `fetchGuidance(region, month, lang, garden, {onPhase})` now reports `pending → generating → almost` as the wait progresses. `GuidanceView` and `ThisMonthCard` render context-specific messages: *"Reading Quito's climate…"* → *"Choosing what to plant in February for Quito…"* + *"Fresh regions take ~30–60s the first time. Future visits are instant."* Cache hits never show any stage UI — the data appears instantly with no flicker.
- **Fix 2 — Service worker version bump** (`patchpot-v3` → `patchpot-v4`). Forces all browsers to discard stale shell + runtime caches on next visit so the new bundle propagates fast.
- **EN copy only for now**. The 4 new keys (`guidance.loading.starting/.generating/.almost/.cold_note`) live in EN; `t()` falls back to EN for the 57 other locales until I batch-translate via `/app/scripts/translate_new_keys.py`. Non-EN users will see English loading copy in the meantime — functional but not ideal. Translation run is a follow-up.
- **Verified**: live browser smoke against a fresh Quito/Feb scenario — stage messages rotated correctly, content appeared at ~25s; same region clicked again returned instantly with no stage UI at all. Lint clean both sides.

### Iteration 18 (2026-02-22): ✅ — Cloudflare timeout fix
- **`POST /api/guidance` is now async-with-cache-fastpath.** Cold AI generation routinely took 30-40s, blowing through Cloudflare/edge-proxy timeouts → users saw a Cloudflare error page until they refreshed (cache had filled in the meantime). Fix: cache hits keep their 1-call 200 contract; cache misses now return **HTTP 202 + `{status: "pending", job_id}`** immediately and a background task runs the Claude call. New `GET /api/guidance/job/{job_id}` returns `{status: "pending" | "done" | "error", data?, error?}`.
- **Frontend wrapper** (`/app/frontend/src/lib/api.js → fetchGuidance`): polls the job endpoint every 2s (up to ~3min) and resolves with the final guidance dict. All 3 callers (`Home/ThisMonthCard`, `Calendar/GuidanceView`, `Print`) unchanged — they keep their `.then(data => …)` shape.
- **Verified**: curl Lagos/March/EN cold → 202 + job_id, generated in ~36s, then identical request returns 200 in 180ms (cache fast-path). 31/31 router-refactor regression suite + 103 of 104 broader pytests pass; the one flake was the AI-touching admin cron test and passes when retried (Claude/Cloudflare flakiness, unrelated). Home page smoke screenshot shows the "June in your garden" sow/list/keep-an-eye-out columns populated correctly via the new polling path.

### Iteration 17 (2026-02-21): ✅
- **Backend refactor — server.py 2,337 → 118 lines.** Extracted shared models, helpers, plant data, climate maths, paywall guards and LLM helpers into `/app/backend/core.py`. Pulled the guidance generator into `/app/backend/services_guidance.py`. Split every endpoint into per-feature routers under `/app/backend/routers/` (checkout, plants, guidance, arrangement, pdf, masterclass, images, lesson, admin — alongside the existing regions / feedback / affiliate). server.py is now a thin app-assembly file with mongo + middleware + scheduler + router includes.
- **Sentry error logging — silent no-op default.** New `/app/backend/sentry_init.py` and `/app/frontend/src/sentry.js`. Both initialise only if `SENTRY_DSN` / `REACT_APP_SENTRY_DSN` is set; otherwise the app boots and renders normally with zero overhead. Frontend wraps the app tree in `Sentry.ErrorBoundary` (no-op when init is skipped). Backend uses Starlette + FastAPI integrations. Tunables: `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` (all optional).
- **Verified**: 73/73 pytest passing + 31/31 router-refactor regression suite (`/app/backend/tests/test_router_refactor.py`) green on warm cache (3s) and cold (90s). Every endpoint reachable at its original `/api/...` path with the original response shape. Frontend smoke OK.

### P1
- Real affiliate codes — waiting on user-supplied Amazon Associates, Awin, etc. network tags to swap into `/app/frontend/src/data/vendors.js`.
- Optional email subscription via Resend (when user supplies API key).
- Community / journal entries (would need auth).
- Refactor: consider splitting `/app/frontend/src/i18n/index.jsx` (>22,000 lines) into `i18n/en.js`, `i18n/de.js`, … with a `langLoader` per locale to keep diffs reviewable.
- Consolidate `PlantDetail.jsx` + `AIPlantDetail.jsx` (near-duplicates).
- Migrate FastAPI `@app.on_event(...)` to the modern `lifespan` context manager (deprecation warning).

### Iteration 20 (2026-02-22): ✅ — Homepage embed snippet + Admin AI usage UI
- **Homepage embed snippet** (`/app/frontend/src/components/EmbedFoundingSnippet.jsx`). New section on `/` for non-paid visitors, mounted only while the Founding cohort is active. Shows the iframe code block (`<iframe src=".../api/founding-status/widget" …>`) and a one-click "Copy embed code" button (clipboard API + execCommand fallback). Includes a "Preview the embed" deep-link. Disappears with the cohort the moment spots sell out — same gating as the banner.
- **Admin AI usage dashboard** (`/app/frontend/src/pages/AdminAiUsage.jsx`, mounted at `/admin/ai-usage`). Token-gated UI for the existing `GET /api/admin/ai-usage` endpoint: budget card with progress bar (£X / £cap with status pill — Healthy / Approaching cap / Circuit breaker tripped / Cap disabled), per-engine cards (Sonnet · Haiku · Images) with sub-breakdowns, total LLM calls + relative cost units, 7d/30d/90d window switcher, refresh, sign-out. Token persists in `localStorage['pp-admin-token']`. Not linked from public nav; `noindex` meta tag set.
- **API helper added**: `fetchAdminAiUsage(token, days)` in `/app/frontend/src/lib/api.js`.
- **Verified**: testing agent iteration_16 reports 100% pass — backend (3 window sizes + 422/403 negative cases) and frontend (gate, invalid-token error, valid-token dashboard, all 7 required data-testids, window switcher, sign-out) all green.

### Iteration 55 (2026-07-23): ✅ — GA4 wired live + Terms membership copy corrected + locale escape sweep
- **GA4 integration** — `REACT_APP_GA4_ID=G-JQ83NVMG5H` set in `/app/frontend/.env`. The pre-existing loader in `index.html` now activates: `gtag.js` loads on every page, `window.gtag` is defined, and SPA route changes fire a hand-crafted `page_view` with `page_location` / `page_path` / `page_title`. Fixed `/app/frontend/src/lib/track.js` to use the correct GA4 `gtag('event', name, params)` API (previously pushed GTM-style objects into dataLayer which GA4 didn't recognise). All custom events (`cta_click`, `page_view`, etc.) now dual-write to both first-party Mongo and GA4. Verified via live browser: `googletagmanager.com/gtag/js?id=G-JQ83NVMG5H` loaded, dataLayer contains proper GA4 config + page_view events on route change.
- **Terms page — Membership & payment section** rewritten in `en.js`: removed "inclusive of any UK VAT" (user does not charge VAT); added "Prices may increase in line with UK inflation; any change is flagged at least 14 days in advance and never affects a membership you have already paid for." Verified live at `/terms`.
- **57-language translation sweep** for `legal.terms.membership.html` via new `/app/scripts/translate_terms_membership_key.py` (GPT-4o-mini, price figures preserved as-is). All 57 non-EN locales now contain the corrected copy.
- **Compile-error sweep** — discovered and fixed 30 locale files where a prior translation script had emitted `\\"` (2 backslashes + quote) instead of `\\\"` (3 backslashes + quote) in `class=\"link\"` HTML attributes, causing SyntaxError: `Expecting Unicode escape sequence \uXXXX`. Fixed all 30 files in one regex sweep. Preview overlay gone, all locales compile.
- **Service worker** bumped `patchpot-v87 → v89` (two bumps: env change + locale fixes).
- **Follow-up (deferred, pending user OK)**: Privacy Policy disclosure of GA4 third-party analytics cookie (currently states "we do not run ad-tracking or fingerprinting on Patch & Pot itself" — now inaccurate since GA4 is live). Needs 58-language re-translation sweep once user confirms wording.

### Iteration 56 (2026-07-23): ✅ — Privacy Policy GA4 disclosure + gtag hardened
- **`legal.privacy.share.html`** rewritten in `en.js`: added GA4 to the processor list with plain-English disclosure (aggregate analytics, IP anonymised, Signals off, ad personalisation off, 14-month retention, link to Google's policy, opt-out add-on link). Reworded the tail paragraph so "no ad-tracking" no longer contradicts the GA4 line.
- **`legal.privacy.cookies.html`** rewritten in `en.js`: added a dedicated GA4 cookie bullet naming `_ga` and `_ga_<id>`, explaining what they do, and pointing to Google's opt-out browser add-on + browser-level Do Not Track.
- **`gtag('config', …)` hardened** in `/app/frontend/public/index.html`: `anonymize_ip: true`, `allow_google_signals: false`, `allow_ad_personalization_signals: false` so the privacy claims are actually enforced. (14-month retention must still be set in the GA4 admin console.)
- **57-language translation sweep** for both privacy keys via `translate_privacy_affiliate_disclosure.py`. 3 initial failures (lv, gu, az — JSON parse errors) recovered with `translate_privacy_retry.py` (GPT-4o, higher token budget).
- **Escape-bug sweep #2**: the LLM output re-introduced the `\\"link\\"` escape bug across 41 locale files (1,440 occurrences). Fixed by the same one-liner regex that repaired iteration 55. Also patched `translate_privacy_affiliate_disclosure.py`'s `upsert()` to run the same repair in-line so future translation runs of that script won't emit broken output.
- **SW bumped** v89 → v90.
- **Verified live** at `/privacy`: no compile overlay; all 7 verification checks pass (GA4 mentioned, opt-out link, IP anonymised, `_ga` cookie, 14-month retention, Signals off, policies.google.com link).
- **Follow-up (P1)**: Real GA4 admin console change needed — set data-retention to 14 months (Admin → Data Settings → Data Retention). Nothing to do in code.

### Iteration 57 (2026-07-23): ✅ — GA4 conversion events wired for the full funnel
- **`checkout_start`** — fires in `PaywallModal.jsx` the moment "Pay" is tapped, BEFORE the network call so drop-offs are still captured. Includes `currency: "GBP"`, `value` (GBP per tier), `items[]` (GA4 Ecommerce format), and `tier`. Also emits GA4-recommended alias `begin_checkout` so Ecommerce reports populate automatically.
- **`founding_claim`** — fires in `FoundingClaimModal.jsx` `useEffect` when the modal mounts (= user has committed to the Founding tier). Same shape as above, `value: 35`, `tier: "lifetime_founding"`, plus `remaining` spots. Also emits `begin_checkout` alias.
- **`checkout_success`** — fires in `CheckoutSuccess.jsx` inside the polling loop the first time `status.paid === true` (guarded by a `converted` flag so it never double-fires). Tips excluded. Includes `transaction_id: sessionId`, `value` (Stripe pence ÷ 100), `currency` (uppercased), `items[]`, `tier`. Also emits GA4-recommended `purchase` alias — this auto-populates GA4 Ecommerce revenue reports without any admin config.
- **`masterclass_generated`** — fires in `AIMasterclassSuggest.jsx` at both success paths (cache-warm + fresh AI generation) with `topic`, `slug`, `language`, `cached: bool`. Cached vs fresh distinction lets funnel analysis separate "first-time generation" from "returning to a saved topic".
- **Backend**: `GET /api/checkout/status/{session_id}` now returns `package_id`. Frontend already assumed this field existed for tip detection — the missing field was a latent bug. Now correctly populated from `payment_transactions.package_id` (with fallback to Stripe metadata).
- **Verified live** — smoke test confirmed:
  - Founding CTA → dataLayer contains `founding_claim` + `begin_checkout` with `value: 35, currency: 'GBP', tier: 'lifetime_founding', remaining: 29`
  - Paywall (annual tier) → dataLayer contains `checkout_start` + `begin_checkout` with `value: 15, currency: 'GBP', tier: 'annual'` and correct GA4 `items[]`
- SW bumped v90 → v91.
- **Admin console follow-up (P1)**: In GA4 → Admin → Events, mark `checkout_success`, `founding_claim`, `masterclass_generated` as **Key Events** so they appear in Conversion reports. `purchase` and `begin_checkout` are already recognised recommended events; no admin config needed for them.

### Iteration 58 (2026-07-23): ✅ — Brand favicon suite live (matches patchandpot.com)
- **Source**: the existing 3D plant-in-terracotta-pot brand logo from `patchandpot.com/img/patchandpot-logo.png` — same visual mark both sites now share.
- **Assets generated** from the source PNG via Pillow: `favicon.ico` (multi-res 16+32+48), `favicon-16/32/48/96.png` (transparent), `favicon-180/192/512.png` (composited onto sand `#F7F5F0` because iOS + Android require opaque backgrounds under the icon).
- **`index.html`**: added 4 `<link>` tags — 16×16, 32×32, `shortcut icon` for legacy, and 180×180 `apple-touch-icon`. Cache-busted with `?v=2`.
- **`manifest.json`**: replaced the single `favicon.ico` reference with `favicon-192.png` + `favicon-512.png` as `any maskable` — required for Android home-screen install and Google search's brand-image slot.
- **SW bumped** v92 → v93.
- **Verified**: all 6 icon files serve 200 with correct MIME; `favicon.ico` probe confirms 3.7KB multi-res ICO.
- **Removed** the earlier custom SVG favicon prototype (the brand PNG takes priority).
- **Follow-up (P2)**: Once patchandpot.app is deployed, Google search's "sitelink favicon" typically updates within 1–2 weeks of the next crawl. To speed that up you can request a re-crawl from Google Search Console.

### Iteration 60 (2026-09-29): ✅ — Lifetime + Founding tiers hidden from UI; email swap; £15 Annual CTA
- **Contact email swap** (68 files): `hello@patchandpot.com` → `gcanth@gmail.com`. Every locale, every component, every static data file. One `sed` sweep.
- **Feature flag** `SHOW_LIFETIME_TIERS = false` added at `/app/frontend/src/lib/features.js`. When flipped back to `true`, the Founding banner, Founding-claim modal, Embed snippet section, and Lifetime paywall tier all reappear with no other changes needed.
- **Home page** (`Home.jsx`):
  - `<FoundingBanner />` now guarded by `SHOW_LIFETIME_TIERS`
  - `<EmbedFoundingSnippet />` now guarded by `SHOW_LIFETIME_TIERS`
  - Bundle CTA rewritten to promote the **£15 Annual** tier — new headline "£15 · 12-month membership", body "One growing year, £15. No auto-renew — the membership ends naturally when the year is up.", "Unlock your full year" button, £2.99/mo fallback link.
  - `data-testid` renamed `home-bundle-buy-lifetime` → uses annual tier, plus new `home-bundle-buy-monthly` for fallback link.
- **PaywallModal.jsx**: `TIERS` array now filters out `lifetime` when the flag is off (4-tier modal instead of 5). Lifetime blurb "Pay once, keep it forever" removed from source. Modal header updated from "Five-tier" → "Time-limited-tier".
- **Copy rewrites in `en.js`**:
  - `legal.terms.membership.html` — removed "£50 one-off (lifetime)", the "Lifetime means lifetime of the Service…" clause, and the founding-supporter paragraph. Now says "We offer four tiers, all GBP…".
  - `legal.privacy.collect.html` — removed "(£5 / year or £25 / lifetime)" price hint.
  - `legal.privacy.retention.html` — removed "Access tokens linked to a lifetime membership: kept indefinitely" bullet.
  - `paywall.benefit.lifetime` — "Pay once, forever" → "No auto-renewal — memberships end naturally".
  - `home.bundle.body`, plus three new keys `home.bundle.annual_label`, `home.bundle.annual_blurb`, `home.bundle.unlock_annual`.
- **57-language translation sweep** for all 8 changed/new keys via `translate_post_lifetime_removal.py` (GPT-4o). Zero failures. The dead lifetime keys (e.g. `home.bundle.lifetime_label`, `paywall.tier.lifetime.*`) remain in non-EN locales as harmless orphans — they'll be picked up again if the flag is flipped back on.
- **Backend**: `/api/founding-status`, `/api/checkout/session` for `lifetime` + `lifetime_founding`, and Stripe pricing config in `core.py` all UNTOUCHED. Stale links, old share cards, and existing lifetime holders continue to work.
- **`FOUNDING_PHANTOM_SOLD=4`** env var still set (leftover from previous "pretend 5 sold" request). No effect while flag is off; harmless.
- **SW bumped** v99 → v101.
- **Verified live**: FoundingBanner absent, Embed section absent, Bundle CTA shows £15, paywall shows 4 tiers, no compile errors.

### Iteration 61 (2026-09-29): ✅ — Consent-gated cookie banner (GDPR)
- **`index.html`**: gtag script is no longer injected on page load. Instead, exposes `window.__ppInitAnalytics()` which the React banner calls on Accept. Returning visitors with `localStorage.pp_consent === "accepted"` auto-bootstrap the loader on script-eval (so their session isn't delayed by React hydration).
- **`CookieBanner.jsx`** (new): bottom-right forest-green rounded card, terracotta Accept button, ghost Reject button, dismiss × in corner (treated as reject). Reads/writes `localStorage.pp_consent`. Never renders once a decision is stored. Mounted globally in `App.js`.
- **Behaviour verified live**:
  - First visit: banner visible, `window.gtag === undefined`, zero requests to `googletagmanager.com`.
  - Accept: gtag script loads, `pp_consent = "accepted"`, banner dismissed. Retro-fires a `page_view` for the current URL so entry hit isn't lost.
  - Reject: no gtag, `pp_consent = "rejected"`, banner dismissed.
  - Reload with `rejected`: banner stays hidden, still no gtag traffic.
- **7 new i18n keys**: `cookie.title/body/privacy_link/accept/reject/dismiss/aria_label`. Translated to all 57 non-EN locales via `translate_cookie_banner_keys.py` — zero failures.
- **Bonus**: hardcoded "unlimited for founding members" line in the Home value strip changed to "unlimited with any membership" (was inconsistent post-lifetime-removal).
- **`track.js`** unchanged: existing `typeof window.gtag === "function"` guards mean the tracker safely no-ops when consent is rejected.
- **SW bumped** v101 → v102.
- **Follow-up note**: GA4 Consent Mode v2 signals (`gtag('consent', 'default', {...})`) are NOT set — because we're doing hard-blocking (no gtag script at all) rather than "cookieless pings". This is the stricter reading of the EU cookie directive. If you later want cookieless pings from rejected users, switch to Consent Mode v2 in `index.html`.

### Iteration 62 (2026-09-30): ✅ — Cookie preferences reset link in footer
- **Footer.jsx**: added a "Cookie preferences" button (rendered inline with the other legal links). On click it clears `localStorage.pp_consent` and dispatches a `pp:consent:reset` CustomEvent.
- **CookieBanner.jsx**: subscribes to `window.pp:consent:reset` and re-shows itself immediately — no page reload needed.
- **1 new i18n key** `footer.legal.cookie_prefs` = "Cookie preferences", translated to all 57 non-EN locales.
- **Verified live**: rejected visitor reloads → banner hidden; clicks footer "Cookie preferences" → localStorage cleared + banner reappears in bottom-right without reload.
- **SW bumped** v102 → v103.

### Iteration 63 (2026-10-01): ✅ — Mobile optimizations
- **Hero image** (`Home.jsx`): aspect-4/5 → aspect-16/10 on mobile, `md:aspect-[4/5]` restores portrait on tablet+. Added `rounded-2xl md:rounded-none` for a softer mobile edge. Prevents the hero from eating 125% of mobile viewport height.
- **Tap-target expansion** (iOS 44pt guideline): 6 text-link CTAs + 7 footer legal links + the Tip Jar button got `py-2 -my-2` (or `py-1.5 -my-1.5` on footer). No layout shift because the negative margin cancels the padding. Affected testids: `home-ethos-cta`, `home-wellbeing-cta`, `home-popular-more`, `home-thismonth-set-region`, `home-bundle-buy-monthly`, `tip-jar-button`, `footer-{about,patrons,privacy,terms,disclosure,cookie-prefs,contact}-link`.
- **Bundle CTA ordering**: added `order-1 md:order-2` / `order-2 md:order-1` so the £15 price card appears FIRST on mobile (users see offer before scrolling past features), and keeps the desktop features-on-left/price-on-right layout.
- **Plant of the Week** (`PlantOfTheWeek.jsx`): title drops `text-5xl` → `text-4xl` on mobile (prevents overflow against the decorative Sprout); outer card padding `p-8` → `p-6` on mobile (reclaims ~16px horizontal width per side).
- **SW bumped** v103 → v104.
- **Note**: screenshot tool is locked to 1920×800 viewport, so this was a code-review-driven pass rather than a visual mobile audit. User should verify on real device + take any specific mobile issues as follow-ups.

### Iteration 64 (2026-10-01): ✅ — Mobile pass on Masterclass Readers (AI + hand-authored)
- Both masterclass readers (`AIMasterclass.jsx` + `MasterclassDetail.jsx`) share the same mobile UX problem: the fat sidebar (lesson image, title, tagline, progress bar, full lesson list) renders ABOVE the lesson content in source order. Mobile visitors scroll past ~500px of nav before reaching the lesson they clicked on.
- **Mobile fix (both pages, identical pattern)**:
  - **Sidebar hidden on mobile** via `hidden md:block` so content appears above the fold.
  - **Compact mobile header**: masterclass title + duration + "Lesson N of M" + slim progress bar sit above the article.
  - **Horizontal lesson chip strip**: `-mx-6 px-6 snap-x snap-mandatory` scrolls edge-to-edge with per-chip snap. Active chip is forest/sand, done chips show a terracotta tick. Lets users swipe between lessons at a glance.
  - **Sticky bottom nav bar**: Previous ← | N/M | → Next, always one tap away. Uses `env(safe-area-inset-bottom)` so it sits above the iOS home-indicator on edge-to-edge phones. Hidden on tablets+.
  - **Mobile mark-complete button**: wider, full-width pill below the article (was a small inline text link).
  - **Container padding**: `pb-24 md:pb-16` so content isn't obscured by the sticky nav on mobile.
  - **Prose rhythm**: lesson H1 drops `text-4xl` → `text-3xl` on mobile; "All masterclasses" back link gets `py-2 -my-2` tap padding.
- Desktop layout above `md:` untouched — original fat sidebar + article grid stays exactly as it was.
- New data-testids: `ai-lesson-chip-{slug}`, `ai-mark-done-mobile-{slug}`, `ai-prev-lesson-mobile`, `ai-next-lesson-mobile`, `lesson-chip-{slug}`, `lesson-prev-mobile`, `lesson-next-mobile`.
- **SW bumped** v104 → v105. Site compiles clean, `/masterclasses/propagation` returns 200.

## 2026-06 — Instagram Seasonal Watercolours + Carousel (DONE, self-tested curl + screenshot)
- Rotation now: Mon = 3-slide masterclass CAROUSEL (cover → 3 Claude-written seasonal tips → CTA "Plan your patch free at patchandpot.app" + "Link in bio"), Wed = seasonal FEED card, Fri = masterclass REEL.
- Seasonal watercolours: 5 masterclasses × 4 UK seasons × 2 shapes (square/vertical) = 40 Gemini backgrounds, cached in `ig_bg_watercolours` keyed by (slug, orientation, season, v). Pre-generated by a background job that starts on backend boot (skips cached ones, so prod fills itself after deploy). Admin can re-run it with "Fill missing variants".
- Fixed: the `seasonal-planting` masterclass was being read as a month slug, and `plant-care`/`seasonal-planting` had no scene prompts.
- New endpoints: GET /api/instagram/seasonal-bgs, POST /api/instagram/seasonal-bgs/pregenerate, GET /api/instagram/seasonal-bgs/thumb, GET /api/public-image/{post_id}/{idx} (carousel slides for Meta). preview + publish-now accept ?media_format=CAROUSEL|FEED|REEL.
- /status no longer returns heavy video/slide base64.
- Admin UI: per-format preview buttons, swipeable carousel preview, seasonal watercolour grid (components/admin/IgSeasonalLibrary.jsx, IgPreviewMedia.jsx). sw.js → patchpot-v112.
- Pending user action: deploy, then Connect Instagram at patchandpot.app/admin/instagram. Meta carousel publish not tested live (no connection in preview).

## 2026-06 — Instagram switched to "Instagram API with Instagram Login"
- The old Meta app (1288380276707699, Facebook Login for Business) could not add the Instagram use case, so the Facebook dialog failed with "Sorry, something went wrong".
- New Meta app "Patch & Pot Poster" → Instagram app ID 1597617765170240 (INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET in backend .env). No Facebook Page is needed.
- The OAuth flow now goes instagram.com/oauth/authorize (scopes instagram_business_basic, instagram_business_content_publish) → api.instagram.com code exchange → graph.instagram.com long-lived token. Publishing goes through graph.instagram.com/v26.0. The token auto-refreshes before each publish once it's more than 24h old.
- Redirect URI: https://patchandpot.app/api/instagram/oauth/callback (must be saved in the Instagram business login settings).
- META_APP_ID / META_APP_SECRET are no longer used.

## 2026-06 — Prod Reel OOM fix
- The deployer RCA found the tier_0 pods (512Mi, 250m CPU) were OOMKilled while rendering Reels. The posts were left at COMPOSING, and preview returned a non-JSON 502, which Safari shows as "string did not match the expected pattern".
- Fixes:
  - x264 now runs with 1 thread, no lookahead, no B-frames: ffmpeg memory 391MB → 79MB, Reel peak ~390MB total.
  - The background is pre-tinted/pre-blurred once (render about 2x faster).
  - The encode runs in asyncio.to_thread, with a semaphore of 1 per pod.
  - Previews are async jobs: POST /api/instagram/preview → {preview_id}, then poll GET /api/instagram/preview/{id}. Jobs live in the ig_previews collection with a 1h TTL.
  - On startup, stuck COMPOSING/READY/CONTAINER_CREATED posts are marked ERROR.
  - The admin UI shows a friendly message when the server sends back non-JSON.
- Instagram is connected in prod as @patchandpot (IG user 17841476162761771).

## 2026-06 — Instagram visual refresh (all 3 formats)
- New `backend/routers/ig_graphics.py` "postcard on a painting" design system:
  - Crisp watercolour with vignette and paper grain, frosted sand cards with soft shadows.
  - Brand fonts in backend/assets/fonts: Cormorant Garamond VF + Outfit VF. Patch & Pot sprout badge, terracotta season pills, slide counters.
- Carousel: cover card → "Autumn tips" card with big italic numerals → forest CTA "Plan your patch, free." + LINK IN BIO.
- Reel: 12s, 3 scenes with 0.6s crossfades:
  - Scene A (title card slides up) → Scene B (3 tips appear one by one) → Scene C (staggered CTA). Ken Burns drift throughout.
  - The Reel now also uses Claude tips.
- Memory safety: frames are rendered to JPEGs on disk, then gc + malloc_trim, then a single-thread x264 encode. Peak is ~406MB with the full server loaded (limit 512Mi).
- PENDING: Instagram-library music needs Meta's Audio API (`/ig_audio` search + `audio_configuration` on the REELS container). That only works with Facebook Login + a Facebook Page linked to @patchandpot. The user is setting up the FB Page; next step is adding Facebook Login to the "Patch & Pot Poster" app and a second "Connect Facebook (music)" flow.

## 2026-06 — Saturday "What to Sow" carousel + Reel music (code ready)
- New slot: Saturday 09:00 UK (cron `ig-sat-9am`). It builds a carousel from the app's own planting-calendar guidance (London/UK, current month, `plant_now`):
  - Slides: cover "What to sow in {Month}", then 3 plants per slide (name + FOOD/FLOWER tag + how-to, trimmed to whole sentences), then the CTA.
  - Hashtag pool: `what-to-sow`.
  - The caption names the plants.
  - SLOTS dict replaces ROTATION; preview key `SOW`.
- Music: the Facebook Login flow lives at /api/instagram/fb/oauth/start + /fb/oauth/callback (redirect = META_OAUTH_REDIRECT with /fb/oauth/callback). It stores the page token + IG business id in `ig_fb_connection`.
  - Reels search `/ig_audio` (queries rotate weekly: The Wandering Hearts, Nick Drake, upbeat folk, feel good acoustic folk) and publish via graph.facebook.com with `audio_configuration`.
  - If the FB container fails, the Reel falls back to a silent post via Instagram Login.
  - GET /fb/music-test lists found tracks; POST /fb/disconnect.
- NEEDS from user: Facebook Page linked to @patchandpot; FB_APP_ID + FB_APP_SECRET (Meta App ID of "Patch & Pot Poster", Settings → Basic); Facebook Login product with redirect https://patchandpot.app/api/instagram/fb/oauth/callback; optional FB_LOGIN_CONFIG_ID if Meta forces Facebook Login for Business.
- Music keys added: FB_APP_ID=4590252727857744 ("Patch & Pot Poster", verified with app token), FB_APP_SECRET, FB_LOGIN_CONFIG_ID=1418060107200751 (Facebook Login for Business config, so the dialog sends config_id instead of scope). Awaiting user: redeploy → Connect Facebook (for music) → Test music search.
- CTA wording changed to "Plan your patch, / season by season." (app isn't free); Reel CTA scale 1.15.
- Music search verified in prod (royalty-free library for Business accounts; artist names return unrelated results). MUSIC_QUERIES switched to genre terms. Admin Publish now publishes the last-previewed format (e.g. Fri · Reel), and the post list shows the music track or music error. Reel publish WITH audio_configuration not yet verified live.
- 2026-10-10: ALL slots now publish as Reels so music can attach (Meta's Audio API is REELS-only):
  - Mon: masterclass slideshow Reel, 3 slides × 3s, ~9.8s.
  - Wed: 8s card Reel.
  - Fri: 12s 3-scene Reel.
  - Sat: what-to-sow slideshow Reel, ~12.8s.
  - Slideshow = the square slides (reel=True, so no swipe hints/counters) as rounded postcards over a light-washed vertical painting, with slow zoom + 0.5s crossfades (ig_graphics.make_slideshow_renderer).
  - post doc stores 'slot'. The old carousel publish path is kept but unused.
- 2026-10-10: First live Reel with library music published (Ocean Tide by Lyle Workman). The Sat what-to-sow slideshow OOM'd in prod: ffmpeg '-shortest' made the muxer buffer the whole video (253MB). Replaced with '-t dur' plus single-thread input decode → peaks: SOW 385MB, Mon carousel 386, Fri reel 388, Wed card 373 (limit 512).
- 2026-10-10: Music variety: 12 folky genre queries shuffled per post, full result lists pooled, the last 30 used audio_ids are skipped (from ig_posts.music); if all were used recently, it picks the least-recently used.
- 2026-10-10: Longer reading time:
  - Slideshows: 5s per slide, last slide +1s (SOW 21s, Mon ~16s).
  - Card Reel: 10s.
  - Fri Reel: 16s (title 4.6s, tips 1.6s apart until 12s, CTA 4s).
  - Peaks ≤400MB.
  - Admin preview polls up to 6 min.
