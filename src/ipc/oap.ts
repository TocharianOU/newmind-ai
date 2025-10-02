import { invoke } from "@tauri-apps/api/core"
import { isElectron } from "./env"
import { ApiResponse, MCPServerSearchParam, OAPMCPServer, OAPModelDescription, OAPModelDescriptionParam, OAPUsage, OAPUser } from "../../types/oap"
import { listenIPC } from "."
import { getHubLoginUrl, getHubRegisterUrl } from "../config/env"

export function setOapHost(host: string) {
    if (isElectron) {
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
    
    // 临时硬编码 URL 以确保功能正常
    const fallbackUrl = regist 
        ? 'http://localhost:5174/register'
        : 'http://localhost:5174/login';
    
    const finalUrl = hubUrl || fallbackUrl;
    console.log('🔗 Final URL:', finalUrl);
    
    if (isElectron) {
        // Electron: Use IPC to call shell.openExternal in main process
        console.log('🔗 Opening in Electron with IPC shell.openExternal');
        try {
            // Use the existing IPC method to open external URL
            if (window.ipcRenderer && window.ipcRenderer.invoke) {
                // Create a custom IPC call to open external URL
                window.ipcRenderer.invoke('open-external-url', finalUrl);
            } else {
                // Fallback to window.open
                console.log('🔗 Fallback to window.open');
                window.open(finalUrl, '_blank');
            }
        } catch (error) {
            console.error('🔗 Error opening URL:', error);
            // Final fallback
            window.open(finalUrl, '_blank');
        }
        return Promise.resolve();
    }

    // Tauri: Use open command
    console.log('🔗 Opening in Tauri with invoke');
    return invoke("open_url", { url: finalUrl }).catch(() => {
        // Fallback: Use window.open
        console.log('🔗 Fallback to window.open');
        window.open(finalUrl, '_blank');
    });
}

export function oapLogin(token: string) {
    if (isElectron) {
        return window.ipcRenderer.oapLoginWithToken(token)
    }

    return invoke("oap_login", { token })
}

export function oapLogout() {
    if (isElectron) {
        return window.ipcRenderer.oapLogout()
    }

    return invoke("oap_logout")
}

export function oapGetToken(): Promise<string> {
    if (isElectron) {
        return window.ipcRenderer.oapGetToken()
    }

    return invoke("oap_get_token")
}

export function oapGetMe(): Promise<ApiResponse<OAPUser>> {
    if (isElectron) {
        return window.ipcRenderer.oapGetMe()
    }

    return invoke("oap_get_me")
}

export function oapGetUsage(): Promise<ApiResponse<OAPUsage>> {
    if (isElectron) {
        return window.ipcRenderer.oapGetUsage()
    }

    return invoke("oap_get_usage")
}

export function oapSearchMCPServer(params: MCPServerSearchParam): Promise<ApiResponse<OAPMCPServer[]>> {
    if (isElectron) {
        return window.ipcRenderer.oapSearchMCPServer(params)
    }

    return invoke("oap_search_mcp_server", { params })
}

export function oapApplyMCPServer(ids: string[]): Promise<void> {
    if (isElectron) {
        return window.ipcRenderer.oapApplyMCPServer(ids)
    }

    return invoke("oap_apply_mcp_server", { ids })
}

export function oapGetMCPServers(): Promise<ApiResponse<OAPMCPServer[]>> {
    if (isElectron) {
        return window.ipcRenderer.oapGetMCPServers()
    }

    return invoke("oap_get_mcp_servers")
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

    return invoke("oap_get_model_description", { params })
}

export function oapLoginWithToken(token: string): Promise<{ success: boolean }> {
    if (isElectron) {
        return window.ipcRenderer.oapLoginWithToken(token)
    }

    return invoke("oap_login_with_token", { token })
}