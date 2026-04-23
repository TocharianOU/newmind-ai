import { isElectron, isWeb } from "./env"
import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs"
import * as path from "@tauri-apps/api/path"
import { getWebToken } from "./oap"

function webConfigFetch(url: string, options?: RequestInit) {
  const token = getWebToken()
  const headers = new Headers(options?.headers || {})
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (!headers.has("Content-Type") && options?.body) {
    headers.set("Content-Type", "application/json")
  }
  return fetch(url, { ...options, headers })
}

const WEB_MODEL_SETTINGS_KEY = "newmind_model_settings"

export async function getModelSettings() {
  if (isElectron) {
    return window.ipcRenderer.getModelSettings()
  }
  if (isWeb) {
    // Web mode: model settings are persisted in localStorage (same format as
    // the desktop file). The MCP Host's /api/config/model uses a different
    // schema and must not be used for frontend model group settings.
    const raw = localStorage.getItem(WEB_MODEL_SETTINGS_KEY)
    if (!raw) return null
    try { return JSON.parse(raw) } catch { return null }
  }

  const home = await path.homeDir()
  const appDir = await path.join(home, ".newmind")
  const configDir = await path.join(appDir, "config")
  const configPath = await path.join(configDir, "model_settings.json")
  if (!(await exists(configPath))) {
    return null
  }

  const contents = await readTextFile(configPath)
  return JSON.parse(contents)
}

export async function setModelSettings(settings: any) {
  if (isElectron) {
    return window.ipcRenderer.setModelSettings(settings)
  }
  if (isWeb) {
    // Web mode: persist to localStorage — see getModelSettings for rationale.
    localStorage.setItem(WEB_MODEL_SETTINGS_KEY, JSON.stringify(settings))
    return
  }

  const home = await path.homeDir()
  const appDir = await path.join(home, ".newmind")
  const configDir = await path.join(appDir, "config")
  const configPath = await path.join(configDir, "model_settings.json")
  await writeTextFile(configPath, JSON.stringify(settings))
}