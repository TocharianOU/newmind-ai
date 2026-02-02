import React from "react"
import { useAtomValue } from "jotai"
import { modalStackAtom } from "../../atoms/unifiedModalState"
import UnifiedModal from "./UnifiedModal"

const ModalPortal: React.FC = () => {
  const modals = useAtomValue(modalStackAtom)

  return (
    <>
      {modals.map((modal) => (
        <UnifiedModal key={modal.id} modal={modal} />
      ))}
    </>
  )
}

export default ModalPortal
