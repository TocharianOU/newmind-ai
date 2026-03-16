import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../config/api';
import './PaymentSuccess.css';

const PaymentSuccess = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { checkAuth } = useAuth();
  const { t } = useLanguage();
  const [verifying, setVerifying] = useState(true);
  const [sessionData, setSessionData] = useState(null);
  const [error, setError] = useState(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    verifyPayment();
  }, []);

  useEffect(() => {
    if (sessionData && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);

      return () => clearTimeout(timer);
    }

    if (countdown === 0) {
      navigate('/dashboard');
    }
  }, [countdown, sessionData, navigate]);

  const verifyPayment = async () => {
    const sessionId = searchParams.get('session_id');

    if (!sessionId) {
      setError('No session ID found');
      setVerifying(false);
      return;
    }

    try {
      const response = await api.get(`/api/v1/payment/verify-session/${sessionId}`);

      if (response.data.status === 'success') {
        setSessionData(response.data.data);
        
        // 刷新用户数据以获取最新的 Token 余额
        await checkAuth();
      } else {
        setError('Failed to verify payment');
      }
    } catch (err) {
      console.error('Error verifying payment:', err);
      setError('Failed to verify payment');
    } finally {
      setVerifying(false);
    }
  };

  if (verifying) {
    return (
      <div className="payment-success-page">
        <div className="payment-card">
          <div className="spinner-large"></div>
          <h2>{t('payment.verifying', 'Verifying payment...')}</h2>
          <p>{t('payment.pleaseWait', 'Please wait while we confirm your payment')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="payment-success-page">
        <div className="payment-card error">
          <div className="icon-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10" strokeWidth="2"/>
              <line x1="15" y1="9" x2="9" y2="15" strokeWidth="2" strokeLinecap="round"/>
              <line x1="9" y1="9" x2="15" y2="15" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <h2>{t('payment.error', 'Payment Verification Failed')}</h2>
          <p>{error}</p>
          <button
            className="action-button"
            onClick={() => navigate('/billing')}
          >
            {t('payment.backToBilling', 'Back to Billing')}
          </button>
        </div>
      </div>
    );
  }

  const purchaseType = sessionData?.metadata?.type;

  return (
    <div className="payment-success-page">
      <div className="payment-card success">
        <div className="icon-success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="12" cy="12" r="10" strokeWidth="2"/>
            <path d="M9 12l2 2 4-4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h2>{t('payment.success', 'Payment Successful!')}</h2>
        
        {purchaseType === 'usd_topup' ? (
          <>
            <p className="payment-desc">
              {t('payment.topupSuccess', 'Your balance has been topped up')}
            </p>
            <div className="payment-details">
              <div className="detail-item">
                <span className="label">{t('payment.balanceAdded', 'Balance Added')}:</span>
                <span className="value">${sessionData.amountTotal?.toFixed(2)}</span>
              </div>
            </div>
          </>
        ) : purchaseType === 'token_purchase' ? (
          <>
            <p className="payment-desc">
              {t('payment.tokenSuccess', 'Your tokens have been added to your account')}
            </p>
            <div className="payment-details">
              <div className="detail-item">
                <span className="label">{t('payment.tokens', 'Tokens')}:</span>
                <span className="value">
                  {parseInt(sessionData.metadata.tokensAmount).toLocaleString()}
                </span>
              </div>
              <div className="detail-item">
                <span className="label">{t('payment.amount', 'Amount')}:</span>
                <span className="value">${sessionData.amountTotal?.toFixed(2)}</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="payment-desc">
              {t('payment.subscriptionSuccess', 'Your subscription has been activated')}
            </p>
            <div className="payment-details">
              <div className="detail-item">
                <span className="label">{t('payment.plan', 'Plan')}:</span>
                <span className="value">{sessionData.metadata?.planId?.toUpperCase()}</span>
              </div>
              <div className="detail-item">
                <span className="label">{t('payment.period', 'Period')}:</span>
                <span className="value">{sessionData.metadata?.period}</span>
              </div>
              <div className="detail-item">
                <span className="label">{t('payment.amount', 'Amount')}:</span>
                <span className="value">${sessionData.amountTotal?.toFixed(2)}</span>
              </div>
            </div>
          </>
        )}

        <div className="redirect-notice">
          {t('payment.redirecting', 'Redirecting to dashboard in')} {countdown} {t('payment.seconds', 'seconds')}...
        </div>

        <button
          className="action-button"
          onClick={() => navigate('/dashboard')}
        >
          {t('payment.goToDashboard', 'Go to Dashboard Now')}
        </button>
      </div>
    </div>
  );
};

export default PaymentSuccess;

