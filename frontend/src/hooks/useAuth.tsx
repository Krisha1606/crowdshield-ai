import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (token: string, userData: User) => void;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('crowdshield_token'));
  const [isLoading, setIsLoading] = useState(true);

  const login = (newToken: string, userData: User) => {
    localStorage.setItem('crowdshield_token', newToken);
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    api.post('/auth/logout').catch(() => {}).finally(() => {
      localStorage.removeItem('crowdshield_token');
      setToken(null);
      setUser(null);
    });
  };

  const checkAuth = async (): Promise<boolean> => {
    const storedToken = localStorage.getItem('crowdshield_token');
    if (!storedToken) {
      setIsLoading(false);
      return false;
    }
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
      setIsLoading(false);
      return true;
    } catch (error) {
      logout();
      setIsLoading(false);
      return false;
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        checkAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
export default useAuth;
