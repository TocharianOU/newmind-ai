import { app, BrowserWindow, shell, ipcMain } from "electron"
import path from "node:path"
import os from "node:os"
import AppState from "./state"
import { cleanup, initMCPClient, restartHost } from "./service"
import { runSync, isSyncEnabled, startPeriodicSync, stopPeriodicSync } from "./syncService"
import { getDarwinSystemPath, modifyPath } from "./util"
import { binDirList, darwinPathList, __dirname, VITE_DEV_SERVER_URL, RENDERER_DIST, logDir } from "./constant"
import { update } from "./update"
import { ipcHandler } from "./ipc"
import { initTray } from "./tray"
import { preferencesStore } from "./store"
import { initProtocol } from "./protocol"
import log from "electron-log/main"
import { deeplinkHandler, refreshConfig, setOAPTokenToHost, setupAppImageDeepLink } from "./deeplink"
import { oapClient } from "./oap"
import { refreshProjectContextForCurrentUser } from "./ipc/project"
import electronDl from "electron-dl"
import "./ipc/mcp.js"  // Import MCP IPC handlers
import "./ipc/project.js"  // Import Project IPC handlers
import { registerKeychainHandlers } from "./ipc/keychain"  // Import Keychain IPC handlers

log.initialize()
log.transports.file.resolvePathFn = () => path.join(logDir, "main-electron.log")
Object.assign(console, log.functions)

electronDl()

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith("6.1"))
  app.disableHardwareAcceleration()

// Set application name for Windows 10+ notifications
if (process.platform === "win32")
  app.setAppUserModelId(app.getName())

// Check if the app is already running
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
} else {
  app.on("second-instance", (event, commandLine) => {
    if (win) {
      if (win.isMinimized()) {
        win.restore()
      }
      win.focus()
    }

    deeplinkHandler(win, commandLine.pop() ?? "")
  })
}

app.on("open-url", (event, url) => {
  deeplinkHandler(win, url)
})

// Settings deeplink scheme
if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient("attacktrace", process.execPath, [path.resolve(process.argv[1])])
  }
} else {
  app.setAsDefaultProtocolClient("attacktrace")
}

let win: BrowserWindow | null = null
const preload = path.join(__dirname, "../preload/index.cjs")
const indexHtml = path.join(RENDERER_DIST, "index.html")

async function onReady() {
  if (process.platform === "win32") {
    binDirList.forEach(modifyPath)
  } else if (process.platform === "darwin") {
    if (!process.env.PATH) {
      process.env.PATH = await getDarwinSystemPath().catch(() => "")
    }

    darwinPathList.forEach(modifyPath)
  }

  setupAppImageDeepLink()
  initProtocol()
  createWindow()
  initMCPClient(win!)

  if (import.meta.env.VITE_OAP_TOKEN && !app.isPackaged) {
    console.info("set oap token from env")
    setOAPTokenToHost(import.meta.env.VITE_OAP_TOKEN)
  }

  oapClient.registEvent("login", async () => {
    // Account switched: refresh project context cache for this user first.
    refreshProjectContextForCurrentUser()
    // Restart host so ATTACKTRACE_USER_ID is populated with the freshly logged-in user.
    const result = await restartHost()
    if (result.success && result.port) {
      win!.webContents.send("app-port", result.port)
    }
    // Notify renderer only after host/user context has switched.
    win!.webContents.send("oap:login")
    // Kick off a sync after login so the user's history is available immediately.
    runSync().then(r => {
      if (r.success) {
        win!.webContents.send("sync:completed", r)
      }
    }).catch(console.error)
    // Start periodic background sync if the user has it enabled.
    if (isSyncEnabled()) startPeriodicSync()
  })

  oapClient.registEvent("logout", async () => {
    // Clear account-bound project context before restarting host.
    refreshProjectContextForCurrentUser()
    win!.webContents.send("oap:logout")
    stopPeriodicSync()
    // Restart host with an empty ATTACKTRACE_USER_ID so that no user-specific
    // data is accessible while the login screen is shown.  This prevents
    // cross-account data leakage in the edge case where API requests slip
    // through between a logout and the next login restart.
    try {
      const result = await restartHost()
      if (result.success && result.port) {
        win!.webContents.send("app-port", result.port)
      }
    } catch (err) {
      console.error(err)
    }
  })

}

export async function createWindow() {
  win = new BrowserWindow({
    title: "AttackTrace Agent",
    icon: path.join(process.env.VITE_PUBLIC, "favicon.ico"),
    width: 1280,
    height: 720,
    minHeight: 320,
    minWidth: 400,
    // Enable SaaS-style transparent window with custom controls on right
    transparent: true,
    backgroundColor: "#00000000",
    titleBarStyle: process.platform === "darwin" ? "hidden" : "default",
    titleBarOverlay: process.platform === "win32" ? {
      color: "#00000000",
      symbolColor: "#ffffff",
      height: 60
    } : undefined,
    vibrancy: process.platform === "darwin" ? "under-window" : undefined,
    backgroundMaterial: process.platform === "win32" ? "acrylic" : undefined,
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,        // preload needs Node APIs; keep sandbox off while preload is not sandboxed
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  })

  if (process.platform === "darwin") {
    // Hide native traffic lights to avoid duplicate controls.
    win.setWindowButtonVisibility(false)
  }

  // win.webContents.openDevTools()
  if (VITE_DEV_SERVER_URL) { // #298
    win.loadURL(VITE_DEV_SERVER_URL)
    // Open devTool if the app is not packaged
    win.webContents.openDevTools()
  } else {
    win.setMenu(null)
    win.loadFile(indexHtml)
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString())
  })

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:"))
      shell.openExternal(url)

    return { action: "deny" }
  })

  win.on("close", (event) => {
    const shouldminimalToTray = preferencesStore.get("minimalToTray")
    if (shouldminimalToTray && !AppState.isQuitting) {
      event.preventDefault()
      win?.hide()
      return false
    }

    return true
  })

  // Auto update
  update(win)

  // Tray
  const shouldminimalToTray = preferencesStore.get("minimalToTray")
  if (process.platform !== "darwin" && shouldminimalToTray) {
    initTray(win)
    AppState.setIsQuitting(false)
  }

  // ipc handler
  ipcHandler(win)

  // Register keychain handlers
  registerKeychainHandlers()

  const shouldAutoLaunch = preferencesStore.get("autoLaunch")
  app.setLoginItemSettings({
    openAtLogin: shouldAutoLaunch,
    openAsHidden: false
  })
}

app.whenReady().then(onReady)

app.on("quit", async () => {
  await cleanup()
})

app.on("window-all-closed", async () => {
  win = null

  if (process.platform !== "darwin" && AppState.isQuitting) {
    app.quit()
  }
})

app.on("before-quit", () => {
  AppState.setIsQuitting(true)
})

app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows()
  if (allWindows.length) {
    allWindows[0].focus()
  } else {
    if (win) {
      win.show()
    } else {
      createWindow()
    }
  }
})

