import { ipcRenderer, contextBridge } from "electron"

import type { OAPModelDescriptionParam, MCPServerSearchParam } from "../../types/oap"
import type { ModelGroupSetting } from "../../types/model"

/**
 * Allowlist for generic IPC channels.
 * Only channels matching these prefixes (or exact names) may pass through the
 * generic on/off/invoke bridge.  Named wrapper methods above are always preferred;
 * these are kept for update, open-external, and direct project calls.
 */
const INVOKE_CHANNEL_PREFIXES = [
  "util:", "project:", "system:", "window:", "llm:", "env:",
  "oap:", "sync:", "keychain:", "mcp:", "show-"
]
const INVOKE_CHANNEL_EXACT = new Set([
  "check-update", "start-download", "quit-and-install",
  "open-external-url",
  "show-selection-context-menu", "show-input-context-menu",
  "save_clipboard_image_to_cache", "download_image",
])
const LISTEN_CHANNEL_PREFIXES = ["oap:", "mcp:", "sync:", "keychain:"]
const LISTEN_CHANNEL_EXACT = new Set([
  "download-progress", "update-downloaded", "update-error",
  "update-can-available", "refresh", "mcp.install",
  "app-port", "install-host-dependencies-log",
])

function isAllowedInvoke(ch: string) {
  return INVOKE_CHANNEL_EXACT.has(ch) || INVOKE_CHANNEL_PREFIXES.some(p => ch.startsWith(p))
}
function isAllowedListen(ch: string) {
  return LISTEN_CHANNEL_EXACT.has(ch) || LISTEN_CHANNEL_PREFIXES.some(p => ch.startsWith(p))
}

// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld("ipcRenderer", {
  on(channel: string, listener: (...args: any[]) => void) {
    if (!isAllowedListen(channel)) return () => {}
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(channel: string, listener: (...args: any[]) => void) {
    if (!isAllowedListen(channel)) return
    return ipcRenderer.off(channel, listener)
  },
  invoke(channel: string, ...args: any[]) {
    if (!isAllowedInvoke(channel)) {
      console.warn(`[preload] Blocked ipcRenderer.invoke on channel: ${channel}`)
      return Promise.reject(new Error(`IPC channel not allowed: ${channel}`))
    }
    return ipcRenderer.invoke(channel, ...args)
  },

  // listener
  onReceivePort: (callback: (port: number) => void) => {
    const listener = (_event: Electron.IpcMainInvokeEvent, value: number) => callback(value)
    ipcRenderer.on("app-port", listener as any)
    return () => ipcRenderer.off("app-port", listener as any)
  },
  onReceiveInstallHostDependenciesLog: (callback: (data: string) => void) => {
    const listener = (_event: Electron.IpcMainInvokeEvent, value: string) => callback(value)
    ipcRenderer.on("install-host-dependencies-log", listener as any)
    return () => ipcRenderer.off("install-host-dependencies-log", listener as any)
  },
  onReceiveSyncCompleted: (callback: (result: { success: boolean; pushed: number; pulled: number }) => void) => {
    const listener = (_event: Electron.IpcMainInvokeEvent, value: { success: boolean; pushed: number; pulled: number }) => callback(value)
    ipcRenderer.on("sync:completed", listener as any)
    return () => ipcRenderer.off("sync:completed", listener as any)
  },

  // util
  fillPathToConfig: (config: string) => ipcRenderer.invoke("util:fillPathToConfig", config),
  download: (url: string) => ipcRenderer.invoke("util:download", { url }),
  copyImage: (url: string) => ipcRenderer.invoke("util:copyimage", url),
  getModelSettings: () => ipcRenderer.invoke("util:getModelSettings"),
  setModelSettings: (settings: ModelGroupSetting) => ipcRenderer.invoke("util:setModelSettings", settings),
  refreshConfig: () => ipcRenderer.invoke("util:refreshConfig"),
  restartHost: () => ipcRenderer.invoke("util:restartHost"),
  getInstallHostDependenciesLog: () => ipcRenderer.invoke("util:getInstallHostDependenciesLog"),
  readLocalLogo: (logoPath: string) => ipcRenderer.invoke("util:readLocalLogo", logoPath),

  // sync
  syncGetStatus: () => ipcRenderer.invoke("sync:getStatus"),
  syncSetEnabled: (enabled: boolean) => ipcRenderer.invoke("sync:setEnabled", enabled),
  syncRun: () => ipcRenderer.invoke("sync:run"),

  // project
  getCurrentProject: () => ipcRenderer.invoke("project:getCurrentProject"),
  setCurrentProject: (projectId: string) => ipcRenderer.invoke("project:setCurrentProject", projectId),
  projectList: () => ipcRenderer.invoke("project:list"),
  projectCreate: (data: { name: string; description?: string }) => ipcRenderer.invoke("project:create", data),
  projectUpdate: (projectId: string, data: { name?: string; description?: string }) => ipcRenderer.invoke("project:update", projectId, data),
  projectDelete: (projectId: string) => ipcRenderer.invoke("project:delete", projectId),

  // system
  openScriptsDir: () => ipcRenderer.invoke("system:openScriptsDir"),
  getAutoLaunch: () => ipcRenderer.invoke("system:getAutoLaunch"),
  setAutoLaunch: (enable: boolean) => ipcRenderer.invoke("system:setAutoLaunch", enable),
  getMinimalToTray: () => ipcRenderer.invoke("system:getMinimalToTray"),
  setMinimalToTray: (enable: boolean) => ipcRenderer.invoke("system:setMinimalToTray", enable),
  getAuthToken: () => ipcRenderer.invoke("system:getAuthToken"),
  
  // window controls
  windowMinimize: () => ipcRenderer.invoke("window:minimize"),
  windowMaximize: () => ipcRenderer.invoke("window:maximize"),
  windowClose: () => ipcRenderer.invoke("window:close"),
  windowIsMaximized: () => ipcRenderer.invoke("window:isMaximized"),

  // llm
  openaiModelList: (apiKey: string) => ipcRenderer.invoke("llm:openaiModelList", apiKey),
  openaiCompatibleModelList: (apiKey: string, baseURL: string) => ipcRenderer.invoke("llm:openaiCompatibleModelList", apiKey, baseURL),
  anthropicModelList: (apiKey: string, baseURL: string) => ipcRenderer.invoke("llm:anthropicModelList", apiKey, baseURL),
  ollamaModelList: (baseURL: string) => ipcRenderer.invoke("llm:ollamaModelList", baseURL),
  googleGenaiModelList: (apiKey: string) => ipcRenderer.invoke("llm:googleGenaiModelList", apiKey),
  mistralaiModelList: (apiKey: string) => ipcRenderer.invoke("llm:mistralaiModelList", apiKey),
  bedrockModelList: (accessKeyId: string, secretAccessKey: string, sessionToken: string, region: string) => ipcRenderer.invoke("llm:bedrockModelList", accessKeyId, secretAccessKey, sessionToken, region),
  azureOpenaiModelList: (apiKey: string, azureEndpoint: string, azureDeployment: string, apiVersion: string) => ipcRenderer.invoke("llm:azureOpenaiModelList", apiKey, azureEndpoint, azureDeployment, apiVersion),

  // context menu
  showSelectionContextMenu: () => ipcRenderer.invoke("show-selection-context-menu"),
  showInputContextMenu: () => ipcRenderer.invoke("show-input-context-menu"),

  // env
  getPlatform: () => ipcRenderer.invoke("env:getPlatform"),
  port: () => ipcRenderer.invoke("env:port"),
  getResourcesPath: (p: string) => ipcRenderer.invoke("env:getResourcesPath", p),
  isDev: () => ipcRenderer.invoke("env:isDev"),

  // oap
  oapLogin: (regist: boolean) => ipcRenderer.invoke("oap:login", regist),
  oapLogout: () => ipcRenderer.invoke("oap:logout"),
  oapGetToken: () => ipcRenderer.invoke("oap:getToken"),
  oapSearchMCPServer: (params: MCPServerSearchParam) => ipcRenderer.invoke("oap:searchMCPServer", params),
  oapModelDescription: (params?: OAPModelDescriptionParam) => ipcRenderer.invoke("oap:modelDescription", params),
  oapGetMe: () => ipcRenderer.invoke("oap:getMe"),
  oapGetUsage: () => ipcRenderer.invoke("oap:getUsage"),
  oapLoginWithToken: (token: string) => ipcRenderer.invoke("oap:loginWithToken", token),
  oapGetOAuthConfig: () => ipcRenderer.invoke("oap:getOAuthConfig"),
  oapLoginWithOAuth: (provider: string) => ipcRenderer.invoke("oap:loginWithOAuth", provider),
  oapRegistEvent: (event: "login" | "logout", callback: () => void) => {
    ipcRenderer.on(`oap:${event}`, callback)
    return () => ipcRenderer.off(`oap:${event}`, callback)
  },

  // deep link
  listenRefresh: (cb: () => void) => {
    ipcRenderer.on("refresh", cb)
    return () => ipcRenderer.off("refresh", cb)
  },
  listenMcpApply: (cb: (data: { name: string; config: string }) => void) => {
    const listener = (_event: Electron.IpcMainInvokeEvent, data: { name: string; config: string }) => cb(data)
    ipcRenderer.on("mcp.install", listener as any)
    return () => ipcRenderer.off("mcp.install", listener as any)
  },

  // keychain
  keychainSetPassword: (service: string, account: string, password: string) => 
    ipcRenderer.invoke("keychain:setPassword", service, account, password),
  keychainGetPassword: (service: string, account: string) => 
    ipcRenderer.invoke("keychain:getPassword", service, account),
  keychainDeletePassword: (service: string, account: string) => 
    ipcRenderer.invoke("keychain:deletePassword", service, account),
  keychainList: () => 
    ipcRenderer.invoke("keychain:list"),
  keychainIsAvailable: () => 
    ipcRenderer.invoke("keychain:isAvailable"),
  keychainOnDecryptFailed: (cb: (service: string, account: string) => void) => {
    const listener = (_event: Electron.IpcMainInvokeEvent, { service, account }: { service: string; account: string }) => cb(service, account)
    ipcRenderer.on("keychain:credentialDecryptFailed", listener as any)
    return () => ipcRenderer.off("keychain:credentialDecryptFailed", listener as any)
  },
})

// --------- Preload scripts loading ---------
import "../../shared/preload.js"
