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

const _pollGuidanceJob = async (jobId) => {
  for (let attempt = 0; attempt < GUIDANCE_POLL_MAX_ATTEMPTS; attempt += 1) {
    await _sleep(GUIDANCE_POLL_INTERVAL_MS);
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

export const fetchGuidance = async (region, month, language = "en", myGarden = null) => {
  const res = await api.post(
    "/guidance",
    { region, month, language, my_garden: myGarden },
    { validateStatus: (s) => s === 200 || s === 202 },
  );
  const body = res.data;
  // Cache miss → background job kicked off; poll until done.
  if (res.status === 202 && body?.status === "pending" && body?.job_id) {
    return _pollGuidanceJob(body.job_id);
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
