// Environment configuration for Dive App
export const ENV_CONFIG = {
  // Hub Backend API (用于API调用和WebSocket)
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:23000',
  // Hub Frontend URL (用于页面跳转 - 注册/登录)
  HUB_BASE_URL: import.meta.env.VITE_HUB_BASE_URL || 'http://localhost:23001',
} as const;

// Helper functions
export const getHubLoginUrl = () => {
  return `${ENV_CONFIG.HUB_BASE_URL}/login`;
};

export const getHubRegisterUrl = () => {
  return `${ENV_CONFIG.HUB_BASE_URL}/register`;
};
