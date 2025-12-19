/**
 * Generic OIDC Provider
 * 通用 OIDC provider，支持 Azure AD, AWS Cognito 等标准 OIDC 服务
 */

import { SSOProvider } from '../types.js';
import logger from '../../utils/logger.js';
import { ProxyAgent } from 'undici';

// 创建支持代理和超时的 fetch 配置
// Node.js 原生 fetch 不会自动读取代理环境变量，需要手动配置
function createFetchOptions() {
  const options = {
    // 增加超时时间到 30 秒
    signal: AbortSignal.timeout(30000)
  };

  // 配置代理（如果有）
  const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
  if (proxyUrl) {
    logger.info(`Using proxy for OIDC API requests: ${proxyUrl}`);
    options.dispatcher = new ProxyAgent(proxyUrl);
  }

  return options;
}

export class GenericOIDCProvider extends SSOProvider {
  constructor(name, config) {
    super(name, config);

    if (!config.issuer) {
      throw new Error(`OIDC issuer is required for provider: ${name}`);
    }

    this.issuer = config.issuer;
    this.scopes = config.scopes || ['openid', 'email', 'profile'];

    // OIDC discovery endpoints (will be discovered from .well-known)
    this.authEndpoint = null;
    this.tokenEndpoint = null;
    this.userInfoEndpoint = null;

    // Auto-discover endpoints on initialization
    this.discoveryPromise = this._discoverEndpoints();
  }

  /**
   * Discover OIDC endpoints from .well-known/openid-configuration
   * @private
   */
  async _discoverEndpoints() {
    try {
      const discoveryUrl = `${this.issuer}/.well-known/openid-configuration`;
      logger.info(`Discovering OIDC endpoints for ${this.name}: ${discoveryUrl}`);

      const fetchOptions = createFetchOptions();
      const response = await fetch(discoveryUrl, fetchOptions);
      if (!response.ok) {
        throw new Error(`Failed to discover OIDC endpoints: ${response.status}`);
      }

      const config = await response.json();
      this.authEndpoint = config.authorization_endpoint;
      this.tokenEndpoint = config.token_endpoint;
      this.userInfoEndpoint = config.userinfo_endpoint;

      logger.info(`OIDC endpoints discovered for ${this.name}`);
    } catch (error) {
      logger.error(`OIDC discovery failed for ${this.name}:`, error);
      throw error;
    }
  }

  /**
   * Ensure endpoints are discovered before proceeding
   * @private
   */
  async _ensureDiscovered() {
    if (!this.authEndpoint) {
      await this.discoveryPromise;
    }
  }

  /**
   * Generate OIDC authorization URL
   * @param {string} state - State parameter for CSRF protection
   * @returns {Promise<string>} Authorization URL
   */
  async getAuthorizationUrl(state) {
    await this._ensureDiscovered();

    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.getCallbackUrl(),
      response_type: 'code',
      scope: this.scopes.join(' '),
      state: state
    });

    const url = `${this.authEndpoint}?${params.toString()}`;
    logger.info(`${this.name} auth URL generated for state: ${state}`);
    return url;
  }

  /**
   * Exchange authorization code for access token and get user info
   * @param {string} code - Authorization code from callback
   * @returns {Promise<SSOUserInfo>} User information
   */
  async handleCallback(code) {
    try {
      await this._ensureDiscovered();

      // Step 1: Exchange code for access token
      logger.info(`Exchanging ${this.name} authorization code for access token`);
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
        logger.error(`${this.name} token exchange failed:`, errorText);
        throw new Error(`Failed to exchange code for token: ${tokenResponse.status}`);
      }

      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      const idToken = tokenData.id_token;

      // 🔍 Enhanced logging for debugging
      logger.info(`${this.name} token exchange successful. Token type: ${tokenData.token_type}, Scopes: ${tokenData.scope || 'not specified'}`);
      logger.info(`Access token (first 20 chars): ${accessToken?.substring(0, 20)}...`);
      if (idToken) {
        logger.info(`ID token received (first 20 chars): ${idToken.substring(0, 20)}...`);
      }

      // Step 2: Get user info
      logger.info(`Fetching ${this.name} user info from: ${this.userInfoEndpoint}`);
      const fetchOptions2 = createFetchOptions();
      const userInfoResponse = await fetch(this.userInfoEndpoint, {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        ...fetchOptions2
      });

      if (!userInfoResponse.ok) {
        const errorText = await userInfoResponse.text();
        logger.error(`${this.name} userinfo request failed (${userInfoResponse.status}):`, errorText);
        logger.error(`UserInfo endpoint: ${this.userInfoEndpoint}`);
        logger.error(`Token scopes from response: ${tokenData.scope || 'none'}`);
        throw new Error(`Failed to fetch user info: ${userInfoResponse.status} - ${errorText}`);
      }

      const userInfo = await userInfoResponse.json();
      logger.info(`${this.name} user info retrieved: ${userInfo.email || userInfo.sub}`);

      // Step 3: Map to our SSOUserInfo format (standardized OIDC claims)
      return {
        providerUserId: userInfo.sub, // 'sub' is the standard OIDC user identifier
        email: userInfo.email || null,
        displayName: userInfo.name || userInfo.preferred_username || userInfo.email?.split('@')[0] || 'User',
        profilePicture: userInfo.picture || null,
        metadata: {
          ...userInfo,
          provider: this.name
        }
      };
    } catch (error) {
      logger.error(`${this.name} SSO callback error:`, error);
      throw error;
    }
  }
}

/**
 * Create Azure AD provider from environment variables
 * @returns {GenericOIDCProvider|null}
 */
export function createAzureProvider() {
  const enabled = process.env.SSO_AZURE_ENABLED === 'true';
  if (!enabled) return null;

  const tenantId = process.env.SSO_AZURE_TENANT_ID || 'common';
  const config = {
    enabled: true,
    clientId: process.env.SSO_AZURE_CLIENT_ID,
    clientSecret: process.env.SSO_AZURE_CLIENT_SECRET,
    callbackBaseUrl: process.env.SSO_CALLBACK_BASE_URL || 'http://localhost:23000',
    issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
    scopes: process.env.SSO_AZURE_SCOPES
      ? process.env.SSO_AZURE_SCOPES.split(',')
      : ['openid', 'email', 'profile']
  };

  return new GenericOIDCProvider('azure', config);
}

/**
 * Create AWS Cognito provider from environment variables
 * @returns {GenericOIDCProvider|null}
 */
export function createAWSProvider() {
  const enabled = process.env.SSO_AWS_ENABLED === 'true';
  if (!enabled) return null;

  const config = {
    enabled: true,
    clientId: process.env.SSO_AWS_CLIENT_ID,
    clientSecret: process.env.SSO_AWS_CLIENT_SECRET,
    callbackBaseUrl: process.env.SSO_CALLBACK_BASE_URL || 'http://localhost:23000',
    issuer: process.env.SSO_AWS_ISSUER, // e.g., https://cognito-idp.us-east-1.amazonaws.com/us-east-1_xxxxx
    scopes: process.env.SSO_AWS_SCOPES
      ? process.env.SSO_AWS_SCOPES.split(',')
      : ['openid', 'email', 'profile']
  };

  return new GenericOIDCProvider('aws', config);
}

export default GenericOIDCProvider;
