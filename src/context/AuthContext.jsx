import React, { createContext, useContext, useState, useEffect } from 'react';
import authApi from '../api/authApi';

const AuthContext = createContext(null);
const TOKEN_KEY = 'carenova_token';
const USER_KEY = 'carenova_user';

const normalizeRole = (role) => {
  if (!role || typeof role !== 'string') return 'Patient';
  const raw = role.trim().toLowerCase();

  if (raw === 'patient' || raw === 'user') return 'Patient';
  if (raw === 'doctor') return 'Doctor';
  if (raw === 'admin') return 'Admin';
  if (raw === 'pharmacystaff' || raw === 'pharmacy staff') return 'PharmacyStaff';

  return 'Patient';
};

const clearStoredAuth = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

const isTokenExpired = (jwt) => {
  if (!jwt || typeof jwt !== 'string') {
    return true;
  }

  const tokenParts = jwt.split('.');
  if (tokenParts.length !== 3) {
    return true;
  }

  try {
    const payload = JSON.parse(atob(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp) {
      return false;
    }
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
};

const getFirstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);

  const applyAuthState = (nextToken, nextUser) => {
    const normalizedUser = {
      ...nextUser,
      role: normalizeRole(nextUser?.role),
    };

    setToken(nextToken);
    setUser(normalizedUser);
    localStorage.setItem(TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
  };

  const clearAuthState = () => {
    setToken(null);
    setUser(null);
    clearStoredAuth();
  };

  useEffect(() => {
    // Restore session from localStorage on app boot
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        if (isTokenExpired(storedToken)) {
          clearStoredAuth();
        } else {
          setToken(storedToken);
          setUser({ ...parsedUser, role: normalizeRole(parsedUser?.role) });
        }
      } catch {
        clearStoredAuth();
      }
    }

    const onUnauthorized = () => {
      clearAuthState();
    };

    window.addEventListener('carenova:unauthorized', onUnauthorized);
    setLoading(false);

    return () => {
      window.removeEventListener('carenova:unauthorized', onUnauthorized);
    };
  }, []);

  const login = async (email, password) => {
    const data = await authApi.login({ email, password });
    const authToken = getFirstDefined(
      data?.token,
      data?.Token,
      data?.jwt,
      data?.Jwt,
      data?.accessToken,
      data?.AccessToken
    );

    if (!authToken) {
      throw new Error('Authentication failed. Missing token in login response.');
    }

    const authUser = data?.user || data?.User || {
      userId: getFirstDefined(data?.userId, data?.UserId, null),
      email: getFirstDefined(data?.email, data?.Email, email),
      role: normalizeRole(getFirstDefined(data?.role, data?.Role, 'Patient')),
      fullName: getFirstDefined(data?.fullName, data?.FullName, email.split('@')[0]),
    };

    applyAuthState(authToken, authUser);
    return authUser;
  };

  const register = async (userData) => {
    return authApi.register(userData);
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
    } finally {
      clearAuthState();
    }
  };

  const updateUser = (nextUser) => {
    const normalizedUser = nextUser ? { ...nextUser, role: normalizeRole(nextUser?.role) } : null;
    setUser(normalizedUser);
    if (normalizedUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
    }
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
    setUser: updateUser,
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
