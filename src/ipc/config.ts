import { isElectron } from "./env"
import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs"
import * as path from "@tauri-apps/api/path"

export async function getModelSettings() {
  if (isElectron) {
    return window.ipcRenderer.getModelSettings()
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

  const home = await path.homeDir()
  const appDir = await path.join(home, ".attacktrace")
  const configDir = await path.join(appDir, "config")
  const configPath = await path.join(configDir, "model_settings.json")
  await writeTextFile(configPath, JSON.stringify(settings))
}