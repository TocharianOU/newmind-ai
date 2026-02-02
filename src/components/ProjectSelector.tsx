import React, { useEffect } from "react"
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
    const result = await switchProject(projectId)
    if (result.success) {
      // Trigger reload of tools and configurations
      window.location.reload()
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
    <div className="project-selector" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
      <Select
        options={options}
        value={currentProjectId}
        onSelect={handleProjectSwitch}
        placeholder={loading ? t("project.loading") : displayName}
        size="s"
        type="outline"
        fullWidth={false}
      />
    </div>
  )
}

export default React.memo(ProjectSelector)
