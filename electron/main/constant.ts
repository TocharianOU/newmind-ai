import { app } from "electron"
import envPaths from "env-paths"
import os from "os"
import path from "path"
import { fileURLToPath } from "url"

export const __dirname = path.dirname(fileURLToPath(import.meta.url))

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, "../..")

export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron")
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist")
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST

export const envPath = envPaths(app.getName(), {suffix: ""})
export const legacyConfigDir = envPath.config
export const cacheDir = envPath.cache
export const homeDir = os.homedir()
export const appDir = path.join(homeDir, ".newmind")
export const scriptsDir = path.join(appDir, "scripts")
// Always use ~/.newmind/config for consistency between dev and production
export const configDir = path.join(appDir, "config")
export const hostCacheDir = path.join(appDir, "host_cache")
export const logDir = path.join(appDir, "log")

export const binDirList = [
  path.join(process.resourcesPath, "node"),
  path.join(process.resourcesPath, "uv"),
  path.join(process.resourcesPath, "python", "bin"),
]

export const darwinPathList = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  path.join(process.resourcesPath, "node", "bin"),
  path.join(process.resourcesPath, "uv"),
]

export const DEF_MCP_SERVER_CONFIG = {
  "mcpServers": {
    "echo": {
      "enabled": true,
      "command": "node",
      "args": [
        path.join(scriptsDir, "mcp-server-echo", "dist", "index.js")
      ]
    }
    // Note: Kibana and Elasticsearch are now available through IntegrationMarket
    // No need for hardcoded defaults - users can install from the hub
  }
}

export const DEF_MODEL_CONFIG = {
  "activeProvider": "none",
  "configs": {},
  "enableTools": true
}

export const DEF_PLUGIN_CONFIG = [
  {
    "name": "oap-platform",
    "module": "oap_mcp_host.oap_plugin",
    "config": {},
    "ctx_manager": "oap_mcp_host.oap_plugin.OAPPlugin",
    "static_callbacks": "oap_mcp_host.oap_plugin.get_static_callbacks"
  }
]

// Legacy global db.sqlite path (for reference only)
const legacyDbPath = path.join(configDir, "db.sqlite")

// Default config uses a placeholder path - will be dynamically set based on current project
export const DEF_ATTACKTRACE_HTTPD_CONFIG = {
  "db": {
    "uri": `sqlite:///${legacyDbPath}`,  // Placeholder, will be overridden at runtime
    "pool_size": 5,
    "pool_recycle": 60,
    "max_overflow": 10,
    "echo": false,
    "pool_pre_ping": true,
    "migrate": true
  },
  "checkpointer": {
    "uri": `sqlite:///${legacyDbPath}`  // Placeholder, will be overridden at runtime
  }
}

// ===== Project Mode Support =====

/**
 * Get user-scoped base directory.
 * When a userId is supplied every project lives under:
 *   ~/.newmind/users/{userId}/projects/{projectId}/
 * so that different OAP accounts never share database files or configs.
 */
export function getUserDir(userId: string): string {
  return path.join(appDir, "users", userId)
}

/** Allow alphanumeric, hyphens, underscores, and dots. Max 128 chars. */
const SAFE_ID_RE = /^[a-zA-Z0-9._-]{1,128}$/

/**
 * Validate that a projectId or userId contains only safe characters.
 * Throws if the value is unsafe (prevents path traversal).
 */
export function assertSafeId(value: string, label = "id"): void {
  if (!value || !SAFE_ID_RE.test(value)) {
    throw new Error(`Invalid ${label}: "${value}" — only alphanumeric, -, _, . (max 128 chars) allowed`)
  }
}

/**
 * Get project directory path.
 * @param projectId Project ID (defaults to 'default')
 * @param userId   OAP user ID – when provided the path is user-scoped;
 *                 when omitted the legacy machine-level path is used.
 */
export function getProjectDir(projectId: string = 'default', userId?: string): string {
  if (userId) {
    return path.join(getUserDir(userId), "projects", projectId)
  }
  // Legacy / offline fallback: machine-level (no user isolation)
  return path.join(appDir, "projects", projectId)
}

/**
 * Get project's MCP config file path.
 */
export function getProjectConfigPath(projectId: string = 'default', userId?: string): string {
  return path.join(getProjectDir(projectId, userId), "mcp_config.json")
}

/**
 * Get project's database file path.
 * Pass userId to get the user-scoped path; omit for the legacy fallback.
 */
export function getProjectDbPath(projectId: string = 'default', userId?: string): string {
  return path.join(getProjectDir(projectId, userId), "db.sqlite")
}

/**
 * Get the legacy (non-user-scoped) database path for a project.
 * Used only during first-login migration.
 */
export function getLegacyProjectDbPath(projectId: string = 'default'): string {
  return path.join(appDir, "projects", projectId, "db.sqlite")
}

/**
 * Get project's cache directory path.
 */
export function getProjectCacheDir(projectId: string = 'default', userId?: string): string {
  return path.join(getProjectDir(projectId, userId), "cache")
}

/**
 * Get project's reports directory path.
 */
export function getProjectReportsDir(projectId: string = 'default', userId?: string): string {
  return path.join(getProjectDir(projectId, userId), "reports")
}

/**
 * Get the current-project tracking file path.
 * Per-user so that different accounts can have different active projects.
 */
export function getCurrentProjectFilePath(userId?: string): string {
  if (userId) {
    return path.join(getUserDir(userId), "current_project.json")
  }
  // Legacy / offline fallback
  return path.join(appDir, "current_project.json")
}

/**
 * Generate oap_httpd config for a specific project.
 * @param projectId Project ID (defaults to 'default')
 * @param userId    OAP user ID for user-scoped DB path
 */
export function getProjectHttpdConfig(projectId: string = 'default', userId?: string) {
  const projectDbPath = getProjectDbPath(projectId, userId)
  return {
    "db": {
      "uri": `sqlite:///${projectDbPath}`,
      "pool_size": 5,
      "pool_recycle": 60,
      "max_overflow": 10,
      "echo": false,
      "pool_pre_ping": true,
      "migrate": true
    },
    "checkpointer": {
      "uri": `sqlite:///${projectDbPath}`
    }
  }
}

export const cwd = app.isPackaged ? path.join(__dirname, "../..") : process.cwd()