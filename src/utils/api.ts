import { getCurrentProject } from "@/ipc/project"

/**
 * Enhanced fetch wrapper that automatically injects X-Project-ID and X-Auth-Token headers
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const currentProjectId = await getCurrentProject()

  const headers = new Headers(init?.headers || {})
  
  // Inject X-Project-ID header for all project-scoped requests
  if (currentProjectId) {
    headers.set('X-Project-ID', currentProjectId)
  }

  // Security: Inject X-Auth-Token header for MCP Host authentication
  try {
    const authToken = await window.ipcRenderer.getAuthToken()
    if (authToken) {
      headers.set('X-Auth-Token', authToken)
    }
  } catch (error) {
    console.error("[Security] Failed to get auth token:", error)
  }

  const enhancedInit: RequestInit = {
    ...init,
    headers
  }

  return fetch(input, enhancedInit)
}

/**
 * Convenience methods for common HTTP verbs
 */
export const api = {
  get: async (url: string, options?: RequestInit) => {
    return apiFetch(url, { ...options, method: 'GET' })
  },

  post: async (url: string, body?: any, options?: RequestInit) => {
    return apiFetch(url, {
      ...options,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      body: body ? JSON.stringify(body) : undefined
    })
  },

  put: async (url: string, body?: any, options?: RequestInit) => {
    return apiFetch(url, {
      ...options,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      body: body ? JSON.stringify(body) : undefined
    })
  },

  patch: async (url: string, body?: any, options?: RequestInit) => {
    return apiFetch(url, {
      ...options,
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers
      },
      body: body ? JSON.stringify(body) : undefined
    })
  },

  delete: async (url: string, options?: RequestInit) => {
    return apiFetch(url, { ...options, method: 'DELETE' })
  }
}
