import { atom } from "jotai"

export type ModalSize = "small" | "medium" | "large"

export type ModalConfig = 
  | { 
      type: "createProject"
      data?: { name?: string; description?: string }
    }
  | {
      type: "editProject"
      data: { id: string; name: string; description?: string }
    }
  | {
      type: "confirm"
      data: {
        title: string
        message: string
        confirmText?: string
        cancelText?: string
        onConfirm: () => void | Promise<void>
        onCancel?: () => void
      }
    }
  | {
      type: "alert"
      data: {
        title: string
        message: string
        okText?: string
      }
    }
  | {
      type: "custom"
      data: {
        title: string
        content: React.ReactNode
        size?: ModalSize
        onClose?: () => void
      }
    }

export type Modal = {
  id: string
  config: ModalConfig
  size?: ModalSize
}

export const modalStackAtom = atom<Modal[]>([])

export const openModalAtom = atom(
  null,
  (get, set, modal: Omit<Modal, "id">) => {
    const currentModals = get(modalStackAtom)
    const id = `modal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    set(modalStackAtom, [...currentModals, { ...modal, id }])
    return id
  }
)

export const closeModalAtom = atom(
  null,
  (get, set, modalId?: string) => {
    const currentModals = get(modalStackAtom)
    if (modalId) {
      set(modalStackAtom, currentModals.filter(m => m.id !== modalId))
    } else {
      // Close the top modal
      const newModals = [...currentModals]
      newModals.pop()
      set(modalStackAtom, newModals)
    }
  }
)

export const closeAllModalsAtom = atom(
  null,
  (_get, set) => {
    set(modalStackAtom, [])
  }
)

// Helper to get the active modal (top of stack)
export const activeModalAtom = atom(
  (get) => {
    const stack = get(modalStackAtom)
    return stack[stack.length - 1] || null
  }
)
