import React from "react"
import { Outlet } from "react-router-dom"
import HistorySidebar from "../components/HistorySidebar"
import Header from "../components/Header"
import WindowControls from "../components/WindowControls"
import { useAtom, useAtomValue } from "jotai"
import { isConfigNotInitializedAtom } from "../atoms/configState"
import GlobalToast from "../components/GlobalToast"
import { themeAtom, systemThemeAtom } from "../atoms/themeState"
import Overlay from "./Overlay"
import KeymapModal from "../components/Modal/KeymapModal"
import CodeModal from "./Chat/CodeModal"
import { overlaysAtom } from "../atoms/layerState"
import { isLoggedInOAPAtom } from "../atoms/oapState"
import { isWeb } from "../ipc/env"
import Login from "./Login"

const ConsoleLoginRedirect = ({ theme }: { theme: string }) => {
  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      window.location.replace("/console/login?appRedirect=web")
    }, 800)

    return () => window.clearTimeout(timer)
  }, [])

  return (
    <div className="app-container" data-theme={theme}>
      <div className="login-page-container">
        <div className="header">
          <h1 className="main-title">Redirecting to sign in</h1>
          <p className="subtitle">Use the unified OAP Hub sign-in page to continue.</p>
        </div>
      </div>
    </div>
  )
}

const Layout = () => {
  const isConfigNotInitialized = useAtomValue(isConfigNotInitializedAtom)
  const [theme] = useAtom(themeAtom)
  const [systemTheme] = useAtom(systemThemeAtom)
  const overlays = useAtomValue(overlaysAtom)
  const isLoggedIn = useAtomValue(isLoggedInOAPAtom)
  const resolvedTheme = theme === "system" ? systemTheme : theme

  if (!isLoggedIn) {
    if (isWeb) {
      return <ConsoleLoginRedirect theme={resolvedTheme} />
    }

    return (
      <div className="app-container" data-theme={resolvedTheme}>
        <div className="login-titlebar" style={{ WebkitAppRegion: "drag" } as React.CSSProperties}>
          <div style={{ WebkitAppRegion: "no-drag" } as React.CSSProperties}>
            <WindowControls variant="header" />
          </div>
        </div>
        <Login />
        <GlobalToast />
      </div>
    )
  }

  return (
    <div className="app-container" data-theme={resolvedTheme}>
      <div className="app-content">
        {(!isConfigNotInitialized || isWeb) && <HistorySidebar />}
        <div className="outlet-container">
          {(!isConfigNotInitialized || isWeb) && <Header showHelpButton={overlays.length === 0} showModelSelect={overlays.length === 0} showProjectSelector={true} />}
          <Outlet />
        </div>
        <CodeModal />
      </div>
      <Overlay />
      <GlobalToast />
      <KeymapModal />
    </div>
  )
}

export default React.memo(Layout)
