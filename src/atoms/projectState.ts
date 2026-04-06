import { atom } from "jotai"
import { 
  getCurrentProject, 
  setCurrentProject, 
  projectList, 
  projectCreate, 
  projectUpdate, 
  projectDelete,
  type Project,
  type CreateProjectRequest,
  type UpdateProjectRequest
} from "@/ipc/project"

export type { Project, CreateProjectRequest, UpdateProjectRequest }

// Current active project ID
export const currentProjectIdAtom = atom<string>("default")

// All available projects
export const projectsAtom = atom<Project[]>([])

// Loading state
export const projectsLoadingAtom = atom<boolean>(false)

// Error state
export const projectsErrorAtom = atom<string | null>(null)

// Current project details (derived atom)
export const currentProjectAtom = atom<Project | null>(
  (get) => {
    const projectId = get(currentProjectIdAtom)
    const projects = get(projectsAtom)
    return projects.find(p => p.id === projectId) || null
  }
)

// Load current project ID, auto-resolving the isDefault project on first visit
export const loadCurrentProjectIdAtom = atom(
  null,
  async (get, set) => {
    try {
      let projectId = await getCurrentProject()

      if (projectId === "default") {
        const result = await projectList()
        if (result.projects?.length > 0) {
          const defaultProject = result.projects.find(p => p.isDefault) || result.projects[0]
          if (defaultProject.id !== "default") {
            projectId = defaultProject.id
            await setCurrentProject(projectId)
          }
          set(projectsAtom, result.projects)
        }
      }

      console.log(`[ProjectState] Loaded project ID: ${projectId}`)
      set(currentProjectIdAtom, projectId)
      return projectId
    } catch (error) {
      console.error("Failed to load current project ID:", error)
      set(currentProjectIdAtom, "default")
      return "default"
    }
  }
)

// Load projects list
export const loadProjectsAtom = atom(
  null,
  async (get, set, hubUrl?: string) => {
    set(projectsLoadingAtom, true)
    set(projectsErrorAtom, null)
    
    try {
      const result = await projectList(hubUrl)
      
      if (result.error) {
        set(projectsErrorAtom, result.error)
        set(projectsAtom, [])
      } else {
        set(projectsAtom, result.projects)
      }
      
      return result
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to load projects"
      set(projectsErrorAtom, errorMessage)
      set(projectsAtom, [])
      return { projects: [], error: errorMessage }
    } finally {
      set(projectsLoadingAtom, false)
    }
  }
)

// Switch to a different project
export const switchProjectAtom = atom(
  null,
  async (get, set, projectId: string) => {
    try {
      console.log(`[ProjectState] Switching project to: ${projectId}`)
      const result = await setCurrentProject(projectId)
      
      if (result.success) {
        console.log(`[ProjectState] Project switch successful, updating atom to: ${result.projectId}`)
        set(currentProjectIdAtom, result.projectId)
        
        // Reload tools and configs for new project context
        // This will trigger re-fetching with new X-Project-ID header
        if (typeof window !== 'undefined') {
          console.log(`[ProjectState] Dispatching project-switched event`)
          window.dispatchEvent(new CustomEvent('project-switched', { 
            detail: { projectId: result.projectId } 
          }))
        }
      } else {
        console.error(`[ProjectState] Project switch failed`)
      }
      
      return result
    } catch (error) {
      console.error("Failed to switch project:", error)
      return { success: false, projectId: get(currentProjectIdAtom) }
    }
  }
)

// Create new project
export const createProjectAtom = atom(
  null,
  async (get, set, data: CreateProjectRequest, hubUrl?: string) => {
    try {
      const result = await projectCreate(data, hubUrl)
      
      // Reload projects list
      await set(loadProjectsAtom, hubUrl)
      
      return result
    } catch (error) {
      console.error("Failed to create project:", error)
      throw error
    }
  }
)

// Update project
export const updateProjectAtom = atom(
  null,
  async (get, set, projectId: string, data: UpdateProjectRequest, hubUrl?: string) => {
    try {
      const result = await projectUpdate(projectId, data, hubUrl)
      
      // Reload projects list
      await set(loadProjectsAtom, hubUrl)
      
      return result
    } catch (error) {
      console.error("Failed to update project:", error)
      throw error
    }
  }
)

// Delete project
export const deleteProjectAtom = atom(
  null,
  async (get, set, projectId: string, hubUrl?: string) => {
    try {
      const result = await projectDelete(projectId, hubUrl)
      
      if (result.success) {
        // Reload projects list
        await set(loadProjectsAtom, hubUrl)
        
        // If deleted project was current, switch to default
        const currentId = get(currentProjectIdAtom)
        if (currentId === projectId) {
          await set(switchProjectAtom, "default")
        }
      }
      
      return result
    } catch (error) {
      console.error("Failed to delete project:", error)
      throw error
    }
  }
)
