/**
 * Google SSO Provider
 * 实现 Google OAuth 2.0 / OIDC 登录
 */

import { SSOProvider } from '../types.js';
import logger from '../../utils/logger.js';
import { ProxyAgent } from 'undici';

// 创建支持代理的 fetch 配置
// Node.js 原生 fetch 不会自动读取代理环境变量，需要手动配置
function createFetchOptions() {
  const options = {
    // 增加超时时间到 30 秒
    signal: AbortSignal.timeout(30000)
  };

  // 配置代理（如果有）
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxyUrl) {
    logger.info(`Using proxy for Google API requests: ${proxyUrl}`);
    options.dispatcher = new ProxyAgent(proxyUrl);
  }

  return options;
}

export class GoogleSSOProvider extends SSOProvider {
  constructor(config) {
    super('google', config);

    // Google OAuth endpoints
    this.authEndpoint = 'https://accounts.google.com/o/oauth2/v2/auth';
    this.tokenEndpoint = 'https://oauth2.googleapis.com/token';
    this.userInfoEndpoint = 'https://www.googleapis.com/oauth2/v2/userinfo';

    // Default scopes
    this.scopes = config.scopes || [
      'openid',
      'email',
      'profile'
    ];
  }

  /**
   * Generate Google OAuth authorization URL
   * @param {string} state - State parameter for CSRF protection
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl(state) {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.getCallbackUrl(),
      response_type: 'code',
      scope: this.scopes.join(' '),
      state: state,
      access_type: 'online', // or 'offline' if refresh token needed
      prompt: 'select_account' // Always show account selection
    });

    const url = `${this.authEndpoint}?${params.toString()}`;
    logger.info(`Google auth URL generated for state: ${state}`);
    return url;
  }

  /**
   * Exchange authorization code for access token and get user info
   * @param {string} code - Authorization code from callback
   * @returns {Promise<SSOUserInfo>} User information
   */
  async handleCallback(code) {
    try {
      // Step 1: Exchange code for access token
      logger.info('Exchanging Google authorization code for access token');
      logger.info(`Token endpoint: ${this.tokenEndpoint}`);

      const fetchOptions = createFetchOptions();
      const tokenResponse = await fetch(this.tokenEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code: code,
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          redirect_uri: this.getCallbackUrl(),
          grant_type: 'authorization_code'
        }).toString(),
        ...fetchOptions
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        logger.error('Google token exchange failed:', errorText);
        throw new Error(`Failed to exchange code for token: ${tokenResponse.status}`);
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      // Step 2: Get user info
      logger.info('Fetching Google user info');
      const fetchOptions2 = createFetchOptions();
      const userInfoResponse = await fetch(this.userInfoEndpoint, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        ...fetchOptions2
      });

      if (!userInfoResponse.ok) {
        throw new Error(`Failed to fetch user info: ${userInfoResponse.status}`);
      }

      const userInfo = await userInfoResponse.json();
      logger.info(`Google user info retrieved: ${userInfo.email}`);

      // Step 3: Map to our SSOUserInfo format
      return {
        providerUserId: userInfo.id,
        email: userInfo.email,
        displayName: userInfo.name || userInfo.email.split('@')[0],
        profilePicture: userInfo.picture,
        metadata: {
          verified_email: userInfo.verified_email,
          locale: userInfo.locale,
          given_name: userInfo.given_name,
          family_name: userInfo.family_name
        }
      };
    } catch (error) {
      logger.error('Google SSO callback error:', error);
      throw error;
    }
  }
}

/**
 * Create Google provider from environment variables
 * @returns {GoogleSSOProvider}
 */
export function createGoogleProvider() {
  const config = {
    enabled: process.env.SSO_GOOGLE_ENABLED === 'true',
    clientId: process.env.SSO_GOOGLE_CLIENT_ID,
    clientSecret: process.env.SSO_GOOGLE_CLIENT_SECRET,
    callbackBaseUrl: process.env.SSO_CALLBACK_BASE_URL || 'http://localhost:23000',
    scopes: process.env.SSO_GOOGLE_SCOPES
      ? process.env.SSO_GOOGLE_SCOPES.split(',')
      : undefined
  };

  return new GoogleSSOProvider(config);
}

export default GoogleSSOProvider;
