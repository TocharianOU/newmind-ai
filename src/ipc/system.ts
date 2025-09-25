import { invoke } from "@tauri-apps/api/core"
import { isElectron } from "./index"
import { enable, isEnabled, disable } from "@tauri-apps/plugin-autostart"

export async function getIPCAutoLaunch() {
  if (isElectron) {
    return window.ipcRenderer.getAutoLaunch()
  }

  return isEnabled()
}

export async function setIPCAutoLaunch(setting: boolean) {
  if (isElectron) {
    return window.ipcRenderer.setAutoLaunch(setting)
  }

  return setting ? enable() : disable()
}

export async function getIPCMinimalToTray(): Promise<boolean> {
  if (isElectron) {
    return window.ipcRenderer.getMinimalToTray()
  }

  return invoke("system_get_minimize_to_tray")
}

export async function setIPCMinimalToTray(setting: boolean) {
  if (isElectron) {
    return window.ipcRenderer.setMinimalToTray(setting)
  }

  return invoke("system_set_minimize_to_tray", { enable: setting })
}