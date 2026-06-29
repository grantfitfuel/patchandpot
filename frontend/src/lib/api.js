import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  timeout: 60000,
});

export const fetchRecentAIPlants = (language = "en") =>
  api.get("/recent-plants", { params: { language } }).then((r) => r.data);
export const submitFeedback = (payload) =>
  api.post("/feedback", payload).then((r) => r.data);
export const fetchPlants = (language = "en") =>
  api.get("/plants", { params: { language } }).then((r) => r.data);
export const fetchPlant = (id, language = "en") =>
  api.get(`/plants/${id}`, { params: { language } }).then((r) => r.data);
export const fetchCompanions = (id, language = "en") =>
  api.get(`/plants/${id}/companions`, { params: { language } }).then((r) => r.data);

// ────────────────── Paywall ──────────────────
export const createCheckout = (originUrl, email, packageId) =>
  api.post("/checkout/session", {
    origin_url: originUrl, email, package_id: packageId,
  }).then((r) => r.data);
export const getCheckoutStatus = (sessionId) =>
  api.get(`/checkout/status/${sessionId}`).then((r) => r.data);
export const checkAccess = (token) =>
  api.post("/access/check", { token }).then((r) => r.data);

// Build URL for the seasonal PDF endpoint. We POST so the access token doesn't
// end up in browser history/server logs.
export const seasonalPdfUrl = () => `${API}/seasonal-pdf`;
export const fetchPlantGuide = (query, language = "en") =>
  api.post("/plant-guide", { query, language }).then((r) => r.data);
export const fetchCachedPlantGuide = (slug, language = "en") =>
  api.get(`/plant-guide/${slug}`, { params: { language } }).then((r) => r.data);
// Cold AI guidance generation can take 20-40s which exceeds Cloudflare's
// timeout. The backend now returns 202 + {status: "pending", job_id} when it
// schedules a background job; this wrapper polls transparently so the 3
// callers keep their plain `.then(data => …)` shape. Cache hits still resolve
// in one round-trip.
const GUIDANCE_POLL_INTERVAL_MS = 2000;
const GUIDANCE_POLL_MAX_ATTEMPTS = 90;  // ~3 minutes — well past Claude's cold ceiling.

const _sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const _pollGuidanceJob = async (jobId, onPhase) => {
  for (let attempt = 0; attempt < GUIDANCE_POLL_MAX_ATTEMPTS; attempt += 1) {
    await _sleep(GUIDANCE_POLL_INTERVAL_MS);
    // Switch phase as the wait drags on so the UI can reassure the user
    // instead of looking like a hang.
    if (onPhase) {
      const elapsedSec = (attempt + 1) * (GUIDANCE_POLL_INTERVAL_MS / 1000);
      if (elapsedSec >= 25) onPhase("almost");
      else if (elapsedSec >= 8) onPhase("generating");
    }
    const { data } = await api.get(`/guidance/job/${jobId}`);
    if (data?.status === "done" && data?.data) return data.data;
    if (data?.status === "error") {
      const err = new Error(data.error || "AI generation failed");
      err.code = "guidance_job_failed";
      throw err;
    }
    // status === "pending" → keep polling
  }
  const timeout = new Error("Guidance generation timed out — please try again.");
  timeout.code = "guidance_job_timeout";
  throw timeout;
};

/**
 * Fetch monthly guidance with optional phase reporting.
 * @param {Object} region
 * @param {number} month
 * @param {string} [language="en"]
 * @param {string[]|null} [myGarden=null]
 * @param {{ onPhase?: (phase: "pending"|"generating"|"almost") => void }} [opts]
 */
export const fetchGuidance = async (region, month, language = "en", myGarden = null, opts = {}) => {
  const { onPhase } = opts;
  const res = await api.post(
    "/guidance",
    { region, month, language, my_garden: myGarden },
    { validateStatus: (s) => s === 200 || s === 202 },
  );
  const body = res.data;
  if (res.status === 202 && body?.status === "pending" && body?.job_id) {
    if (onPhase) onPhase("pending");
    return _pollGuidanceJob(body.job_id, onPhase);
  }
  return body;
};
export const fetchPlantImage = (plant) =>
  api.post("/plant-image", { plant_id: plant.id, plant_name: plant.name }).then((r) => r.data);
export const fetchPestImage = (name) =>
  api.post("/pest-image", { name }).then((r) => r.data);
export const searchRegions = (q) =>
  api.get("/regions/search", { params: { q } }).then((r) => r.data);
export const reverseGeocode = (lat, lon) =>
  api.get("/regions/reverse", { params: { lat, lon } }).then((r) => r.data);
// IP-based fallback for when navigator.geolocation isn't available, was
// denied, timed out, or — common on desktops with no GPS — returns nothing.
export const ipDetectRegion = () =>
  api.get("/regions/ip-detect").then((r) => r.data);

export const fetchFoundingStatus = () =>
  api.get("/founding-status").then((r) => r.data);
// Admin: AI usage telemetry. Token is passed via query string per existing
// router contract; we don't store it on the axios instance because the token
// is per-request and gated by an explicit text input on the admin page.
export const fetchAdminAiUsage = (token, days = 30) =>
  api
    .get("/admin/ai-usage", { params: { token, days } })
    .then((r) => r.data);
export const fetchAdminReferrals = (token, days = 30) =>
  api
    .get("/admin/referrals", { params: { token, days } })
    .then((r) => r.data);
// Admin: AI plant searches — top AI-generated guides by 7-day views.
// Powers the /admin/ai-searches "Promote" workflow.
export const fetchAdminAiSearches = (token, { limit = 50, includePromoted = false } = {}) =>
  api
    .get("/admin/ai-searches", {
      params: { token, limit, include_promoted: includePromoted },
    })
    .then((r) => r.data);
export const promoteAiPlant = (token, payload) =>
  api
    .post("/admin/promote-plant", payload, { params: { token } })
    .then((r) => r.data);
export const unpromoteAiPlant = (token, plantId) =>
  api
    .post("/admin/unpromote-plant", null, { params: { token, plant_id: plantId } })
    .then((r) => r.data);
export const clearPlantGuideCache = (token, slug) =>
  api
    .post("/admin/clear-plant-guide-cache", null, { params: { token, slug } })
    .then((r) => r.data);
// Patrons (public opt-in display)
export const fetchPatrons = () =>
  api.get("/patrons").then((r) => r.data);
export const fetchPatronMe = (sessionId) =>
  api.get("/patrons/me", { params: { session_id: sessionId } }).then((r) => r.data);
export const patronOptIn = (sessionId, displayName) =>
  api.post("/patrons/opt-in", {
    session_id: sessionId,
    display_name: displayName,
    consent: true,
  }).then((r) => r.data);
export const patronOptOut = (sessionId) =>
  api.post("/patrons/opt-out", { session_id: sessionId }).then((r) => r.data);
// Fire-and-forget cache prewarm. Returns a Promise but callers don't need to
// await it — any errors are swallowed so a flaky prewarm never crashes the UI.
export const prewarmGuidance = (region, month, language = "en") => {
  if (!region) return Promise.resolve(null);
  return api
    .post(
      "/guidance",
      { region, month, language, my_garden: null },
      { validateStatus: (s) => s === 200 || s === 202 },
    )
    .then((r) => r.data)
    .catch(() => null);
};
export const fetchVendorBlurbs = (plantName, vendors, region, language = "en") =>
  api
    .post("/vendor-blurbs", {
      plant_name: plantName,
      vendors: vendors.map((v) => ({ id: v.id, name: v.name, kind: v.kind })),
      region: region || null,
      language,
    })
    .then((r) => r.data);

// ────────────────── AI-generated Masterclasses ──────────────────
export const generateMasterclass = (topic, language, accessToken) =>
  api.post("/masterclass/generate", {
    topic, language, access_token: accessToken,
  }).then((r) => r.data);

export const pollMasterclassJob = (jobId) =>
  api.get(`/masterclass/job/${jobId}`).then((r) => r.data);

export const fetchGeneratedMasterclass = (slug, language = "en", accessToken = "") =>
  api.get(`/masterclass/generated/${slug}`, {
    params: { language, access_token: accessToken },
  }).then((r) => r.data);

export const fetchPopularMasterclasses = (limit = 12) =>
  api.get("/masterclass/generated", { params: { limit } }).then((r) => r.data);

export const fetchMyMasterclassLibrary = (accessToken, language = "en") =>
  api.get("/masterclass/library", {
    params: { access_token: accessToken, language },
  }).then((r) => r.data);

// SEO landing pages — OpenGraph + intro paragraphs for /learn/:topic.
export const fetchLearnOgMeta = (topic, language = "en") =>
  api.get(`/og/learn/${topic}`, { params: { language } }).then((r) => r.data);

// "What's in your garden right now" arrangement suggester.
export const fetchArrangementSuggestion = (payload, regenerate = false) =>
  api.post("/arrangement/suggest", payload, { params: { regenerate } }).then((r) => r.data);

// ────────────────── Share my patch ──────────────────
export const createSharedPatch = (payload) =>
  api.post("/share/patch", payload).then((r) => r.data);
export const fetchSharedPatch = (shareId) =>
  api.get(`/share/patch/${shareId}`).then((r) => r.data);
export const deleteSharedPatch = (shareId, ownerSecret) =>
  api.delete(`/share/patch/${shareId}`, { params: { owner_secret: ownerSecret } }).then((r) => r.data);
export const fetchPopularPatches = (limit = 6) =>
  api.get("/share/patches/popular", { params: { limit } }).then((r) => r.data);
export const fetchPlantOfTheWeek = (language = "en") =>
  api.get("/plants/of-the-week", { params: { language } }).then((r) => r.data);
export const fetchPopularPlants = (limit = 6, language = "en") =>
  api.get("/plants/popular", { params: { limit, language } }).then((r) => r.data);
