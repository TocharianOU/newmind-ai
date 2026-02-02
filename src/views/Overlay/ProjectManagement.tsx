import React, { useState, useEffect } from "react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import {
  projectsAtom,
  projectsLoadingAtom,
  projectsErrorAtom,
  loadProjectsAtom,
  createProjectAtom,
  updateProjectAtom,
  deleteProjectAtom,
  currentProjectIdAtom,
  type Project,
  type CreateProjectRequest,
  type UpdateProjectRequest
} from "@/atoms/projectState"
import { oapUserAtom } from "@/atoms/oapState"
import Button from "@/components/Button"
import Modal from "@/components/Modal/KeymapModal"
import WrappedInput from "@/components/WrappedInput"
import WrappedTextarea from "@/components/WrappedTextarea"
import { useTranslation } from "react-i18next"
import "../../styles/overlay/_ProjectManagement.scss"

const ProjectManagement: React.FC = () => {
  const { t } = useTranslation()
  const projects = useAtomValue(projectsAtom)
  const loading = useAtomValue(projectsLoadingAtom)
  const error = useAtomValue(projectsErrorAtom)
  const currentProjectId = useAtomValue(currentProjectIdAtom)
  const currentUser = useAtomValue(oapUserAtom)
  const loadProjects = useSetAtom(loadProjectsAtom)
  const createProject = useSetAtom(createProjectAtom)
  const updateProject = useSetAtom(updateProjectAtom)
  const deleteProject = useSetAtom(deleteProjectAtom)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [formData, setFormData] = useState<CreateProjectRequest | UpdateProjectRequest>({
    name: "",
    description: ""
  })
  const [formError, setFormError] = useState<string>("")

  useEffect(() => {
    const hubUrl = currentUser?.hubUrl
    loadProjects(hubUrl)
  }, [currentUser])

  const handleCreate = () => {
    setFormData({ name: "", description: "" })
    setFormError("")
    setShowCreateModal(true)
  }

  const handleEdit = (project: Project) => {
    setSelectedProject(project)
    setFormData({ name: project.name, description: project.description || "" })
    setFormError("")
    setShowEditModal(true)
  }

  const handleDelete = async (project: Project) => {
    if (project.isDefault) {
      alert(t("project.cannotDeleteDefault"))
      return
    }

    if (!confirm(t("project.confirmDelete", { name: project.name }))) {
      return
    }

    try {
      const hubUrl = currentUser?.hubUrl
      await deleteProject(project.id, hubUrl)
    } catch (error) {
      alert(t("project.deleteFailed") + ": " + (error instanceof Error ? error.message : "Unknown error"))
    }
  }

  const handleSubmitCreate = async () => {
    if (!formData.name?.trim()) {
      setFormError(t("project.nameRequired"))
      return
    }

    try {
      const hubUrl = currentUser?.hubUrl
      await createProject(formData as CreateProjectRequest, hubUrl)
      setShowCreateModal(false)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to create project")
    }
  }

  const handleSubmitEdit = async () => {
    if (!selectedProject) return

    if (!formData.name?.trim()) {
      setFormError(t("project.nameRequired"))
      return
    }

    try {
      const hubUrl = currentUser?.hubUrl
      await updateProject(selectedProject.id, formData as UpdateProjectRequest, hubUrl)
      setShowEditModal(false)
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to update project")
    }
  }

  return (
    <div className="project-management-container">
      <div className="project-management-header">
        <h2>{t("project.title")}</h2>
        <Button onClick={handleCreate} color="blue" size="fit" padding="s">
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
                      <img src="/image/icon_edit.svg" alt="编辑" width="18" height="18" />
                    </button>
                    {!project.isDefault && (
                      <button
                        className="icon-btn danger"
                        onClick={() => handleDelete(project)}
                        title={t("project.delete")}
                      >
                        <img src="/image/icon_delete.svg" alt="删除" width="18" height="18" />
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

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t("project.createNew")}</h3>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>{t("project.name")}</label>
                <WrappedInput
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t("project.namePlaceholder")}
                />
              </div>
              <div className="form-group">
                <label>{t("project.description")}</label>
                <WrappedTextarea
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t("project.descriptionPlaceholder")}
                  rows={3}
                />
              </div>
              {formError && <div className="form-error">{formError}</div>}
            </div>
            <div className="modal-footer">
              <Button onClick={() => setShowCreateModal(false)} color="gray" size="fit">
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSubmitCreate} color="blue" size="fit">
                {t("common.create")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedProject && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{t("project.edit")}</h3>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>×</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>{t("project.name")}</label>
                <WrappedInput
                  value={formData.name || ""}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={t("project.namePlaceholder")}
                />
              </div>
              <div className="form-group">
                <label>{t("project.description")}</label>
                <WrappedTextarea
                  value={formData.description || ""}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder={t("project.descriptionPlaceholder")}
                  rows={3}
                />
              </div>
              {formError && <div className="form-error">{formError}</div>}
            </div>
            <div className="modal-footer">
              <Button onClick={() => setShowEditModal(false)} color="gray" size="fit">
                {t("common.cancel")}
              </Button>
              <Button onClick={handleSubmitEdit} color="blue" size="fit">
                {t("common.save")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default React.memo(ProjectManagement)
