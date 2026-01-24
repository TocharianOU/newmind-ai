// Use environment variables for configuration
// OAP_ROOT_URL 用于 WebSocket 和 API 调用，应该指向后端服务
export const OAP_ROOT_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:23000';
export const OAP_PROXY_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:23000';
