import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient, { setAuthToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await apiClient.get('/auth/me');
        setUser(response.data);
      } catch (err) {
        // 401 or network error — user not authenticated
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore errors on logout
    } finally {
      setAuthToken(null);
      setUser(null);
    }
  }, []);

  const value = {
    user,
    loading,
    logout,
    isAuthenticated: !!user,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export default AuthContext;
