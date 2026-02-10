import React, { useState, useEffect } from "react"
import { isElectron } from "../ipc/env"

type WindowControlsProps = {
  variant?: "header" | "drawer"
}

const WindowControls = ({ variant = "header" }: WindowControlsProps) => {
  const [isMaximized, setIsMaximized] = useState(false)
  const [isHovered, setIsHovered] = useState(false)

  useEffect(() => {
    if (isElectron && window.ipcRenderer) {
      // Check initial maximize state
      window.ipcRenderer.windowIsMaximized().then(setIsMaximized)
    }
  }, [])

  const handleMinimize = () => {
    if (isElectron && window.ipcRenderer) {
      window.ipcRenderer.windowMinimize()
    }
  }

  const handleMaximize = () => {
    if (isElectron && window.ipcRenderer) {
      window.ipcRenderer.windowMaximize().then(() => {
        window.ipcRenderer.windowIsMaximized().then(setIsMaximized)
      })
    }
  }

  const handleClose = () => {
    if (isElectron && window.ipcRenderer) {
      window.ipcRenderer.windowClose()
    }
  }

  // Don't render on non-Electron platforms
  if (!isElectron) {
    return null
  }

  return (
    <div 
      className={`window-controls ${variant === "drawer" ? "window-controls-drawer" : ""}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <button
        className="window-control-btn maximize-btn"
        onClick={handleMaximize}
        aria-label="Maximize window"
      >
        {isHovered && (
          <svg width="10" height="10" viewBox="0 0 10 10">
            {isMaximized ? (
              <>
                <path d="M2 3H8V9H2V3Z" stroke="currentColor" strokeWidth="1" fill="none"/>
                <path d="M3 1H9V7" stroke="currentColor" strokeWidth="1" fill="none"/>
              </>
            ) : (
              <path d="M1 1H9V9H1V1Z" stroke="currentColor" strokeWidth="1" fill="none"/>
            )}
          </svg>
        )}
      </button>
      <button
        className="window-control-btn minimize-btn"
        onClick={handleMinimize}
        aria-label="Minimize window"
      >
        {isHovered && (
          <svg width="10" height="2" viewBox="0 0 10 2">
            <path d="M1 1H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}
      </button>
      <button
        className="window-control-btn close-btn"
        onClick={handleClose}
        aria-label="Close window"
      >
        {isHovered && (
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}
      </button>
    </div>
  )
}

export default WindowControls
