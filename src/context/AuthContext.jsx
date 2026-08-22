import React, { createContext, useContext, useState, useEffect } from 'react';
import authApi from '../api/authApi';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from localStorage on app boot
    const storedToken = localStorage.getItem('carenova_token');
    const storedUser = localStorage.getItem('carenova_user');

    if (storedToken && storedUser) {
      setToken(storedToken);
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Failed to parse cached user data', e);
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const data = await authApi.login({ email, password });
      // Expected response format: { token, user: { id, email, fullName, role } }
      const authToken = data.token || 'mock-jwt-token-carenova';
      const authUser = data.user || { email, role: data.role || 'Patient', fullName: email.split('@')[0] };

      setToken(authToken);
      setUser(authUser);
      localStorage.setItem('carenova_token', authToken);
      localStorage.setItem('carenova_user', JSON.stringify(authUser));

      return authUser;
    } catch (error) {
      throw error;
    }
  };

  const register = async (userData) => {
    try {
      const data = await authApi.register(userData);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('carenova_token');
    localStorage.removeItem('carenova_user');
  };

  const value = {
    user,
    token,
    role: user?.role || null,
    isAuthenticated: !!token,
    loading,
    login,
    register,
    logout,
    setUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
