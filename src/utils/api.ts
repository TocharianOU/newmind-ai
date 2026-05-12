import { getCurrentProject } from "@/ipc/project"
import { getWebToken } from "@/ipc/oap"

type ApiFetchInit = RequestInit & {
  /** Explicitly override which project ID is sent in X-Project-ID.
   *  Useful when editing a project that is NOT the currently active one. */
  projectId?: string
}

/**
 * Enhanced fetch wrapper that automatically injects X-Project-ID and auth headers.
 *
 * Browser deployments authenticate via Hub JWT. The Hub validates it and
 * injects X-Auth-Token + X-User-ID when proxying to the MCP Host.
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

  const token = getWebToken()
  if (token) {
    headers.set("Authorization", `Bearer ${token}`)
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
