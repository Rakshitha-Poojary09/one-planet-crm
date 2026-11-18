import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('opt_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('opt_token') || null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verifyUser = async () => {
      if (token) {
        try {
          const res = await api.get('/auth/me');
          if (res.data?.success) {
            setUser(res.data.user);
            localStorage.setItem('opt_user', JSON.stringify(res.data.user));
          }
        } catch (err) {
          console.error('Session validation error:', err);
          logout();
        }
      }
      setLoading(false);
    };

    verifyUser();
  }, [token]);

  const login = (authToken, userData) => {
    setToken(authToken);
    setUser(userData);
    localStorage.setItem('opt_token', authToken);
    localStorage.setItem('opt_user', JSON.stringify(userData));
  };

  const logout = async () => {
    try {
      const activeToken = token || localStorage.getItem('opt_token');
      if (activeToken) {
        await api.post('/auth/logout');
      }
    } catch (err) {
      // Ignore network errors so local session cleanup always completes
      console.warn('Backend session logout notice:', err?.message);
    } finally {
      setToken(null);
      setUser(null);
      localStorage.removeItem('opt_token');
      localStorage.removeItem('opt_user');
      sessionStorage.clear();
      delete api.defaults.headers.common['Authorization'];
    }
  };

  const updateUser = (updatedUserData) => {
    setUser(prev => {
      const merged = { ...prev, ...updatedUserData };
      localStorage.setItem('opt_user', JSON.stringify(merged));
      return merged;
    });
  };

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
