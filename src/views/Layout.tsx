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

const Layout = () => {
  const isConfigNotInitialized = useAtomValue(isConfigNotInitializedAtom)
  const [theme] = useAtom(themeAtom)
  const [systemTheme] = useAtom(systemThemeAtom)
  const overlays = useAtomValue(overlaysAtom)
  const isLoggedIn = useAtomValue(isLoggedInOAPAtom)

  if (!isLoggedIn) {
    return (
      <div className="app-container" data-theme={theme === "system" ? systemTheme : theme}>
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
    <div className="app-container" data-theme={theme === "system" ? systemTheme : theme}>
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
