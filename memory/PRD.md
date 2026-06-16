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

## Prioritised Backlog
### P1
- Real cron for monthly auto-refresh of guides.
- Lazy-load plant images on grid (defer LLM cost until card focused).
- Save multiple "patches" (home + holiday cottage).

### P2
- Optional email subscription via Resend (when user supplies API key).
- Community / journal entries (would need auth).
- More languages (es, pt, it, hi, ar).

## Smart Next Action
Region-aware **affiliate links** on the plant database (seeds, compost, pots) — genuinely helpful
*and* a clean revenue layer that turns AI cost back into income.
