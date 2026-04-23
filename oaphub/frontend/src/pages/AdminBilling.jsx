import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../config/api';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import './AdminStats.css';

const AdminBilling = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [users, setUsers] = useState([]);
  const [range, setRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [txnLoading, setTxnLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (user && user.role !== 'ADMIN') navigate('/dashboard', { replace: true });
  }, [user, navigate]);

  useEffect(() => {
    if (user?.role === 'ADMIN') fetchData();
  }, [range, user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [summaryRes, usersRes] = await Promise.all([
        api.get(`/api/v1/admin/billing/summary?range=${range}`),
        api.get('/api/v1/admin/billing/users'),
      ]);
      if (summaryRes.data.status === 'success') setSummary(summaryRes.data.data);
      if (usersRes.data.status === 'success') setUsers(usersRes.data.data);
    } catch (err) {
      console.error('Error fetching billing data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = async (u) => {
    setSelectedUser(u);
    setTxnLoading(true);
    try {
      const res = await api.get(`/api/v1/admin/billing/users/${u.id}/transactions?limit=50`);
      if (res.data.status === 'success') setTransactions(res.data.data.transactions);
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setTxnLoading(false);
    }
  };

  const closeModal = () => { setSelectedUser(null); setTransactions([]); };

  const fmt = (n) => `$${Number(n).toFixed(2)}`;
  const fmtDate = (d) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const fmtDateTime = (d) => new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="admin-stats-loading">
        <div className="spinner" />
        <p>Loading billing data...</p>
      </div>
    );
  }

  const chartData = summary?.daily?.map(d => ({
    date: fmtDate(d.date),
    Topups: +d.topups.toFixed(2),
    Charges: +d.charges.toFixed(2),
  })) || [];

  return (
    <div className="admin-stats">
      <div className="admin-stats-header">
        <div>
          <h1>{t('admin.billingReport', 'Billing Report')}</h1>
          <p className="subtitle">{t('admin.billingDesc', 'Platform revenue & per-user spending')}</p>
        </div>
        <div className="range-selector">
          {['7d', '30d', '90d'].map(r => (
            <button key={r} className={range === r ? 'active' : ''} onClick={() => setRange(r)}>
              {r === '7d' ? '7 Days' : r === '30d' ? '30 Days' : '90 Days'}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}>$</div>
          <div className="stat-info">
            <span className="stat-value">{fmt(summary?.totalTopups ?? 0)}</span>
            <span className="stat-label">Total Top-ups</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}>$</div>
          <div className="stat-info">
            <span className="stat-value">{fmt(summary?.totalModelCharges ?? 0)}</span>
            <span className="stat-label">Model Charges</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>$</div>
          <div className="stat-info">
            <span className="stat-value">{fmt(summary?.totalToolCharges ?? 0)}</span>
            <span className="stat-label">Tool Charges</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon" style={{ background: 'linear-gradient(135deg, #ec4899, #db2777)' }}>
            <span style={{ fontSize: '0.75rem' }}>{summary?.activeUsers ?? 0}</span>
          </div>
          <div className="stat-info">
            <span className="stat-value">{summary?.activeUsers ?? 0}</span>
            <span className="stat-label">Active Users</span>
          </div>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="chart-container" style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', fontWeight: 600 }}>Daily Revenue & Charges</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} tickFormatter={v => `$${v}`} />
              <Tooltip formatter={(v) => `$${v.toFixed(2)}`} />
              <Legend />
              <Bar dataKey="Topups" fill="#22c55e" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Charges" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* User Table */}
      <div className="users-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ fontWeight: 600 }}>User Spending (This Month)</h3>
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="user-search-input"
          />
        </div>
        <div className="history-table-container">
          <table className="history-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>User</th>
                <th>Plan</th>
                <th>Balance</th>
                <th>Model $</th>
                <th>Tool $</th>
                <th>Total Spent</th>
                <th>Top-ups</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map(u => (
                <tr key={u.id} onClick={() => handleUserClick(u)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div>
                      <strong>{u.username || '—'}</strong>
                      <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>{u.email}</div>
                    </div>
                  </td>
                  <td><span className={`type-badge ${u.plan.toLowerCase()}`}>{u.plan}</span></td>
                  <td>{fmt(u.usdBalance)}</td>
                  <td>{fmt(u.monthModelCharged)}</td>
                  <td>{fmt(u.monthToolCharged)}</td>
                  <td style={{ fontWeight: 600 }}>{fmt(u.monthTotal)}</td>
                  <td style={{ color: '#22c55e' }}>{fmt(u.monthTopups)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction Modal */}
      {selectedUser && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 700, maxHeight: '80vh', overflow: 'auto' }}>
            <div className="modal-header">
              <h3>{selectedUser.email} — Transactions</h3>
              <button className="modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
              {txnLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem' }}><div className="spinner" /></div>
              ) : transactions.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#9ca3af' }}>No transactions</p>
              ) : (
                <table className="history-table" style={{ width: '100%', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th>Time</th>
                      <th>Type</th>
                      <th>Amount</th>
                      <th>Before</th>
                      <th>After</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(t => (
                      <tr key={t.id}>
                        <td>{fmtDateTime(t.createdAt)}</td>
                        <td><span className={`type-badge ${t.type}`}>{t.type}</span></td>
                        <td style={{ color: t.amountUsd >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                          {t.amountUsd >= 0 ? '+' : ''}{fmt(t.amountUsd)}
                        </td>
                        <td>{fmt(t.balanceBefore)}</td>
                        <td>{fmt(t.balanceAfter)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminBilling;
