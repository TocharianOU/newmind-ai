import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useFeatureFlags } from '../contexts/FeatureFlagsContext';
import api from '../config/api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { billingEnabled, licenseEnabled, deploymentMode } = useFeatureFlags();
  const [stats, setStats] = useState(null);
  const [usage, setUsage] = useState(null);
  const [toolQuota, setToolQuota] = useState(null);
  const [range, setRange] = useState('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [range]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsResponse, usageResponse, quotaResponse] = await Promise.all([
        api.get(`/api/v1/user/stats?range=${range}`),
        api.get('/api/v1/user/usage'),
        api.get('/api/v1/user/tool-quota').catch(() => null)
      ]);

      if (statsResponse.data.status === 'success') {
        setStats(statsResponse.data.data);
      }

      if (usageResponse.data.status === 'success') {
        setUsage(usageResponse.data.data);
      }

      if (quotaResponse?.data?.status === 'success') {
        setToolQuota(quotaResponse.data.data);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading) {
    return (
      <div className="dashboard-loading">
        <div className="spinner"></div>
        <p>{t('dashboard.loadingDashboard', 'Loading dashboard...')}</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>{t('dashboard.welcomeBack', 'Welcome back')}, {user?.username}!</h1>
          <p className="subtitle">{t('dashboard.usageOverview', "Here's your usage overview")}</p>
        </div>
        
        <div className="range-selector">
          <button
            className={range === '7d' ? 'active' : ''}
            onClick={() => setRange('7d')}
          >
            {t('dashboard.days7', '7 Days')}
          </button>
          <button
            className={range === '30d' ? 'active' : ''}
            onClick={() => setRange('30d')}
          >
            {t('dashboard.days30', '30 Days')}
          </button>
          <button
            className={range === '90d' ? 'active' : ''}
            onClick={() => setRange('90d')}
          >
            {t('dashboard.days90', '90 Days')}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon total-calls">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="stat-content">
            <h3>{formatNumber(stats?.summary?.totalCalls || 0)}</h3>
            <p>{t('dashboard.totalApiCalls', 'Total API Calls')}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon total-tokens">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="stat-content">
            <h3>{formatNumber(stats?.summary?.totalTokens || 0)}</h3>
            <p>{t('dashboard.totalTokensUsed', 'Total Tokens Used')}</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon avg-tokens">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="stat-content">
            <h3>{formatNumber(stats?.summary?.averageTokensPerCall || 0)}</h3>
            <p>{t('dashboard.avgTokensPerCall', 'Avg Tokens/Call')}</p>
          </div>
        </div>

        {/* Token balance (SaaS) or License seats (Enterprise) */}
        {deploymentMode === 'enterprise' ? (
          <div className="stat-card">
            <div className="stat-icon token-balance">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="stat-content">
              <h3>{usage?.enterpriseQuota?.currentSeats ?? '—'} / {usage?.enterpriseQuota?.maxSeats ?? '—'}</h3>
              <p>{t('dashboard.seats', 'Seats Used')}</p>
              <Link to="/license" className="refill-link">
                {t('dashboard.manageLicense', 'Manage License')} →
              </Link>
            </div>
          </div>
        ) : (
          <div className="stat-card">
            <div className="stat-icon token-balance">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="stat-content">
              <h3>${Number(usage?.usdBalance ?? 0).toFixed(2)}</h3>
              <p>{t('dashboard.usdBalance', 'USD Balance')}</p>
              {billingEnabled && (
                <Link to="/billing" className="refill-link">
                  {t('dashboard.topUp', 'Top Up')} →
                </Link>
              )}
            </div>
          </div>
        )}

        <div className="stat-card">
          <div className="stat-icon plan-info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="stat-content">
            <h3>{deploymentMode === 'enterprise' ? 'Enterprise' : (user?.subscription?.PlanName || 'BASE')}</h3>
            <p>{t('dashboard.currentPlan', 'Current Plan')}</p>
            {deploymentMode === 'enterprise' && usage?.enterpriseQuota?.expiresAt && (
              <span className="plan-expiry">
                {t('dashboard.expires', 'Expires')}: {new Date(usage.enterpriseQuota.expiresAt).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Usage Progress */}
      {usage && (
        <div className="usage-card">
          <h2>
            {deploymentMode === 'enterprise'
              ? t('dashboard.globalTokenUsage', 'Global Token Usage')
              : t('dashboard.monthlyUsage', 'Monthly Usage')}
          </h2>
          <div className="usage-progress">
            <div className="usage-bar">
              <div
                className="usage-bar-fill"
                style={{
                  width: deploymentMode === 'enterprise' && usage.enterpriseQuota?.maxTokens > 0
                    ? `${Math.min((usage.enterpriseQuota.globalUsedTokens / usage.enterpriseQuota.maxTokens) * 100, 100)}%`
                    : `${Math.min((usage.total / usage.limit) * 100, 100)}%`
                }}
              ></div>
            </div>
            <div className="usage-text">
              {deploymentMode === 'enterprise' && usage.enterpriseQuota ? (
                <>
                  <span>{formatNumber(usage.enterpriseQuota.globalUsedTokens)} {t('dashboard.tokensUsed', 'tokens used')}</span>
                  <span>
                    {usage.enterpriseQuota.maxTokens > 0
                      ? `${formatNumber(usage.enterpriseQuota.maxTokens)} ${t('dashboard.limit', 'limit')}`
                      : t('dashboard.unlimited', 'Unlimited')}
                  </span>
                </>
              ) : (
                <>
                  <span>{formatNumber(usage.total)} {t('dashboard.tokensUsed', 'tokens used')}</span>
                  <span>{formatNumber(usage.limit)} {t('dashboard.limit', 'limit')}</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tool Tier Quota (SaaS only) */}
      {!licenseEnabled && toolQuota && (
        <div className="usage-card">
          <h2>{t('dashboard.toolQuota', 'Tool Usage Quota (This Month)')}</h2>
          <div className="tool-quota-grid">
            {[
              { tier: 'A', color: '#e53e3e' },
              { tier: 'B', color: '#dd6b20' },
              { tier: 'C', color: '#38a169' },
            ].map(({ tier, color }) => {
              const q = toolQuota.tiers?.[tier] || { used: 0, limit: 0, tools: [] };
              const pct = q.limit > 0 ? Math.min((q.used / q.limit) * 100, 100) : 0;
              const toolNames = (q.tools || []).map(t => typeof t === 'string' ? t : t.name).join(', ');
              return (
                <div key={tier} className="tool-quota-item">
                  <div className="tool-quota-header">
                    <span className="tool-tier-badge" style={{ background: color }}>
                      {t('dashboard.tier', 'Tier')} {tier}
                    </span>
                    <span className="tool-quota-label">{toolNames || '—'}</span>
                    <span className="tool-quota-count">{q.used} / {q.limit}</span>
                  </div>
                  <div className="usage-bar">
                    <div
                      className="usage-bar-fill"
                      style={{ width: `${pct}%`, background: pct >= 100 ? '#e53e3e' : color }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
          {toolQuota.plan !== 'PRO' && (
            <p className="tool-quota-upgrade">
              {t('dashboard.toolQuotaUpgrade', 'Upgrade to PRO for higher tool quotas and custom models.')}{' '}
              <a href="/billing">{t('dashboard.upgradeNow', 'Upgrade now')} →</a>
            </p>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="charts-grid">
        {stats?.dailyUsage && stats.dailyUsage.length > 0 && (
          <div className="chart-card">
            <h2>{t('dashboard.dailyUsageTrend', 'Daily Usage Trend')}</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.dailyUsage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="tokens" 
                  name={t('dashboard.tokens', 'Tokens')}
                  stroke="#667eea" 
                  strokeWidth={2} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {stats?.modelStats && stats.modelStats.length > 0 && (
          <div className="chart-card">
            <h2>{t('dashboard.usageByModel', 'Usage by Model')}</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.modelStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="model" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar 
                  dataKey="totalTokens" 
                  name={t('dashboard.totalTokens', 'Total Tokens')}
                  fill="#764ba2" 
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Model Stats Table */}
      {stats?.modelStats && stats.modelStats.length > 0 && (
        <div className="table-card">
          <h2>{t('dashboard.detailedModelStats', 'Detailed Model Statistics')}</h2>
          <div className="table-container">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>{t('dashboard.model', 'Model')}</th>
                  <th>{t('dashboard.calls', 'Calls')}</th>
                  <th>{t('dashboard.inputTokens', 'Input Tokens')}</th>
                  <th>{t('dashboard.outputTokens', 'Output Tokens')}</th>
                  <th>{t('dashboard.totalTokens', 'Total Tokens')}</th>
                </tr>
              </thead>
              <tbody>
                {stats.modelStats.map((model) => (
                  <tr key={model.model}>
                    <td className="model-name">{model.model}</td>
                    <td>{formatNumber(model.calls)}</td>
                    <td>{formatNumber(model.inputTokens)}</td>
                    <td>{formatNumber(model.outputTokens)}</td>
                    <td><strong>{formatNumber(model.totalTokens)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
