import { app, shell, BrowserWindow } from "electron"
import AppState from "../state"
import { scriptsDir } from "../constant"
import { preferencesStore } from "../store"
import { safeRegisterHandler } from "../utils/ipcRegistry"

import {
  checkAppImageAutoLaunchStatus,
  setAppImageAutoLaunch,
} from "../platform/appimage"
import { destroyTray, initTray } from "../tray"

export function ipcSystemHandler(win: BrowserWindow) {
  safeRegisterHandler("system:openScriptsDir", async () => {
    shell.openPath(scriptsDir)
  })

  safeRegisterHandler("system:getAutoLaunch", () => {
    if (process.env.APPIMAGE) {
      return checkAppImageAutoLaunchStatus()
    }

    return app.getLoginItemSettings().openAtLogin
  })

  safeRegisterHandler("system:setAutoLaunch", (event, enable) => {
    preferencesStore.set("autoLaunch", enable)

    if (process.env.APPIMAGE) {
      setAppImageAutoLaunch(enable)
    } else {
      app.setLoginItemSettings({
        openAtLogin: enable,
        openAsHidden: false,
      })
    }

    return enable
  })

  safeRegisterHandler("system:getMinimalToTray", () => {
    return preferencesStore.get("minimalToTray")
  })

  safeRegisterHandler("system:setMinimalToTray", (event, enable) => {
    preferencesStore.set("minimalToTray", enable)
    AppState.setIsQuitting(!enable)

    if (enable) {
      initTray(win)
    } else {
      destroyTray()
    }
  })

  // Window controls
  safeRegisterHandler("window:minimize", () => {
    win.minimize()
  })

  safeRegisterHandler("window:maximize", () => {
    if (win.isMaximized()) {
      win.unmaximize()
    } else {
      win.maximize()
    }
  })

  safeRegisterHandler("window:close", () => {
    win.close()
  })

  safeRegisterHandler("window:isMaximized", () => {
    return win.isMaximized()
  })
}
