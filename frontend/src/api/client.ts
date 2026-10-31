import createClient, { type Middleware } from 'openapi-fetch';
import type { paths } from './schema';
import { clearAuth, getToken } from '../auth/tokenStorage';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const authMiddleware: Middleware = {
  async onRequest({ request }) {
    const token = getToken();
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`);
    }
    return request;
  },
  async onResponse({ response }) {
    if (response.status === 401) {
      clearAuth();
      if (!window.location.pathname.startsWith('/login') && 
          !window.location.pathname.startsWith('/signup') && 
          !window.location.pathname.startsWith('/forgot-password') && 
          !window.location.pathname.startsWith('/reset-password')) {
        window.location.href = '/login';
      }
    }
    return response;
  },
};

export const api = createClient<paths>({
  baseUrl: API_BASE_URL,
});

api.use(authMiddleware);

export default api;
