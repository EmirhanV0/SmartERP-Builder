import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Read the token from localStorage, decode user info
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (token) {
      try {
        // Decode the JWT payload (base64)
        const payload = JSON.parse(atob(token.split('.')[1]));
        const isExpired = payload.exp * 1000 < Date.now();
        if (isExpired) {
          localStorage.removeItem('access_token');
        } else {
          setUser({ email: payload.sub, ...payload });
        }
      } catch {
        localStorage.removeItem('access_token');
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (email, password) => {
    // FastAPI OAuth2 form data format
    const params = new URLSearchParams();
    params.append('username', email);
    params.append('password', password);

    const res = await api.post('/auth/login', params, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });

    const { access_token } = res.data;
    localStorage.setItem('access_token', access_token);
    const payload = JSON.parse(atob(access_token.split('.')[1]));
    setUser({ email: payload.sub, ...payload });
    return res.data;
  }, []);

  const register = useCallback(async (data) => {
    const res = await api.post('/auth/register', data);
    return res.data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    setUser(null);
  }, []);

  // Syncs the AuthContext user on profile updates
  const updateUser = useCallback((patch) => {
    setUser(prev => prev ? { ...prev, ...patch } : null);
  }, []);

  const isAuthenticated = Boolean(user);

  return (
    <AuthContext.Provider value={{ user, loading, isAuthenticated, login, register, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
