import axios from 'axios';
import useAuthStore from '../store/authStore';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5001/api/v1',
});

// Request Interceptor: Attach JWT to every request
api.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Unauthorized and Silent Refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Check if error is 401 (Unauthorized/Expired) and we haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const { refreshToken, user, setAuth, logout } = useAuthStore.getState();

      if (refreshToken) {
        try {
          // Attempt to refresh the token
          // Note: Avoid using 'api' instance here to prevent circular loops if refresh itself fails with 401
          const response = await axios.post('http://localhost:5001/api/v1/auth/refresh', { refreshToken });
          
          const newAccessToken = response.data.token;
          const newRefreshToken = response.data.refreshToken;

          // Update store with new tokens
          setAuth(user, newAccessToken, newRefreshToken);

          // Update original request header and retry
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          console.error('Silent refresh failed:', refreshError);
          logout();
          window.location.href = '/login';
        }
      } else {
        logout();
        window.location.href = '/login';
      }
    }

    return Promise.reject(error);
  }
);

export default api;
