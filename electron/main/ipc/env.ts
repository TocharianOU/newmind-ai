import { app, BrowserWindow } from "electron"
import { serviceStatus } from "../service"
import path from "node:path"
import { VITE_DEV_SERVER_URL } from "../constant"
import { safeRegisterHandler } from "../utils/ipcRegistry"

export function ipcEnvHandler(_win: BrowserWindow) {
  safeRegisterHandler("env:getPlatform", async () => {
    return process.platform
  })

  safeRegisterHandler("env:port", async () => {
    return serviceStatus.port
  })

  safeRegisterHandler("env:getResourcesPath", async (_, p: string) => {
    if (!app.isPackaged) return p
    const base = path.resolve(process.resourcesPath)
    const resolved = path.resolve(base, p)
    if (!resolved.startsWith(base + path.sep) && resolved !== base) {
      console.warn(`[IPC] env:getResourcesPath blocked path traversal: ${resolved}`)
      return null
    }
    return resolved
  })

  safeRegisterHandler("env:isDev", async () => {
    return !!VITE_DEV_SERVER_URL
  })
}

