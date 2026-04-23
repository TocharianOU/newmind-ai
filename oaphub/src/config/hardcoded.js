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

  // ==================== 下载地址配置 ====================
  // 从环境变量读取，如果未配置则使用空字符串
  DOWNLOAD_URLS: {
    windows: {
      x64: process.env.DOWNLOAD_URL_WINDOWS_X64 || ''
    },
    macos: {
      intel: process.env.DOWNLOAD_URL_MACOS_INTEL || '',
      appleSilicon: process.env.DOWNLOAD_URL_MACOS_APPLE_SILICON || ''
    },
    linux: {
      x64: process.env.DOWNLOAD_URL_LINUX_X64 || '',
      arm64: process.env.DOWNLOAD_URL_LINUX_ARM64 || ''
    }
  },

  // ==================== 其他配置 ====================
  // 可以在这里添加更多硬编码配置
  // 例如：功能开关、默认设置等
};

export default HARDCODED_CONFIG;

