/// <reference types="vite/client" />

import type { MCPServerSearchParam, OAPMCPServer, OAPUser, ApiResponse, OAPModelDescription, OAPModelDescriptionParam } from "../types/oap"
import type { ModelGroupSetting } from "../types/model"

type ModelResults = {
  error?: string
  results: string[]
}

declare global {
  interface Window {
    // expose in the `electron/preload/index.ts`
    ipcRenderer: import("electron").IpcRenderer & {
      port: () => Promise<number>
      getResourcesPath: (p: string) => Promise<string>
      openScriptsDir: () => Promise<void>
      fillPathToConfig: (config: string) => Promise<string>
      openaiModelList: (apiKey: string) => Promise<ModelResults>
      openaiCompatibleModelList: (apiKey: string, baseURL: string) => Promise<ModelResults>
      anthropicModelList: (apiKey: string, baseURL: string) => Promise<ModelResults>
      ollamaModelList: (baseURL: string) => Promise<ModelResults>
      googleGenaiModelList: (apiKey: string) => Promise<ModelResults>
      mistralaiModelList: (apiKey: string) => Promise<ModelResults>
      bedrockModelList: (accessKeyId: string, secretAccessKey: string, sessionToken: string, region: string) => Promise<ModelResults>
      azureOpenaiModelList: (apiKey: string, azureEndpoint: string, azureDeployment: string, apiVersion: string) => Promise<ModelResults>
      showSelectionContextMenu: () => Promise<void>
      showInputContextMenu: () => Promise<void>
      getHotkeyMap: () => Promise<Record<string, any>>
      getPlatform: () => Promise<string>
      getAutoLaunch: () => Promise<boolean>
      setAutoLaunch: (enable: boolean) => Promise<void>
      getMinimalToTray: () => Promise<boolean>
      setMinimalToTray: (enable: boolean) => Promise<void>
      getAuthToken: () => Promise<string>
      windowMinimize: () => Promise<void>
      windowMaximize: () => Promise<void>
      windowClose: () => Promise<void>
      windowIsMaximized: () => Promise<boolean>
      onReceivePort: (callback: (port: number) => void) => void
      download: (url: string) => Promise<void>
      copyImage: (url: string) => Promise<void>
      oapLogin: (regist?: boolean) => Promise<void>
      oapLogout: () => Promise<void>
      oapGetToken: () => Promise<string>
      oapSearchMCPServer: (params: MCPServerSearchParam) => Promise<ApiResponse<OAPMCPServer[]>>
      oapModelDescription: (params?: OAPModelDescriptionParam) => Promise<ApiResponse<OAPModelDescription[]>>
      oapGetMe: () => Promise<ApiResponse<OAPUser>>
      oapRegistEvent: (event: "login" | "logout", callback: () => void) => () => void
      oapGetUsage: () => Promise<OAPUsage>
      oapLoginWithToken: (token: string) => Promise<{ success: boolean }>
      getModelSettings: () => Promise<ModelGroupSetting>
      setModelSettings: (settings: ModelGroupSetting) => Promise<void>
      listenRefresh: (cb: () => void) => () => void
      listenMcpApply: (cb: (id: string) => void) => () => void
      refreshConfig: () => Promise<void>
      restartHost: () => Promise<{ success: boolean; port?: number; error?: string }>
      onReceiveInstallHostDependenciesLog: (callback: (data: string) => void) => () => void
      getInstallHostDependenciesLog: () => Promise<string[]>
      readLocalLogo: (logoPath: string) => Promise<string | null>

      // Sync
      syncGetStatus: () => Promise<{ enabled: boolean; lastSyncAt: string }>
      syncSetEnabled: (enabled: boolean) => Promise<{ success: boolean }>
      syncRun: () => Promise<{ success: boolean; pushed: number; pulled: number; error?: string }>
      onReceiveSyncCompleted: (callback: (result: { success: boolean; pushed: number; pulled: number }) => void) => () => void

      // Project
      getCurrentProject: () => Promise<string>
      setCurrentProject: (projectId: string) => Promise<{ success: boolean; projectId: string }>
      projectList: (hubUrl?: string) => Promise<Array<{ id: string; name: string; description?: string }>>
      projectCreate: (data: { name: string; description?: string }, hubUrl?: string) => Promise<{ id: string; name: string }>
      projectUpdate: (projectId: string, data: { name?: string; description?: string }, hubUrl?: string) => Promise<{ id: string; name: string }>
      projectDelete: (projectId: string, hubUrl?: string) => Promise<{ success: boolean }>

      // OAP OAuth
      oapGetOAuthConfig: () => Promise<ApiResponse<{ oauthEnabled: boolean; brandText: string; providers: Array<{ name: string; displayName: string }> }>>
      oapLoginWithOAuth: (provider: string) => Promise<{ success: boolean }>

      // Keychain
      keychainSetPassword: (service: string, account: string, password: string) => Promise<{ success: boolean; error?: string }>
      keychainGetPassword: (service: string, account: string) => Promise<{ success: boolean; password?: string; error?: string }>
      keychainDeletePassword: (service: string, account: string) => Promise<{ success: boolean; error?: string }>
      keychainList: () => Promise<{ 
        success: boolean
        credentials?: Array<{ service: string; account: string; createdAt: string; updatedAt: string }>
        error?: string 
      }>
      keychainIsAvailable: () => Promise<{ success: boolean; available: boolean }>
      keychainOnDecryptFailed: (cb: (service: string, account: string) => void) => () => void
    }

    PLATFORM: "darwin" | "win32" | "linux"
    isDev: boolean

    __TAURI_INTERNALS__: object
    __TAURI_METADATA__: {
      app: object
    }
  }
}
