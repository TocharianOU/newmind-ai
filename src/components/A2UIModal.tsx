import React, { useEffect } from "react"
import A2UIRenderer from "./A2UIRenderer"
import type { A2UIResponse, A2UIFormData } from "../types/a2ui"
import "../styles/a2ui-modal.scss"

interface A2UIModalProps {
  a2uiData: A2UIResponse
  onSubmit: (data: A2UIFormData) => void
  onClose: () => void
}

const A2UIModal: React.FC<A2UIModalProps> = ({ a2uiData, onSubmit, onClose }) => {
  useEffect(() => {
    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden'
    
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  const handleSubmit = (formData: A2UIFormData) => {
    onSubmit(formData)
    onClose()
  }

  return (
    <div className="a2ui-modal-overlay" onClick={handleOverlayClick}>
      <div className="a2ui-modal-container">
        <div className="a2ui-modal-content">
          <A2UIRenderer
            schema={a2uiData.schema}
            onSubmit={handleSubmit}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  )
}

export default A2UIModal

