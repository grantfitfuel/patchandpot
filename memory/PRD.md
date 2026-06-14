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
- **Iteration 2**: 25/25 backend + 100% frontend ✅

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
