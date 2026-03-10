import React, { useEffect } from "react"
import { useAtomValue, useSetAtom } from "jotai"
import {
  projectsAtom,
  projectsLoadingAtom,
  projectsErrorAtom,
  loadProjectsAtom,
  deleteProjectAtom,
  type Project
} from "@/atoms/projectState"
import { oapUserAtom } from "@/atoms/oapState"
import { openModalAtom } from "@/atoms/unifiedModalState"
import { useProjectSwitch } from "@/hooks/useProjectSwitch"
import Button from "@/components/Button"
import { useTranslation } from "react-i18next"
import "../../styles/drawer/_ProjectManagement.scss"

const ProjectManagement: React.FC = () => {
  const { t } = useTranslation()
  const projects = useAtomValue(projectsAtom)
  const loading = useAtomValue(projectsLoadingAtom)
  const error = useAtomValue(projectsErrorAtom)
  const currentUser = useAtomValue(oapUserAtom)
  const loadProjects = useSetAtom(loadProjectsAtom)
  const deleteProject = useSetAtom(deleteProjectAtom)
  const openModal = useSetAtom(openModalAtom)
  const { switchToProject, isRestarting, currentProjectId } = useProjectSwitch()

  useEffect(() => {
    loadProjects(currentUser?.hubUrl)
  }, [currentUser, loadProjects])

  const handleCreate = () => {
    openModal({ config: { type: "createProject" }, size: "medium" })
  }

  const handleEdit = (project: Project) => {
    openModal({
      config: {
        type: "editProject",
        data: { id: project.id, name: project.name, description: project.description || "" }
      },
      size: "medium"
    })
  }

  const handleEditPrompt = (project: Project) => {
    openModal({
      config: {
        type: "editProject",
        data: { id: project.id, name: project.name, description: project.description || "", initialTab: "prompt" }
      },
      size: "medium"
    })
  }

  const handleSwitch = (project: Project) => {
    switchToProject(project.id)
  }

  const handleDelete = (project: Project) => {
    if (project.isDefault) {
      openModal({
        config: { type: "alert", data: { title: t("project.error"), message: t("project.cannotDeleteDefault") } }
      })
      return
    }
    openModal({
      config: {
        type: "confirm",
        data: {
          title: t("project.deleteConfirmTitle"),
          message: t("project.confirmDelete", { name: project.name }),
          confirmText: t("project.delete"),
          cancelText: t("common.cancel"),
          onConfirm: async () => {
            try {
              await deleteProject(project.id, currentUser?.hubUrl)
            } catch (err) {
              openModal({
                config: {
                  type: "alert",
                  data: {
                    title: t("project.error"),
                    message: t("project.deleteFailed") + ": " + (err instanceof Error ? err.message : "Unknown error")
                  }
                }
              })
            }
          }
        }
      }
    })
  }

  return (
    <div className="pm-drawer">
      <div className="pm-drawer__header">
        <h2>{t("project.title")}</h2>
        <Button onClick={handleCreate} color="blue" size="fit" padding="s">
          + {t("project.createNew")}
        </Button>
      </div>

      {error && <div className="pm-error">{error}</div>}

      {loading ? (
        <div className="pm-loading">{t("project.loading")}</div>
      ) : projects.length === 0 ? (
        <div className="pm-empty">
          <p>{t("project.noProjects")}</p>
          <Button onClick={handleCreate} color="blue" size="fit" padding="s">
            {t("project.createFirstProject")}
          </Button>
        </div>
      ) : (
        <div className="pm-list">
          {projects.map(project => {
            const isActive = project.id === currentProjectId
            return (
              <div key={project.id} className={`pm-card ${isActive ? "pm-card--active" : ""}`}>
                <div className="pm-card__top">
                  <div className="pm-card__identity">
                    {project.isDefault && (
                      <svg className="pm-card__star" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                      </svg>
                    )}
                    <span className="pm-card__name">{project.name}</span>
                    {isActive && <span className="pm-card__badge">{t("project.current")}</span>}
                  </div>
                  <div className="pm-card__actions">
                    {!isActive && (
                      <button
                        className="pm-btn pm-btn--switch"
                        onClick={() => handleSwitch(project)}
                        disabled={isRestarting}
                        title={t("project.switchTo")}
                      >
                        {isRestarting ? "..." : t("project.switchTo")}
                      </button>
                    )}
                    <button className="pm-btn pm-btn--icon" onClick={() => handleEdit(project)} title={t("project.edit")}>
                      <svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>
                    </button>
                    {!project.isDefault && (
                      <button className="pm-btn pm-btn--icon pm-btn--danger" onClick={() => handleDelete(project)} title={t("project.delete")}>
                        <svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                      </button>
                    )}
                  </div>
                </div>
                {project.description && (
                  <p className="pm-card__desc">{project.description}</p>
                )}
                <div className="pm-card__footer">
                  <button className="pm-btn pm-btn--prompt" onClick={() => handleEditPrompt(project)}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h7m-7 4h4M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z" />
                    </svg>
                    {t("project.tabPrompt")}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default React.memo(ProjectManagement)
