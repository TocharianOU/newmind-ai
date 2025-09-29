import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './Dashboard.css';

const Dashboard = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [usage, setUsage] = useState(null);
  const [range, setRange] = useState('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [range]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsResponse, usageResponse] = await Promise.all([
        api.get(`/api/v1/user/stats?range=${range}`),
        api.get('/api/v1/user/usage')
      ]);

      if (statsResponse.data.success) {
        setStats(statsResponse.data.data);
      }

      if (usageResponse.data.success) {
        setUsage(usageResponse.data.data);
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
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Welcome back, {user?.username}!</h1>
          <p className="subtitle">Here's your usage overview</p>
        </div>
        
        <div className="range-selector">
          <button
            className={range === '7d' ? 'active' : ''}
            onClick={() => setRange('7d')}
          >
            7 Days
          </button>
          <button
            className={range === '30d' ? 'active' : ''}
            onClick={() => setRange('30d')}
          >
            30 Days
          </button>
          <button
            className={range === '90d' ? 'active' : ''}
            onClick={() => setRange('90d')}
          >
            90 Days
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
            <p>Total API Calls</p>
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
            <p>Total Tokens Used</p>
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
            <p>Avg Tokens/Call</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon plan-info">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div className="stat-content">
            <h3>{user?.subscription?.PlanName || 'BASE'}</h3>
            <p>Current Plan</p>
          </div>
        </div>
      </div>

      {/* Usage Progress */}
      {usage && (
        <div className="usage-card">
          <h2>Monthly Usage</h2>
          <div className="usage-progress">
            <div className="usage-bar">
              <div 
                className="usage-bar-fill"
                style={{
                  width: `${Math.min((usage.total / usage.limit) * 100, 100)}%`
                }}
              ></div>
            </div>
            <div className="usage-text">
              <span>{formatNumber(usage.total)} tokens used</span>
              <span>{formatNumber(usage.limit)} limit</span>
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="charts-grid">
        {stats?.dailyUsage && stats.dailyUsage.length > 0 && (
          <div className="chart-card">
            <h2>Daily Usage Trend</h2>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={stats.dailyUsage}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="tokens" stroke="#667eea" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {stats?.modelStats && stats.modelStats.length > 0 && (
          <div className="chart-card">
            <h2>Usage by Model</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.modelStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="model" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="totalTokens" fill="#764ba2" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Model Stats Table */}
      {stats?.modelStats && stats.modelStats.length > 0 && (
        <div className="table-card">
          <h2>Detailed Model Statistics</h2>
          <div className="table-container">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Calls</th>
                  <th>Input Tokens</th>
                  <th>Output Tokens</th>
                  <th>Total Tokens</th>
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
