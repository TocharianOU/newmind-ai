import { invoke } from "@tauri-apps/api/core"
import { isElectron } from "./env"

export function refreshConfig() {
  if (isElectron) {
    return window.ipcRenderer.refreshConfig()
  }

  return invoke("host_refresh_config")
}