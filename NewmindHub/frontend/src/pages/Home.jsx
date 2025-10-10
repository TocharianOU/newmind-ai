import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import api from '../config/api';
import './Home.css';

const Home = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [downloadUrls, setDownloadUrls] = useState({
    windows: { x64: '' },
    macos: { intel: '', appleSilicon: '' },
    linux: { x64: '', arm64: '' }
  });
  const [detected, setDetected] = useState({ os: 'unknown', arch: 'x64' });
  const [loading, setLoading] = useState(true);

  // Redirect to dashboard if already logged in
  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Detect user's platform and architecture
  useEffect(() => {
    const detectPlatform = () => {
      const ua = navigator.userAgent;
      const platform = navigator.platform;
      
      let os = 'unknown';
      let arch = 'x64';
      
      if (ua.includes('Win')) {
        os = 'windows';
      } else if (ua.includes('Mac')) {
        os = 'macos';
        // Detect Apple Silicon
        if (platform.includes('arm') || platform.includes('ARM')) {
          arch = 'appleSilicon';
        } else {
          arch = 'intel';
        }
      } else if (ua.includes('Linux')) {
        os = 'linux';
      }
      
      return { os, arch };
    };

    setDetected(detectPlatform());
  }, []);

  // Fetch download configuration
  useEffect(() => {
    const fetchDownloadConfig = async () => {
      try {
        const response = await api.get('/api/auth/download-config');
        if (response.data.status === 'success') {
          setDownloadUrls(response.data.data);
        }
      } catch (error) {
        console.error('Failed to fetch download config:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDownloadConfig();
  }, []);

  const handleDownload = (platform, arch) => {
    let url = '';
    
    if (platform === 'windows') {
      url = downloadUrls.windows.x64;
    } else if (platform === 'macos') {
      url = downloadUrls.macos[arch];
    } else if (platform === 'linux') {
      url = downloadUrls.linux[arch];
    }

    if (url) {
      window.location.href = url;
    }
  };

  const isRecommended = (platform, arch) => {
    return detected.os === platform && (platform !== 'macos' || detected.arch === arch);
  };

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">Welcome to NewmindChat</h1>
          <p className="hero-subtitle">Your AI-Powered Conversation Assistant</p>
          <p className="hero-description">
            Experience seamless AI interactions with powerful features and intuitive design
          </p>
          <div className="hero-actions">
            <Link to="/register" className="btn btn-primary">Get Started</Link>
            <Link to="/login" className="btn btn-secondary">Sign In</Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <h2 className="section-title">Why Choose NewmindChat?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <div className="feature-icon">💬</div>
            <h3>AI Conversations</h3>
            <p>Engage in natural, intelligent conversations powered by advanced AI models</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🤖</div>
            <h3>Multiple Models</h3>
            <p>Access various AI models including Claude, GPT, and more in one place</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">🔧</div>
            <h3>MCP Integration</h3>
            <p>Extend functionality with Model Context Protocol tool integrations</p>
          </div>
          <div className="feature-card">
            <div className="feature-icon">☁️</div>
            <h3>Cloud Sync</h3>
            <p>Access your conversation history across all your devices seamlessly</p>
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section className="download-section">
        <h2 className="section-title">Download NewmindChat</h2>
        <p className="section-subtitle">Choose your platform</p>
        
        {loading ? (
          <div className="loading">Loading download options...</div>
        ) : (
          <div className="download-grid">
            {/* Windows */}
            <div className="platform-card">
              <div className="platform-header">
                <div className="platform-icon windows-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
                  </svg>
                </div>
                <h3>Windows</h3>
              </div>
              <button
                className={`download-btn ${isRecommended('windows', 'x64') ? 'recommended' : ''}`}
                onClick={() => handleDownload('windows', 'x64')}
                disabled={!downloadUrls.windows.x64}
              >
                {isRecommended('windows', 'x64') && <span className="badge">Recommended</span>}
                <span className="btn-text">Download for Windows</span>
                <span className="btn-arch">x64</span>
              </button>
            </div>

            {/* macOS */}
            <div className="platform-card">
              <div className="platform-header">
                <div className="platform-icon macos-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                  </svg>
                </div>
                <h3>macOS</h3>
              </div>
              <button
                className={`download-btn ${isRecommended('macos', 'appleSilicon') ? 'recommended' : ''}`}
                onClick={() => handleDownload('macos', 'appleSilicon')}
                disabled={!downloadUrls.macos.appleSilicon}
              >
                {isRecommended('macos', 'appleSilicon') && <span className="badge">Recommended</span>}
                <span className="btn-text">Apple Silicon</span>
                <span className="btn-arch">ARM64</span>
              </button>
              <button
                className={`download-btn ${isRecommended('macos', 'intel') ? 'recommended' : ''}`}
                onClick={() => handleDownload('macos', 'intel')}
                disabled={!downloadUrls.macos.intel}
              >
                {isRecommended('macos', 'intel') && <span className="badge">Recommended</span>}
                <span className="btn-text">Intel Mac</span>
                <span className="btn-arch">x64</span>
              </button>
            </div>

            {/* Linux */}
            <div className="platform-card">
              <div className="platform-header">
                <div className="platform-icon linux-icon">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489.109.716.405 1.416.9 1.932 1.378 1.436 3.336 1.308 5.234 1.107 1.903-.201 3.882-.411 5.785-.617.926-.101 1.832-.204 2.633-.471.801-.267 1.513-.678 1.948-1.375.436-.697.598-1.641.598-2.485 0-.844-.162-1.788-.598-2.485-.435-.697-1.147-1.108-1.948-1.375-.801-.267-1.707-.37-2.633-.471-1.903-.206-3.882-.416-5.785-.617-1.898-.201-3.856-.329-5.234 1.107-.495.516-.791 1.216-.9 1.932-.123.805.009 1.657.287 2.489.589 1.771 1.831 3.47 2.716 4.521.75 1.067.974 1.928 1.05 3.02.065 1.491-1.056 5.965 3.17 6.298.165.013.325.021.48.021 4.226 0 3.105-4.807 3.17-6.298.076-1.092.3-1.953 1.05-3.02.885-1.051 2.127-2.75 2.716-4.521.278-.832.41-1.684.287-2.489-.109-.716-.405-1.416-.9-1.932-1.378-1.436-3.336-1.308-5.234-1.107-1.903.201-3.882.411-5.785.617-.926.101-1.832.204-2.633.471-.801.267-1.513.678-1.948 1.375-.436.697-.598 1.641-.598 2.485s.162 1.788.598 2.485c.435.697 1.147 1.108 1.948 1.375.801.267 1.707.37 2.633.471 1.903.206 3.882.416 5.785.617 1.898.201 3.856.329 5.234-1.107.495-.516.791-1.216.9-1.932.123-.805-.009-1.657-.287-2.489-.589-1.771-1.831-3.47-2.716-4.521-.75-1.067-.974-1.928-1.05-3.02-.065-1.491 1.056-5.965-3.17-6.298-.165-.013-.325-.021-.48-.021z"/>
                  </svg>
                </div>
                <h3>Linux</h3>
              </div>
              <button
                className={`download-btn ${isRecommended('linux', 'x64') ? 'recommended' : ''}`}
                onClick={() => handleDownload('linux', 'x64')}
                disabled={!downloadUrls.linux.x64}
              >
                {isRecommended('linux', 'x64') && <span className="badge">Recommended</span>}
                <span className="btn-text">Linux x64</span>
                <span className="btn-arch">x86_64</span>
              </button>
              <button
                className="download-btn"
                onClick={() => handleDownload('linux', 'arm64')}
                disabled={!downloadUrls.linux.arm64}
              >
                <span className="btn-text">Linux ARM64</span>
                <span className="btn-arch">aarch64</span>
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="footer-content">
          <p>&copy; 2025 NewmindChat. All rights reserved.</p>
          <div className="footer-links">
            <Link to="/login">Sign In</Link>
            <span className="separator">·</span>
            <Link to="/register">Sign Up</Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;

