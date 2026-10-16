import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import api from '../api/axios';

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

  const refresh = useCallback(async () => {
    const res = await api.get('/auth/me');
    setUser(res.data);
    localStorage.setItem('pg_user', JSON.stringify(res.data));
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
