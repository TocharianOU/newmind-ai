import { useState, useEffect } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import './Auth.css';

const SSO_CONFIGS = {
  google: {
    label: (t) => t('auth.loginWithGoogle', 'Continue with Google'),
    className: 'google-button',
    icon: (
      <svg className="sso-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
    ),
  },
  azure: {
    label: (t) => t('auth.loginWithAzure', 'Continue with Azure'),
    className: 'azure-button',
    icon: (
      <svg className="sso-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M13.05 16.45l-4.55.55 4.05 5c.2.25.55.4.9.4h5.35l-5.75-5.95z" fill="#0078D4" />
        <path d="M11.65 3L4.5 17.35l4.95-.55L16.2 3h-4.55z" fill="#00BCF2" />
        <path d="M11.35 16.05l4.85.05-5.4-7.2-5.5 8.2 6.05-.05z" fill="#0078D4" />
      </svg>
    ),
  },
  aws: {
    label: (t) => t('auth.loginWithAWS', 'Continue with AWS'),
    className: 'aws-button',
    icon: (
      <svg className="sso-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M6.76 10.25c0 .33.03.63.09.91.06.28.15.58.3.87.05.09.07.18.07.26 0 .11-.07.22-.21.33l-.7.47c-.1.07-.2.1-.28.10-.11 0-.22-.05-.33-.16-.15-.16-.27-.33-.37-.52-.1-.19-.2-.4-.31-.64-.78.92-1.76 1.38-2.95 1.38-.84 0-1.51-.24-2-.72-.49-.48-.74-1.12-.74-1.92 0-.85.3-1.54.9-2.07.6-.53 1.4-.79 2.4-.79.33 0 .67.03 1.03.08.36.05.73.13 1.12.21v-.71c0-.74-.15-1.26-.46-1.55-.31-.29-.84-.44-1.58-.44-.34 0-.69.04-1.05.12-.36.08-.71.18-1.05.3-.16.06-.27.1-.34.11-.07.01-.12.02-.15.02-.13 0-.2-.09-.2-.28v-.44c0-.15.02-.26.06-.33.04-.07.12-.14.24-.21.34-.18.75-.33 1.23-.45.48-.12.99-.18 1.54-.18 1.18 0 2.04.27 2.59.8.54.53.81 1.35.81 2.44v3.21zm8.05 1.53c-.69 0-1.25-.06-1.61-.19-.53-.13-.94-.28-1.22-.45-.17-.1-.29-.21-.34-.32-.05-.11-.08-.23-.08-.35v-.46c0-.19.07-.28.21-.28.05 0 .11.01.16.03.05.02.13.05.23.09.31.14.65.25 1 .33.36.08.71.12 1.06.12.56 0 .99-.1 1.29-.29.3-.19.45-.47.45-.82 0-.24-.08-.45-.23-.61-.16-.16-.45-.31-.88-.45l-1.27-.4c-.64-.2-1.11-.5-1.42-.89-.31-.39-.46-.82-.46-1.29 0-.37.08-.7.24-1 .16-.3.38-.56.65-.77.27-.22.59-.38.95-.49.36-.11.75-.17 1.16-.17.23 0 .47.01.7.04.24.03.46.07.67.11.2.05.39.1.56.16.17.06.3.12.39.18.14.09.24.18.3.28.06.1.09.22.09.37v.43c0 .19-.07.29-.21.29-.08 0-.2-.04-.37-.13-.56-.26-1.19-.39-1.88-.39-.51 0-.91.09-1.19.26-.28.17-.42.43-.42.77 0 .24.08.45.25.62.17.17.48.33.93.47l1.24.39c.63.2 1.09.49 1.38.86.29.37.43.79.43 1.27 0 .38-.08.73-.24 1.04-.16.31-.39.58-.68.81-.29.23-.64.41-1.05.53-.41.12-.87.18-1.37.18z" fill="#FF9900" />
      </svg>
    ),
  },
  wechatwork: {
    label: (t) => t('auth.loginWithWechatWork', 'Continue with WeCom'),
    className: 'wechatwork-button',
    icon: (
      <svg className="sso-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M8.5 2C4.91 2 2 4.73 2 8.11c0 1.81.97 3.43 2.49 4.58-.17.6-.56 1.95-.6 2.11 0 0-.03.14.07.19.1.05.19 0 .19 0 .22-.03 2.03-1.32 2.32-1.55.49.11 1.01.17 1.53.17 3.59 0 6.5-2.73 6.5-6.11S12.09 2 8.5 2zm-2 7.75c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25zm4 0c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z" fill="#1AAD19"/>
        <path d="M22 14.5c0-2.87-2.48-5.2-5.54-5.2-3.06 0-5.54 2.33-5.54 5.2s2.48 5.2 5.54 5.2c.44 0 .87-.05 1.3-.14.24.19 1.79 1.29 1.98 1.32 0 0 .08.04.16 0 .08-.04.06-.16.06-.16-.03-.14-.37-1.29-.51-1.8C20.79 17.42 22 16.07 22 14.5zm-7.29-.75c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm3.58 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" fill="#1AAD19"/>
      </svg>
    ),
  },
};

const Login = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login, user } = useAuth();
  const { t } = useLanguage();
  const { enabledSSOProviders, ssoEnabled } = useFeatureFlags();
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showAppRedirect, setShowAppRedirect] = useState(false);

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam) {
      setError(decodeURIComponent(errorParam));
    }

    const appRedirect = searchParams.get('appRedirect');
    const token = searchParams.get('token');

    if (appRedirect === 'attacktrace' && (token || user)) {
      setShowAppRedirect(true);

      setTimeout(() => {
        const authToken = token || localStorage.getItem('authToken');
        if (authToken) {
          window.location.href = `attacktrace://signin/${authToken}`;
        }
      }, 1500);
    } else if (appRedirect === 'web' && (token || user)) {
      // SSO callback for web app — token already in localStorage via AuthContext
      window.location.href = '/app';
    }
  }, [searchParams, user, showAppRedirect]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(formData.email, formData.password);

      const appRedirect = searchParams.get('appRedirect');
      if (appRedirect === 'attacktrace') {
        // Desktop deep-link flow
        setShowAppRedirect(true);
      } else if (appRedirect === 'web') {
        // Web app flow — navigate to the embedded SPA
        window.location.href = '/app';
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message || t('auth.loginFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleContinueInApp = () => {
    const token = localStorage.getItem('authToken');
    if (token) {
      // Use custom URL scheme to open in AttackTrace
      window.location.href = `attacktrace://signin/${token}`;
    }
  };

  const handleSSOLogin = (provider) => {
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || window.location.origin;
    const appRedirect = searchParams.get('appRedirect');
    const ssoUrl = `${apiBaseUrl}/api/auth/sso/${provider}/start${appRedirect ? `?appRedirect=${encodeURIComponent(appRedirect)}` : ''}`;
    window.location.href = ssoUrl;
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>OAP Platform</h1>
          <p>{t('auth.loginTitle')}</p>
        </div>

        {showAppRedirect ? (
          // Show "Continue in App" UI after successful SSO login
          <div className="app-redirect-container">
            <div className="success-message">
              <svg className="success-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <h2>{t('auth.loginSuccessMessage')}</h2>
              <p>{t('auth.returningToApp')}</p>
              <div style={{
                marginTop: '16px',
                display: 'inline-block',
                padding: '8px 16px',
                background: '#f0f0f0',
                borderRadius: '4px',
                fontSize: '14px',
                color: '#666'
              }}>
                <div className="loading-spinner" style={{ display: 'inline-block', marginRight: '8px' }}>⏳</div>
                {t('auth.autoRedirecting')}
              </div>
            </div>

            <button
              onClick={handleContinueInApp}
              className="auth-button continue-in-app-button"
              style={{ marginTop: '24px' }}
            >
              {t('auth.clickIfNotRedirect')}
            </button>

            <div className="auth-footer">
              <p>
                {t('auth.orGoToDashboard')}{' '}
                <Link to="/dashboard">{t('auth.goToDashboard')}</Link>
              </p>
            </div>
          </div>
        ) : (
          // Show normal login form
          <form onSubmit={handleSubmit} className="auth-form">
            {error && <div className="auth-error">{error}</div>}

            <div className="form-group">
              <label htmlFor="email">{t('auth.email')}</label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder={t('auth.emailPlaceholder')}
                autoComplete="email"
              />
            </div>

            <div className="form-group">
              <label htmlFor="password">{t('auth.password')}</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                placeholder={t('auth.passwordPlaceholder')}
                autoComplete="current-password"
              />
            </div>

            <div style={{ textAlign: 'right', marginBottom: 4 }}>
              <Link to="/forgot-password" style={{ fontSize: 13, color: '#6366f1' }}>
                {t('auth.forgotPassword', 'Forgot password?')}
              </Link>
            </div>

            <button
              type="submit"
              className="auth-button"
              disabled={loading}
            >
              {loading ? t('auth.loggingIn') : t('auth.login')}
            </button>

            {/* SSO Buttons — only rendered when providers are configured and enabled */}
            {ssoEnabled && enabledSSOProviders.length > 0 && (
              <>
                <div className="sso-divider">
                  <span>{t('auth.orLoginWith', 'Or continue with')}</span>
                </div>
                <div className="sso-buttons">
                  {enabledSSOProviders.map((provider) => {
                    const cfg = SSO_CONFIGS[provider];
                    if (!cfg) return null;
                    return (
                      <button
                        key={provider}
                        type="button"
                        className={`sso-button ${cfg.className}`}
                        onClick={() => handleSSOLogin(provider)}
                        disabled={loading}
                      >
                        {cfg.icon}
                        {cfg.label(t)}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </form>
        )}

        {!showAppRedirect && (
          <div className="auth-footer">
            <p>
              {t('auth.noAccount')}{' '}
              <Link to="/register">{t('auth.signUpNow')}</Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
