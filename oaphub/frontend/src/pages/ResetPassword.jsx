import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../config/api';
import './Auth.css';

const ResetPassword = () => {
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') || '';

  const [formData, setFormData] = useState({ password: '', confirmPassword: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError(t('auth.resetTokenMissing', 'Reset token is missing. Please use the link from your email.'));
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError(t('auth.passwordMismatch', 'Passwords do not match'));
      return;
    }

    if (formData.password.length < 8) {
      setError(t('auth.passwordTooShort', 'Password must be at least 8 characters'));
      return;
    }

    if (!/[a-zA-Z]/.test(formData.password)) {
      setError(t('auth.passwordNeedsLetter', 'Password must contain at least one letter'));
      return;
    }

    if (!/[0-9]/.test(formData.password)) {
      setError(t('auth.passwordNeedsNumber', 'Password must contain at least one number'));
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', {
        token,
        password: formData.password,
      });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || t('auth.resetPasswordError', 'Failed to reset password. The link may have expired.'));
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <div className="auth-header">
            <h1>OAP Hub</h1>
          </div>
          <div className="auth-form">
            <div className="auth-error">
              {t('auth.resetTokenMissing', 'Reset token is missing. Please use the link from your email.')}
            </div>
          </div>
          <div className="auth-footer">
            <p><Link to="/forgot-password">{t('auth.requestNewLink', 'Request a new reset link')}</Link></p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>OAP Hub</h1>
          <p>{t('auth.resetPasswordTitle', 'Set a new password')}</p>
        </div>

        {success ? (
          <div className="auth-form">
            <div className="auth-success">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 48, height: 48, color: '#22c55e', margin: '0 auto 16px', display: 'block' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p style={{ textAlign: 'center' }}>
                {t('auth.resetPasswordSuccess', 'Password updated! Redirecting to login...')}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            {error && <div className="auth-error">{error}</div>}

            <div className="form-group">
              <label htmlFor="password">{t('auth.newPassword', 'New Password')}</label>
              <input
                type="password"
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                required
                minLength="8"
                placeholder={t('auth.passwordPlaceholder', 'Min 8 chars, letters & numbers')}
                autoComplete="new-password"
              />
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword">{t('auth.confirmPassword', 'Confirm New Password')}</label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                placeholder={t('auth.passwordPlaceholder', 'Min 8 chars, letters & numbers')}
                autoComplete="new-password"
              />
            </div>

            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? t('auth.saving', 'Saving...') : t('auth.resetPassword', 'Reset Password')}
            </button>
          </form>
        )}

        {!success && (
          <div className="auth-footer">
            <p><Link to="/login">{t('auth.backToLogin', '← Back to login')}</Link></p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
