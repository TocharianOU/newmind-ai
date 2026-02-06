import { invoke } from "@tauri-apps/api/core"
import { isElectron } from "./env"

export function refreshConfig() {
  if (isElectron) {
    return window.ipcRenderer.refreshConfig()
  }

  return invoke("host_refresh_config")
}

export function restartHost(): Promise<{ success: boolean; port?: number; error?: string }> {
  if (isElectron) {
    return window.ipcRenderer.restartHost()
  }

  return invoke("host_restart")
}