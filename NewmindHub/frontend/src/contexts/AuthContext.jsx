import { createContext, useContext, useState, useEffect } from 'react';
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
          const newUrl = window.location.pathname;
          window.history.replaceState({}, document.title, newUrl);
          
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
    const response = await api.post('/api/auth/login', { email, password });
    if (response.data.success) {
      localStorage.setItem('authToken', response.data.data.accessToken);
      setUser(response.data.data.user);
      return response.data;
    }
    throw new Error(response.data.error || 'Login failed');
  };

  const register = async (email, username, password, inviteCode = null) => {
    const requestData = {
      email,
      username,
      password
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