/**
 * OAuth配置模块
 * 解析ENV环境变量，返回启用的OAuth提供商配置
 */

/**
 * 获取OAuth配置
 * @returns {Object} OAuth配置对象
 */
export function getOAuthConfig() {
  const config = {
    enabled: process.env.OAUTH_ENABLED === 'true',
    brandText: process.env.OAUTH_BRAND_TEXT || '',
    providers: []
  };

  // Google OAuth
  if (process.env.OAUTH_GOOGLE_ENABLED === 'true') {
    config.providers.push({
      name: 'google',
      displayName: 'Google',
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.OAUTH_CALLBACK_BASE_URL}/api/v1/auth/google/callback`,
      scope: ['profile', 'email']
    });
  }

  // Microsoft OAuth
  if (process.env.OAUTH_MICROSOFT_ENABLED === 'true') {
    config.providers.push({
      name: 'microsoft',
      displayName: 'Microsoft',
      clientID: process.env.MICROSOFT_CLIENT_ID,
      clientSecret: process.env.MICROSOFT_CLIENT_SECRET,
      callbackURL: `${process.env.OAUTH_CALLBACK_BASE_URL}/api/v1/auth/microsoft/callback`,
      tenant: process.env.MICROSOFT_TENANT_ID || 'common',
      scope: ['user.read']
    });
  }

  // GitHub OAuth
  if (process.env.OAUTH_GITHUB_ENABLED === 'true') {
    config.providers.push({
      name: 'github',
      displayName: 'GitHub',
      clientID: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
      callbackURL: `${process.env.OAUTH_CALLBACK_BASE_URL}/api/v1/auth/github/callback`,
      scope: ['user:email']
    });
  }

  // GitLab OAuth
  if (process.env.OAUTH_GITLAB_ENABLED === 'true') {
    config.providers.push({
      name: 'gitlab',
      displayName: 'GitLab',
      clientID: process.env.GITLAB_CLIENT_ID,
      clientSecret: process.env.GITLAB_CLIENT_SECRET,
      callbackURL: `${process.env.OAUTH_CALLBACK_BASE_URL}/api/v1/auth/gitlab/callback`,
      baseURL: process.env.GITLAB_URL || 'https://gitlab.com',
      scope: ['read_user']
    });
  }

  return config;
}

/**
 * 获取指定提供商的scope
 * @param {string} provider - 提供商名称
 * @returns {Array} scope数组
 */
export function getProviderScope(provider) {
  const scopes = {
    google: ['profile', 'email'],
    microsoft: ['user.read'],
    github: ['user:email'],
    gitlab: ['read_user']
  };

  return scopes[provider] || [];
}

/**
 * 检查OAuth功能是否启用
 * @returns {boolean}
 */
export function isOAuthEnabled() {
  return process.env.OAUTH_ENABLED === 'true';
}

/**
 * 获取提供商配置（不包含敏感信息）
 * @returns {Array} 提供商列表
 */
export function getPublicProviderList() {
  const config = getOAuthConfig();
  return config.providers.map(p => ({
    name: p.name,
    displayName: p.displayName
  }));
}

