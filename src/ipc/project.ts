/**
 * Project management IPC wrapper
 */

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

const isElectron = typeof window !== 'undefined' && window.ipcRenderer

/**
 * Get current project ID
 */
export async function getCurrentProject(): Promise<string> {
  if (isElectron) {
    return window.ipcRenderer.invoke('project:getCurrentProject')
  }
  return 'default'
}

/**
 * Set current project
 */
export async function setCurrentProject(projectId: string): Promise<{ success: boolean; projectId: string }> {
  if (isElectron) {
    return window.ipcRenderer.invoke('project:setCurrentProject', projectId)
  }
  return { success: false, projectId: 'default' }
}

/**
 * Get project list
 */
export async function projectList(hubUrl?: string): Promise<{ projects: Project[]; error?: string }> {
  if (isElectron) {
    return window.ipcRenderer.invoke('project:list', hubUrl)
  }
  return { projects: [] }
}

/**
 * Create new project
 */
export async function projectCreate(
  data: CreateProjectRequest,
  hubUrl?: string
): Promise<{ project: Project }> {
  if (isElectron) {
    return window.ipcRenderer.invoke('project:create', data, hubUrl)
  }
  throw new Error('Not supported in browser mode')
}

/**
 * Update project
 */
export async function projectUpdate(
  projectId: string,
  data: UpdateProjectRequest,
  hubUrl?: string
): Promise<{ project: Project }> {
  if (isElectron) {
    return window.ipcRenderer.invoke('project:update', projectId, data, hubUrl)
  }
  throw new Error('Not supported in browser mode')
}

/**
 * Delete project
 */
export async function projectDelete(
  projectId: string,
  hubUrl?: string
): Promise<{ success: boolean; message: string }> {
  if (isElectron) {
    return window.ipcRenderer.invoke('project:delete', projectId, hubUrl)
  }
  throw new Error('Not supported in browser mode')
}
