import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import "./styles/index.scss"
import "pretendard/dist/web/static/pretendard.css"
import "./i18n"
import Root from "./Root.tsx"
import { initPlatform, isElectron } from "./ipc/env.ts"
import logger from "electron-log/renderer"
import { error as tauriErrorLog } from "@tauri-apps/plugin-log"

window.onerror = (message, filename, lineno, colno, error) => {
  if (message.toString().includes("__TAURI_INTERNALS__.unregisterCallback")) {
    return
  }

  const content = [
    "JavaScript Error:",
    {
      message,
      filename,
      lineno,
      colno,
      stack: error?.stack
    }
  ]

  if (isElectron) {
    logger.error(...content)
  } else {
    tauriErrorLog(JSON.stringify(content))
  }
}

window.onunhandledrejection = (event) => {
  const content = [
    "Unhandled Rejection:",
    {
      reason: event.reason,
      stack: event.reason?.stack
    }
  ]

  if (isElectron) {
    logger.error(...content)
  } else {
    tauriErrorLog(JSON.stringify(content))
  }
}

if (isElectron) {
  window.addEventListener("contextmenu", (e) => {
  e.preventDefault()
  const selection = window.getSelection()?.toString()

  if (selection) {
      window.ipcRenderer.showSelectionContextMenu()
    }
  })
}

window.isDev = import.meta.env.DEV
initPlatform().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <Root />
    </StrictMode>,
  )
})
