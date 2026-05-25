import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);
const API_URL = '/api';

function extractData(payload) {
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return payload.data;
  }
  return payload;
}

function decodeJwtPayload(token) {
  try {
    const encodedPayload = token?.split('.')?.[1];
    if (!encodedPayload) return null;

    const normalized = encodedPayload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function normalizeUser(userData, fallbackRole) {
  if (!userData || typeof userData !== 'object') return null;
  if (userData.role) return userData;
  if (fallbackRole) return { ...userData, role: fallbackRole };
  return userData;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const setTokenHeader = useCallback((token) => {
    if (token) {
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common.Authorization;
    }
  }, []);

  const checkAuth = useCallback(async () => {
    const token = localStorage.getItem('cyberhub_token');
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    setTokenHeader(token);

    try {
      const decoded = decodeJwtPayload(token);
      const isCustomer = decoded?.role === 'customer';
      const meEndpoint = isCustomer ? '/customer-auth/me' : '/auth/me';

      const res = await axios.get(`${API_URL}${meEndpoint}`);
      const me = normalizeUser(extractData(res.data), isCustomer ? 'customer' : undefined);
      setUser(me || null);
    } catch {
      localStorage.removeItem('cyberhub_token');
      setTokenHeader(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [setTokenHeader]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const login = async (username, password) => {
    const res = await axios.post(`${API_URL}/auth/login`, { username, password });
    const payload = extractData(res.data) || {};
    const token = payload.token;
    const userData = normalizeUser(payload.user);

    if (!token || !userData) {
      throw new Error('Invalid login response');
    }

    localStorage.setItem('cyberhub_token', token);
    setTokenHeader(token);
    setUser(userData);
    return userData;
  };

  const loginCustomer = async (username, password) => {
    const res = await axios.post(`${API_URL}/customer-auth/login`, { username, password });
    const payload = extractData(res.data) || {};
    const token = payload.token;
    const userData = normalizeUser(payload.user, 'customer');

    if (!token || !userData) {
      throw new Error('Invalid login response');
    }

    localStorage.setItem('cyberhub_token', token);
    setTokenHeader(token);
    setUser(userData);
    return userData;
  };

  const registerCustomer = async (name, phone, password) => {
    const res = await axios.post(`${API_URL}/customer-auth/register`, { name, phone, password });
    return extractData(res.data);
  };

  const logout = () => {
    localStorage.removeItem('cyberhub_token');
    setTokenHeader(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginCustomer, registerCustomer, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
