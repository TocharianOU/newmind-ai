import React, { useEffect, useRef } from "react"
import "./Drawer.scss"

export type DrawerProps = {
  visible: boolean
  onClose: () => void
  position?: "left" | "right"
  width?: number | string
  children: React.ReactNode
  showMask?: boolean
  className?: string
  fullscreen?: boolean
  title?: string
}

const Drawer: React.FC<DrawerProps> = ({
  visible,
  onClose,
  position = "right",
  width = 700,
  children,
  showMask = true,
  className = "",
  fullscreen = true,
  title = ""
}) => {
  const drawerRef = useRef<HTMLDivElement>(null)

  // Handle ESC key
  useEffect(() => {
    if (!visible) return

    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      }
    }

    document.addEventListener("keydown", handleEsc)
    return () => document.removeEventListener("keydown", handleEsc)
  }, [visible, onClose])

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (visible) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }

    return () => {
      document.body.style.overflow = ""
    }
  }, [visible])

  if (!visible) return null

  const widthStyle = typeof width === "number" ? `${width}px` : width

  return (
    <div className={`drawer-container ${fullscreen ? "fullscreen" : ""}`}>
      {showMask && (
        <div 
          className="drawer-mask" 
          onClick={onClose}
        />
      )}
      <div 
        ref={drawerRef}
        className={`drawer ${fullscreen ? "drawer-fullscreen" : `drawer-${position}`} ${className}`}
        style={fullscreen ? {} : {
          width: widthStyle,
          [position]: 0
        }}
      >
        {fullscreen && (
          <div className="drawer-fullscreen-header">
            <button className="drawer-back-button" onClick={onClose}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span>返回</span>
            </button>
            {title && <h1 className="drawer-fullscreen-title">{title}</h1>}
          </div>
        )}
        <div className={fullscreen ? "drawer-fullscreen-content" : ""}>
          {children}
        </div>
      </div>
    </div>
  )
}

export default Drawer
