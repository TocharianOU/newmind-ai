import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../config/api';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './AdminStats.css';

const AdminStats = () => {
  const { user } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [range, setRange] = useState('30d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userStats, setUserStats] = useState(null);
  const [userStatsLoading, setUserStatsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Authorization check
  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      navigate('/dashboard', { replace: true });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (user?.role === 'ADMIN') {
      fetchData();
      fetchUsers();
    }
  }, [range, user]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get(`/api/v1/user/admin/stats?range=${range}`);

      if (response.data.status === 'success') {
        setStats(response.data.data);
      } else {
        setError(response.data.message || '加载数据失败');
      }
    } catch (error) {
      console.error('Error fetching admin stats:', error);
      if (error.response?.status === 403) {
        navigate('/dashboard', { replace: true });
      } else {
        setError('加载管理员统计数据失败');
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const response = await api.get('/api/v1/user/admin/users');
      if (response.data.status === 'success') {
        setUsers(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const fetchUserStats = async (userId) => {
    setUserStatsLoading(true);
    try {
      const response = await api.get(`/api/v1/user/admin/users/${userId}/stats?range=${range}`);
      if (response.data.status === 'success') {
        setUserStats(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching user stats:', error);
    } finally {
      setUserStatsLoading(false);
    }
  };

  const handleUserClick = (clickedUser) => {
    setSelectedUser(clickedUser);
    fetchUserStats(clickedUser.id);
  };

  const closeUserModal = () => {
    setSelectedUser(null);
    setUserStats(null);
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatNumber = (num) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading) {
    return (
      <div className="admin-stats-loading">
        <div className="spinner"></div>
        <p>加载管理员统计数据...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-stats-error">
        <p>{error}</p>
        <button onClick={fetchData}>重试</button>
      </div>
    );
  }

  return (
    <div className="admin-stats">
      <div className="admin-stats-header">
        <div>
          <h1>企业管理统计</h1>
          <p className="subtitle">全平台用户使用概览</p>
        </div>

        <div className="range-selector">
          <button
            className={range === '7d' ? 'active' : ''}
            onClick={() => setRange('7d')}
          >
            最近7天
          </button>
          <button
            className={range === '30d' ? 'active' : ''}
            onClick={() => setRange('30d')}
          >
            最近30天
          </button>
          <button
            className={range === '90d' ? 'active' : ''}
            onClick={() => setRange('90d')}
          >
            最近90天
          </button>
          <button
            className={range === 'all' ? 'active' : ''}
            onClick={() => setRange('all')}
          >
            全部
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon registered-users">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="stat-content">
            <h3>{formatNumber(stats?.totalUsers || 0)}</h3>
            <p>注册用户总数</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon total-calls">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="stat-content">
            <h3>{formatNumber(stats?.summary?.totalCalls || 0)}</h3>
            <p>API 调用总数</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon total-tokens">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="stat-content">
            <h3>{formatNumber(stats?.summary?.totalTokens || 0)}</h3>
            <p>Token 使用总量</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon avg-tokens">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="stat-content">
            <h3>{formatNumber(stats?.summary?.averageTokensPerCall || 0)}</h3>
            <p>平均每次调用 Token 数</p>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="charts-grid">
        {stats?.dailyUsage && stats.dailyUsage.length > 0 && (
          <div className="chart-card">
            <h2>每日 Token 使用趋势</h2>
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
                  name="Tokens"
                  stroke="#667eea"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {stats?.modelStats && stats.modelStats.length > 0 && (
          <div className="chart-card">
            <h2>模型使用分布</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={stats.modelStats}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="model" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar
                  dataKey="totalTokens"
                  name="总 Token 数"
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
          <h2>模型使用详细统计</h2>
          <div className="table-container">
            <table className="stats-table">
              <thead>
                <tr>
                  <th>模型名称</th>
                  <th>调用次数</th>
                  <th>输入 Token</th>
                  <th>输出 Token</th>
                  <th>总 Token 数</th>
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

      {/* Additional Info */}
      <div className="info-card">
        <div className="info-row">
          <span className="info-label">统计时间范围:</span>
          <span className="info-value">
            {new Date(stats?.startDate).toLocaleDateString('zh-CN')} - {new Date(stats?.endDate).toLocaleDateString('zh-CN')}
          </span>
        </div>
        <div className="info-row">
          <span className="info-label">输入 Token 总数:</span>
          <span className="info-value">{formatNumber(stats?.summary?.totalInputTokens || 0)}</span>
        </div>
        <div className="info-row">
          <span className="info-label">输出 Token 总数:</span>
          <span className="info-value">{formatNumber(stats?.summary?.totalOutputTokens || 0)}</span>
        </div>
      </div>

      {/* Users List */}
      <div className="table-card">
        <div className="table-card-header">
          <h2>注册用户列表</h2>
          <div className="search-box">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <input
              type="text"
              placeholder="搜索用户（邮箱或用户名）..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
        <div className="table-container">
          <table className="stats-table users-table">
            <thead>
              <tr>
                <th>用户</th>
                <th>邮箱</th>
                <th>套餐</th>
                <th>注册时间</th>
                <th>近30天调用</th>
                <th>近30天Token</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="user-cell">
                      {u.picture ? (
                        <img src={u.picture} alt={u.username} className="user-avatar-small" />
                      ) : (
                        <div className="user-avatar-small">
                          {u.username?.charAt(0).toUpperCase() || u.email.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <span className="user-name">{u.username || '未设置'}</span>
                    </div>
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`plan-badge ${u.subscription?.planName || 'BASE'}`}>
                      {u.subscription?.planName || 'BASE'}
                    </span>
                  </td>
                  <td>{new Date(u.createdAt).toLocaleDateString('zh-CN')}</td>
                  <td>{formatNumber(u.usage30d?.calls || 0)}</td>
                  <td>{formatNumber(u.usage30d?.totalTokens || 0)}</td>
                  <td>
                    <button
                      className="view-details-btn"
                      onClick={() => handleUserClick(u)}
                    >
                      查看详情
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Details Modal */}
      {selectedUser && (
        <div className="modal-overlay" onClick={closeUserModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-user-info">
                {selectedUser.picture ? (
                  <img src={selectedUser.picture} alt={selectedUser.username} className="modal-user-avatar" />
                ) : (
                  <div className="modal-user-avatar">
                    {selectedUser.username?.charAt(0).toUpperCase() || selectedUser.email.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h2>{selectedUser.username || '未设置用户名'}</h2>
                  <p>{selectedUser.email}</p>
                </div>
              </div>
              <button className="modal-close" onClick={closeUserModal}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>

            {userStatsLoading ? (
              <div className="modal-loading">
                <div className="spinner"></div>
                <p>加载用户统计数据...</p>
              </div>
            ) : userStats ? (
              <div className="modal-body">
                {/* User Info */}
                <div className="user-details-grid">
                  <div className="user-detail-item">
                    <span className="detail-label">套餐:</span>
                    <span className={`plan-badge ${userStats.user.subscription?.planName || 'BASE'}`}>
                      {userStats.user.subscription?.planName || 'BASE'}
                    </span>
                  </div>
                  <div className="user-detail-item">
                    <span className="detail-label">团队:</span>
                    <span>{userStats.user.team || '未设置'}</span>
                  </div>
                  <div className="user-detail-item">
                    <span className="detail-label">注册时间:</span>
                    <span>{new Date(userStats.user.createdAt).toLocaleDateString('zh-CN')}</span>
                  </div>
                </div>

                {/* Stats Cards */}
                <div className="modal-stats-grid">
                  <div className="modal-stat-card">
                    <h4>{formatNumber(userStats.summary.totalCalls)}</h4>
                    <p>总调用次数</p>
                  </div>
                  <div className="modal-stat-card">
                    <h4>{formatNumber(userStats.summary.totalTokens)}</h4>
                    <p>总 Token 数</p>
                  </div>
                  <div className="modal-stat-card">
                    <h4>{formatNumber(userStats.summary.averageTokensPerCall)}</h4>
                    <p>平均每次 Token</p>
                  </div>
                </div>

                {/* Charts */}
                {userStats.dailyUsage && userStats.dailyUsage.length > 0 && (
                  <div className="modal-chart">
                    <h3>每日使用趋势</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={userStats.dailyUsage}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="tokens"
                          name="Tokens"
                          stroke="#667eea"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Model Stats */}
                {userStats.modelStats && userStats.modelStats.length > 0 && (
                  <div className="modal-table">
                    <h3>模型使用详情</h3>
                    <table className="stats-table">
                      <thead>
                        <tr>
                          <th>模型</th>
                          <th>调用次数</th>
                          <th>输入 Token</th>
                          <th>输出 Token</th>
                          <th>总 Token</th>
                        </tr>
                      </thead>
                      <tbody>
                        {userStats.modelStats.map((model) => (
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
                )}
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminStats;
