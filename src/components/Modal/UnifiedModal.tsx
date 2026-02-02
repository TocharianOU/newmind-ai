import React, { useEffect, useRef } from "react"
import { useSetAtom } from "jotai"
import { closeModalAtom, type Modal, type ModalSize } from "../../atoms/unifiedModalState"
import Button from "../Button"
import WrappedInput from "../WrappedInput"
import WrappedTextarea from "../WrappedTextarea"
import { useTranslation } from "react-i18next"
import "./UnifiedModal.scss"
import {
  createProjectAtom,
  updateProjectAtom,
  type CreateProjectRequest,
  type UpdateProjectRequest
} from "../../atoms/projectState"
import { oapUserAtom } from "../../atoms/oapState"
import { useAtomValue } from "jotai"

type UnifiedModalProps = {
  modal: Modal
}

const UnifiedModal: React.FC<UnifiedModalProps> = ({ modal }) => {
  const { t } = useTranslation()
  const closeModal = useSetAtom(closeModalAtom)
  const modalRef = useRef<HTMLDivElement>(null)

  const sizeClass = modal.size || (
    modal.config.type === "confirm" || modal.config.type === "alert" ? "small" : "medium"
  )

  // Handle ESC key
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeModal(modal.id)
      }
    }

    document.addEventListener("keydown", handleEsc)
    return () => document.removeEventListener("keydown", handleEsc)
  }, [modal.id, closeModal])

  // Prevent body scroll
  useEffect(() => {
    const scrollY = window.scrollY
    document.body.style.overflow = "hidden"
    document.body.style.position = "fixed"
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = "100%"

    return () => {
      document.body.style.overflow = ""
      document.body.style.position = ""
      document.body.style.top = ""
      document.body.style.width = ""
      window.scrollTo(0, scrollY)
    }
  }, [])

  const renderContent = () => {
    switch (modal.config.type) {
      case "createProject":
        return <CreateProjectModal modalId={modal.id} data={modal.config.data} />
      case "editProject":
        return <EditProjectModal modalId={modal.id} data={modal.config.data} />
      case "confirm":
        return <ConfirmModal modalId={modal.id} data={modal.config.data} />
      case "alert":
        return <AlertModal modalId={modal.id} data={modal.config.data} />
      case "custom":
        return <CustomModal modalId={modal.id} data={modal.config.data} />
      default:
        return <div>Unknown modal type</div>
    }
  }

  return (
    <div className="unified-modal-container">
      <div 
        className="unified-modal-mask" 
        onClick={() => closeModal(modal.id)}
      />
      <div 
        ref={modalRef}
        className={`unified-modal unified-modal-${sizeClass}`}
      >
        {renderContent()}
      </div>
    </div>
  )
}

// Create Project Modal
const CreateProjectModal: React.FC<{ modalId: string; data?: { name?: string; description?: string } }> = ({ modalId, data }) => {
  const { t } = useTranslation()
  const closeModal = useSetAtom(closeModalAtom)
  const createProject = useSetAtom(createProjectAtom)
  const currentUser = useAtomValue(oapUserAtom)
  const [formData, setFormData] = React.useState<CreateProjectRequest>({
    name: data?.name || "",
    description: data?.description || ""
  })
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const handleSubmit = async () => {
    if (!formData.name?.trim()) {
      setError(t("project.nameRequired"))
      return
    }

    setLoading(true)
    setError("")

    try {
      const hubUrl = currentUser?.hubUrl
      await createProject(formData, hubUrl)
      closeModal(modalId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="modal-header">
        <h3>{t("project.createNew")}</h3>
        <button className="close-btn" onClick={() => closeModal(modalId)}>×</button>
      </div>
      <div className="modal-body">
        <div className="form-group">
          <label>{t("project.name")}</label>
          <WrappedInput
            value={formData.name || ""}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder={t("project.namePlaceholder")}
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label>{t("project.description")}</label>
          <WrappedTextarea
            value={formData.description || ""}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder={t("project.descriptionPlaceholder")}
            rows={3}
            disabled={loading}
          />
        </div>
        {error && <div className="form-error">{error}</div>}
      </div>
      <div className="modal-footer">
        <Button onClick={() => closeModal(modalId)} variant="secondary" disabled={loading}>
          {t("common.cancel")}
        </Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? t("common.creating") : t("common.create")}
        </Button>
      </div>
    </>
  )
}

// Edit Project Modal
const EditProjectModal: React.FC<{ modalId: string; data: { id: string; name: string; description?: string } }> = ({ modalId, data }) => {
  const { t } = useTranslation()
  const closeModal = useSetAtom(closeModalAtom)
  const updateProject = useSetAtom(updateProjectAtom)
  const currentUser = useAtomValue(oapUserAtom)
  const [formData, setFormData] = React.useState<UpdateProjectRequest>({
    name: data.name,
    description: data.description || ""
  })
  const [error, setError] = React.useState("")
  const [loading, setLoading] = React.useState(false)

  const handleSubmit = async () => {
    if (!formData.name?.trim()) {
      setError(t("project.nameRequired"))
      return
    }

    setLoading(true)
    setError("")

    try {
      const hubUrl = currentUser?.hubUrl
      await updateProject(data.id, formData, hubUrl)
      closeModal(modalId)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update project")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="modal-header">
        <h3>{t("project.edit")}</h3>
        <button className="close-btn" onClick={() => closeModal(modalId)}>×</button>
      </div>
      <div className="modal-body">
        <div className="form-group">
          <label>{t("project.name")}</label>
          <WrappedInput
            value={formData.name || ""}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder={t("project.namePlaceholder")}
            disabled={loading}
          />
        </div>
        <div className="form-group">
          <label>{t("project.description")}</label>
          <WrappedTextarea
            value={formData.description || ""}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder={t("project.descriptionPlaceholder")}
            rows={3}
            disabled={loading}
          />
        </div>
        {error && <div className="form-error">{error}</div>}
      </div>
      <div className="modal-footer">
        <Button onClick={() => closeModal(modalId)} variant="secondary" disabled={loading}>
          {t("common.cancel")}
        </Button>
        <Button onClick={handleSubmit} disabled={loading}>
          {loading ? t("common.saving") : t("common.save")}
        </Button>
      </div>
    </>
  )
}

// Confirm Modal
const ConfirmModal: React.FC<{ 
  modalId: string
  data: {
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    onConfirm: () => void | Promise<void>
    onCancel?: () => void
  }
}> = ({ modalId, data }) => {
  const { t } = useTranslation()
  const closeModal = useSetAtom(closeModalAtom)
  const [loading, setLoading] = React.useState(false)

  const handleConfirm = async () => {
    setLoading(true)
    try {
      await data.onConfirm()
      closeModal(modalId)
    } catch (error) {
      console.error("Confirm action failed:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    data.onCancel?.()
    closeModal(modalId)
  }

  return (
    <>
      <div className="modal-header">
        <h3>{data.title}</h3>
        <button className="close-btn" onClick={handleCancel}>×</button>
      </div>
      <div className="modal-body">
        <p>{data.message}</p>
      </div>
      <div className="modal-footer">
        <Button onClick={handleCancel} variant="secondary" disabled={loading}>
          {data.cancelText || t("common.cancel")}
        </Button>
        <Button onClick={handleConfirm} disabled={loading}>
          {loading ? t("common.confirming") : (data.confirmText || t("common.confirm"))}
        </Button>
      </div>
    </>
  )
}

// Alert Modal
const AlertModal: React.FC<{
  modalId: string
  data: {
    title: string
    message: string
    okText?: string
  }
}> = ({ modalId, data }) => {
  const { t } = useTranslation()
  const closeModal = useSetAtom(closeModalAtom)

  return (
    <>
      <div className="modal-header">
        <h3>{data.title}</h3>
        <button className="close-btn" onClick={() => closeModal(modalId)}>×</button>
      </div>
      <div className="modal-body">
        <p>{data.message}</p>
      </div>
      <div className="modal-footer">
        <Button onClick={() => closeModal(modalId)}>
          {data.okText || t("common.ok")}
        </Button>
      </div>
    </>
  )
}

// Custom Modal
const CustomModal: React.FC<{
  modalId: string
  data: {
    title: string
    content: React.ReactNode
    onClose?: () => void
  }
}> = ({ modalId, data }) => {
  const closeModal = useSetAtom(closeModalAtom)

  const handleClose = () => {
    data.onClose?.()
    closeModal(modalId)
  }

  return (
    <>
      <div className="modal-header">
        <h3>{data.title}</h3>
        <button className="close-btn" onClick={handleClose}>×</button>
      </div>
      <div className="modal-body">
        {data.content}
      </div>
    </>
  )
}

export default UnifiedModal
