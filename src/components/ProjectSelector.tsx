import React, { useEffect, useState } from "react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { 
  currentProjectIdAtom, 
  projectsAtom, 
  loadProjectsAtom, 
  switchProjectAtom,
  loadCurrentProjectIdAtom,
  projectsLoadingAtom
} from "@/atoms/projectState"
import { oapUserAtom } from "@/atoms/oapState"
import { restartHost } from "@/ipc/host"
import Select from "./Select"
import { useTranslation } from "react-i18next"
import Tooltip from "./Tooltip"

interface ProjectSelectorProps {
  onManageClick?: () => void
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ onManageClick }) => {
  const { t } = useTranslation()
  const [currentProjectId, setCurrentProjectId] = useAtom(currentProjectIdAtom)
  const projects = useAtomValue(projectsAtom)
  const loading = useAtomValue(projectsLoadingAtom)
  const loadProjects = useSetAtom(loadProjectsAtom)
  const switchProject = useSetAtom(switchProjectAtom)
  const loadCurrentId = useSetAtom(loadCurrentProjectIdAtom)
  const currentUser = useAtomValue(oapUserAtom)
  const [isRestarting, setIsRestarting] = useState(false)

  // Load current project ID and projects list on mount
  useEffect(() => {
    const init = async () => {
      await loadCurrentId()
      const hubUrl = currentUser?.hubUrl
      await loadProjects(hubUrl)
    }
    init()
  }, [loadCurrentId, loadProjects, currentUser?.hubUrl])

  const handleProjectSwitch = async (projectId: string) => {
    // If switching to the same project, do nothing
    if (projectId === currentProjectId) return

    console.log(`[ProjectSelector] Switching from ${currentProjectId} to ${projectId}`)
    setIsRestarting(true)
    
    try {
      // Step 1: Switch project (saves to file)
      const result = await switchProject(projectId)
      if (!result.success) {
        console.error(`[ProjectSelector] Project switch failed`)
        setIsRestarting(false)
        return
      }
      
      console.log(`[ProjectSelector] Project switched successfully to ${projectId}`)
      
      // Step 2: Restart Host to load new project's MCP config
      console.log(`[ProjectSelector] Restarting MCP Host...`)
      const restartResult = await restartHost()
      
      if (!restartResult.success) {
        console.error(`[ProjectSelector] Host restart failed:`, restartResult.error)
        alert(`Failed to restart MCP Host: ${restartResult.error}. Please restart the application manually.`)
        setIsRestarting(false)
        return
      }
      
      console.log(`[ProjectSelector] Host restarted successfully on port ${restartResult.port}`)
      
      // Step 3: Reload the page to refresh all UI state
      console.log(`[ProjectSelector] Reloading page...`)
      window.location.reload()
      
    } catch (error) {
      console.error(`[ProjectSelector] Error during project switch:`, error)
      alert(`Failed to switch project: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsRestarting(false)
    }
  }

  // Find current project to display its name
  const currentProject = projects.find(p => p.id === currentProjectId)
  const displayName = currentProject?.name || currentProjectId || "Default"

  const options = projects.length > 0 ? projects.map(project => ({
    value: project.id,
    label: (
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {project.isDefault && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.6 }}>
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
          </svg>
        )}
        <span>{project.name}</span>
      </div>
    ),
    info: project.description
  })) : [{
    value: "default",
    label: <span>Default</span>,
    info: "Default project"
  }]

  return (
    <div className="project-selector" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <Select
        options={options}
        value={currentProjectId}
        onSelect={handleProjectSwitch}
        placeholder={isRestarting ? t("projects.restarting") || "Restarting..." : (loading ? t("project.loading") : displayName)}
        className="project-select-button"
        fullWidth={false}
        disabled={isRestarting || loading}
      />
      {isRestarting && (
        <span style={{ fontSize: "12px", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>
          🔄 {t('projects.restartingHost') || "Restarting Host..."}
        </span>
      )}
    </div>
  )
}

export default React.memo(ProjectSelector)
