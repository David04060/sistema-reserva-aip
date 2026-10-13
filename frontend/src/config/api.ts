const API_URL = (
  (import.meta.env.MODE === "express" && import.meta.env.VITE_API_URL?.trim()) ||
  "/api"
).replace(/\/+$/, "");

export default API_URL;
