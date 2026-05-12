/**
 * 硬编码配置文件
 * 用于统一管理邀请码、下载地址等配置，避免环境变量不一致导致的问题
 * 
 * 修改此文件后需要重启后端服务：
 * docker-compose restart backend
 */

import featureFlags from './featureFlags.js';

// Parse invite codes from environment variable (comma-separated).
// Example: INVITE_CODES=code1,code2,code3
const _rawCodes = process.env.INVITE_CODES || '';
const _parsedCodes = _rawCodes
  .split(',')
  .map(c => c.trim())
  .filter(Boolean);

export const HARDCODED_CONFIG = {
  // ==================== 邀请码配置 ====================
  // Controlled by the INVITE_CODE_ENABLED feature flag.
  get INVITE_CODE_ENABLED() { return featureFlags.INVITE_CODE_ENABLED; },

  // Codes are read from INVITE_CODES env var (comma-separated).
  // Never hardcode secrets in source.
  VALID_INVITE_CODES: _parsedCodes,

  // ==================== 客户部署包下载配置 ====================
  DOWNLOAD_PACKAGES: [
    {
      id: 'docker-x86_64',
      mode: 'docker',
      architecture: 'x86_64',
      title: 'Docker Offline Package',
      description: 'Docker Compose quick-start bundle for Intel / AMD Linux servers.',
      fileName: process.env.DOWNLOAD_FILE_DOCKER_X86_64 || 'oaphub-docker-x86_64.tar.gz',
    },
    {
      id: 'docker-arm64',
      mode: 'docker',
      architecture: 'arm64',
      title: 'Docker Offline Package',
      description: 'Docker Compose quick-start bundle for ARM64 Linux servers.',
      fileName: process.env.DOWNLOAD_FILE_DOCKER_ARM64 || 'oaphub-docker-arm64.tar.gz',
    },
    {
      id: 'kubernetes-standard',
      mode: 'kubernetes',
      architecture: 'multi-arch',
      title: 'Kubernetes Manifests',
      description: 'Kubernetes manifests and deployment guide for cluster installs.',
      fileName: process.env.DOWNLOAD_FILE_KUBERNETES || 'oaphub-kubernetes-standard.tar.gz',
    },
  ],

  // ==================== 其他配置 ====================
  // 可以在这里添加更多硬编码配置
  // 例如：功能开关、默认设置等
};

export default HARDCODED_CONFIG;

