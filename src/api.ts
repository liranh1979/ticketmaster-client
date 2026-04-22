import axios from 'axios';
import i18n from './i18n';

// 1. Log to console to debug (check this in F12)
console.log("Current VITE_API_URL:", import.meta.env.VITE_API_URL);

const api = axios.create({
  // 2. Add the hardcoded fallback so it never hits port 5173 by mistake
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1',
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  config.headers['Accept-Language'] = i18n.language || 'en';
  return config;
});

export default api;

