import { invoke } from "@tauri-apps/api/core"
import { isElectron, isWeb } from "./env"
import { getWebToken } from "./oap"

function webHostFetch(url: string, options?: RequestInit) {
  const token = getWebToken()
  const headers = new Headers(options?.headers || {})
  if (token) headers.set("Authorization", `Bearer ${token}`)
  return fetch(url, { ...options, headers })
}

export function refreshConfig() {
  if (isElectron) {
    return window.ipcRenderer.refreshConfig()
  }
  if (isWeb) {
    // MCP Host config reload — Hub proxies this through
    return webHostFetch("/api/config/reload", { method: "POST" })
      .then(() => undefined)
      .catch(() => undefined)
  }

  return invoke("host_refresh_config")
}

export function restartHost(): Promise<{ success: boolean; port?: number; error?: string }> {
  if (isElectron) {
    return window.ipcRenderer.restartHost()
  }
  if (isWeb) {
    // In server deployment the MCP Host is a long-running process managed
    // externally — a "restart" just reloads the MCP server config.
    return webHostFetch("/api/config/reload", { method: "POST" })
      .then(() => ({ success: true }))
      .catch((e: Error) => ({ success: false, error: e.message }))
  }

  return invoke("host_restart")
}