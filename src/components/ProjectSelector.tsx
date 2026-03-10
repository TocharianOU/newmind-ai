import React, { useEffect } from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { 
  projectsAtom, 
  loadProjectsAtom, 
  loadCurrentProjectIdAtom,
  projectsLoadingAtom
} from "@/atoms/projectState"
import { oapUserAtom } from "@/atoms/oapState"
import { useProjectSwitch } from "@/hooks/useProjectSwitch"
import Select from "./Select"
import { useTranslation } from "react-i18next"
import Tooltip from "./Tooltip"

interface ProjectSelectorProps {
  onManageClick?: () => void
}

const ProjectSelector: React.FC<ProjectSelectorProps> = ({ onManageClick }) => {
  const { t } = useTranslation()
  const projects = useAtomValue(projectsAtom)
  const loading = useAtomValue(projectsLoadingAtom)
  const loadProjects = useSetAtom(loadProjectsAtom)
  const loadCurrentId = useSetAtom(loadCurrentProjectIdAtom)
  const currentUser = useAtomValue(oapUserAtom)
  const { switchToProject, isRestarting, currentProjectId } = useProjectSwitch()

  // Load current project ID and projects list on mount
  useEffect(() => {
    const init = async () => {
      await loadCurrentId()
      const hubUrl = currentUser?.hubUrl
      await loadProjects(hubUrl)
    }
    init()
  }, [loadCurrentId, loadProjects, currentUser?.hubUrl])

  // Find current project to display its name
  const currentProject = projects.find(p => p.id === currentProjectId)
  const displayName = currentProject?.name || currentProjectId || "Default"

  const options = projects.length > 0 ? projects.map(project => ({
    value: project.id,
    label: (
      <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
        {project.isDefault && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style={{ opacity: 0.5, flexShrink: 0 }}>
            <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
          </svg>
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{project.name}</span>
      </div>
    ),
  })) : [{
    value: "default",
    label: <span>Default</span>,
  }]

  return (
    <div className="project-selector" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <Select
        options={options}
        value={currentProjectId}
        onSelect={switchToProject}
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
