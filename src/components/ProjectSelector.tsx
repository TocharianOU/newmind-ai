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
import { currentUserAtom } from "@/atoms/oapState"
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
  const currentUser = useAtomValue(currentUserAtom)

  // Load current project ID and projects list on mount
  useEffect(() => {
    const init = async () => {
      await loadCurrentId()
      const hubUrl = currentUser?.hubUrl
      await loadProjects(hubUrl)
    }
    init()
  }, [])

  const handleProjectSwitch = async (projectId: string) => {
    const result = await switchProject(projectId)
    if (result.success) {
      // Trigger reload of tools and configurations
      window.location.reload()
    }
  }

  const options = projects.map(project => ({
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
  }))

  return (
    <div className="project-selector" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <Select
        options={options}
        value={currentProjectId}
        onSelect={handleProjectSwitch}
        placeholder={loading ? t("project.loading") : t("project.selectProject")}
        size="s"
        type="outline"
        fullWidth={false}
      />
      
      {onManageClick && (
        <Tooltip content={t("project.manageProjects")}>
          <button
            className="icon-btn"
            onClick={onManageClick}
            style={{
              padding: "6px",
              borderRadius: "4px",
              border: "1px solid var(--border-color)",
              background: "transparent",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19.43 12.98c.04-.32.07-.64.07-.98s-.03-.66-.07-.98l2.11-1.65c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.3-.61-.22l-2.49 1c-.52-.4-1.08-.73-1.69-.98l-.38-2.65C14.46 2.18 14.25 2 14 2h-4c-.25 0-.46.18-.49.42l-.38 2.65c-.61.25-1.17.59-1.69.98l-2.49-1c-.23-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64l2.11 1.65c-.04.32-.07.65-.07.98s.03.66.07.98l-2.11 1.65c-.19.15-.24.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1c.52.4 1.08.73 1.69.98l.38 2.65c.03.24.24.42.49.42h4c.25 0 .46-.18.49-.42l.38-2.65c.61-.25 1.17-.59 1.69-.98l2.49 1c.23.09.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.65zM12 15.5c-1.93 0-3.5-1.57-3.5-3.5s1.57-3.5 3.5-3.5 3.5 1.57 3.5 3.5-1.57 3.5-3.5 3.5z"/>
            </svg>
          </button>
        </Tooltip>
      )}
    </div>
  )
}

export default React.memo(ProjectSelector)
