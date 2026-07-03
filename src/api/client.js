import axios from 'axios';

const TOKEN_KEY = 'alquimia_auth_token';

// El login con Meta vuelve con el token en el hash (#token=...). Lo guardamos
// y limpiamos la URL. Esto evita depender de cookies de terceros.
try {
  const m = (window.location.hash || '').match(/(?:#|&)token=([^&]+)/);
  if (m) {
    localStorage.setItem(TOKEN_KEY, decodeURIComponent(m[1]));
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }
} catch { /* noop */ }

export function setAuthToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }
export function getAuthToken() { try { return localStorage.getItem(TOKEN_KEY); } catch { return null; } }

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://meta-ads-backend-production-85df.up.railway.app',
  withCredentials: true, // se mantiene por compatibilidad (navegadores que permiten cookies)
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30000,
});

// Adjuntar el token (si existe) en cada request.
apiClient.interceptors.request.use((config) => {
  const t = getAuthToken();
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      // Solo deslogueamos si falla la verificación de sesión (/auth/me). Un 401
      // transitorio en otro endpoint (hipo de Supabase, permiso puntual) NO debe
      // cerrar la sesión ni mandar al login — eso hacía re-pedir la clave a cada rato.
      const url = error.config?.url || '';
      const path = window.location.pathname;
      if (url.includes('/auth/me') && path !== '/' && !path.startsWith('/cliente')) {
        setAuthToken(null); // sesión realmente inválida
        window.location.href = '/';
      }
    }

    // Normalize error format
    const normalizedError = {
      status,
      message:
        error.response?.data?.error ||
        error.response?.data?.message ||
        error.message ||
        'Error desconocido',
      data: error.response?.data || null,
    };

    return Promise.reject(normalizedError);
  }
);

export default apiClient;
