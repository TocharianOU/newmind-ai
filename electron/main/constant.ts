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
export const appDir = path.join(homeDir, ".attacktrace")
export const scriptsDir = path.join(appDir, "scripts")
// Always use ~/.attacktrace/config for consistency between dev and production
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
    "module": "attacktrace_mcp_host.oap_plugin",
    "config": {},
    "ctx_manager": "attacktrace_mcp_host.oap_plugin.OAPPlugin",
    "static_callbacks": "attacktrace_mcp_host.oap_plugin.get_static_callbacks"
  }
]

const dbPath = path.join(configDir, "db.sqlite")
export const DEF_ATTACKTRACE_HTTPD_CONFIG = {
  "db": {
    "uri": `sqlite:///${dbPath}`,
    "pool_size": 5,
    "pool_recycle": 60,
    "max_overflow": 10,
    "echo": false,
    "pool_pre_ping": true,
    "migrate": true
  },
  "checkpointer": {
    "uri": `sqlite:///${dbPath}`
  }
}

export const cwd = app.isPackaged ? path.join(__dirname, "../..") : process.cwd()

// ===== Project Mode Support =====

/**
 * Get project directory path
 * @param projectId Project ID, defaults to 'default'
 * @returns Project directory path
 */
export function getProjectDir(projectId: string = 'default'): string {
  return path.join(appDir, "projects", projectId)
}

/**
 * Get project's config file path
 * @param projectId Project ID
 * @returns MCP config file path
 */
export function getProjectConfigPath(projectId: string = 'default'): string {
  return path.join(getProjectDir(projectId), "mcp_config.json")
}

/**
 * Get project's database file path
 * @param projectId Project ID
 * @returns Database file path
 */
export function getProjectDbPath(projectId: string = 'default'): string {
  return path.join(getProjectDir(projectId), "db.sqlite")
}

/**
 * Get project's cache directory path
 * @param projectId Project ID
 * @returns Cache directory path
 */
export function getProjectCacheDir(projectId: string = 'default'): string {
  return path.join(getProjectDir(projectId), "cache")
}

/**
 * Get project's reports directory path
 * @param projectId Project ID
 * @returns Reports directory path
 */
export function getProjectReportsDir(projectId: string = 'default'): string {
  return path.join(getProjectDir(projectId), "reports")
}

/**
 * Get current project file path
 * @returns Current project config file path
 */
export function getCurrentProjectFilePath(): string {
  return path.join(appDir, "current_project.json")
}