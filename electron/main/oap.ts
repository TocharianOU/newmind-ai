import { ApiResponse, OAPModelDescriptionParam, MCPServerSearchParam, OAPUsage, OAPUser, OAPModelDescription } from "../../types/oap"
import { OAPMCPServer } from "../../types/oap"
import { serviceStatus } from "./service"
import { oapStore as store } from "./store"
import EventEmitter from "node:events"
import { OAP_ROOT_URL } from "../../shared/oap"
import { safeStorage } from "electron"

/**
 * JWT Token payload interface
 */
interface JWTPayload {
  userId: string
  iat: number // Issued at
  exp: number // Expiration time
}

/**
 * Decode JWT token without verification (client-side only for expiration check)
 * @param token - JWT token string
 * @returns Decoded payload or null if invalid
 */
function decodeJWT(token: string): JWTPayload | null {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) {
      return null
    }
    
    // Decode base64url payload
    const payload = parts[1]
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const jsonPayload = Buffer.from(base64, 'base64').toString('utf8')
    return JSON.parse(jsonPayload) as JWTPayload
  } catch (error) {
    console.error('[Security] Failed to decode JWT:', error)
    return null
  }
}

/**
 * Check if JWT token is expired or will expire soon
 * @param token - JWT token string
 * @param bufferSeconds - Consider expired if expiring within this many seconds (default: 3600 = 1 hour)
 * @returns True if expired or expiring soon
 */
function isTokenExpiringSoon(token: string, bufferSeconds: number = 3600): boolean {
  const payload = decodeJWT(token)
  if (!payload || !payload.exp) {
    return true // Invalid token, consider expired
  }
  
  const now = Math.floor(Date.now() / 1000)
  const expiresIn = payload.exp - now
  
  console.log(`[Security] Token expires in ${expiresIn} seconds (${Math.floor(expiresIn / 60)} minutes)`)
  
  return expiresIn < bufferSeconds
}

/**
 * Get decrypted OAP token from secure storage
 * @returns Decrypted token or undefined if not available
 */
let decryptFailureLogged = false

function migrateLegacyToken(): string | undefined {
  const legacyToken = store.get("token") as string | undefined
  if (!legacyToken) {
    return undefined
  }

  // Best-effort migration from legacy plaintext token storage.
  if (safeStorage.isEncryptionAvailable()) {
    try {
      const encrypted = safeStorage.encryptString(legacyToken)
      store.set("encryptedToken", encrypted.toString("base64"))
      store.delete("token")
      console.log("[Security] Migrated legacy token to secure storage")
      return legacyToken
    } catch (error) {
      console.error("[Security] Failed to migrate legacy token:", error)
    }
  }

  return legacyToken
}

export const getToken = (): string | undefined => {
  const encryptedToken = store.get("encryptedToken") as string | undefined
  if (!encryptedToken) {
    return migrateLegacyToken()
  }

  if (!safeStorage.isEncryptionAvailable()) {
    console.warn("[Security] Encryption unavailable, falling back to legacy token")
    return migrateLegacyToken()
  }

  try {
    // Decrypt token
    const encrypted = Buffer.from(encryptedToken, "base64")
    const decrypted = safeStorage.decryptString(encrypted)
    if (decrypted) {
      return decrypted
    }
  } catch (error) {
    if (!decryptFailureLogged) {
      console.error("[Security] Failed to decrypt token, clearing corrupted token:", error)
      decryptFailureLogged = true
    }
    // Corrupted token (keychain changed, stale data, etc.)
    store.delete("encryptedToken")
  }

  return migrateLegacyToken()
}

/**
 * Extract the OAP user ID from the stored JWT token without a network call.
 */
export const getUserId = (): string | undefined => {
  const token = getToken()
  if (!token) return undefined
  return decodeJWT(token)?.userId || undefined
}

/**
 * Store encrypted OAP token using system secure storage
 * @param token - Plain text token to encrypt and store
 */
export const setToken = (token: string): void => {
  try {
    if (!token) {
      // Clear token
      store.delete("encryptedToken")
      store.delete("token")
      store.delete("encryptedRefreshToken")
      return
    }

    // Check if encryption is available
    if (!safeStorage.isEncryptionAvailable()) {
      console.error("[Security] Encryption not available, cannot store token securely")
      throw new Error("Secure storage not available")
    }

    // Encrypt and store token
    const encrypted = safeStorage.encryptString(token)
    const base64Token = encrypted.toString("base64")
    store.set("encryptedToken", base64Token)
    console.log("[Security] Token encrypted and stored securely")
  } catch (error) {
    console.error("[Security] Failed to encrypt token:", error)
    throw error
  }
}

/**
 * Get decrypted refresh token from secure storage
 * @returns Decrypted refresh token or undefined if not available
 */
export const getRefreshToken = (): string | undefined => {
  const encryptedToken = store.get("encryptedRefreshToken") as string | undefined
  if (!encryptedToken) {
    return undefined
  }

  if (!safeStorage.isEncryptionAvailable()) {
    console.warn("[Security] Encryption unavailable, cannot retrieve refresh token")
    return undefined
  }

  try {
    const encrypted = Buffer.from(encryptedToken, "base64")
    const decrypted = safeStorage.decryptString(encrypted)
    return decrypted || undefined
  } catch (error) {
    console.error("[Security] Failed to decrypt refresh token:", error)
    store.delete("encryptedRefreshToken")
    return undefined
  }
}

/**
 * Store encrypted refresh token using system secure storage
 * @param refreshToken - Plain text refresh token to encrypt and store
 */
export const setRefreshToken = (refreshToken: string): void => {
  try {
    if (!refreshToken) {
      store.delete("encryptedRefreshToken")
      return
    }

    if (!safeStorage.isEncryptionAvailable()) {
      console.error("[Security] Encryption not available, cannot store refresh token securely")
      throw new Error("Secure storage not available")
    }

    const encrypted = safeStorage.encryptString(refreshToken)
    const base64Token = encrypted.toString("base64")
    store.set("encryptedRefreshToken", base64Token)
    console.log("[Security] Refresh token encrypted and stored securely")
  } catch (error) {
    console.error("[Security] Failed to encrypt refresh token:", error)
    throw error
  }
}

class OAPClient {
  public loggedIn: boolean
  private eventEmitter = new EventEmitter()
  private tokenCheckInterval: NodeJS.Timeout | null = null

  constructor() {
    const token = getToken()
    this.loggedIn = !!token
    if (token) {
      this.startTokenRefreshTimer()
    }
  }

  registEvent(event: "login" | "logout", callback: () => void) {
    this.eventEmitter.on(event, callback)
  }

  login(token: string, refreshToken?: string) {
    setToken(token)
    if (refreshToken) {
      setRefreshToken(refreshToken)
    }
    this.loggedIn = true
    this.eventEmitter.emit("login")
    this.startTokenRefreshTimer()
  }

  async logout() {
    const token = getToken()
    if (token) {
      await this.fetch("/api/v1/user/logout").catch(console.error)
    }

    this.stopTokenRefreshTimer()
    setToken("")
    this.loggedIn = false
    this.eventEmitter.emit("logout")

    const url = `http://${serviceStatus.ip}:${serviceStatus.port}`
    fetch(`${url}/api/plugins/oap-platform/auth`, {
      method: "DELETE",
      headers: {
        "X-Auth-Token": serviceStatus.authToken || "",
      },
    })
      .then((res) => console.log("oap logout", res.status))
  }

  fetch<T>(url: string, options: RequestInit = {}) {
    const token = getToken()
    if (!token) {
      this.logout()
      throw new Error("not logged in")
    }

    return fetch(`${OAP_ROOT_URL}${url}`, {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${token}`,
      },
    }).then((res) => res.text() as Promise<T>)
    .then(text => {
      try {
        return JSON.parse(text as string) as T
      } catch (_error) {
        return text as T
      }
    })
  }

  searchMCPServer(params: MCPServerSearchParam) {
    const form = new FormData()
    Object.entries(params).forEach(([key, value]) => {
      form.append(key, `${value}`)
    })

    return this.fetch<ApiResponse<OAPMCPServer[]>>("/api/v1/user/mcp/search", {
      method: "POST",
      body: form,
    })
  }

  modelDescription(params?: OAPModelDescriptionParam) {
    if (params && params?.models.length > 0) {
      return this.fetch<ApiResponse<OAPModelDescription[]>>("/api/v1/llms/query", {
        method: "POST",
        body: JSON.stringify(params),
      })
    } else {
      return this.fetch<ApiResponse<OAPModelDescription[]>>("/api/v1/llms")
    }
  }

  getMe() {
    return this.fetch<ApiResponse<OAPUser>>("/api/v1/user/me")
  }

  getUsage() {
    return this.fetch<ApiResponse<OAPUsage>>("/api/v1/user/usage")
  }

  /**
   * Start periodic token refresh timer
   * Checks every 30 minutes if token needs refresh
   */
  private startTokenRefreshTimer() {
    this.stopTokenRefreshTimer()
    
    // Check immediately on start
    this.checkAndRefreshToken().catch(console.error)
    
    // Check every 30 minutes
    this.tokenCheckInterval = setInterval(() => {
      this.checkAndRefreshToken().catch(console.error)
    }, 30 * 60 * 1000) // 30 minutes
    
    console.log('[Security] Token refresh timer started')
  }

  /**
   * Stop token refresh timer
   */
  private stopTokenRefreshTimer() {
    if (this.tokenCheckInterval) {
      clearInterval(this.tokenCheckInterval)
      this.tokenCheckInterval = null
      console.log('[Security] Token refresh timer stopped')
    }
  }

  /**
   * Check if token is expiring soon and refresh if needed
   */
  private async checkAndRefreshToken(): Promise<void> {
    const token = getToken()
    if (!token) {
      return
    }

    // Check if token expires within 1 hour
    if (isTokenExpiringSoon(token, 3600)) {
      console.log('[Security] Token expiring soon, attempting refresh...')
      
      const refreshToken = getRefreshToken()
      if (!refreshToken) {
        console.warn('[Security] No refresh token available, user will need to re-login')
        // Don't logout immediately, let the user continue until token actually expires
        return
      }

      try {
        await this.refreshAccessToken(refreshToken)
        console.log('[Security] Token refreshed successfully')
      } catch (error) {
        console.error('[Security] Failed to refresh token:', error)
        // If refresh fails, user will need to re-login when token expires
      }
    }
  }

  /**
   * Refresh access token using refresh token
   * @param refreshToken - Refresh token
   */
  private async refreshAccessToken(refreshToken: string): Promise<void> {
    try {
      const response = await fetch(`${OAP_ROOT_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      })

      if (!response.ok) {
        throw new Error(`Token refresh failed: ${response.status}`)
      }

      const data = await response.json()
      
      if (data.success && data.data?.accessToken) {
        // Store new access token
        setToken(data.data.accessToken)
        
        // Store new refresh token if provided
        if (data.data.refreshToken) {
          setRefreshToken(data.data.refreshToken)
        }
        
        console.log('[Security] Access token refreshed')
      } else {
        throw new Error('Invalid refresh response')
      }
    } catch (error) {
      console.error('[Security] Token refresh failed:', error)
      throw error
    }
  }
}

export const oapClient = new OAPClient()