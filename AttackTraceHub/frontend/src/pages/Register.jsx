import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../config/api';
import './Auth.css';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    inviteCode: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteCodeRequired, setInviteCodeRequired] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    // Fetch invite code requirement from backend
    (async () => {
      try {
        const response = await api.get('/api/auth/config');
        console.log('🔧 Register config response:', response?.data);
        if (response?.data?.status === 'success') {
          const required = Boolean(response.data.data.inviteCodeRequired);
          console.log('🔧 Invite code required:', required);
          setInviteCodeRequired(required);
        }
      } catch (_error) {
        console.error('🔧 Config fetch error:', _error);
        // Default to false if API fails
        setInviteCodeRequired(false);
      } finally {
        setConfigLoading(false);
      }
    })();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    if (formData.password.length < 6) {
      setError(t('auth.passwordTooShort'));
      return;
    }

    setLoading(true);

    try {
      await register(
        formData.email, 
        formData.username, 
        formData.password,
        inviteCodeRequired ? formData.inviteCode : null
      );
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || t('auth.registerFailed'));
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

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>NewMind Hub</h1>
          <p>{t('auth.registerTitle')}</p>
        </div>

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
            <label htmlFor="username">{t('auth.username')}</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              placeholder={t('auth.usernamePlaceholder')}
              autoComplete="name"
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
              autoComplete="new-password"
              minLength="6"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">{t('auth.confirmPassword')}</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder={t('auth.passwordPlaceholder')}
              autoComplete="new-password"
            />
          </div>

          {inviteCodeRequired && (
            <div className="form-group">
              <label htmlFor="inviteCode">{t('auth.inviteCode')}</label>
              <input
                type="text"
                id="inviteCode"
                name="inviteCode"
                value={formData.inviteCode}
                onChange={handleChange}
                required
                placeholder={t('auth.inviteCodePlaceholder')}
                autoComplete="off"
              />
            </div>
          )}

          <button
            type="submit"
            className="auth-button"
            disabled={loading || configLoading}
          >
            {loading ? t('auth.registering') : t('auth.register')}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {t('auth.hasAccount')}{' '}
            <Link to="/login">{t('auth.signInNow')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
