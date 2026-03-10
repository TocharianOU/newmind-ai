// Environment configuration for AttackTrace App
export const ENV_CONFIG = {
  // Hub Backend API (for API calls and WebSocket)
  API_BASE_URL:    import.meta.env.VITE_API_BASE_URL    || 'http://localhost:23000',
  // Hub Frontend URL (for page navigation - login/register)
  HUB_BASE_URL:    import.meta.env.VITE_HUB_BASE_URL    || 'http://localhost:23001',
  // Branding — override per customer via .env at build time
  APP_NAME:        import.meta.env.VITE_APP_NAME        || 'AttackTrace',
  PLATFORM_NAME:   import.meta.env.VITE_PLATFORM_NAME   || 'OAP Platform',
} as const;

// Helper functions
export const getHubLoginUrl = () => {
  return `${ENV_CONFIG.HUB_BASE_URL}/login`;
};

export const getHubRegisterUrl = () => {
  return `${ENV_CONFIG.HUB_BASE_URL}/register`;
};
