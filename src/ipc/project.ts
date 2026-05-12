/**
 * Project management IPC wrapper
 */
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

// Web mode: current project tracked in sessionStorage so it persists across
// page refreshes but resets when the browser tab is closed.
const WEB_PROJECT_KEY = "newmind_current_project"

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
  return sessionStorage.getItem(WEB_PROJECT_KEY) || "default"
}

/**
 * Set current project
 */
export async function setCurrentProject(projectId: string): Promise<{ success: boolean; projectId: string }> {
  sessionStorage.setItem(WEB_PROJECT_KEY, projectId)
  return { success: true, projectId }
}

/**
 * Get project list
 */
export async function projectList(_hubUrl?: string): Promise<{ projects: Project[]; error?: string }> {
  void _hubUrl
  const res = await webProjectFetch("/api/v1/projects")
  if (!res.ok) return { projects: [], error: `HTTP ${res.status}` }
  const data = await res.json()
  return { projects: data.data ?? data.projects ?? [] }
}

/**
 * Create new project
 */
export async function projectCreate(
  data: CreateProjectRequest,
  _hubUrl?: string
): Promise<{ project: Project }> {
  void _hubUrl
  const res = await webProjectFetch("/api/v1/projects", {
    method: "POST",
    body: JSON.stringify(data),
  })
  const json = await res.json()
  return { project: json.data ?? json.project }
}

/**
 * Update project
 */
export async function projectUpdate(
  projectId: string,
  data: UpdateProjectRequest,
  _hubUrl?: string
): Promise<{ project: Project }> {
  void _hubUrl
  const res = await webProjectFetch(`/api/v1/projects/${projectId}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
  const json = await res.json()
  return { project: json.data ?? json.project }
}

/**
 * Delete project
 */
export async function projectDelete(
  projectId: string,
  _hubUrl?: string
): Promise<{ success: boolean; message: string }> {
  void _hubUrl
  const res = await webProjectFetch(`/api/v1/projects/${projectId}`, { method: "DELETE" })
  const json = await res.json()
  return { success: res.ok, message: json.message ?? "" }
}
