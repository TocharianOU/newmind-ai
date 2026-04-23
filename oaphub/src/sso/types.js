/**
 * SSO Provider Types
 * 定义 SSO provider 的接口和类型
 */

/**
 * @typedef {Object} SSOUserInfo
 * @property {string} providerUserId - Provider 的用户 ID
 * @property {string} email - 用户邮箱
 * @property {string} displayName - 显示名称
 * @property {string} [profilePicture] - 头像 URL
 * @property {Object} [metadata] - 额外的元数据
 */

/**
 * @typedef {Object} SSOConfig
 * @property {boolean} enabled - 是否启用
 * @property {string} clientId - OAuth Client ID
 * @property {string} clientSecret - OAuth Client Secret
 * @property {string} callbackBaseUrl - 回调基础 URL
 * @property {string} [issuer] - OIDC Issuer URL (for generic OIDC)
 * @property {string[]} [scopes] - OAuth scopes
 */

/**
 * Abstract SSO Provider interface
 */
export class SSOProvider {
  /**
   * @param {string} name - Provider name (google, azure, aws, etc.)
   * @param {SSOConfig} config - Provider configuration
   */
  constructor(name, config) {
    if (this.constructor === SSOProvider) {
      throw new Error('SSOProvider is abstract and cannot be instantiated directly');
    }
    this.name = name;
    this.config = config;
  }

  /**
   * Generate authorization URL for OAuth flow
   * @param {string} state - State parameter for CSRF protection
   * @returns {string} Authorization URL
   */
  getAuthorizationUrl(state) {
    throw new Error('getAuthorizationUrl must be implemented');
  }

  /**
   * Exchange authorization code for access token and get user info
   * @param {string} code - Authorization code from callback
   * @returns {Promise<SSOUserInfo>} User information
   */
  async handleCallback(code) {
    throw new Error('handleCallback must be implemented');
  }

  /**
   * Check if provider is enabled
   * @returns {boolean}
   */
  isEnabled() {
    return this.config.enabled === true;
  }

  /**
   * Get callback URL for this provider
   * @returns {string}
   */
  getCallbackUrl() {
    return `${this.config.callbackBaseUrl}/api/auth/sso/${this.name}/callback`;
  }
}

export default SSOProvider;
