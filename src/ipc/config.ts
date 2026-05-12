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
  // Browser mode: model settings are persisted in localStorage. The MCP Host's
  // /api/config/model uses a different
  // schema and must not be used for frontend model group settings.
  const raw = localStorage.getItem(WEB_MODEL_SETTINGS_KEY)
  if (!raw) return null
  try { return JSON.parse(raw) } catch { return null }
}

export async function setModelSettings(settings: any) {
  // Web mode: persist to localStorage — see getModelSettings for rationale.
  localStorage.setItem(WEB_MODEL_SETTINGS_KEY, JSON.stringify(settings))
}