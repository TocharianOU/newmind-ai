/**
 * SSO Module Entry Point
 * 初始化并注册所有 SSO providers
 */

import registry from './registry.js';
import { createGoogleProvider } from './providers/google.js';
import { createAzureProvider, createAWSProvider } from './providers/generic-oidc.js';
import { createWeChatWorkProvider } from './providers/wechatwork.js';
import logger from '../utils/logger.js';

/**
 * Initialize all SSO providers based on environment configuration
 */
export function initializeSSOProviders() {
  logger.info('Initializing SSO providers...');

  // Google provider
  try {
    const googleProvider = createGoogleProvider();
    registry.register('google', googleProvider);
  } catch (error) {
    logger.warn('Failed to initialize Google SSO provider:', error.message);
  }

  // Azure provider
  try {
    const azureProvider = createAzureProvider();
    if (azureProvider) {
      registry.register('azure', azureProvider);
    }
  } catch (error) {
    logger.warn('Failed to initialize Azure SSO provider:', error.message);
  }

  // AWS Cognito provider
  try {
    const awsProvider = createAWSProvider();
    if (awsProvider) {
      registry.register('aws', awsProvider);
    }
  } catch (error) {
    logger.warn('Failed to initialize AWS SSO provider:', error.message);
  }

  // WeChatWork (企业微信) provider
  try {
    const wechatWorkProvider = createWeChatWorkProvider();
    if (wechatWorkProvider) {
      registry.register('wechatwork', wechatWorkProvider);
    }
  } catch (error) {
    logger.warn('Failed to initialize WeChatWork SSO provider:', error.message);
  }

  const enabledProviders = registry.getEnabled();
  logger.info(`SSO providers initialized: ${enabledProviders.length} enabled`);
  enabledProviders.forEach(({ name }) => {
    logger.info(`  - ${name}: enabled`);
  });
}

export { registry as ssoRegistry };
export default registry;
