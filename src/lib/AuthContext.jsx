import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { authApi, clearAccessToken, getAccessToken } from '@/api';

const AuthContext = createContext(null);

/**
 * Authentication state backed by the EVGrid API (JWT in localStorage).
 * The token itself is owned by `@/api/client`; this provider only mirrors the
 * resulting user/session state for the React tree.
 */
export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [authError, setAuthError] = useState(null);

  const checkUserAuth = useCallback(async () => {
    if (!getAccessToken()) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return null;
    }

    setIsLoadingAuth(true);
    try {
      const currentUser = await authApi.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
      return currentUser;
    } catch (error) {
      // Expired or invalid token — drop it and fall back to a signed-out state.
      clearAccessToken();
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(error?.status === 401 ? null : error);
      return null;
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const login = useCallback(async (credentials) => {
    const signedInUser = await authApi.login(credentials);
    setUser(signedInUser ?? null);
    setIsAuthenticated(true);
    setAuthError(null);
    setAuthChecked(true);
    return signedInUser;
  }, []);

  const logout = useCallback((shouldRedirect = true) => {
    authApi.logout();
    setUser(null);
    setIsAuthenticated(false);
    setAuthChecked(true);
    if (shouldRedirect) window.location.href = '/login';
  }, []);

  const navigateToLogin = useCallback(() => {
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        authChecked,
        authError,
        login,
        logout,
        navigateToLogin,
        checkUserAuth,
        setUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
