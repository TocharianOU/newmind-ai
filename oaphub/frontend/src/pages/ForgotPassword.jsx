import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../config/api';
import './Auth.css';

const ForgotPassword = () => {
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.post('/api/auth/forgot-password', { email });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || t('auth.forgotPasswordError', 'Something went wrong. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>OAP Hub</h1>
          <p>{t('auth.forgotPasswordTitle', 'Reset your password')}</p>
        </div>

        {submitted ? (
          <div className="auth-form">
            <div className="auth-success">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 48, height: 48, color: '#22c55e', margin: '0 auto 16px', display: 'block' }}>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p style={{ textAlign: 'center', marginBottom: 8 }}>
                {t('auth.forgotPasswordSent', 'If an account exists for that email, we have sent a reset link.')}
              </p>
              <p style={{ textAlign: 'center', color: '#888', fontSize: 13 }}>
                {t('auth.forgotPasswordCheckSpam', 'Check your spam folder if you don\'t see it.')}
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            {error && <div className="auth-error">{error}</div>}

            <p style={{ color: '#666', marginBottom: 16, fontSize: 14 }}>
              {t('auth.forgotPasswordDesc', 'Enter your email address and we\'ll send you a link to reset your password.')}
            </p>

            <div className="form-group">
              <label htmlFor="email">{t('auth.email', 'Email')}</label>
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder={t('auth.emailPlaceholder', 'you@example.com')}
                autoComplete="email"
              />
            </div>

            <button type="submit" className="auth-button" disabled={loading}>
              {loading ? t('auth.sending', 'Sending...') : t('auth.sendResetLink', 'Send Reset Link')}
            </button>
          </form>
        )}

        <div className="auth-footer">
          <p>
            <Link to="/login">{t('auth.backToLogin', '← Back to login')}</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
