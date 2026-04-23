import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';

const TIER_COLORS = { A: '#e53e3e', B: '#dd6b20', C: '#38a169' };

const AdminToolStats = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState('30d');
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  useEffect(() => {
    fetchStats();
  }, [range]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/api/v1/user/admin/tool-stats?range=${range}`);
      if (res.data.status === 'success') setStats(res.data.data);
    } catch (err) {
      setError('Failed to load tool stats');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center' }}>Loading...</div>;
  if (error)   return <div style={{ padding: 40, color: '#e53e3e' }}>{error}</div>;

  return (
    <div style={{ padding: '32px', maxWidth: 900, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: '1.6rem', fontWeight: 700 }}>Tool Usage Statistics</h1>
        <select
          value={range}
          onChange={e => setRange(e.target.value)}
          style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      {/* Tier summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {['A', 'B', 'C'].map(tier => {
          const t = stats.byTier.find(r => r.tier === tier);
          return (
            <div key={tier} style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '20px 24px', borderLeft: `4px solid ${TIER_COLORS[tier]}` }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>Tier {tier} Calls</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: TIER_COLORS[tier] }}>{(t?.calls || 0).toLocaleString()}</div>
            </div>
          );
        })}
      </div>

      {/* Quota purchases */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '20px 24px', marginBottom: 28 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 600 }}>Quota Package Purchases ({range})</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Purchases</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.quotaPurchases.count}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Revenue</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>${stats.quotaPurchases.revenue.toFixed(2)}</div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Extra Calls Sold</div>
            <div style={{ fontSize: 22, fontWeight: 700 }}>{stats.quotaPurchases.totalCallsBought.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Per-tool breakdown */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '20px 24px', marginBottom: 28 }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 600 }}>By Tool</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--text-secondary)', fontWeight: 600 }}>Tool</th>
              <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--text-secondary)', fontWeight: 600 }}>Tier</th>
              <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-secondary)', fontWeight: 600 }}>Calls</th>
            </tr>
          </thead>
          <tbody>
            {stats.byTool.map(r => (
              <tr key={r.tool} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '10px 0', fontWeight: 500 }}>{r.tool}</td>
                <td style={{ padding: '10px 0' }}>
                  <span style={{ background: TIER_COLORS[r.tier], color: '#fff', borderRadius: 99, padding: '2px 10px', fontSize: 12, fontWeight: 700 }}>
                    Tier {r.tier}
                  </span>
                </td>
                <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 600 }}>{r.calls.toLocaleString()}</td>
              </tr>
            ))}
            {stats.byTool.length === 0 && (
              <tr><td colSpan={3} style={{ padding: '20px 0', color: 'var(--text-secondary)', textAlign: 'center' }}>No tool calls in this period</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Top users */}
      <div style={{ background: 'var(--bg-secondary)', borderRadius: 12, padding: '20px 24px' }}>
        <h2 style={{ margin: '0 0 16px', fontSize: '1rem', fontWeight: 600 }}>Top Users by Tool Calls</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--text-secondary)', fontWeight: 600 }}>#</th>
              <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--text-secondary)', fontWeight: 600 }}>User</th>
              <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--text-secondary)', fontWeight: 600 }}>Calls</th>
            </tr>
          </thead>
          <tbody>
            {stats.topUsers.map((u, i) => (
              <tr key={u.userId} style={{ borderBottom: '1px solid var(--border-color)' }}>
                <td style={{ padding: '10px 0', color: 'var(--text-secondary)', width: 32 }}>{i + 1}</td>
                <td style={{ padding: '10px 0' }}>
                  <div style={{ fontWeight: 500 }}>{u.username || '—'}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{u.email}</div>
                </td>
                <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 600 }}>{u.calls.toLocaleString()}</td>
              </tr>
            ))}
            {stats.topUsers.length === 0 && (
              <tr><td colSpan={3} style={{ padding: '20px 0', color: 'var(--text-secondary)', textAlign: 'center' }}>No data</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminToolStats;
