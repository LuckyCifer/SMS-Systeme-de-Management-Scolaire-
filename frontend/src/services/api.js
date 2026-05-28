/**
 * services/api.js
 * Instance Axios centrale avec gestion automatique des tokens JWT.
 */
import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// ── Instance principale ───────────────────────────────────────────────────────
const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// ── Helpers localStorage ──────────────────────────────────────────────────────
export const getAccessToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('sms_access');
};

export const getRefreshToken = () => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('sms_refresh');
};

export const setTokens = (access, refresh) => {
  localStorage.setItem('sms_access', access);
  if (refresh) localStorage.setItem('sms_refresh', refresh);
};

export const clearTokens = () => {
  localStorage.removeItem('sms_access');
  localStorage.removeItem('sms_refresh');
};

// ── Intercepteur REQUEST — injecte le token + l'établissement ────────────────
api.interceptors.request.use(
  (config) => {
    // Skip token for public endpoints
    const skipAuthEndpoints = ['/api/auth/login/', '/api/auth/sms-login/', '/api/auth/refresh/'];
    if (skipAuthEndpoints.some(endpoint => config.url.includes(endpoint))) {
      return config;
    }

    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Injecte l'établissement courant pour l'isolation des données
    try {
      const raw = localStorage.getItem('sms_etab');
      if (raw) {
        const { data } = JSON.parse(raw);
        if (data?.code_etab) {
          config.headers['X-Etablissement-Id'] = data.code_etab;
        }
      }
    } catch {}

    return config;
  },
  (error) => Promise.reject(error)
);

// ── Intercepteur RESPONSE — gère le 401 / refresh ────────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;

    // Skip if already retried or not 401
    if (original._retry || error.response?.status !== 401) {
      return Promise.reject(error);
    }

    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      })
        .then(token => {
          original.headers.Authorization = `Bearer ${token}`;
          return api(original);
        })
        .catch(err => Promise.reject(err));
    }

    original._retry = true;
    isRefreshing = true;

    const refreshToken = getRefreshToken();

    if (!refreshToken) {
      clearTokens();
      // ← CRITIQUE : NE PAS rediriger ici, laisser le composant gérer
      return Promise.reject(error);
    }

    try {
      const res = await axios.post(`${BASE_URL}/api/auth/refresh/`, { refresh: refreshToken });
      const newAccess = res.data.access;
      setTokens(newAccess, res.data.refresh);
      processQueue(null, newAccess);
      original.headers.Authorization = `Bearer ${newAccess}`;
      return api(original);
      
    } catch (refreshError) {
      processQueue(refreshError, null);
      clearTokens();
      // ← CRITIQUE : NE PAS rediriger ici, laisser le composant gérer
      return Promise.reject(refreshError);
      
    } finally {
      isRefreshing = false;
    }
  }
);

export default api;