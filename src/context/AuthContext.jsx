import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import apiClient, { setAuthToken } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const response = await apiClient.get('/auth/me');
      setUser(response.data);
      return response.data;
    } catch (err) {
      setUser(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

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
    refresh,
    // Modelo con token de agencia: entrar con Alquimia (usuario/contraseña) alcanza.
    // Ya no se conecta Facebook por persona.
    isAuthenticated: !!user,
    needsMeta: false,
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
