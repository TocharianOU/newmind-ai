import { isElectron } from "./env"
import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs"
import * as path from "@tauri-apps/api/path"

const MODEL_SETTINGS_PATH = ".dive/config/model_settings.json"

export async function getModelSettings() {
  if (isElectron) {
    return window.ipcRenderer.getModelSettings()
  }

  const home = await path.homeDir()
  const configPath = await path.join(home, MODEL_SETTINGS_PATH)
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
  const configPath = await path.join(home, MODEL_SETTINGS_PATH)
  await writeTextFile(configPath, JSON.stringify(settings))
}