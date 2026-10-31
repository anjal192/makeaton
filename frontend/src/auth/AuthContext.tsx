import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { clearAuth, getStoredUser, getToken, setStoredUser, setToken, type StoredUser } from './tokenStorage';
import { api, API_BASE_URL } from '../api/client';

export type Role = 'admin' | 'staff' | 'customer';

interface AuthContextType {
  token: string | null;
  user: StoredUser | null;
  role: Role | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setTokenState] = useState<string | null>(() => getToken());
  const [user, setUserState] = useState<StoredUser | null>(() => getStoredUser());
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const role: Role | null = user?.role || null;
  const isAuthenticated = Boolean(token && user);

  const refreshUser = useCallback(async () => {
    const currentToken = getToken();
    if (!currentToken) {
      setUserState(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await api.GET('/auth/me');
      if (data) {
        const stored: StoredUser = {
          id: data.id,
          email: data.email,
          full_name: data.full_name,
          role: data.role as Role,
          is_active: data.is_active,
          created_at: data.created_at,
        };
        setUserState(stored);
        setStoredUser(stored);
      } else if (error) {
        clearAuth();
        setTokenState(null);
        setUserState(null);
      }
    } catch {
      // Network error or server down, keep cached user if present
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (username: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // OAuth2PasswordRequestForm expects application/x-www-form-urlencoded
      const formData = new URLSearchParams();
      formData.append('username', username.trim().toLowerCase());
      formData.append('password', password);

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: formData.toString(),
      });

      const json = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = json.detail || json.message || 'Login failed. Please check your credentials.';
        return { success: false, error: message };
      }

      const accessToken = json.access_token;
      const userObj: StoredUser = {
        id: json.user.id,
        email: json.user.email,
        full_name: json.user.full_name,
        role: json.user.role,
        is_active: json.user.is_active,
        created_at: json.user.created_at,
      };

      setToken(accessToken);
      setStoredUser(userObj);
      setTokenState(accessToken);
      setUserState(userObj);

      return { success: true };
    } catch {
      return { success: false, error: 'Cannot connect to server. Please ensure the backend is running.' };
    }
  };

  const logout = () => {
    clearAuth();
    setTokenState(null);
    setUserState(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        role,
        isAuthenticated,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
