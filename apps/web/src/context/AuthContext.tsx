import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserDTO } from '@careergraph/shared';
import { api } from '../api/client.js';

interface AuthContextType {
  user: UserDTO | null;
  accessToken: string | null;
  isLoading: boolean;
  setAuth: (user: UserDTO, token: string) => void;
  logout: () => Promise<void>;
  checkAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => {
    return localStorage.getItem('cg_access_token');
  });
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const checkAuth = useCallback(async () => {
    setIsLoading(true);
    let token = accessToken;

    // If no access token in memory/storage, attempt refresh via httpOnly cookie
    if (!token) {
      try {
        const refreshRes = await api.refreshToken();
        if (refreshRes?.accessToken) {
          token = refreshRes.accessToken;
          setAccessToken(token);
          localStorage.setItem('cg_access_token', token);
        }
      } catch {
        // No valid session cookie, user remains guest
        setUser(null);
        setAccessToken(null);
        localStorage.removeItem('cg_access_token');
        setIsLoading(false);
        return;
      }
    }

    if (token) {
      try {
        const me = await api.getMe(token);
        setUser(me);
      } catch (err: any) {
        // Token might have expired, try refresh once
        try {
          const refreshRes = await api.refreshToken();
          if (refreshRes?.accessToken) {
            token = refreshRes.accessToken;
            setAccessToken(token);
            localStorage.setItem('cg_access_token', token);
            const me = await api.getMe(token);
            setUser(me);
          } else {
            throw new Error('Refresh failed');
          }
        } catch {
          setUser(null);
          setAccessToken(null);
          localStorage.removeItem('cg_access_token');
        }
      }
    }

    setIsLoading(false);
  }, [accessToken]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const setAuth = (newUser: UserDTO, token: string) => {
    setUser(newUser);
    setAccessToken(token);
    localStorage.setItem('cg_access_token', token);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch {
      // Ignore
    }
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem('cg_access_token');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        setAuth,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
