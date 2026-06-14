# Patch & Pot – PRD

## Original Problem Statement
> Take https://patchandpot.com and create a gardening app with all the features on that and make
> everything work with seasonal monthly updates on planting and pest control and tasks for that
> month. The information should be regional focused regardless of where in the world that region
> is. Cover food and flowers (incl. the cut flower guide and PDFs).

## User Choices (gathered via ask_human)
- Region: auto-detect with manual override (both)
- Features: all (monthly calendar, pest control, plant database, tasks, My Garden)
- Content: AI-generated via Claude Sonnet 4.5 (Emergent LLM key)
- Auth: none
- Images: AI-generated via Gemini Nano Banana (Emergent LLM key)
- Scope expansion: add Cut Flowers + Companion Planting guides from patchandpot.com
  including the two linked PDFs.

## Architecture
- **Backend**: FastAPI on :8001, MongoDB for caching (guidance_cache + image_cache).
  Routes prefixed `/api/`. Uses `emergentintegrations.llm.chat.LlmChat` for Claude Sonnet 4.5
  and Gemini `gemini-3.1-flash-image-preview` (Nano Banana).
- **Frontend**: React 19 + React Router 7. Tailwind 3 with a custom earthy palette
  (sand #F7F5F0, forest #2D4A22, terracotta #C65D47, moss #5C6B52). Typography:
  Cormorant Garamond (headings) + Outfit (body). localStorage for region and My Garden.
- **No auth** – everything works without login.

## Core Requirements (static)
1. Region picker (auto-detect via browser geolocation + manual search via Open-Meteo geocoding).
2. Monthly seasonal guide (12 months) – AI-generated planting/harvest/tasks/pests per region+month.
3. Plant database (32 items: food + flowers).
4. Pest & disease watch (region+month).
5. Tasks/to-do list (region+month, completion persisted to localStorage).
6. My Garden (saved plants + personalized monthly tasks).
7. Guides: First Pot, Space-Saving, Regrow, Cut Flowers (with 2 PDFs), Companion Planting.

## What's Been Implemented (Feb 2026)
- ✅ Backend endpoints: `/api/`, `/api/plants`, `/api/plants/{id}`, `/api/guidance`,
  `/api/plant-image`, `/api/regions/search`, `/api/regions/reverse`.
- ✅ Caching layer in MongoDB (`guidance_cache`, `image_cache`) – first request hits LLM,
  subsequent requests are instant.
- ✅ AI prompt explicitly returns mix of food + flower with `kind` badges.
- ✅ 32-plant database including 12 flowers (Nasturtium, Calendula, Sunflower, Marigold,
  Lavender, Cosmos, Viola/Pansy, Sweet Pea, Zinnia, Borage, Scented Geranium, Chamomile).
- ✅ Frontend pages: Home, Calendar, Plants, PlantDetail, PestControl, MyGarden, Guides (5 slugs).
- ✅ Cut Flowers guide page: hero, intro, 2 PDF download buttons (linked to patchandpot.com),
  container sizes table, bulb lasagne steps, 3 colour palettes (Pastel Meadow, Hot & Happy,
  Cool Calm), full sowing & planting calendar table (19 rows), all-year colour list.
- ✅ Companion Planting guide page: great combos, container pairings table, mini guilds.
- ✅ data-testid coverage throughout.
- ✅ Tested end-to-end (12/12 backend, 100% frontend flows).

## User Personas
- **Balcony beginner** – tiny outdoor space, wants the simplest path to first harvest.
- **Mindful kitchen gardener** – grows a mix of food + flowers, values seasonal rhythm.
- **Global expat / digital nomad** – moves between climates, needs region-aware advice.

## Prioritised Backlog
### P1 (next session)
- Companion-aware suggestions inside Plant detail ("Plants well with…").
- Pest gallery with AI-generated reference photos for the top common pests per region/month.
- Pinch-of-citrus mode: print-friendly month sheet (one-pager you can stick on the fridge).

### P2
- PWA install + offline cache of region's current month guidance.
- Multi-language support (the AI handles content; just need i18n shell).
- Community / journal entries (would require auth — defer).
- Push notifications for the first of each month ("Your March garden is ready").

## Smart Next Action Item
- Add an opt-in email newsletter that sends the AI-generated monthly guide on the 1st of each
  month for the user's saved region — this is the natural retention/engagement layer for a
  seasonal app and gives a clean place to monetise later (sponsored seed/compost links).
