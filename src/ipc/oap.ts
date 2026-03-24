import { invoke } from "@tauri-apps/api/core"
import { isElectron, isWeb } from "./env"
import { ApiResponse, MCPServerSearchParam, OAPMCPServer, OAPModelDescription, OAPModelDescriptionParam, OAPUsage, OAPUser } from "../../types/oap"
import { listenIPC } from "."
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
    if (isElectron || isWeb) {
        return
    }

    return invoke("oap_set_host", { host })
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
    
    const fallbackUrl = isWeb
        ? (regist ? `${window.location.origin}/console/register` : `${window.location.origin}/console/login`)
        : (regist ? 'http://localhost:23001/register' : 'http://localhost:23001/login');

    const finalUrl = hubUrl || fallbackUrl;
    console.log('🔗 Final URL:', finalUrl);
    
    if (isElectron) {
        console.log('🔗 Opening in Electron with IPC shell.openExternal');
        try {
            if (window.ipcRenderer && window.ipcRenderer.invoke) {
                window.ipcRenderer.invoke('open-external-url', finalUrl);
            } else {
                window.open(finalUrl, '_blank');
            }
        } catch (error) {
            console.error('🔗 Error opening URL:', error);
            window.open(finalUrl, '_blank');
        }
        return Promise.resolve();
    }

    // Web mode: just open in same tab or new tab
    if (isWeb) {
        window.open(finalUrl, '_blank');
        return Promise.resolve();
    }

    // Tauri: Use open command
    return invoke("open_url", { url: finalUrl }).catch(() => {
        window.open(finalUrl, '_blank');
    });
}

export function oapLogin(token: string) {
    if (isElectron) {
        return window.ipcRenderer.oapLoginWithToken(token)
    }
    if (isWeb) {
        setWebTokens(token)
        emitWebEvent("login")
        return Promise.resolve({ success: true })
    }

    return invoke("oap_login", { token })
}

export function oapLogout() {
    if (isElectron) {
        return window.ipcRenderer.oapLogout()
    }
    if (isWeb) {
        clearWebTokens()
        emitWebEvent("logout")
        return Promise.resolve()
    }

    return invoke("oap_logout")
}

export function oapGetToken(): Promise<string> {
    if (isElectron) {
        return window.ipcRenderer.oapGetToken()
    }
    if (isWeb) {
        return Promise.resolve(getWebToken() || "")
    }

    return invoke("oap_get_token")
}

export function oapGetMe(): Promise<ApiResponse<OAPUser>> {
    if (isElectron) {
        return window.ipcRenderer.oapGetMe()
    }
    if (isWeb) {
        return webHubFetch("/api/v1/user/me").then(r => r.json())
    }

    return invoke("oap_get_me")
}

export function oapGetUsage(): Promise<ApiResponse<OAPUsage>> {
    if (isElectron) {
        return window.ipcRenderer.oapGetUsage()
    }
    if (isWeb) {
        return webHubFetch("/api/v1/user/usage").then(r => r.json())
    }

    return invoke("oap_get_usage")
}

export function oapSearchMCPServer(params: MCPServerSearchParam): Promise<ApiResponse<OAPMCPServer[]>> {
    if (isElectron) {
        return window.ipcRenderer.oapSearchMCPServer(params)
    }
    if (isWeb) {
        const query = new URLSearchParams(params as any).toString()
        return webHubFetch(`/api/v1/mcp/search?${query}`).then(r => r.json())
    }

    return invoke("oap_search_mcp_server", { params })
}

type BackendEvent = "login" | "logout" | "refresh" | "mcp.install"
export function registBackendEvent(event: BackendEvent, callback: (...args: any[]) => void) {
    if (isElectron) {
        switch (event) {
            case "login":
                return window.ipcRenderer.oapRegistEvent("login", callback)
            case "logout":
                return window.ipcRenderer.oapRegistEvent("logout", callback)
            case "refresh":
                return window.ipcRenderer.listenRefresh(callback)
            case "mcp.install":
                return window.ipcRenderer.listenMcpApply(callback)
        }
    }

    if (isWeb) {
        return onWebEvent(event, callback)
    }

    const listener = (data: any) => callback(data.payload)
    switch (event) {
        case "login":
        case "logout":
        case "refresh":
            return listenIPC(`oap:${event}`, listener)
        case "mcp.install":
            return listenIPC("mcp:install", listener)
    }
}

export function oapModelDescription(params: OAPModelDescriptionParam): Promise<ApiResponse<OAPModelDescription[]>> {
    if (isElectron) {
        return window.ipcRenderer.oapModelDescription(params)
    }
    if (isWeb) {
        return webHubFetch("/api/v1/models/description", {
            method: "POST",
            body: JSON.stringify(params),
        }).then(r => r.json())
    }

    return invoke("oap_get_model_description", { params })
}

export function oapLoginWithToken(token: string): Promise<{ success: boolean }> {
    if (isElectron) {
        return window.ipcRenderer.oapLoginWithToken(token)
    }
    if (isWeb) {
        setWebTokens(token)
        emitWebEvent("login")
        return Promise.resolve({ success: true })
    }

    return invoke("oap_login_with_token", { token })
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
    if (isElectron) {
        return window.ipcRenderer.oapGetOAuthConfig()
    }
    if (isWeb) {
        return webHubFetch("/api/auth/flags").then(r => r.json())
    }

    return invoke("oap_get_oauth_config")
}

/**
 * 启动OAuth登录流程
 * @param provider OAuth提供商名称 (google, microsoft, github, gitlab)
 */
export function oapLoginWithOAuth(provider: string): Promise<{ success: boolean }> {
    if (isElectron) {
        return window.ipcRenderer.oapLoginWithOAuth(provider)
    }
    if (isWeb) {
        window.location.href = `/api/auth/sso/${provider}/start`
        return Promise.resolve({ success: true })
    }

    return invoke("oap_login_with_oauth", { provider })
}