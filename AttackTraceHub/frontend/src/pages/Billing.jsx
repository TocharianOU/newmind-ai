import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../config/api';
import './Billing.css';

const PLAN_HIERARCHY = { 'BASE': 0, 'PRO': 1 };

const Billing = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [topupPackages, setTopupPackages] = useState([]);
  const [history, setHistory] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingPurchase, setLoadingPurchase] = useState(null);
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [pendingPurchase, setPendingPurchase] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [customAmount, setCustomAmount] = useState('');

  // Auto top-up state
  const [autoTopUp, setAutoTopUp] = useState({ enabled: false, threshold: 5, amount: 20, savedCard: null });
  const [showAutoTopUpEdit, setShowAutoTopUpEdit] = useState(false);
  const [savingAutoTopUp, setSavingAutoTopUp] = useState(false);

  // Receipts & monthly spend
  const [receipts, setReceipts] = useState([]);
  const [monthlySpend, setMonthlySpend] = useState({ spent: 0, cap: null });

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [topupRes, historyRes, usageRes, autoTopUpRes, receiptsRes, spendRes] = await Promise.all([
        api.get('/api/v1/payment/topup-packages').catch(() => null),
        api.get('/api/v1/payment/history'),
        api.get('/api/v1/user/usage').catch(() => null),
        api.get('/api/v1/payment/auto-topup-settings').catch(() => null),
        api.get('/api/v1/payment/receipts').catch(() => null),
        api.get('/api/v1/payment/monthly-spend').catch(() => null),
      ]);

      if (topupRes?.data?.status === 'success') setTopupPackages(topupRes.data.data);
      if (historyRes.data.status === 'success') setHistory(historyRes.data.data);
      if (usageRes?.data?.status === 'success') setUsage(usageRes.data.data);
      if (autoTopUpRes?.data?.status === 'success') setAutoTopUp(autoTopUpRes.data.data);
      if (receiptsRes?.data?.status === 'success') setReceipts(receiptsRes.data.data.receipts || []);
      if (spendRes?.data?.status === 'success') setMonthlySpend(spendRes.data.data);
    } catch (error) {
      console.error('Error fetching billing data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAutoTopUp = async (newEnabled) => {
    const updated = { ...autoTopUp, enabled: newEnabled };
    setAutoTopUp(updated);
    setSavingAutoTopUp(true);
    try {
      await api.post('/api/v1/payment/auto-topup-settings', {
        enabled: newEnabled,
        threshold: updated.threshold,
        amount: updated.amount,
      });
    } catch (err) {
      setAutoTopUp(prev => ({ ...prev, enabled: !newEnabled }));
      setErrorMessage(err.response?.data?.error || 'Failed to update auto top-up');
    } finally {
      setSavingAutoTopUp(false);
    }
  };

  const handleSaveAutoTopUpValues = async () => {
    setSavingAutoTopUp(true);
    try {
      await api.post('/api/v1/payment/auto-topup-settings', {
        enabled: autoTopUp.enabled,
        threshold: autoTopUp.threshold,
        amount: autoTopUp.amount,
      });
      setShowAutoTopUpEdit(false);
    } catch (err) {
      setErrorMessage(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSavingAutoTopUp(false);
    }
  };

  const handleTopupPurchase = async (packageId, amount) => {
    setLoadingPurchase(packageId);
    try {
      const shouldSaveCard = autoTopUp.enabled && !autoTopUp.savedCard;
      const body = packageId === 'custom'
        ? { packageId: 'custom', customAmount: amount, saveCard: shouldSaveCard }
        : { packageId, saveCard: shouldSaveCard };
      const response = await api.post('/api/v1/payment/create-topup-checkout', body);
      if (response.data.status === 'success') {
        const { url } = response.data.data;
        if (url) { window.location.href = url; return; }
        setErrorMessage('Checkout URL not available.');
      }
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to create checkout session. Please try again.';
      setErrorMessage(msg);
    } finally {
      setLoadingPurchase(null);
    }
  };

  const handleSubscriptionUpgrade = async (planId, period) => {
    const currentPlan = user?.subscription?.PlanName || 'BASE';
    const isSamePlan = currentPlan === planId.toUpperCase();
    if (isSamePlan && currentPlan !== 'BASE') {
      setPendingPurchase({ planId, period });
      setShowExtendModal(true);
      return;
    }
    await proceedWithPurchase(planId, period);
  };

  const proceedWithPurchase = async (planId, period) => {
    try {
      const response = await api.post('/api/v1/payment/create-subscription-checkout', { planId, period });
      if (response.data.status === 'success') {
        const { url } = response.data.data;
        if (url) { window.location.href = url; return; }
        setErrorMessage('Subscription checkout URL not available.');
      }
    } catch (error) {
      if (error.response?.data?.error?.includes('downgrade') || error.response?.data?.error?.includes('lower plan')) {
        setErrorMessage('Cannot downgrade while active plan exists. Please wait for current plan to expire.');
      } else {
        setErrorMessage('Failed to create subscription checkout. Please try again.');
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
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  const canPurchasePlan = (planId) => {
    const currentPlan = user?.subscription?.PlanName || 'BASE';
    return (PLAN_HIERARCHY[planId.toUpperCase()] || 0) >= (PLAN_HIERARCHY[currentPlan] || 0);
  };

  const getDisabledTooltip = (planId) => {
    if (!canPurchasePlan(planId)) return `Cannot downgrade from ${user?.subscription?.PlanName}`;
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

  const usdBalance = usage?.usdBalance ?? user?.usdBalance ?? 0;
  const tokenUsed = usage?.total ?? 0;
  const tokenLimit = usage?.limit ?? 0;
  const tokenRemaining = Math.max(0, tokenLimit - tokenUsed);

  return (
    <div className="billing-page">
      <div className="billing-header">
        <h1>{t('billing.title', 'Billing & Payments')}</h1>
        <p className="subtitle">{t('billing.subtitle', 'Manage your balance and subscription')}</p>
      </div>

      {errorMessage && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '12px 16px', marginBottom: 20, color: '#dc2626', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontWeight: 700, fontSize: 16 }}>x</button>
        </div>
      )}

      {/* Balance Cards */}
      <section className="balance-section">
        <div className="balance-card">
          <div className="balance-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="balance-content">
            <h2>${usdBalance.toFixed(2)}</h2>
            <p>{t('billing.usdBalance', 'USD Balance')}</p>
          </div>
        </div>

        <div className="balance-card">
          <div className="balance-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="balance-content">
            <h2>{formatNumber(tokenRemaining)}</h2>
            <p>{t('billing.monthlyTokensRemaining', 'Monthly Gifted Tokens Remaining')}</p>
          </div>
        </div>
      </section>

      {/* USD Top-up */}
      <section className="token-packages">
        <h2>{t('billing.topUpBalance', 'Top Up Balance')}</h2>
        <p className="section-subtitle">
          {t('billing.topUpDesc', 'Add funds to your account. USD balance is used for model calls (after gifted tokens) and tool calls (after free quota).')}
        </p>

        <div className="packages-grid">
          {topupPackages.map(pkg => (
            <div key={pkg.id} className={`package-card ${pkg.popular ? 'popular' : ''}`}>
              {pkg.popular && <div className="popular-badge">{t('billing.mostPopular', 'Most Popular')}</div>}
              <h3>{pkg.name}</h3>
              <div className="package-price">
                <span className="currency">$</span>
                <span className="amount">{pkg.amount.toFixed(0)}</span>
              </div>
              <p className="package-description">{pkg.description}</p>
              <button
                className="buy-button"
                onClick={() => handleTopupPurchase(pkg.id)}
                disabled={loadingPurchase === pkg.id}
              >
                {loadingPurchase === pkg.id
                  ? <span className="spinner-small"></span>
                  : t('billing.topUp', 'Top Up')}
              </button>
            </div>
          ))}

          {/* Custom amount */}
          <div className="package-card">
            <h3>{t('billing.customAmount', 'Custom Amount')}</h3>
            <div className="custom-amount-input">
              <span className="currency-prefix">$</span>
              <input
                type="number"
                min="5"
                max="10000"
                step="1"
                placeholder="50"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
              />
            </div>
            <p className="package-description">{t('billing.customAmountDesc', 'Enter any amount between $5 and $10,000')}</p>
            <button
              className="buy-button"
              onClick={() => handleTopupPurchase('custom', customAmount)}
              disabled={loadingPurchase === 'custom' || !customAmount || parseFloat(customAmount) < 5}
            >
              {loadingPurchase === 'custom'
                ? <span className="spinner-small"></span>
                : t('billing.topUp', 'Top Up')}
            </button>
          </div>
        </div>

        {/* Compact auto top-up row */}
        <div className="auto-topup-inline">
          <div className="auto-topup-summary">
            <button
              className={`toggle-btn-sm ${autoTopUp.enabled ? 'on' : 'off'}`}
              onClick={() => handleToggleAutoTopUp(!autoTopUp.enabled)}
              disabled={savingAutoTopUp}
              type="button"
            >
              <span className="toggle-knob-sm" />
            </button>
            <span className="auto-topup-text">
              {autoTopUp.enabled
                ? `Auto top-up $${autoTopUp.amount} when below $${autoTopUp.threshold}`
                : 'Auto top-up off'}
              {autoTopUp.enabled && autoTopUp.savedCard
                ? ` · ${autoTopUp.savedCard.brand?.toUpperCase()} ••${autoTopUp.savedCard.last4}`
                : autoTopUp.enabled ? ' · card saved on next purchase' : ''}
            </span>
            <button
              className="auto-topup-edit-btn"
              onClick={() => setShowAutoTopUpEdit(!showAutoTopUpEdit)}
              type="button"
            >
              {showAutoTopUpEdit ? 'Close' : 'Edit'}
            </button>
          </div>
          {showAutoTopUpEdit && (
            <div className="auto-topup-edit-panel">
              <div className="auto-topup-edit-fields">
                <label>
                  <span>Below $</span>
                  <input type="number" min="1" max="100" value={autoTopUp.threshold}
                    onChange={e => setAutoTopUp(s => ({ ...s, threshold: e.target.value }))} />
                </label>
                <label>
                  <span>Add $</span>
                  <input type="number" min="5" max="500" step="5" value={autoTopUp.amount}
                    onChange={e => setAutoTopUp(s => ({ ...s, amount: e.target.value }))} />
                </label>
              </div>
              <button className="auto-topup-save-btn" onClick={handleSaveAutoTopUpValues} disabled={savingAutoTopUp}>
                {savingAutoTopUp ? '...' : 'Save'}
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Subscription Upgrade */}
      <section className="subscription-upgrade">
        <h2>{t('billing.upgradeSubscription', 'Upgrade Subscription')}</h2>
        <p className="section-subtitle">{t('billing.subscriptionDesc', 'Get monthly gifted tokens, tool free quota, and premium features')}</p>

        <div className="subscription-cards">
          <div className="subscription-card">
            <h3>PRO</h3>
            <div className="subscription-price">
              <span className="currency">$</span>
              <span className="amount">49</span>
              <span className="period">/month</span>
            </div>

            <ul className="subscription-features">
              <li>5M gifted tokens/month (medium + strong)</li>
              <li>strong-agent access (3x multiplier)</li>
              <li>Free tool calls included per tier</li>
              <li>Custom model providers</li>
              <li>Priority support</li>
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
              <li>Self-hosted private deployment</li>
              <li>Unlimited seats &amp; tokens</li>
              <li>Custom model providers</li>
              <li>Dedicated support &amp; SLA</li>
            </ul>
            <div className="subscription-actions">
              <a className="subscribe-button" href="mailto:enterprise@yourdomain.com" style={{ textDecoration: 'none', display: 'inline-block', textAlign: 'center' }}>
                {t('billing.contactSales', 'Contact Sales')}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Monthly Spend */}
      {monthlySpend.cap !== null && (
        <section className="monthly-spend-section">
          <h2>{t('billing.monthlySpend', 'Monthly Spending')}</h2>
          <div className="spend-bar-container">
            <div className="spend-bar-labels">
              <span>${monthlySpend.spent.toFixed(2)} spent</span>
              <span>${monthlySpend.cap.toFixed(2)} cap</span>
            </div>
            <div className="spend-bar-track">
              <div
                className={`spend-bar-fill ${monthlySpend.spent / monthlySpend.cap > 0.9 ? 'danger' : monthlySpend.spent / monthlySpend.cap > 0.7 ? 'warn' : ''}`}
                style={{ width: `${Math.min(100, (monthlySpend.spent / monthlySpend.cap) * 100)}%` }}
              />
            </div>
          </div>
        </section>
      )}

      {/* Receipts */}
      {receipts.length > 0 && (
        <section className="payment-history">
          <h2>{t('billing.receipts', 'Receipts & Invoices')}</h2>
          <div className="history-table-container">
            <table className="history-table">
              <thead>
                <tr>
                  <th>{t('billing.date', 'Date')}</th>
                  <th>{t('billing.type', 'Type')}</th>
                  <th>{t('billing.amount', 'Amount')}</th>
                  <th>{t('billing.status', 'Status')}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {receipts.map(r => (
                  <tr key={r.id}>
                    <td>{formatDate(r.date)}</td>
                    <td><span className={`type-badge ${r.type}`}>{r.type === 'invoice' ? 'Invoice' : 'Receipt'}</span></td>
                    <td>${r.amount.toFixed(2)} {r.currency?.toUpperCase()}</td>
                    <td><span className={`status-badge ${r.status}`}>{r.status}</span></td>
                    <td>
                      {(r.pdfUrl || r.hostedUrl) && (
                        <a href={r.pdfUrl || r.hostedUrl} target="_blank" rel="noopener noreferrer" className="receipt-link">
                          {r.pdfUrl ? 'PDF' : 'View'}
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
                          ? 'Token Purchase'
                          : record.type === 'usd_topup'
                          ? 'Balance Top-up'
                          : 'Subscription'}
                      </span>
                    </td>
                    <td>
                      {record.type === 'token_purchase'
                        ? `${formatNumber(record.tokensAmount)} tokens`
                        : record.type === 'usd_topup'
                        ? `$${record.amount?.toFixed(2)} balance added`
                        : `${record.period} payment`}
                    </td>
                    <td>${record.amount?.toFixed(2)}</td>
                    <td>
                      <span className={`status-badge ${record.status?.toLowerCase()}`}>
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

      {/* Extend Modal */}
      {showExtendModal && (
        <div className="modal-overlay" onClick={handleCancelExtend}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t('billing.extendSubscription', 'Extend Subscription')}</h3>
              <button className="modal-close" onClick={handleCancelExtend}>x</button>
            </div>
            <div className="modal-body">
              <p>{t('billing.extendConfirmMessage', 'The new duration will be added to your existing subscription period.')}</p>
              {pendingPurchase && (
                <div className="extend-details">
                  <div className="detail-row">
                    <span className="label">{t('billing.plan', 'Plan')}:</span>
                    <span className="value">{pendingPurchase.planId.toUpperCase()}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">{t('billing.period', 'Period')}:</span>
                    <span className="value">{pendingPurchase.period === 'monthly' ? '1 Month' : '1 Year'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">{t('billing.cost', 'Cost')}:</span>
                    <span className="value">
                      ${pendingPurchase.period === 'monthly' ? '49.00' : '490.00'}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="modal-button cancel" onClick={handleCancelExtend}>{t('billing.cancel', 'Cancel')}</button>
              <button className="modal-button confirm" onClick={handleConfirmExtend}>{t('billing.confirmExtend', 'Confirm & Extend')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Billing;
