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
    return app.isPackaged ? path.join(process.resourcesPath, p) : p
  })

  safeRegisterHandler("env:isDev", async () => {
    return !!VITE_DEV_SERVER_URL
  })
}

