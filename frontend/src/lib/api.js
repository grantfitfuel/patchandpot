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
export const createCheckout = (originUrl, email) =>
  api.post("/checkout/session", { origin_url: originUrl, email }).then((r) => r.data);
export const getCheckoutStatus = (sessionId) =>
  api.get(`/checkout/status/${sessionId}`).then((r) => r.data);
export const checkAccess = (token) =>
  api.post("/access/check", { token }).then((r) => r.data);
export const fetchPlantGuide = (query, language = "en") =>
  api.post("/plant-guide", { query, language }).then((r) => r.data);
export const fetchCachedPlantGuide = (slug, language = "en") =>
  api.get(`/plant-guide/${slug}`, { params: { language } }).then((r) => r.data);
export const fetchGuidance = (region, month, language = "en", myGarden = null) =>
  api.post("/guidance", { region, month, language, my_garden: myGarden }).then((r) => r.data);
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
