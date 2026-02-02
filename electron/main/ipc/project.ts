import { ipcMain } from "electron"
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

// Current project state (in-memory cache)
let currentProjectId: string = "default"

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
}

// IPC Handlers

ipcMain.handle("project:getCurrentProject", async () => {
  return currentProjectId
})

ipcMain.handle("project:setCurrentProject", async (_, projectId: string) => {
  currentProjectId = projectId
  saveCurrentProjectId(projectId)
  ensureProjectDir(projectId)
  return { success: true, projectId }
})

ipcMain.handle("project:list", async (_, hubUrl?: string) => {
  try {
    // Get token from OAP
    const tokenResult = await ipcMain.handleOnce("oap:getToken", async () => {
      // This will be handled by oap.ts
      return null
    })
    
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

ipcMain.handle("project:create", async (_, data: { name: string; description?: string }, hubUrl?: string) => {
  try {
    // Get token
    const tokenResult = await ipcMain.handleOnce("oap:getToken", async () => null)
    
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

ipcMain.handle("project:update", async (_, projectId: string, data: { name?: string; description?: string }, hubUrl?: string) => {
  try {
    const tokenResult = await ipcMain.handleOnce("oap:getToken", async () => null)
    
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

ipcMain.handle("project:delete", async (_, projectId: string, hubUrl?: string) => {
  try {
    // Don't allow deleting default project
    if (projectId === "default") {
      throw new Error("Cannot delete default project")
    }
    
    const tokenResult = await ipcMain.handleOnce("oap:getToken", async () => null)
    
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

// Initialize current project on startup
currentProjectId = loadCurrentProjectId()
ensureProjectDir(currentProjectId)

console.log(`[Project] Initialized with project: ${currentProjectId}`)
