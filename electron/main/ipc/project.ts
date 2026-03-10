import { BrowserWindow } from "electron"
import fs from "fs-extra"
import path from "path"
import fetch from "node-fetch"
import {
  appDir,
  getUserDir,
  getProjectDir,
  getProjectConfigPath,
  getProjectDbPath,
  getCurrentProjectFilePath,
  assertSafeId,
} from "../constant"
import { safeRegisterHandler } from "../utils/ipcRegistry"
import { getToken, getUserId } from "../oap"
import { OAP_ROOT_URL } from "../../../shared/oap"

/** Hub URL used for all project API calls — sourced from the build-time env, never from the renderer. */
function getHubUrl(): string {
  return OAP_ROOT_URL
}

// Current project state (in-memory cache)
// Initialize from file immediately to ensure correct initial state
let currentProjectId: string = "default"
function syncProjectContextFromStorage() {
  currentProjectId = loadCurrentProjectId()
  ensureProjectDir(currentProjectId)
}
try {
  syncProjectContextFromStorage()
  console.log(`[Project] Initialized with project: ${currentProjectId}`)
} catch (e) {
  console.error("[Project] Initialization error:", e)
}

/**
 * Load current project ID from the user-scoped (or legacy) tracking file.
 */
function loadCurrentProjectId(): string {
  const userId = getUserId()
  const filePath = getCurrentProjectFilePath(userId)
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readJSONSync(filePath)
      return data.projectId || "default"
    }
    // Fall back to machine-level file for legacy installations
    const legacyFilePath = getCurrentProjectFilePath()
    if (userId && fs.existsSync(legacyFilePath)) {
      const data = fs.readJSONSync(legacyFilePath)
      return data.projectId || "default"
    }
  } catch (error) {
    console.error("Failed to load current project:", error)
  }
  return "default"
}

/**
 * Save current project ID to the user-scoped tracking file.
 */
function saveCurrentProjectId(projectId: string) {
  const userId = getUserId()
  const filePath = getCurrentProjectFilePath(userId)
  try {
    fs.ensureDirSync(path.dirname(filePath))
    fs.writeJSONSync(filePath, { projectId }, { spaces: 2 })
  } catch (error) {
    console.error("Failed to save current project:", error)
  }
}

/**
 * Ensure project directory (and default config) exist for the current user.
 */
function ensureProjectDir(projectId: string) {
  const userId = getUserId()
  const projectDir = getProjectDir(projectId, userId)
  fs.ensureDirSync(projectDir)
  fs.ensureDirSync(path.join(projectDir, "cache"))
  fs.ensureDirSync(path.join(projectDir, "reports"))

  // Create initial mcp_config.json if it doesn't exist
  const configPath = getProjectConfigPath(projectId, userId)
  if (!fs.existsSync(configPath)) {
    fs.writeJSONSync(configPath, { mcpServers: {} }, { spaces: 2 })
    console.log(`[Project] Created initial config for project: ${projectId}`)
  }
}

// Initialize current project on startup (MOVED UP)
// currentProjectId = loadCurrentProjectId()
// ensureProjectDir(currentProjectId)
// console.log(`[Project] Initialized with project: ${currentProjectId}`)

/** Returns the currently active project ID (safe to call from any main-process module). */
export function getCurrentProjectId(): string {
  return currentProjectId
}

/** Refresh in-memory project context after login/logout account changes. */
export function refreshProjectContextForCurrentUser(): string {
  syncProjectContextFromStorage()
  return currentProjectId
}

export function ipcProjectHandler(_win: BrowserWindow) {
  safeRegisterHandler("project:getCurrentProject", async () => {
    // User identity may have changed since module initialization (login/logout).
    syncProjectContextFromStorage()
    return currentProjectId
  })

  safeRegisterHandler("project:setCurrentProject", async (_, projectId: string) => {
    assertSafeId(projectId, "projectId")
    currentProjectId = projectId
    saveCurrentProjectId(projectId)
    ensureProjectDir(projectId)
    return { success: true, projectId }
  })

  safeRegisterHandler("project:list", async () => {
  try {
    const tokenResult = getToken()
    const hubUrl = getHubUrl()

    if (!tokenResult) {
      // Offline / not logged in: list local projects from filesystem
      const userId = getUserId()
      const projectsDir = userId
        ? path.join(getUserDir(userId), "projects")
        : path.join(appDir, "projects")

      if (!fs.existsSync(projectsDir)) {
        return { projects: [] }
      }

      const dirs = fs.readdirSync(projectsDir, { withFileTypes: true })
      const projects = dirs
        .filter(d => d.isDirectory())
        .map(d => ({
          id: d.name,
          name: d.name.charAt(0).toUpperCase() + d.name.slice(1),
          isDefault: d.name === "default",
          local: true
        }))

      return { projects }
    }

    const response = await fetch(`${hubUrl}/api/v1/projects`, {
      headers: { "Authorization": `Bearer ${tokenResult}` }
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    const result = await response.json()

    // First-time login: Hub has no projects yet — auto-create the default project
    if (!result.error && Array.isArray(result.projects) && result.projects.length === 0) {
      console.log("[Project] No projects found in Hub, creating default project for user")
      try {
        const createResp = await fetch(`${hubUrl}/api/v1/projects`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${tokenResult}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ id: "default", name: "Default", description: "Default project", isDefault: true }),
        })
        if (createResp.ok) {
          const created = await createResp.json()
          if (created.project) {
            ensureProjectDir(created.project.id)
            return { projects: [created.project] }
          }
        }
      } catch (createErr) {
        console.error("[Project] Failed to auto-create default project:", createErr)
      }
    }

    return result
  } catch (error) {
    console.error("Failed to list projects:", error)
    return { projects: [], error: (error as Error).message }
  }
})

  safeRegisterHandler("project:create", async (_, data: { name: string; description?: string }) => {
  try {
    const tokenResult = getToken()
    const hubUrl = getHubUrl()

    if (!tokenResult) {
      // Sanitize: lowercase, spaces→dashes, strip unsafe chars
      const projectId = data.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "").substring(0, 128) || "default"
      assertSafeId(projectId, "projectId")
      ensureProjectDir(projectId)
      return {
        project: {
          id: projectId,
          name: data.name,
          description: data.description,
          isDefault: false,
          local: true
        }
      }
    }

    const response = await fetch(`${hubUrl}/api/v1/projects`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${tokenResult}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    const result = await response.json()
    if (result.project?.id) {
      ensureProjectDir(result.project.id)
    }

    return result
  } catch (error) {
    console.error("Failed to create project:", error)
    throw error
  }
})

  safeRegisterHandler("project:update", async (_, projectId: string, data: { name?: string; description?: string }) => {
  try {
    const tokenResult = getToken()
    const hubUrl = getHubUrl()

    if (!tokenResult) {
      return { project: { id: projectId, ...data } }
    }

    const response = await fetch(`${hubUrl}/api/v1/projects/${projectId}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${tokenResult}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(data)
    })

    if (!response.ok) {
      const errorData = await response.json()
      throw new Error(errorData.error || `HTTP ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error("Failed to update project:", error)
    throw error
  }
})

  safeRegisterHandler("project:delete", async (_, projectId: string) => {
  try {
    if (projectId === "default") {
      throw new Error("Cannot delete default project")
    }
    assertSafeId(projectId, "projectId")

    const tokenResult = getToken()
    const hubUrl = getHubUrl()

    if (tokenResult) {
      const response = await fetch(`${hubUrl}/api/v1/projects/${projectId}`, {
        method: "DELETE",
        headers: { "Authorization": `Bearer ${tokenResult}` }
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
    }
    
    // Delete local directory (user-scoped)
    const userId = getUserId()
    const projectDir = getProjectDir(projectId, userId)
    if (fs.existsSync(projectDir)) {
      fs.removeSync(projectDir)
    }
    
    // If this was the current project, switch to default
    if (currentProjectId === projectId) {
      currentProjectId = "default"
      saveCurrentProjectId("default")
    }
    
    return { success: true, message: "Project deleted successfully" }
  } catch (error) {
    console.error("Failed to delete project:", error)
    throw error
  }
})
}
