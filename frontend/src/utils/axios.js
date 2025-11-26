import axios from 'axios';

// Configure axios base URL for API calls
// In development, Vite proxy will handle this
// In production, API calls go to the same origin
if (import.meta.env.DEV) {
  // Development: proxy to backend (configured in vite.config.js)
  axios.defaults.baseURL = '';
} else {
  // Production: same origin
  axios.defaults.baseURL = '';
}

// Add request interceptor to include token
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('mtm_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid, clear auth and redirect to login
      localStorage.removeItem('mtm_token');
      localStorage.removeItem('mtm_user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default axios;

