/**
 * 硬编码配置文件
 * 用于统一管理邀请码、下载地址等配置，避免环境变量不一致导致的问题
 * 
 * 修改此文件后需要重启后端服务：
 * docker-compose restart backend
 */

export const HARDCODED_CONFIG = {
  // ==================== 邀请码配置 ====================
  // 是否启用邀请码功能
  INVITE_CODE_ENABLED: false,
  
  // 有效的邀请码列表
  VALID_INVITE_CODES: [
    'hellonewmind',
    'newmind2024',
    'welcome'
  ],

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

