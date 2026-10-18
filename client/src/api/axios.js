import axios from 'axios';
import { goTo } from '../utils/navigation';

// In dev the Vite proxy forwards /api to localhost:5000.
// In production (Render static site) set VITE_API_URL to e.g. https://your-api.onrender.com/api
const baseURL = import.meta.env.VITE_API_URL || '/api';

// The server already marks every response as never-cacheable, but some
// browsers/proxies still only look at the *request's* cache headers for
// GETs - sending these too closes that gap, so data a page just fetched
// can never be served stale from a cache instead of hitting the API.
const api = axios.create({ baseURL, headers: { 'Cache-Control': 'no-cache' } });

// A plain client with no interceptors, used only for the refresh call itself
// so a failed refresh can never recursively trigger another refresh attempt.
const rawApi = axios.create({ baseURL });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('pg_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
})

function clearSession() {
  localStorage.removeItem('pg_token');
  localStorage.removeItem('pg_refresh');
  localStorage.removeItem('pg_user');
}

// Codes that mean "this account can't be used right now" -> sign out with a notice.
const FORCE_LOGOUT = ['ACCOUNT_BANNED', 'STORE_PENDING', 'STORE_REJECTED', 'STORE_INACTIVE', 'ACCOUNT_LOCKED'];

// Only one refresh request in flight at a time - if several requests 401 at
// once, they all wait on the same promise instead of racing each other.
let refreshPromise = null;

function refreshAccessToken() {
  if (!refreshPromise) {
    const refreshToken = localStorage.getItem('pg_refresh');
    refreshPromise = (refreshToken
      ? rawApi.post('/auth/refresh', { refreshToken })
      : Promise.reject(new Error('No refresh token')))
      .then((res) => {
        localStorage.setItem('pg_token', res.data.token);
        localStorage.setItem('pg_refresh', res.data.refreshToken);
        localStorage.setItem('pg_user', JSON.stringify(res.data.user));
        return res.data.token;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const status = err.response?.status;
    const code = err.response?.data?.code;
    const url = err.config?.url || '';
    const isAuthCall = url.startsWith('/auth/login') || url.startsWith('/auth/refresh') || url.startsWith('/auth/register');
    const loggedIn = !!localStorage.getItem('pg_token');

    // A plain expired access token - try a silent refresh once, then retry the request.
    if (status === 401 && loggedIn && !isAuthCall && !err.config._retried) {
      err.config._retried = true;
      try {
        const newToken = await refreshAccessToken();
        err.config.headers.Authorization = `Bearer ${newToken}`;
        return api(err.config);
      } catch {
        clearSession();
        goTo('/login', { replace: true });
        return Promise.reject(err);
      }
    }

    if (!isAuthCall && loggedIn) {
      if ((status === 403 && FORCE_LOGOUT.includes(code)) || status === 423) {
        clearSession();
        sessionStorage.setItem('pg_notice', err.response.data.message);
        goTo('/login', { replace: true });
      } else if (status === 403 && code === 'STORE_NOT_ACTIVE') {
        // Store status changed while logged in (e.g. banned). Re-sync the user.
        window.dispatchEvent(new Event('pg:refresh-user'));
      } else if (status === 401) {
        // Refresh already failed above, or there was never a refresh token.
        clearSession();
        goTo('/login', { replace: true });
      }
    }
    return Promise.reject(err);
  }
);

export default api;
