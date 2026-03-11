import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../config/api';
import './Billing.css';

const TIER_COLORS = { A: '#e53e3e', B: '#dd6b20', C: '#38a169' };
const TIER_LABELS = { A: 'Tier A', B: 'Tier B', C: 'Tier C' };

// 直接使用后端返回的 Checkout 会话 URL，避免依赖 Stripe.js CDN

// Plan hierarchy (must match backend)
const PLAN_HIERARCHY = {
  'BASE': 0,
  'PRO': 1,
};

const Billing = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [packages, setPackages] = useState([]);
  const [toolQuotaPackages, setToolQuotaPackages] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingPurchase, setLoadingPurchase] = useState(null);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [packagesRes, historyRes, toolPkgRes] = await Promise.all([
        api.get('/api/v1/payment/token-packages'),
        api.get('/api/v1/payment/history'),
        api.get('/api/v1/payment/tool-quota-packages').catch(() => null),
      ]);

      if (packagesRes.data.status === 'success') {
        setPackages(packagesRes.data.data);
      }

      if (historyRes.data.status === 'success') {
        setHistory(historyRes.data.data);
      }

      if (toolPkgRes?.data?.status === 'success') {
        setToolQuotaPackages(toolPkgRes.data.data);
      }
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTokenPurchase = async (packageId) => {
    setLoadingPurchase(packageId);
    try {
      const response = await api.post('/api/v1/payment/create-token-checkout', {
        packageId
      });

      if (response.data.status === 'success') {
        const { url } = response.data.data;
        if (url) {
          window.location.href = url;
          return;
        }
        setErrorMessage(t('billing.checkoutUnavailable', 'Checkout URL not available.'));
        setLoadingPurchase(null);
      }
    } catch (error) {
      setErrorMessage(t('billing.checkoutFailed', 'Failed to create checkout session. Please try again.'));
      setLoadingPurchase(null);
    }
  };

  const handleToolQuotaPurchase = async (packageId) => {
    setLoadingPurchase(packageId);
    try {
      const response = await api.post('/api/v1/payment/create-tool-quota-checkout', { packageId });
      if (response.data.status === 'success') {
        const { url } = response.data.data;
        if (url) { window.location.href = url; return; }
        setErrorMessage(t('billing.checkoutUnavailable', 'Checkout URL not available.'));
      }
    } catch (error) {
      setErrorMessage(t('billing.checkoutFailed', 'Failed to create checkout session. Please try again.'));
    } finally {
      setLoadingPurchase(null);
    }
  };

  const handleSubscriptionUpgrade = async (planId, period) => {
    const currentPlan = user?.subscription?.PlanName || 'BASE';
    const isSamePlan = currentPlan === planId.toUpperCase();
    
    // 如果是同级套餐，显示确认弹窗
    if (isSamePlan && currentPlan !== 'BASE') {
      setPendingPurchase({ planId, period });
      setShowExtendModal(true);
      return;
    }
    
    // 否则直接购买
    await proceedWithPurchase(planId, period);
  };

  const proceedWithPurchase = async (planId, period) => {
    try {
      const response = await api.post('/api/v1/payment/create-subscription-checkout', {
        planId,
        period
      });

      if (response.data.status === 'success') {
        const { url } = response.data.data;
        if (url) {
          window.location.href = url;
          return;
        }
        setErrorMessage(t('billing.subscriptionCheckoutUnavailable', 'Subscription checkout URL not available.'));
      }
    } catch (error) {
      if (error.response?.data?.error?.includes('downgrade') ||
          error.response?.data?.error?.includes('lower plan')) {
        setErrorMessage(t('billing.noDowngrade', 'Cannot downgrade while active plan exists. Please wait for current plan to expire.'));
      } else {
        setErrorMessage(t('billing.subscriptionFailed', 'Failed to create subscription checkout. Please try again.'));
      }
    }
  };

  const handleConfirmExtend = () => {
    if (pendingPurchase) {
      proceedWithPurchase(pendingPurchase.planId, pendingPurchase.period);
      setShowExtendModal(false);
      setPendingPurchase(null);
    }
  };

  const handleCancelExtend = () => {
    setShowExtendModal(false);
    setPendingPurchase(null);
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Check if user can purchase a plan (no downgrades)
  const canPurchasePlan = (planId) => {
    const currentPlan = user?.subscription?.PlanName || 'BASE';
    const currentTier = PLAN_HIERARCHY[currentPlan] || 0;
    const newTier = PLAN_HIERARCHY[planId.toUpperCase()] || 0;
    return newTier >= currentTier;
  };

  // Get tooltip message for disabled plans
  const getDisabledTooltip = (planId) => {
    const currentPlan = user?.subscription?.PlanName || 'BASE';
    if (!canPurchasePlan(planId)) {
      return `Cannot downgrade from ${currentPlan}. Please wait for current plan to expire.`;
    }
    return '';
  };

  if (loading) {
    return (
      <div className="billing-loading">
        <div className="spinner"></div>
        <p>{t('billing.loading', 'Loading billing information...')}</p>
      </div>
    );
  }

  return (
    <div className="billing-page">
      <div className="billing-header">
        <h1>{t('billing.title', 'Billing & Payments')}</h1>
        <p className="subtitle">{t('billing.subtitle', 'Manage your tokens and subscription')}</p>
      </div>

      {errorMessage && (
        <div
          style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#dc2626', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700, fontSize: 16 }}>×</button>
        </div>
      )}

      {/* Token Balance Card */}
      <section className="balance-section">
        <div className="balance-card">
          <div className="balance-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="balance-content">
            <h2>{formatNumber(user?.tokenBalance || 0)}</h2>
            <p>{t('billing.tokenBalance', 'Available Tokens')}</p>
          </div>
        </div>
      </section>

      {/* Token Packages */}
      <section className="token-packages">
        <h2>{t('billing.purchaseTokens', 'Purchase Token Packages')}</h2>
        <p className="section-subtitle">{t('billing.purchaseDesc', 'Buy tokens that never expire and can be used anytime')}</p>
        
        <div className="packages-grid">
          {packages.map(pkg => (
            <div key={pkg.id} className={`package-card ${pkg.popular ? 'popular' : ''}`}>
              {pkg.popular && (
                <div className="popular-badge">
                  {t('billing.mostPopular', 'Most Popular')}
                </div>
              )}
              
              <h3>{pkg.name}</h3>
              <div className="package-tokens">
                {formatNumber(pkg.tokens)}
                <span>{t('billing.tokens', 'tokens')}</span>
              </div>
              
              <div className="package-price">
                <span className="currency">$</span>
                <span className="amount">{pkg.price.toFixed(2)}</span>
              </div>
              
              <div className="package-rate">
                ${pkg.pricePerMToken}/M {t('billing.tokens', 'tokens')}
              </div>
              
              <p className="package-description">{pkg.description}</p>
              
              <button
                className="buy-button"
                onClick={() => handleTokenPurchase(pkg.id)}
                disabled={loadingPurchase === pkg.id}
              >
                {loadingPurchase === pkg.id ? (
                  <span className="spinner-small"></span>
                ) : (
                  t('billing.buyNow', 'Buy Now')
                )}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Tool Quota Packages */}
      {toolQuotaPackages.length > 0 && (
        <section className="token-packages">
          <h2>{t('billing.toolQuotaPackages', 'Tool Call Quota Packages')}</h2>
          <p className="section-subtitle">
            {t('billing.toolQuotaDesc', 'Purchase additional tool calls for high-cost integrations. Extra calls never expire.')}
          </p>
          <div className="packages-grid">
            {toolQuotaPackages.map(pkg => (
              <div key={pkg.id} className={`package-card ${pkg.popular ? 'popular' : ''}`}>
                {pkg.popular && (
                  <div className="popular-badge">{t('billing.mostPopular', 'Most Popular')}</div>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <span
                    className="tool-tier-badge-sm"
                    style={{ background: TIER_COLORS[pkg.tier] }}
                  >
                    {TIER_LABELS[pkg.tier]}
                  </span>
                  <h3 style={{ margin: 0 }}>{pkg.calls.toLocaleString()} {t('billing.calls', 'calls')}</h3>
                </div>
                <div className="package-price">
                  <span className="currency">$</span>
                  <span className="amount">{pkg.price.toFixed(2)}</span>
                </div>
                <p className="package-description">{pkg.description}</p>
                <button
                  className="buy-button"
                  onClick={() => handleToolQuotaPurchase(pkg.id)}
                  disabled={loadingPurchase === pkg.id}
                >
                  {loadingPurchase === pkg.id
                    ? <span className="spinner-small"></span>
                    : t('billing.buyNow', 'Buy Now')}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Subscription Upgrade */}
      <section className="subscription-upgrade">
        <h2>{t('billing.upgradeSubscription', 'Upgrade Subscription')}</h2>
        <p className="section-subtitle">{t('billing.subscriptionDesc', 'Get monthly token allowance and premium features')}</p>
        
        <div className="subscription-cards">
          <div className="subscription-card">
            <h3>PRO</h3>
            <div className="subscription-price">
              <span className="currency">$</span>
              <span className="amount">49</span>
              <span className="period">/month</span>
            </div>
            
            <ul className="subscription-features">
              <li>✓ {t('billing.proFeatureMedium', '5M gifted tokens/month (medium + strong)')}</li>
              <li>✓ {t('billing.proFeatureStrong', 'strong-agent access (3× token multiplier)')}</li>
              <li>✓ {t('billing.proFeature2A', 'Tier A tools: 2,000 calls/mo')}</li>
              <li>✓ {t('billing.proFeature2B', 'Tier B tools: 3,000 calls/mo')}</li>
              <li>✓ {t('billing.proFeature2C', 'Tier C tools: 5,000 calls/mo')}</li>
              <li>✓ {t('billing.proFeatureModels', 'Custom model providers')}</li>
              <li>✓ {t('billing.proFeature3', 'Priority support')}</li>
            </ul>
            
            <div className="subscription-actions">
              <button
                className="subscribe-button"
                onClick={() => handleSubscriptionUpgrade('pro', 'monthly')}
                disabled={!canPurchasePlan('pro')}
                title={getDisabledTooltip('pro')}
              >
                {user?.subscription?.PlanName === 'PRO' 
                  ? t('billing.extend', 'Extend')
                  : !canPurchasePlan('pro')
                  ? t('billing.unavailable', 'Unavailable')
                  : t('billing.monthly', 'Monthly')}
              </button>
              <button
                className="subscribe-button secondary"
                onClick={() => handleSubscriptionUpgrade('pro', 'yearly')}
                disabled={!canPurchasePlan('pro')}
                title={getDisabledTooltip('pro')}
              >
                {user?.subscription?.PlanName === 'PRO'
                  ? t('billing.extendYearly', 'Extend (Yearly)')
                  : !canPurchasePlan('pro')
                  ? t('billing.unavailable', 'Unavailable')
                  : `${t('billing.yearly', 'Yearly')} ($490)`}
              </button>
            </div>
          </div>

          <div className="subscription-card enterprise">
            <div className="enterprise-badge">{t('billing.privateDeploy', 'Private Deploy')}</div>
            <h3>{t('billing.enterpriseTitle', 'Enterprise')}</h3>
            <div className="subscription-price">
              <span className="amount" style={{ fontSize: '1.4rem', fontWeight: 700 }}>{t('billing.contactUs', 'Contact Us')}</span>
            </div>

            <ul className="subscription-features">
              <li>✓ {t('billing.enterpriseFeature1', 'Self-hosted private deployment')}</li>
              <li>✓ {t('billing.enterpriseFeature2', 'Unlimited seats & tokens')}</li>
              <li>✓ {t('billing.enterpriseFeature3', 'Custom model providers')}</li>
              <li>✓ {t('billing.enterpriseFeature4', 'Dedicated support & SLA')}</li>
            </ul>

            <div className="subscription-actions">
              <a
                className="subscribe-button"
                href="mailto:enterprise@yourdomain.com"
                style={{ textDecoration: 'none', display: 'inline-block', textAlign: 'center' }}
              >
                {t('billing.contactSales', 'Contact Sales')}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Payment History */}
      <section className="payment-history">
        <h2>{t('billing.paymentHistory', 'Payment History')}</h2>
        
        {history.length === 0 ? (
          <div className="no-history">
            <p>{t('billing.noHistory', 'No payment history yet')}</p>
          </div>
        ) : (
          <div className="history-table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>{t('billing.date', 'Date')}</th>
                  <th>{t('billing.type', 'Type')}</th>
                  <th>{t('billing.description', 'Description')}</th>
                  <th>{t('billing.amount', 'Amount')}</th>
                  <th>{t('billing.status', 'Status')}</th>
                </tr>
              </thead>
              <tbody>
                {history.map((record) => (
                  <tr key={record.id}>
                    <td>{formatDate(record.createdAt)}</td>
                    <td>
                      <span className={`type-badge ${record.type}`}>
                        {record.type === 'token_purchase' 
                          ? t('billing.tokenPurchase', 'Token Purchase')
                          : t('billing.subscription', 'Subscription')}
                      </span>
                    </td>
                    <td>
                      {record.type === 'token_purchase' 
                        ? `${formatNumber(record.tokensAmount)} tokens`
                        : `${record.period === 'monthly' 
                            ? t('billing.monthlyPayment', 'monthly payment')
                            : record.period === 'yearly'
                            ? t('billing.yearlyPayment', 'yearly payment')
                            : `${record.period} ${t('billing.payment', 'payment')}`}`}
                    </td>
                    <td>${record.amount.toFixed(2)}</td>
                    <td>
                      <span className={`status-badge ${record.status.toLowerCase()}`}>
                        {record.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Extend Subscription Confirmation Modal */}
      {showExtendModal && (
        <div className="modal-overlay" onClick={handleCancelExtend}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('billing.extendSubscription', 'Extend Subscription')}</h3>
              <button className="modal-close" onClick={handleCancelExtend}>×</button>
            </div>
            
            <div className="modal-body">
              <p>
                {t('billing.extendConfirmMessage', 
                  'You are about to extend your current subscription. The new duration will be added to your existing subscription period.')}
              </p>
              
              {pendingPurchase && (
                <div className="extend-details">
                  <div className="detail-row">
                    <span className="label">{t('billing.plan', 'Plan')}:</span>
                    <span className="value">{pendingPurchase.planId.toUpperCase()}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">{t('billing.period', 'Period')}:</span>
                    <span className="value">
                      {pendingPurchase.period === 'monthly' ? '1 Month' : '1 Year'}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="label">{t('billing.cost', 'Cost')}:</span>
                    <span className="value">
                      ${pendingPurchase.period === 'monthly' 
                        ? (pendingPurchase.planId === 'pro' ? '49.00' : '100.00')
                        : (pendingPurchase.planId === 'pro' ? '490.00' : '1000.00')}
                    </span>
                  </div>
                </div>
              )}
            </div>
            
            <div className="modal-footer">
              <button className="modal-button cancel" onClick={handleCancelExtend}>
                {t('billing.cancel', 'Cancel')}
              </button>
              <button className="modal-button confirm" onClick={handleConfirmExtend}>
                {t('billing.confirmExtend', 'Confirm & Extend')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;

