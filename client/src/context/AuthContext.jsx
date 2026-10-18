import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import api from '../api/axios';
import useAutoRefresh from '../utils/useAutoRefresh';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('pg_user');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);
  const userRef = useRef(user);
  userRef.current = user;

  const refresh = useCallback(async () => {
    const res = await api.get('/auth/me');
    const json = JSON.stringify(res.data);
    // Only touch state when something actually changed, so the background
    // refresh below never re-renders the whole app for nothing.
    if (json !== JSON.stringify(userRef.current)) {
      setUser(res.data);
    }
    localStorage.setItem('pg_user', json);
    return res.data;
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('pg_token');
    if (!token) {
      setLoading(false);
      return;
    }

    refresh()
      .catch(() => {
        localStorage.removeItem('pg_token');
        localStorage.removeItem('pg_refresh');
        localStorage.removeItem('pg_user');
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [refresh]);

  // Fired by the axios interceptor when the store's status changed mid-session.
  useEffect(() => {
    const handler = () => refresh().catch(() => {});
    window.addEventListener('pg:refresh-user', handler);
    return () => window.removeEventListener('pg:refresh-user', handler);
  }, [refresh]);

  // The session was ended elsewhere (logout everywhere, ban, expiry).
  useEffect(() => {
    const handler = () => setUser(null);
    window.addEventListener('pg:session-ended', handler);
    return () => window.removeEventListener('pg:session-ended', handler);
  }, []);

  // Keeps account/store status, permissions, avatar etc. current, and notices
  // quickly when this device has been logged out from another one.
  useAutoRefresh(() => refresh().catch(() => {}), 15000, !!user);

  function login(token, refreshToken, userData) {
    localStorage.setItem('pg_token', token);
    localStorage.setItem('pg_refresh', refreshToken);
    localStorage.setItem('pg_user', JSON.stringify(userData));
    setUser(userData);
  }

  function logout() {
    const refreshToken = localStorage.getItem('pg_refresh');
    // Revoke the refresh token server-side too, not just locally - best effort,
    // never block logging out on it.
    if (refreshToken) {
      api.post('/auth/logout', { refreshToken }).catch(() => {});
    }
    localStorage.removeItem('pg_token');
    localStorage.removeItem('pg_refresh');
    localStorage.removeItem('pg_user');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, login, logout, refresh, loading }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
