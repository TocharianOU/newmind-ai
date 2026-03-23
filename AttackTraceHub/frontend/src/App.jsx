import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { FeatureFlagsProvider, useFeatureFlags } from './contexts/FeatureFlagsContext';
import Layout from './components/Layout';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import Settings from './pages/Settings';
import Billing from './pages/Billing';
import PaymentSuccess from './pages/PaymentSuccess';
import AdminStats from './pages/AdminStats';
import AdminModels from './pages/AdminModels';
import AdminToolStats from './pages/AdminToolStats';
import AdminBilling from './pages/AdminBilling';
import License from './pages/License';
import './App.css';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

// Public Route Component (redirect to dashboard if already logged in)
const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Loading...</p>
      </div>
    );
  }

  // Check if this is an app redirect (e.g., from AttackTrace)
  // If so, don't auto-redirect to dashboard - let the Login page handle deep linking
  const urlParams = new URLSearchParams(window.location.search);
  const appRedirect = urlParams.get('appRedirect');

  if (user && appRedirect !== 'attacktrace') {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

function AppRoutes() {
  const { billingEnabled, licenseEnabled } = useFeatureFlags();

  return (
    <Routes>
      {/* Home/Landing Page */}
      <Route path="/" element={<Home />} />

      {/* Public Routes */}
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/register"
        element={
          <PublicRoute>
            <Register />
          </PublicRoute>
        }
      />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password"  element={<ResetPassword />} />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <Layout>
              <Settings />
            </Layout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing"
        element={
          billingEnabled ? (
            <ProtectedRoute>
              <Layout>
                <Billing />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />
      <Route
        path="/payment/success"
        element={
          <ProtectedRoute>
            <PaymentSuccess />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin/stats"
        element={
          <ProtectedRoute>
            <Layout>
              <AdminStats />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Admin: Custom Model Providers */}
      <Route
        path="/admin/models"
        element={
          <ProtectedRoute>
            <Layout>
              <AdminModels />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Admin: Tool Usage Stats */}
      <Route
        path="/admin/tool-stats"
        element={
          <ProtectedRoute>
            <Layout>
              <AdminToolStats />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* Admin: Billing Report */}
      <Route
        path="/admin/billing"
        element={
          <ProtectedRoute>
            <Layout>
              <AdminBilling />
            </Layout>
          </ProtectedRoute>
        }
      />

      {/* License management — enterprise only */}
      <Route
        path="/license"
        element={
          licenseEnabled ? (
            <ProtectedRoute>
              <Layout>
                <License />
              </Layout>
            </ProtectedRoute>
          ) : (
            <Navigate to="/dashboard" replace />
          )
        }
      />

      {/* 404 */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter basename="/console">
      <LanguageProvider>
        <ThemeProvider>
          <FeatureFlagsProvider>
            <AuthProvider>
              <AppRoutes />
            </AuthProvider>
          </FeatureFlagsProvider>
        </ThemeProvider>
      </LanguageProvider>
    </BrowserRouter>
  );
}

export default App;