import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  timeout: 60000,
});

export const fetchPlants = () => api.get("/plants").then((r) => r.data);
export const fetchPlant = (id) => api.get(`/plants/${id}`).then((r) => r.data);
export const fetchGuidance = (region, month) =>
  api.post("/guidance", { region, month }).then((r) => r.data);
export const fetchPlantImage = (plant) =>
  api.post("/plant-image", { plant_id: plant.id, plant_name: plant.name }).then((r) => r.data);
export const searchRegions = (q) =>
  api.get("/regions/search", { params: { q } }).then((r) => r.data);
export const reverseGeocode = (lat, lon) =>
  api.get("/regions/reverse", { params: { lat, lon } }).then((r) => r.data);
