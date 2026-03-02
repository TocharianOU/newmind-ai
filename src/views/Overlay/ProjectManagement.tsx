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
import "../../styles/overlay/_ProjectManagement.scss"

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
    <div className="pm-page">
      <div className="pm-page__header">
        <div>
          <h2>{t("project.title")}</h2>
          <p className="pm-page__subtitle">{t("project.manageProjects")}</p>
        </div>
        <Button onClick={handleCreate} color="blue" size="fit" padding="s">
          + {t("project.createNew")}
        </Button>
      </div>

      {error && <div className="pm-error">{error}</div>}

      {loading ? (
        <div className="pm-loading">{t("project.loading")}</div>
      ) : projects.length === 0 ? (
        <div className="pm-empty">
          <div className="pm-empty__icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
            </svg>
          </div>
          <p>{t("project.noProjects")}</p>
          <Button onClick={handleCreate} color="blue" size="fit" padding="s">
            {t("project.createFirstProject")}
          </Button>
        </div>
      ) : (
        <div className="pm-grid">
          {projects.map(project => {
            const isActive = project.id === currentProjectId
            return (
              <div key={project.id} className={`pm-card ${isActive ? "pm-card--active" : ""}`}>
                <div className="pm-card__header">
                  <div className="pm-card__identity">
                    {project.isDefault && (
                      <svg className="pm-card__star" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                      </svg>
                    )}
                    <h3 className="pm-card__name">{project.name}</h3>
                    {isActive && <span className="pm-card__badge pm-card__badge--active">{t("project.current")}</span>}
                    {project.isDefault && !isActive && (
                      <span className="pm-card__badge pm-card__badge--default">{t("project.default")}</span>
                    )}
                  </div>
                  <div className="pm-card__actions">
                    {!isActive && (
                      <button
                        className="pm-btn pm-btn--switch"
                        onClick={() => handleSwitch(project)}
                        disabled={isRestarting}
                      >
                        {isRestarting ? "..." : t("project.switchTo")}
                      </button>
                    )}
                    <button className="pm-btn pm-btn--icon" onClick={() => handleEdit(project)} title={t("project.edit")}>
                      <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                      </svg>
                    </button>
                    {!project.isDefault && (
                      <button className="pm-btn pm-btn--icon pm-btn--danger" onClick={() => handleDelete(project)} title={t("project.delete")}>
                        <svg viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>

                {project.description && (
                  <p className="pm-card__desc">{project.description}</p>
                )}

                {project._count && (
                  <div className="pm-card__stats">
                    <div className="pm-stat">
                      <svg className="pm-stat__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                      </svg>
                      <span>{project._count.chatSessions || 0} {t("project.sessions")}</span>
                    </div>
                    <div className="pm-stat">
                      <svg className="pm-stat__icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                      </svg>
                      <span>{project._count.userMcpConfigs || 0} {t("project.integrations")}</span>
                    </div>
                  </div>
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
