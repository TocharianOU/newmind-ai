import { platform } from "@tauri-apps/plugin-os"

export const isElectron = window.ipcRenderer !== undefined
export const isTauri = window.__TAURI_INTERNALS__ !== undefined
export const isWeb = !isElectron && !isTauri

export const imgPrefix = isTauri ? "/image/" : "img://"

export async function initPlatform() {
  if (isElectron) {
    window.PLATFORM = await window.ipcRenderer.getPlatform() as any
    return
  }

  if (isTauri) {
    switch (platform()) {
      case "linux":
        window.PLATFORM = "linux"
        break
      case "macos":
        window.PLATFORM = "darwin"
        break
      case "windows":
        window.PLATFORM = "win32"
        break
      default:
    }
  }
}