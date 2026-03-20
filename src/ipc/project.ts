/**
 * Project management IPC wrapper
 */
import { isWeb } from "./env"
import { getWebToken } from "./oap"

export interface Project {
  id: string
  name: string
  description?: string
  isDefault: boolean
  createdAt?: string
  updatedAt?: string
  local?: boolean
  _count?: {
    chatSessions: number
    userMcpConfigs: number
    auditLogs: number
  }
}

export interface CreateProjectRequest {
  name: string
  description?: string
}

export interface UpdateProjectRequest {
  name?: string
  description?: string
}

const isElectron = typeof window !== "undefined" && window.ipcRenderer

// Web mode: current project tracked in sessionStorage so it persists across
// page refreshes but resets when the browser tab is closed.
const WEB_PROJECT_KEY = "attacktrace_current_project"

function webProjectFetch(path: string, options?: RequestInit): Promise<Response> {
  const token = getWebToken()
  const headers = new Headers(options?.headers || {})
  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (!headers.has("Content-Type") && options?.body) {
    headers.set("Content-Type", "application/json")
  }
  return fetch(path, { ...options, headers })
}

/**
 * Get current project ID
 */
export async function getCurrentProject(): Promise<string> {
  if (isElectron) {
    return window.ipcRenderer.invoke("project:getCurrentProject")
  }
  if (isWeb) {
    return sessionStorage.getItem(WEB_PROJECT_KEY) || "default"
  }
  return "default"
}

/**
 * Set current project
 */
export async function setCurrentProject(projectId: string): Promise<{ success: boolean; projectId: string }> {
  if (isElectron) {
    return window.ipcRenderer.invoke("project:setCurrentProject", projectId)
  }
  if (isWeb) {
    sessionStorage.setItem(WEB_PROJECT_KEY, projectId)
    return { success: true, projectId }
  }
  return { success: false, projectId: "default" }
}

/**
 * Get project list
 */
export async function projectList(_hubUrl?: string): Promise<{ projects: Project[]; error?: string }> {
  if (isElectron) {
    return window.ipcRenderer.invoke("project:list", _hubUrl)
  }
  if (isWeb) {
    const res = await webProjectFetch("/api/v1/projects")
    if (!res.ok) return { projects: [], error: `HTTP ${res.status}` }
    const data = await res.json()
    return { projects: data.data ?? data.projects ?? [] }
  }
  return { projects: [] }
}

/**
 * Create new project
 */
export async function projectCreate(
  data: CreateProjectRequest,
  _hubUrl?: string
): Promise<{ project: Project }> {
  if (isElectron) {
    return window.ipcRenderer.invoke("project:create", data, _hubUrl)
  }
  if (isWeb) {
    const res = await webProjectFetch("/api/v1/projects", {
      method: "POST",
      body: JSON.stringify(data),
    })
    const json = await res.json()
    return { project: json.data ?? json.project }
  }
  throw new Error("Not supported in browser mode")
}

/**
 * Update project
 */
export async function projectUpdate(
  projectId: string,
  data: UpdateProjectRequest,
  _hubUrl?: string
): Promise<{ project: Project }> {
  if (isElectron) {
    return window.ipcRenderer.invoke("project:update", projectId, data, _hubUrl)
  }
  if (isWeb) {
    const res = await webProjectFetch(`/api/v1/projects/${projectId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
    const json = await res.json()
    return { project: json.data ?? json.project }
  }
  throw new Error("Not supported in browser mode")
}

/**
 * Delete project
 */
export async function projectDelete(
  projectId: string,
  _hubUrl?: string
): Promise<{ success: boolean; message: string }> {
  if (isElectron) {
    return window.ipcRenderer.invoke("project:delete", projectId, _hubUrl)
  }
  if (isWeb) {
    const res = await webProjectFetch(`/api/v1/projects/${projectId}`, { method: "DELETE" })
    const json = await res.json()
    return { success: res.ok, message: json.message ?? "" }
  }
  throw new Error("Not supported in browser mode")
}
