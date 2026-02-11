import { createContext, useContext, useState, useEffect } from 'react';
import CryptoJS from 'crypto-js';
import api from '../config/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    // First check for token in URL parameters (from Dive app)
    const urlParams = new URLSearchParams(window.location.search);
    const urlToken = urlParams.get('token');

    if (urlToken) {
      console.log('🔗 Token found in URL, attempting auto-login...');
      try {
        // Store the token from URL
        localStorage.setItem('authToken', urlToken);

        // Verify the token by calling /api/v1/user/me
        const response = await api.get('/api/v1/user/me');
        if (response.data.status === 'success') {
          setUser(response.data.data);
          console.log('🔗 Auto-login successful');

          // Clean up URL by removing token parameter
          // BUT preserve appRedirect parameter for Login.jsx to handle deep link
          const appRedirect = urlParams.get('appRedirect');
          if (appRedirect) {
            const newUrl = `${window.location.pathname}?appRedirect=${appRedirect}`;
            window.history.replaceState({}, document.title, newUrl);
            console.log('🔗 Preserved appRedirect parameter for deep link handling');
          } else {
            const newUrl = window.location.pathname;
            window.history.replaceState({}, document.title, newUrl);
          }

          setLoading(false);
          return;
        }
      } catch (error) {
        console.error('🔗 Auto-login failed:', error);
        localStorage.removeItem('authToken');
        // Remove token from URL even if login failed
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
      }
    }

    // Fallback to normal auth check
    const token = localStorage.getItem('authToken');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await api.get('/api/v1/user/me');
      if (response.data.status === 'success') {
        setUser(response.data.data);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      localStorage.removeItem('authToken');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    // Security: Password transmitted over HTTPS (no client-side encryption needed)
    // Client-side encryption with hardcoded keys is security theater
    const response = await api.post('/api/auth/login', {
      email,
      password, // Send plaintext over HTTPS
      encrypted: false // No longer encrypting
    });
    if (response.data.success) {
      localStorage.setItem('authToken', response.data.data.accessToken);
      setUser(response.data.data.user);
      return response.data;
    }
    throw new Error(response.data.error || 'Login failed');
  };

  const register = async (email, username, password, inviteCode = null) => {
    // Security: Password transmitted over HTTPS (no client-side encryption needed)
    const requestData = {
      email,
      username,
      password, // Send plaintext over HTTPS
      encrypted: false // No longer encrypting
    };

    // Only include inviteCode if provided
    if (inviteCode) {
      requestData.inviteCode = inviteCode;
    }

    const response = await api.post('/api/auth/register', requestData);
    if (response.data.status === 'success') {
      localStorage.setItem('authToken', response.data.data.token);
      setUser(response.data.data.user);
      return response.data;
    }
    throw new Error(response.data.error || 'Registration failed');
  };

  const logout = async () => {
    try {
      await api.post('/api/v1/user/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('authToken');
      setUser(null);
      window.location.href = '/login';
    }
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    checkAuth
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};