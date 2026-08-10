import React from "react"
import { useAtom, useSetAtom } from "jotai"
import { sidebarVisibleAtom, toggleSidebarAtom } from "../atoms/sidebarState"
import { useTranslation } from "react-i18next"
import { keymapModalVisibleAtom, memoryPanelVisibleAtom } from "../atoms/modalState"
import { openDrawerAtom } from "../atoms/drawerState"
import { isWeb } from "../ipc/env"
import ModelSelect from "./ModelSelect"
import ProjectSelector from "./ProjectSelector"
import Tooltip from "./Tooltip"
import WindowControls from "./WindowControls"

type Props = {
  showHelpButton?: boolean
  showModelSelect?: boolean
  showProjectSelector?: boolean
}

const Header = ({ showHelpButton = false, showModelSelect = false, showProjectSelector = false }: Props) => {
  const toggleSidebar = useSetAtom(toggleSidebarAtom)
  const { t } = useTranslation()
  const setKeymapModalVisible = useSetAtom(keymapModalVisibleAtom)
  const openDrawer = useSetAtom(openDrawerAtom)
  const [isSidebarVisible] = useAtom(sidebarVisibleAtom)
  const [memoryPanelVisible, setMemoryPanelVisible] = useAtom(memoryPanelVisibleAtom)

  const onClose = () => {
    toggleSidebar()
  }

  return (
    <div className={`app-header ${isSidebarVisible ? "sidebar-visible" : ""}`}>
      <div className="header-content">
        <div className="left-side">
          <Tooltip
            content={isSidebarVisible ? t("header.closeSidebar") : t("header.openSidebar")}
          >
            <button
              className={`menu-btn ${isSidebarVisible ? "close-sidebar-btn" : ""}`}
              onClick={onClose}
            >
              <svg className="open-sidebar-btn-icon" width="24" height="24" viewBox="0 0 24 24">
                <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
              </svg>
              <svg className="close-sidebar-btn-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 30 30" fill="none">
                <path d="M8 22L8 7.27273" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M25 15.75C25.4142 15.75 25.75 15.4142 25.75 15C25.75 14.5858 25.4142 14.25 25 14.25V15V15.75ZM11.4697 14.4697C11.1768 14.7626 11.1768 15.2374 11.4697 15.5303L16.2426 20.3033C16.5355 20.5962 17.0104 20.5962 17.3033 20.3033C17.5962 20.0104 17.5962 19.5355 17.3033 19.2426L13.0607 15L17.3033 10.7574C17.5962 10.4645 17.5962 9.98959 17.3033 9.6967C17.0104 9.40381 16.5355 9.40381 16.2426 9.6967L11.4697 14.4697ZM25 15V14.25L12 14.25V15V15.75L25 15.75V15Z" fill="currentColor"/>
              </svg>
            </button>
          </Tooltip>
          {showModelSelect && <ModelSelect showSettingsButton={false} />}
        </div>
        <div className="center-side">
          {showProjectSelector && <ProjectSelector />}
        </div>
        {showHelpButton && (
          <div className="right-side">
            <Tooltip content={t("memory.togglePanel")}>
              <button
                className={`memory-toggle-btn header-memory-btn ${memoryPanelVisible ? "active" : ""}`}
                onClick={() => setMemoryPanelVisible(!memoryPanelVisible)}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
                {t("memory.title")}
              </button>
            </Tooltip>
            {isWeb && (
              <Tooltip content={t("header.console", "Console")}>
                <a
                  className="settings-btn"
                  href="/console/"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/>
                  </svg>
                </a>
              </Tooltip>
            )}
            <Tooltip content={t("header.settings")}>
              <button
                className="settings-btn"
                onClick={() => openDrawer({ id: "Settings", page: "Settings", tab: "Projects" })}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61 l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41 h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87 C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58 c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54 c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96 c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6 s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z"/>
                </svg>
              </button>
            </Tooltip>
            <WindowControls variant="header" />
          </div>
        )}
        {!showHelpButton && <WindowControls variant="header" />}
      </div>
    </div>
  )
}

export default React.memo(Header)