import { getCurrentProject } from "@/ipc/project"
import { isWeb } from "@/ipc/env"
import { getWebToken } from "@/ipc/oap"

type ApiFetchInit = RequestInit & {
  /** Explicitly override which project ID is sent in X-Project-ID.
   *  Useful when editing a project that is NOT the currently active one. */
  projectId?: string
}

/**
 * Enhanced fetch wrapper that automatically injects X-Project-ID and auth headers.
 *
 * Desktop / Tauri: injects X-Auth-Token (shared secret with local MCP Host).
 * Web: injects Authorization: Bearer {jwt} — the Hub validates it and injects
 *      X-Auth-Token + X-User-ID when proxying to the MCP Host.
 */
export async function apiFetch(
  input: RequestInfo | URL,
  init?: ApiFetchInit
): Promise<Response> {
  const { projectId: overrideProjectId, ...restInit } = init || {}
  const currentProjectId = overrideProjectId ?? await getCurrentProject()

  const headers = new Headers(restInit?.headers || {})
  
  if (currentProjectId) {
    headers.set("X-Project-ID", currentProjectId)
  }

  if (isWeb) {
    // Web mode: authenticate via Hub JWT — Hub forwards with internal token
    const token = getWebToken()
    if (token) {
      headers.set("Authorization", `Bearer ${token}`)
    }
  } else {
    // Desktop / Tauri mode: authenticate directly against local MCP Host
    try {
      const authToken = await window.ipcRenderer.getAuthToken()
      if (authToken) {
        headers.set("X-Auth-Token", authToken)
      }
    } catch (error) {
      console.error("[Security] Failed to get auth token:", error)
    }
  }

  return fetch(input, { ...restInit, headers })
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
