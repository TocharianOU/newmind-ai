import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import './Auth.css';

const Register = () => {
  const navigate = useNavigate();
  const { register } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    username: '',
    password: '',
    confirmPassword: '',
    inviteCode: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [inviteCodeRequired, setInviteCodeRequired] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);

  useEffect(() => {
    // Fetch auth config to check if invite code is required
    const fetchConfig = async () => {
      try {
        const response = await api.get('/api/auth/config');
        if (response.data.status === 'success') {
          setInviteCodeRequired(response.data.data.inviteCodeRequired);
        }
      } catch (error) {
        console.error('Failed to fetch auth config:', error);
      } finally {
        setConfigLoading(false);
      }
    };
    
    fetchConfig();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await register(
        formData.email, 
        formData.username, 
        formData.password,
        inviteCodeRequired ? formData.inviteCode : null
      );
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <h1>NewMind Hub</h1>
          <p>Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {error && <div className="auth-error">{error}</div>}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="your@email.com"
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              placeholder="Your name"
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="••••••••"
              autoComplete="new-password"
              minLength="6"
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="••••••••"
              autoComplete="new-password"
            />
          </div>

          {inviteCodeRequired && (
            <div className="form-group">
              <label htmlFor="inviteCode">Invite Code</label>
              <input
                type="text"
                id="inviteCode"
                name="inviteCode"
                value={formData.inviteCode}
                onChange={handleChange}
                required
                placeholder="Enter your invite code"
                autoComplete="off"
              />
            </div>
          )}

          <button
            type="submit"
            className="auth-button"
            disabled={loading || configLoading}
          >
            {loading ? 'Creating account...' : 'Sign up'}
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account?{' '}
            <Link to="/login">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
