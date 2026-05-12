import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import "./styles/index.scss"
import "pretendard/dist/web/static/pretendard.css"
import "./i18n"
import Root from "./Root.tsx"
import ErrorBoundary from "./components/ErrorBoundary"
import { initPlatform } from "./ipc/env.ts"

window.onerror = (message, filename, lineno, colno, error) => {
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

  console.error(...content)
}

window.onunhandledrejection = (event) => {
  const content = [
    "Unhandled Rejection:",
    {
      reason: event.reason,
      stack: event.reason?.stack
    }
  ]

  console.error(...content)
}

window.isDev = import.meta.env.DEV
initPlatform().finally(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <Root />
      </ErrorBoundary>
    </StrictMode>,
  )
})
