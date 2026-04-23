import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../config/api';
import './License.css';

const License = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const isAdmin = user?.role === 'ADMIN';

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [deactivating, setDeactivating] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [licenseText, setLicenseText] = useState('');

  useEffect(() => {
    fetchStatus();
  }, []);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/v1/license/status');
      if (res.data?.status === 'success') {
        setStatus(res.data.data);
      }
    } catch (err) {
      setMessage({ type: 'error', text: t('license.fetchError', 'Failed to fetch license status') });
    } finally {
      setLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!licenseText.trim()) {
      setMessage({ type: 'error', text: t('license.pasteRequired', 'Please paste the license JSON') });
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(licenseText.trim());
    } catch {
      setMessage({ type: 'error', text: t('license.invalidJson', 'Invalid JSON format') });
      return;
    }

    setActivating(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await api.post('/api/v1/license/activate', parsed);
      if (res.data?.status === 'success') {
        setMessage({ type: 'success', text: t('license.activateSuccess', 'License activated successfully') });
        setLicenseText('');
        fetchStatus();
      } else {
        setMessage({ type: 'error', text: res.data?.error || t('license.activateFailed', 'Activation failed') });
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || t('license.activateFailed', 'Activation failed') });
    } finally {
      setActivating(false);
    }
  };

  const handleDeactivate = async () => {
    if (!window.confirm(t('license.deactivateConfirm', 'Are you sure you want to deactivate the current license?'))) return;
    setDeactivating(true);
    setMessage({ type: '', text: '' });
    try {
      const res = await api.delete('/api/v1/license');
      if (res.data?.status === 'success') {
        setMessage({ type: 'success', text: t('license.deactivateSuccess', 'License deactivated') });
        fetchStatus();
      }
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || t('license.deactivateFailed', 'Failed to deactivate') });
    } finally {
      setDeactivating(false);
    }
  };

  const statusBadgeClass = () => {
    switch (status?.status) {
      case 'ACTIVE':      return 'badge-active';
      case 'EXPIRED':     return 'badge-expired';
      case 'NOT_ACTIVATED': return 'badge-inactive';
      default:            return 'badge-invalid';
    }
  };

  const formatTokens = (n) => {
    if (n === -1 || n === undefined) return t('license.unlimited', 'Unlimited');
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
    return String(n);
  };

  if (loading) {
    return (
      <div className="license-loading">
        <div className="spinner" />
        <p>{t('license.loading', 'Loading license info...')}</p>
      </div>
    );
  }

  return (
    <div className="license-page">
      <div className="license-header">
        <h1>{t('license.title', 'License Management')}</h1>
        <p className="license-subtitle">
          {t('license.subtitle', 'Manage your enterprise license — seats, token quota and feature entitlements.')}
        </p>
      </div>

      {/* Status card */}
      <div className="license-status-card">
        <div className="license-status-row">
          <span className="license-status-label">{t('license.statusLabel', 'Status')}</span>
          <span className={`license-badge ${statusBadgeClass()}`}>
            {status?.status || 'UNKNOWN'}
          </span>
        </div>

        {status?.license && (
          <>
            <div className="license-status-row">
              <span className="license-status-label">{t('license.customer', 'Customer')}</span>
              <span>{status.license.customerName}</span>
            </div>
            <div className="license-status-row">
              <span className="license-status-label">{t('license.maxSeats', 'Max Seats')}</span>
              <span>{status.license.maxSeats}</span>
            </div>
            <div className="license-status-row">
              <span className="license-status-label">{t('license.maxTokens', 'Max Tokens')}</span>
              <span>{formatTokens(status.license.maxTokens)}</span>
            </div>
            <div className="license-status-row">
              <span className="license-status-label">{t('license.features', 'Features')}</span>
              <span>{status.license.features.length > 0 ? status.license.features.join(', ') : t('license.standard', 'Standard')}</span>
            </div>
            <div className="license-status-row">
              <span className="license-status-label">{t('license.issuedAt', 'Issued')}</span>
              <span>{new Date(status.license.issuedAt).toLocaleDateString()}</span>
            </div>
            <div className="license-status-row">
              <span className="license-status-label">{t('license.expiresAt', 'Expires')}</span>
              <span className={new Date(status.license.expiresAt) < new Date() ? 'text-danger' : ''}>
                {new Date(status.license.expiresAt).toLocaleDateString()}
              </span>
            </div>
          </>
        )}

        {status?.reason && (
          <p className="license-reason">{status.reason}</p>
        )}
      </div>

      {/* Admin actions */}
      {isAdmin && (
        <div className="license-admin-section">
          <h2>{t('license.activateTitle', 'Activate New License')}</h2>
          <p className="license-hint">
            {t('license.activateHint', 'Paste the license JSON provided by your vendor below.')}
          </p>

          {message.text && (
            <div className={`license-message ${message.type === 'error' ? 'license-message-error' : 'license-message-success'}`}>
              {message.text}
            </div>
          )}

          <textarea
            className="license-textarea"
            rows={10}
            placeholder={'{\n  "customerId": "...",\n  "customerName": "...",\n  ...\n}'}
            value={licenseText}
            onChange={e => setLicenseText(e.target.value)}
          />

          <div className="license-actions">
            <button
              className="license-btn license-btn-primary"
              onClick={handleActivate}
              disabled={activating}
            >
              {activating ? t('license.activating', 'Activating...') : t('license.activate', 'Activate License')}
            </button>

            {status?.status === 'ACTIVE' && (
              <button
                className="license-btn license-btn-danger"
                onClick={handleDeactivate}
                disabled={deactivating}
              >
                {deactivating ? t('license.deactivating', 'Deactivating...') : t('license.deactivate', 'Deactivate')}
              </button>
            )}
          </div>
        </div>
      )}

      {!isAdmin && (
        <p className="license-non-admin">
          {t('license.adminOnly', 'License management requires administrator privileges.')}
        </p>
      )}
    </div>
  );
};

export default License;
