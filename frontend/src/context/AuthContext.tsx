import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '../types';
import { getCurrentUser, loginUser, registerUser, logoutUser } from '../api/client';

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<User>;
  register: (username: string, password: string, displayName?: string) => Promise<User>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    try {
      const u = await getCurrentUser();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (username: string, password: string): Promise<User> => {
    const loggedInUser = await loginUser(username, password);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const register = async (username: string, password: string, displayName?: string): Promise<User> => {
    const newUser = await registerUser(username, password, displayName);
    setUser(newUser);
    return newUser;
  };

  const logout = async (): Promise<void> => {
    try {
      await logoutUser();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
