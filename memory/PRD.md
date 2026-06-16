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
- **Iteration 11** (2026-02-16): ✅
  - **Massive localisation expansion**: total supported languages went from **14 → 31**. Added: Portuguese (`pt`), Italian (`it`), Dutch (`nl`), Polish (`pl`), Czech (`cs`), Slovak (`sk`), Slovenian (`sl`), Croatian (`hr`), Bulgarian (`bg`), Romanian (`ro`), Hungarian (`hu`), Greek (`el`), Estonian (`et`), Latvian (`lv`), Lithuanian (`lt`), Maltese (`mt`), Ukrainian (`uk`). All 24 official EU languages now covered, plus Ukrainian as the major non-EU European language.
  - **Translation-gap sweep**: extracted 20 hard-coded English strings into i18n keys (`region.search_failed`, `region.geo_not_supported`, etc.). All 14 pre-existing locales got full native translations for these new keys via a Python injection script.
  - Backend `LANG_NAMES` extended to all 31 codes; Claude now writes natively in any of them.
  - LANGUAGES dropdown exposes all 31 options with their native labels.
  - **Coverage trade-off**: 4 fully-native new locales (pt, it, nl, pl) ship complete ~130-key dictionaries. The other 13 (cs, sk, sl, hr, bg, ro, hu, el, et, lv, lt, mt, uk) ship a focused ~40-key dictionary covering nav, months, calendar/plants/garden titles, ThisMonthCard, source links, climates and the most visible buttons. Body paragraphs in those 13 fall back to English via the existing `t()` lookup.
  - **Verified end-to-end**: Polish UI screenshot confirms all visible page elements render in Polish. Claude API tests confirm natural-sounding vendor-blurbs in Polish, Greek, Ukrainian and Hungarian — with climate awareness.

## Prioritised Backlog
### P1
- **Translate masterclass lesson titles & in-lesson box headings** ("Why propagate?", "What you'll learn", etc.) — currently still English in sidebar regardless of UI language. Approach: add `mc.lesson.<slug>.<lesson-slug>` keys batch-translated via Claude, or extend `/api/lesson-adapt` to also return translated lesson chrome.
- **Translate static plant data** (`summary`, `sun`, `water`, `soil`, `difficulty`, `edible_part`, `category`) on the legacy `/plants/:id` route. The AI route `/plants/ai/:slug` already passes `language` and gets fully-translated content from Claude.
- Real affiliate codes — waiting on user-supplied Amazon Associates, Awin, etc. network tags to swap into `/app/frontend/src/data/vendors.js`.
- Real cron for monthly auto-refresh of guides.
- Lazy-load plant images on grid (defer LLM cost until card focused).
- Save multiple "patches" (home + holiday cottage).

### P2
- Optional email subscription via Resend (when user supplies API key).
- Community / journal entries (would need auth).
- Refactor: consider splitting `/app/frontend/src/i18n/index.jsx` (now ~7500 lines) into `i18n/en.js`, `i18n/de.js`, … with a `langLoader` per locale to keep diffs reviewable.
- Consolidate `PlantDetail.jsx` + `AIPlantDetail.jsx` (near-duplicates).

## Smart Next Action
Region-aware **affiliate links** on the plant database (seeds, compost, pots) — genuinely helpful
*and* a clean revenue layer that turns AI cost back into income.
