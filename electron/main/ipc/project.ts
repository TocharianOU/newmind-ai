import { BrowserWindow } from "electron"
import fs from "fs-extra"
import path from "path"
import fetch from "node-fetch"
import {
  appDir,
  getProjectDir,
  getProjectConfigPath,
  getProjectDbPath,
  getCurrentProjectFilePath
} from "../constant"
import { safeRegisterHandler } from "../utils/ipcRegistry"
import { getToken } from "../oap"

// Current project state (in-memory cache)
// Initialize from file immediately to ensure correct initial state
let currentProjectId: string = "default"
try {
  currentProjectId = loadCurrentProjectId()
  console.log(`[Project] Initialized with project: ${currentProjectId}`)
  ensureProjectDir(currentProjectId)
} catch (e) {
  console.error("[Project] Initialization error:", e)
}

/**
 * Load current project ID from file
 */
function loadCurrentProjectId(): string {
  const filePath = getCurrentProjectFilePath()
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readJSONSync(filePath)
      return data.projectId || "default"
    }
  } catch (error) {
    console.error("Failed to load current project:", error)
  }
  return "default"
}

/**
 * Save current project ID to file
 */
function saveCurrentProjectId(projectId: string) {
  const filePath = getCurrentProjectFilePath()
  try {
    fs.ensureDirSync(path.dirname(filePath))
    fs.writeJSONSync(filePath, { projectId }, { spaces: 2 })
  } catch (error) {
    console.error("Failed to save current project:", error)
  }
}

/**
 * Ensure project directory exists
 */
function ensureProjectDir(projectId: string) {
  const projectDir = getProjectDir(projectId)
  fs.ensureDirSync(projectDir)
  fs.ensureDirSync(path.join(projectDir, "cache"))
  fs.ensureDirSync(path.join(projectDir, "reports"))
  
  // Create initial mcp_config.json if it doesn't exist
  const configPath = getProjectConfigPath(projectId)
  if (!fs.existsSync(configPath)) {
    fs.writeJSONSync(configPath, { mcpServers: {} }, { spaces: 2 })
    console.log(`[Project] Created initial config for project: ${projectId}`)
  }
}

// Initialize current project on startup (MOVED UP)
// currentProjectId = loadCurrentProjectId()
// ensureProjectDir(currentProjectId)
// console.log(`[Project] Initialized with project: ${currentProjectId}`)

export function ipcProjectHandler(_win: BrowserWindow) {
  safeRegisterHandler("project:getCurrentProject", async () => {
    return currentProjectId
  })

  safeRegisterHandler("project:setCurrentProject", async (_, projectId: string) => {
    currentProjectId = projectId
    saveCurrentProjectId(projectId)
    ensureProjectDir(projectId)
    return { success: true, projectId }
  })

  safeRegisterHandler("project:list", async (_, hubUrl?: string) => {
  try {
    const tokenResult = getToken()
    
    if (!tokenResult || !hubUrl) {
      // Fallback: list local projects from filesystem
      const projectsDir = path.join(appDir, "projects")
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
    
    // Fetch from Hub API
    const response = await fetch(`${hubUrl}/api/v1/projects`, {
      headers: {
        "Authorization": `Bearer ${tokenResult}`
      }
    })
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    
    const data = await response.json()
    return data
  } catch (error) {
    console.error("Failed to list projects:", error)
    return { projects: [], error: error.message }
  }
})

  safeRegisterHandler("project:create", async (_, data: { name: string; description?: string }, hubUrl?: string) => {
  try {
    const tokenResult = getToken()
    
    if (!tokenResult || !hubUrl) {
      // Local-only mode: create project directory
      const projectId = data.name.toLowerCase().replace(/\s+/g, "-")
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
    
    // Create via Hub API
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
    
    // Ensure local directory exists
    if (result.project?.id) {
      ensureProjectDir(result.project.id)
    }
    
    return result
  } catch (error) {
    console.error("Failed to create project:", error)
    throw error
  }
})

  safeRegisterHandler("project:update", async (_, projectId: string, data: { name?: string; description?: string }, hubUrl?: string) => {
  try {
    const tokenResult = getToken()
    
    if (!tokenResult || !hubUrl) {
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

  safeRegisterHandler("project:delete", async (_, projectId: string, hubUrl?: string) => {
  try {
    if (projectId === "default") {
      throw new Error("Cannot delete default project")
    }
    
    const tokenResult = getToken()
    
    // Delete from Hub if authenticated
    if (tokenResult && hubUrl) {
      const response = await fetch(`${hubUrl}/api/v1/projects/${projectId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${tokenResult}`
        }
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }
    }
    
    // Delete local directory
    const projectDir = getProjectDir(projectId)
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
