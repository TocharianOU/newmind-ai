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

export async function getModelSettings() {
  if (isElectron) {
    return window.ipcRenderer.getModelSettings()
  }
  if (isWeb) {
    const res = await webConfigFetch("/api/config/model")
    if (!res.ok) return null
    const data = await res.json()
    return data?.data ?? data ?? null
  }

  const home = await path.homeDir()
  const appDir = await path.join(home, ".attacktrace")
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
    await webConfigFetch("/api/config/model", {
      method: "POST",
      body: JSON.stringify(settings),
    })
    return
  }

  const home = await path.homeDir()
  const appDir = await path.join(home, ".attacktrace")
  const configDir = await path.join(appDir, "config")
  const configPath = await path.join(configDir, "model_settings.json")
  await writeTextFile(configPath, JSON.stringify(settings))
}