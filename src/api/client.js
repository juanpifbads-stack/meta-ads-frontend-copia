import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'https://meta-ads-backend-production-85df.up.railway.app',
  withCredentials: true, // CRITICAL: needed for httpOnly cookies to work
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
  timeout: 30000,
});

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;

    if (status === 401) {
      // No redirigir en el portal de cliente (es público, con su propia clave)
      const path = window.location.pathname;
      if (path !== '/' && !path.startsWith('/cliente')) {
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
