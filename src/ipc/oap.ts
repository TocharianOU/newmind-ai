import { ApiResponse, MCPServerSearchParam, OAPMCPServer, OAPModelDescription, OAPModelDescriptionParam, OAPUsage, OAPUser } from "../../types/oap"
import { getHubLoginUrl, getHubRegisterUrl } from "../config/env"

// ---------------------------------------------------------------------------
// Web mode event bus — replaces Tauri/Electron IPC events in browser context.
// ---------------------------------------------------------------------------
type WebEventCallback = (...args: any[]) => void
const webEventListeners = new Map<string, Set<WebEventCallback>>()

function emitWebEvent(event: string, ...args: any[]) {
  webEventListeners.get(event)?.forEach(cb => cb(...args))
}

function onWebEvent(event: string, cb: WebEventCallback): () => void {
  if (!webEventListeners.has(event)) webEventListeners.set(event, new Set())
  webEventListeners.get(event)!.add(cb)
  return () => { webEventListeners.get(event)?.delete(cb) }
}

// ---------------------------------------------------------------------------
// Web mode token helpers — Hub JWT stored in localStorage by Hub's Login page.
// The Hub stores the JWT under "authToken"; the SPA may also store it under
// "oap_access_token" when oapLogin() is called directly. We check both so
// the user gets authenticated automatically after logging in on the Hub's
// /login page and navigating to /app — no extra redirect needed.
// ---------------------------------------------------------------------------
const WEB_TOKEN_KEY = "oap_access_token"
const WEB_REFRESH_TOKEN_KEY = "oap_refresh_token"
const HUB_TOKEN_KEY = "authToken" // written by Hub's AuthContext

export function getWebToken(): string | null {
  return localStorage.getItem(WEB_TOKEN_KEY) || localStorage.getItem(HUB_TOKEN_KEY) || null
}

export function setWebTokens(access: string, refresh?: string) {
  localStorage.setItem(WEB_TOKEN_KEY, access)
  localStorage.setItem(HUB_TOKEN_KEY, access)
  if (refresh) localStorage.setItem(WEB_REFRESH_TOKEN_KEY, refresh)
}

export function clearWebTokens() {
  localStorage.removeItem(WEB_TOKEN_KEY)
  localStorage.removeItem(WEB_REFRESH_TOKEN_KEY)
  localStorage.removeItem(HUB_TOKEN_KEY)
}

async function webHubFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = getWebToken()
  const headers = new Headers(options?.headers || {})
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (!headers.has("Content-Type") && options?.body) {
    headers.set("Content-Type", "application/json")
  }
  return fetch(path, { ...options, headers })
}

export function setOapHost(host: string) {
    void host
}

export function openOapLoginPage(regist: boolean) {
    // Open Hub platform in external browser using environment variables
    const hubUrl = regist 
        ? getHubRegisterUrl()  // Hub registration page
        : getHubLoginUrl();    // Hub login page
    
    console.log('🔗 Opening URL:', hubUrl);
    console.log('🔗 Environment variables:', {
        VITE_HUB_BASE_URL: import.meta.env.VITE_HUB_BASE_URL,
        VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL
    });
    
    const fallbackUrl = regist ? `${window.location.origin}/console/register` : `${window.location.origin}/console/login`;

    const finalUrl = hubUrl || fallbackUrl;
    console.log('🔗 Final URL:', finalUrl);
    
    window.open(finalUrl, '_blank');
    return Promise.resolve();
}

export function oapLogin(token: string) {
    setWebTokens(token)
    emitWebEvent("login")
    return Promise.resolve({ success: true })
}

export function oapLogout() {
    clearWebTokens()
    emitWebEvent("logout")
    return Promise.resolve()
}

export function oapGetToken(): Promise<string> {
    return Promise.resolve(getWebToken() || "")
}

export function oapGetMe(): Promise<ApiResponse<OAPUser>> {
    return webHubFetch("/api/v1/user/me").then(r => r.json())
}

export function oapGetUsage(): Promise<ApiResponse<OAPUsage>> {
    return webHubFetch("/api/v1/user/usage").then(r => r.json())
}

export function oapSearchMCPServer(params: MCPServerSearchParam): Promise<ApiResponse<OAPMCPServer[]>> {
    const query = new URLSearchParams(params as any).toString()
    return webHubFetch(`/api/v1/mcp/search?${query}`).then(r => r.json())
}

type BackendEvent = "login" | "logout" | "refresh" | "mcp.install"
export function registBackendEvent(event: BackendEvent, callback: (...args: any[]) => void) {
    return onWebEvent(event, callback)
}

export function oapModelDescription(params: OAPModelDescriptionParam): Promise<ApiResponse<OAPModelDescription[]>> {
    return webHubFetch("/api/v1/models/description", {
        method: "POST",
        body: JSON.stringify(params),
    }).then(r => r.json())
}

export function oapLoginWithToken(token: string): Promise<{ success: boolean }> {
    setWebTokens(token)
    emitWebEvent("login")
    return Promise.resolve({ success: true })
}

/**
 * 获取OAuth配置
 * @returns OAuth配置信息（包含启用状态、品牌文案、可用提供商列表）
 */
export function oapGetOAuthConfig(): Promise<ApiResponse<{
    oauthEnabled: boolean;
    brandText: string;
    providers: Array<{ name: string; displayName: string }>;
}>> {
    return webHubFetch("/api/auth/flags").then(r => r.json())
}

/**
 * 启动OAuth登录流程
 * @param provider OAuth提供商名称 (google, microsoft, github, gitlab)
 */
export function oapLoginWithOAuth(provider: string): Promise<{ success: boolean }> {
    window.location.href = `/api/auth/sso/${provider}/start`
    return Promise.resolve({ success: true })
}