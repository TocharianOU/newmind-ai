import { invoke } from "@tauri-apps/api/core"
import { isElectron, isWeb } from "./env"
import { enable, isEnabled, disable } from "@tauri-apps/plugin-autostart"

export async function getIPCAutoLaunch() {
  if (isElectron) {
    return window.ipcRenderer.getAutoLaunch()
  }
  if (isWeb) return false

  return isEnabled()
}

export async function setIPCAutoLaunch(setting: boolean) {
  if (isElectron) {
    return window.ipcRenderer.setAutoLaunch(setting)
  }
  if (isWeb) return

  return setting ? enable() : disable()
}

export async function getIPCMinimalToTray(): Promise<boolean> {
  if (isElectron) {
    return window.ipcRenderer.getMinimalToTray()
  }
  if (isWeb) return false

  return invoke("system_get_minimize_to_tray")
}

export async function setIPCMinimalToTray(setting: boolean) {
  if (isElectron) {
    return window.ipcRenderer.setMinimalToTray(setting)
  }
  if (isWeb) return

  return invoke("system_set_minimize_to_tray", { enable: setting })
}

export async function getSyncStatus(): Promise<{ enabled: boolean; lastSyncAt: string }> {
  if (isElectron) {
    return window.ipcRenderer.syncGetStatus()
  }
  return { enabled: false, lastSyncAt: "" }
}

export async function setSyncEnabled(enabled: boolean): Promise<void> {
  if (isElectron) {
    await window.ipcRenderer.syncSetEnabled(enabled)
  }
}

export async function runSync(): Promise<{ success: boolean; pushed: number; pulled: number; error?: string }> {
  if (isElectron) {
    return window.ipcRenderer.syncRun()
  }
  return { success: false, pushed: 0, pulled: 0, error: "Not supported" }
}