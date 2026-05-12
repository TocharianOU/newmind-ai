import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import api from '../config/api';
import './Home.css';

const Home = () => {
  const { user } = useAuth();
  const { t, language, changeLanguage } = useLanguage();
  const [downloadPackages, setDownloadPackages] = useState([]);
  const [inviteCode, setInviteCode] = useState('');
  const [downloadError, setDownloadError] = useState('');
  const [activeDownload, setActiveDownload] = useState('');

  const appEntry = user ? '/dashboard' : '/login';

  // Scroll to download section if hash is present
  useEffect(() => {
    if (window.location.hash === '#download') {
      setTimeout(() => {
        const downloadSection = document.getElementById('download');
        if (downloadSection) {
          downloadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    }
  }, []);

  // Fetch the packages currently published by the Hub backend.
  useEffect(() => {
    const fetchDownloadConfig = async () => {
      try {
        const response = await api.get('/api/auth/download-config');
        if (response?.data?.status === 'success' && response.data.data?.packages) {
          setDownloadPackages(response.data.data.packages);
        }
      } catch (_error) {
        setDownloadPackages([]);
      }
    };

    fetchDownloadConfig();
  }, []);

  const label = {
    downloadTitle: language === 'zh' ? '客户部署包下载' : 'Customer Deployment Downloads',
    downloadSubtitle: language === 'zh'
      ? '选择 Docker 或 Kubernetes 安装包。下载需要邀请码。'
      : 'Choose a Docker or Kubernetes package. Downloads require an invite code.',
    invitePlaceholder: language === 'zh' ? '输入邀请码' : 'Enter invite code',
    docker: language === 'zh' ? 'Docker 快速部署' : 'Docker Quick Deploy',
    kubernetes: language === 'zh' ? 'Kubernetes 部署' : 'Kubernetes Deploy',
    dockerDesc: language === 'zh'
      ? '离线 Docker Compose 包，适合单机或测试环境。'
      : 'Offline Docker Compose bundle for single-node or trial environments.',
    kubernetesDesc: language === 'zh'
      ? 'Kubernetes manifests 和镜像包，适合集群环境。'
      : 'Kubernetes manifests and image bundle for cluster environments.',
    unavailable: language === 'zh' ? '暂未发布' : 'Not published yet',
    preparing: language === 'zh' ? '正在准备下载...' : 'Preparing download...',
    downloading: language === 'zh' ? '下载中...' : 'Downloading...',
    download: language === 'zh' ? '下载' : 'Download',
    downloadPackages: language === 'zh' ? '下载部署包' : 'Download Packages',
    documentation: language === 'zh' ? '部署文档' : 'Documentation',
    officialHome: language === 'zh' ? '官网首页' : 'Home',
    consoleEntry: language === 'zh' ? '进入控制台' : 'Open Console',
    dataFlow: language === 'zh' ? '数据接入' : 'Data',
    modelFlow: language === 'zh' ? '模型编排' : 'Models',
    toolFlow: language === 'zh' ? '工具调用' : 'Tools',
    answerFlow: language === 'zh' ? '问数决策' : 'Answers',
    file: language === 'zh' ? '文件' : 'File',
    size: language === 'zh' ? '大小' : 'Size',
    checksum: language === 'zh' ? '校验文件已生成' : 'Checksum available',
    guide: language === 'zh' ? '包内包含 DEPLOY.md、一键 install.sh 和默认 .env 示例。' : 'Each package includes DEPLOY.md, install.sh, and a ready-to-edit .env example.',
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return language === 'zh' ? '待发布' : 'Pending';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex += 1;
    }

    return `${size.toFixed(size >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
  };

  const getPackage = (id) => downloadPackages.find(item => item.id === id);
  const dockerPackages = [
    getPackage('docker-x86_64') || { id: 'docker-x86_64', architecture: 'x86_64', fileName: 'oaphub-docker-x86_64.tar.gz', available: false },
    getPackage('docker-arm64') || { id: 'docker-arm64', architecture: 'arm64', fileName: 'oaphub-docker-arm64.tar.gz', available: false },
  ];
  const kubernetesPackage = getPackage('kubernetes-standard') || {
    id: 'kubernetes-standard',
    architecture: 'multi-arch',
    fileName: 'oaphub-kubernetes-standard.tar.gz',
    available: false,
  };

  const downloadPackage = (packageId) => {
    setDownloadError('');

    if (!inviteCode.trim()) {
      setDownloadError(language === 'zh' ? '请输入邀请码后再下载。' : 'Enter an invite code before downloading.');
      return;
    }

    setActiveDownload(packageId);
    const query = new URLSearchParams({
      inviteCode: inviteCode.trim(),
      packageId,
    });
    window.location.href = `/api/auth/download?${query.toString()}`;
    window.setTimeout(() => setActiveDownload(''), 2500);
  };

  const renderPackageButton = (pkg) => {
    const busy = activeDownload === pkg.id;

    return (
      <button
        key={pkg.id}
        className="download-btn"
        onClick={() => downloadPackage(pkg.id)}
        disabled={!pkg.available || Boolean(activeDownload)}
      >
        <span className="btn-text">{pkg.title || pkg.architecture}</span>
        <span className="btn-arch">
          {pkg.available ? (busy ? label.preparing : label.download) : label.unavailable}
        </span>
      </button>
    );
  };

  return (
    <div className="home-page">
      <header className="home-nav">
        <Link to="/" className="home-nav-brand">
          <img src={`${import.meta.env.BASE_URL}image/logo_oap.svg`} alt="OAP Logo" />
          <span>OAP Platform</span>
        </Link>
        <nav className="home-nav-links">
          <Link to="/">{label.officialHome}</Link>
          <Link to="/documentation">{label.documentation}</Link>
          <a href="#download">{label.downloadPackages}</a>
          <Link to={appEntry}>{label.consoleEntry}</Link>
        </nav>
        <div className="language-switcher">
          <button
            className={`lang-btn ${language === 'en' ? 'active' : ''}`}
            onClick={() => changeLanguage('en')}
          >
            English
          </button>
          <button
            className={`lang-btn ${language === 'zh' ? 'active' : ''}`}
            onClick={() => changeLanguage('zh')}
          >
            中文
          </button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">{t('home.heroTitle')}</h1>
          <p className="hero-subtitle">{t('home.heroSubtitle')}</p>
          <p className="hero-description">
            {t('home.heroDescription')}
          </p>
          <div className="hero-actions">
            <Link to={appEntry} className="btn btn-primary">{label.consoleEntry}</Link>
            <Link to="/documentation" className="btn btn-secondary">{label.documentation}</Link>
            <a href="#download" className="btn btn-secondary">{label.downloadPackages}</a>
          </div>
        </div>
        <div className="hero-visual">
          <div className="flow-line">
            <span>{label.dataFlow}</span>
            <span>{label.modelFlow}</span>
            <span>{label.toolFlow}</span>
            <span>{label.answerFlow}</span>
          </div>
          <div className="query-panel">
            <div className="query-row">
              <span>{language === 'zh' ? '业务问题' : 'Business Question'}</span>
              <strong>{language === 'zh' ? '本周异常订单来自哪里？' : 'Where did this week\'s order anomaly come from?'}</strong>
            </div>
            <div className="query-row">
              <span>{language === 'zh' ? 'Agent 响应' : 'Agent Response'}</span>
              <strong>{language === 'zh' ? '已关联数据、指标和工具链路' : 'Data, metrics, and tools are linked'}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features-section">
        <h2 className="section-title">{t('home.whyChoose')}</h2>
        <div className="feature-lines">
          <div className="feature-line">
            <div className="feature-icon">01</div>
            <div>
              <h3>{t('home.feature1Title')}</h3>
              <p>{t('home.feature1Desc')}</p>
            </div>
          </div>
          <div className="feature-line">
            <div className="feature-icon">02</div>
            <div>
              <h3>{t('home.feature2Title')}</h3>
              <p>{t('home.feature2Desc')}</p>
            </div>
          </div>
          <div className="feature-line">
            <div className="feature-icon">03</div>
            <div>
              <h3>{t('home.feature3Title')}</h3>
              <p>{t('home.feature3Desc')}</p>
            </div>
          </div>
          <div className="feature-line">
            <div className="feature-icon">04</div>
            <div>
              <h3>{t('home.feature4Title')}</h3>
              <p>{t('home.feature4Desc')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Download Section */}
      <section id="download" className="download-section">
        <h2 className="section-title">{label.downloadTitle}</h2>
        <p className="section-subtitle">{label.downloadSubtitle}</p>

        <div className="invite-download-form">
          <input
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
            placeholder={label.invitePlaceholder}
            type="password"
          />
          {downloadError && <div className="download-error">{downloadError}</div>}
        </div>

        <div className="download-panel">
          <div className="platform-block">
            <div className="platform-header">
              <div className="platform-icon">D</div>
              <div>
                <h3>{label.docker}</h3>
                <p>{label.dockerDesc}</p>
              </div>
            </div>
            <div className="package-list">
              {dockerPackages.map(pkg => (
                <div key={pkg.id} className="package-row">
                  <div className="package-info">
                    <span className="package-arch">{pkg.architecture}</span>
                    <span className="package-file">{label.file}: {pkg.fileName}</span>
                    <span className="package-file">{label.size}: {formatFileSize(pkg.fileSize)}</span>
                    {pkg.checksumAvailable && <span className="package-checksum">{label.checksum}</span>}
                  </div>
                  {renderPackageButton(pkg)}
                </div>
              ))}
            </div>
          </div>

          <div className="platform-block">
            <div className="platform-header">
              <div className="platform-icon">K8s</div>
              <div>
                <h3>{label.kubernetes}</h3>
                <p>{label.kubernetesDesc}</p>
              </div>
            </div>
            <div className="package-list">
              <div className="package-row">
                <div className="package-info">
                  <span className="package-arch">{kubernetesPackage.architecture}</span>
                  <span className="package-file">{label.file}: {kubernetesPackage.fileName}</span>
                  <span className="package-file">{label.size}: {formatFileSize(kubernetesPackage.fileSize)}</span>
                  {kubernetesPackage.checksumAvailable && <span className="package-checksum">{label.checksum}</span>}
                </div>
                {renderPackageButton(kubernetesPackage)}
              </div>
            </div>
          </div>
        </div>

        <p className="download-guide">{label.guide}</p>
      </section>

      {/* Footer */}
      <footer className="home-footer">
        <div className="footer-content">
          <p>{t('home.copyright')}</p>
          <div className="footer-links">
            <Link to="/login">{t('home.signIn')}</Link>
            <span className="separator">·</span>
            <Link to="/register">{t('home.getStarted')}</Link>
            <span className="separator">·</span>
            <Link to="/documentation">
              {t('common.documentation')}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Home;

