// Use environment variables for configuration
export const OAP_ROOT_URL = import.meta.env.VITE_HUB_BASE_URL || 'http://localhost:5174';
export const OAP_PROXY_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
