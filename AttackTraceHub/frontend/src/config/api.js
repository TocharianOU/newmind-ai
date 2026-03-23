import axios from 'axios';

// Environment configuration
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

// Documentation URL configuration
export const DOCS_URL = import.meta.env.VITE_DOCS_URL || 'http://localhost:23002';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — try to refresh token on 401 before redirecting to login
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const isAuthPage = window.location.pathname.endsWith('/login') || window.location.pathname.endsWith('/register');
    const originalRequest = error.config;

    if (error.response?.status === 401 && !isAuthPage && !originalRequest._retry) {
      const refreshToken = localStorage.getItem('refreshToken');

      if (!refreshToken) {
        localStorage.removeItem('authToken');
        window.location.href = '/console/login';
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(token => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const response = await api.post('/api/auth/refresh', { refreshToken });
        const { accessToken, refreshToken: newRefreshToken } = response.data.data;

        localStorage.setItem('authToken', accessToken);
        if (newRefreshToken) {
          localStorage.setItem('refreshToken', newRefreshToken);
        }

        api.defaults.headers.common.Authorization = `Bearer ${accessToken}`;
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        processQueue(null, accessToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        window.location.href = '/console/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
