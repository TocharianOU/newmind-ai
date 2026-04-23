/**
 * SSO Provider Registry
 * 管理所有 SSO providers 的注册和获取
 */

import logger from '../utils/logger.js';

class SSORegistry {
  constructor() {
    this.providers = new Map();
  }

  /**
   * Register an SSO provider
   * @param {string} name - Provider name
   * @param {SSOProvider} provider - Provider instance
   */
  register(name, provider) {
    if (this.providers.has(name)) {
      logger.warn(`SSO provider ${name} is already registered, overwriting`);
    }
    this.providers.set(name, provider);
    logger.info(`SSO provider ${name} registered, enabled: ${provider.isEnabled()}`);
  }

  /**
   * Get an SSO provider by name
   * @param {string} name - Provider name
   * @returns {SSOProvider|null}
   */
  get(name) {
    return this.providers.get(name) || null;
  }

  /**
   * Get all enabled providers
   * @returns {Array<{name: string, provider: SSOProvider}>}
   */
  getEnabled() {
    const enabled = [];
    for (const [name, provider] of this.providers.entries()) {
      if (provider.isEnabled()) {
        enabled.push({ name, provider });
      }
    }
    return enabled;
  }

  /**
   * Get all provider names
   * @returns {string[]}
   */
  getAllNames() {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider exists and is enabled
   * @param {string} name - Provider name
   * @returns {boolean}
   */
  isEnabled(name) {
    const provider = this.providers.get(name);
    return provider ? provider.isEnabled() : false;
  }
}

// Singleton instance
const registry = new SSORegistry();

export default registry;
