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
  INVITE_CODE_ENABLED: true,
  
  // 有效的邀请码列表
  VALID_INVITE_CODES: [
    'hellonewmind',
    'newmind2024',
    'welcome'
  ],

  // ==================== 下载地址配置 ====================
  DOWNLOAD_URLS: {
    windows: {
      x64: '' // Windows x64 下载地址（待配置）
    },
    macos: {
      intel: 'http://xiaopenges.tocharian.eu/download/NewmindChat-electron-1.0.0-mac-x64.dmg',
      appleSilicon: 'http://xiaopenges.tocharian.eu/download/NewmindChat-electron-1.0.0-mac-arm64.dmg'
    },
    linux: {
      x64: '',   // Linux x64 下载地址（待配置）
      arm64: ''  // Linux ARM64 下载地址（待配置）
    }
  },

  // ==================== 其他配置 ====================
  // 可以在这里添加更多硬编码配置
  // 例如：功能开关、默认设置等
};

export default HARDCODED_CONFIG;

