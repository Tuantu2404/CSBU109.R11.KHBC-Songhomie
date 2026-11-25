import { createContext, useState, useEffect } from 'react';
import API from '../services/api';

export const AuthContext = createContext();

const clearStoredAuth = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('tokenExpiresAt');
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expiresAt, setExpiresAt] = useState(null);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('token');
      const tokenExpiresAt = Number(localStorage.getItem('tokenExpiresAt'));
      if (token && (!tokenExpiresAt || tokenExpiresAt > Date.now())) {
        try {
          const res = await API.get('/auth/me');
          setUser(res.data.data);
          setExpiresAt(tokenExpiresAt || null);
        } catch {
          clearStoredAuth();
          setExpiresAt(null);
        }
      } else if (token) {
        clearStoredAuth();
        setExpiresAt(null);
      }
      setLoading(false);
    };
    checkAuth();
  }, []);

  useEffect(() => {
    if (!expiresAt) return undefined;
    const timeout = window.setTimeout(() => {
      clearStoredAuth();
      setUser(null);
      setExpiresAt(null);
    }, Math.max(0, expiresAt - Date.now()));
    return () => window.clearTimeout(timeout);
  }, [expiresAt]);

  const login = async (email, password) => {
    const res = await API.post('/auth/login', { email, password });
    const tokenExpiresAt = new Date(res.data.data.tokenExpiresAt).getTime();
    localStorage.setItem('token', res.data.data.token);
    localStorage.setItem('tokenExpiresAt', String(tokenExpiresAt));
    setUser(res.data.data);
    setExpiresAt(tokenExpiresAt);
    return res.data;
  };

  const logout = () => {
    clearStoredAuth();
    setUser(null);
    setExpiresAt(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};