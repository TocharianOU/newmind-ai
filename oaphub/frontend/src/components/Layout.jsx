import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import './Layout.css';

const Layout = ({ children }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const { billingEnabled, licenseEnabled, deploymentMode } = useFeatureFlags();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isActive = (path) => location.pathname === path;

  return (
    <div className="layout">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <img 
            src={`${import.meta.env.BASE_URL}image/logo_oap.svg`} 
            alt="NewMind AI Logo" 
            className="sidebar-logo"
            style={{ width: '84px', height: '84px', marginRight: '16px', marginTop: '14px', objectFit: 'contain' }}
          />
          <div className="sidebar-title">
            <div className="brand-name">OAP</div>
            <div className="brand-subtitle">Platform</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          <Link
            to="/dashboard"
            className={`nav-item ${isActive('/dashboard') ? 'active' : ''}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('navigation.dashboard', 'Dashboard')}
          </Link>

          <Link
            to="/integrations"
            className={`nav-item ${isActive('/integrations') ? 'active' : ''}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('navigation.integrations', '组织连接')}
          </Link>

          {billingEnabled && (
            <Link
              to="/billing"
              className={`nav-item ${isActive('/billing') ? 'active' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('navigation.billing', 'Billing')}
            </Link>
          )}

          {licenseEnabled && (
            <Link
              to="/license"
              className={`nav-item ${isActive('/license') ? 'active' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('navigation.license', 'License')}
            </Link>
          )}

          <Link
            to="/settings"
            className={`nav-item ${isActive('/settings') ? 'active' : ''}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('navigation.settings', 'Settings')}
          </Link>

          <Link
            to="/documentation"
            className={`nav-item ${isActive('/documentation') ? 'active' : ''}`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('navigation.documentation', 'Documentation')}
          </Link>

          {/* Admin-only links */}
          {user?.role === 'ADMIN' && (
            <Link
              to="/admin/stats"
              className={`nav-item ${isActive('/admin/stats') ? 'active' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('navigation.adminStats', 'Admin Stats')}
            </Link>
          )}

          {user?.role === 'ADMIN' && (
            <Link
              to="/admin/models"
              className={`nav-item ${isActive('/admin/models') ? 'active' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('navigation.adminModels', 'Custom Models')}
            </Link>
          )}

          {user?.role === 'ADMIN' && (
            <Link
              to="/admin/tool-stats"
              className={`nav-item ${isActive('/admin/tool-stats') ? 'active' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('navigation.toolStats', 'Tool Stats')}
            </Link>
          )}

          {user?.role === 'ADMIN' && (
            <Link
              to="/admin/billing"
              className={`nav-item ${isActive('/admin/billing') ? 'active' : ''}`}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('navigation.adminBilling', 'Billing Report')}
            </Link>
          )}

          <a
            href="/app/"
            className="nav-item"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('navigation.chatApp', 'Chat App')}
          </a>

        </nav>

        <div className="sidebar-footer">
          <button className="nav-item" onClick={logout}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {t('common.logout', 'Logout')}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content">
        {/* Top Bar */}
        <header className="topbar">
          <div className="topbar-left">
            <h2>
              {location.pathname === '/dashboard' && t('navigation.dashboard', 'Dashboard')}
              {location.pathname === '/integrations' && t('navigation.integrations', '组织连接')}
              {location.pathname === '/settings' && t('navigation.settings', 'Settings')}
              {location.pathname === '/billing' && t('navigation.billing', 'Billing')}
              {location.pathname === '/license' && t('navigation.license', 'License')}
              {location.pathname === '/documentation' && t('navigation.documentation', 'Documentation')}
              {location.pathname === '/admin/stats' && t('navigation.adminStats', 'Admin Stats')}
              {location.pathname === '/admin/models' && t('navigation.adminModels', 'Custom Models')}
              {location.pathname === '/admin/tool-stats' && t('navigation.toolStats', 'Tool Stats')}
              {location.pathname === '/admin/billing' && t('navigation.adminBilling', 'Billing Report')}
            </h2>
          </div>

          <div className="topbar-right">
            <Link to="/" className="download-link">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M3 11l9-8 9 8M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {t('common.home', 'Home')}
            </Link>

            <div className="user-menu">
              <button
                className="user-button"
                onClick={() => setUserMenuOpen(!userMenuOpen)}
              >
                <div className="user-avatar">
                  {user?.picture ? (
                    <img src={user.picture} alt={user.username} />
                  ) : (
                    <span>{user?.username?.charAt(0).toUpperCase() || 'U'}</span>
                  )}
                </div>
                <div className="user-info">
                  <span className="user-name">{user?.username}</span>
                  <span className="user-plan">
                    {deploymentMode === 'enterprise' ? 'Enterprise' : (user?.subscription?.PlanName || 'BASE')}
                  </span>
                </div>
                <svg className="chevron" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>

              {userMenuOpen && (
                <div className="user-dropdown">
                  <div className="dropdown-header">
                    <p className="dropdown-email">{user?.email}</p>
                  </div>
                  <div className="dropdown-divider"></div>
                  <Link to="/settings" className="dropdown-item" onClick={() => setUserMenuOpen(false)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      <path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {t('navigation.settings', 'Settings')}
                  </Link>
                  <div className="dropdown-divider"></div>
                  <button className="dropdown-item" onClick={logout}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {t('common.logout', 'Logout')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="page-content">
          {children}
        </main>
      </div>

      {/* Click outside to close user menu */}
      {userMenuOpen && (
        <div
          className="overlay"
          onClick={() => setUserMenuOpen(false)}
        ></div>
      )}
    </div>
  );
};

export default Layout;
