import React, { useEffect } from "react"
import { useAtomValue, useSetAtom } from "jotai"
import {
  projectsAtom,
  projectsLoadingAtom,
  projectsErrorAtom,
  loadProjectsAtom,
  deleteProjectAtom,
  currentProjectIdAtom,
  type Project
} from "@/atoms/projectState"
import { oapUserAtom } from "@/atoms/oapState"
import { openModalAtom } from "@/atoms/unifiedModalState"
import Button from "@/components/Button"
import { useTranslation } from "react-i18next"
import "../../styles/drawer/_ProjectManagement.scss"

const ProjectManagement: React.FC = () => {
  const { t } = useTranslation()
  const projects = useAtomValue(projectsAtom)
  const loading = useAtomValue(projectsLoadingAtom)
  const error = useAtomValue(projectsErrorAtom)
  const currentProjectId = useAtomValue(currentProjectIdAtom)
  const currentUser = useAtomValue(oapUserAtom)
  const loadProjects = useSetAtom(loadProjectsAtom)
  const deleteProject = useSetAtom(deleteProjectAtom)
  const openModal = useSetAtom(openModalAtom)

  useEffect(() => {
    const hubUrl = currentUser?.hubUrl
    loadProjects(hubUrl)
  }, [currentUser, loadProjects])

  const handleCreate = () => {
    openModal({
      config: { type: "createProject" },
      size: "medium"
    })
  }

  const handleEdit = (project: Project) => {
    openModal({
      config: {
        type: "editProject",
        data: {
          id: project.id,
          name: project.name,
          description: project.description || ""
        }
      },
      size: "medium"
    })
  }

  const handleDelete = async (project: Project) => {
    if (project.isDefault) {
      openModal({
        config: {
          type: "alert",
          data: {
            title: t("project.error"),
            message: t("project.cannotDeleteDefault")
          }
        }
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
              const hubUrl = currentUser?.hubUrl
              await deleteProject(project.id, hubUrl)
            } catch (error) {
              openModal({
                config: {
                  type: "alert",
                  data: {
                    title: t("project.error"),
                    message: t("project.deleteFailed") + ": " + (error instanceof Error ? error.message : "Unknown error")
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
    <div className="project-management-drawer-container">
      <div className="project-management-drawer-header">
        <h2>{t("project.title")}</h2>
        <Button onClick={handleCreate} size="fit" padding="s">
          {t("project.createNew")}
        </Button>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-spinner">
          {t("project.loading")}...
        </div>
      ) : (
        <div className="projects-list">
          {projects.length === 0 ? (
            <div className="empty-state">
              {t("project.noProjects")}
            </div>
          ) : (
            projects.map(project => (
              <div
                key={project.id}
                className={`project-card ${currentProjectId === project.id ? "active" : ""}`}
              >
                <div className="project-card-header">
                  <div className="project-card-title">
                    {project.isDefault && (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="default-icon">
                        <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                      </svg>
                    )}
                    <h3>{project.name}</h3>
                    {currentProjectId === project.id && (
                      <span className="current-badge">{t("project.current")}</span>
                    )}
                  </div>
                  <div className="project-card-actions">
                    <button
                      className="icon-btn"
                      onClick={() => handleEdit(project)}
                      title={t("project.edit")}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                      </svg>
                    </button>
                    {!project.isDefault && (
                      <button
                        className="icon-btn danger"
                        onClick={() => handleDelete(project)}
                        title={t("project.delete")}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                        </svg>
                      </button>
                    )}
                  </div>
                </div>
                {project.description && (
                  <p className="project-card-description">{project.description}</p>
                )}
                <div className="project-card-stats">
                  {project._count && (
                    <>
                      <span>{t("project.sessions")}: {project._count.chatSessions || 0}</span>
                      <span>{t("project.integrations")}: {project._count.userMcpConfigs || 0}</span>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default React.memo(ProjectManagement)
