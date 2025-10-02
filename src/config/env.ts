// Environment configuration for Dive App
export const ENV_CONFIG = {
  // API Configuration
  API_BASE_URL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  HUB_BASE_URL: import.meta.env.VITE_HUB_BASE_URL || 'http://localhost:5174',
} as const;

// Helper functions
export const getHubLoginUrl = () => {
  return `${ENV_CONFIG.HUB_BASE_URL}/login`;
};

export const getHubRegisterUrl = () => {
  return `${ENV_CONFIG.HUB_BASE_URL}/register`;
};
