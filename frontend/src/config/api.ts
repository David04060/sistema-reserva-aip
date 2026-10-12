const API_URL = (
  import.meta.env.VITE_API_URL?.trim() || `http://${window.location.hostname}:3000`
).replace(/\/+$/, "");

export default API_URL;
