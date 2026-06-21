# Patch & Pot – PRD

## Original Problem Statement
> Take https://patchandpot.com and create a gardening app with all the features on that, with
> seasonal monthly updates on planting, pest control and tasks for that month — regional-aware
> regardless of where in the world. Cover food and flowers (incl. cut flowers + PDFs).
> Iteration 2: also add multi-language, pest reference gallery, companion suggestions,
> a "Get this month's update" button with download/print, and PWA offline mode.

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
- Paste real Sentry DSNs into `backend/.env` (`SENTRY_DSN=...`) and `frontend/.env` (`REACT_APP_SENTRY_DSN=...`) when ready. Rebuild frontend.
- Save multiple "patches" (home + holiday cottage).

### P2
- Optional email subscription via Resend (when user supplies API key).
- Community / journal entries (would need auth).
- Refactor: consider splitting `/app/frontend/src/i18n/index.jsx` (>22,000 lines) into `i18n/en.js`, `i18n/de.js`, … with a `langLoader` per locale to keep diffs reviewable.
- Consolidate `PlantDetail.jsx` + `AIPlantDetail.jsx` (near-duplicates).
- Migrate FastAPI `@app.on_event(...)` to the modern `lifespan` context manager (deprecation warning).

## Smart Next Action
Now that errors are wired for visibility, capture the **first 30 days of real user errors** in Sentry — pick the top 1–2 recurring browser exceptions and harden those flows before iterating on new features.
