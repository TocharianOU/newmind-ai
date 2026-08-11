import React, { useEffect } from "react"
import "../../styles/drawer/_Settings.scss"
import Account from "../Overlay/Account"
import ProjectManagement from "./ProjectManagement"
import { useAtomValue, useSetAtom } from "jotai"
import { openDrawerAtom } from "../../atoms/drawerState"
import { useTranslation } from "react-i18next"
import { imgPrefix } from "../../ipc"
import { isLoggedInOAPAtom, oapUserAtom, OAPLevelAtom } from "../../atoms/oapState"
import { settingTabAtom } from "../../atoms/globalState"
import { ENV_CONFIG } from "../../config/env"

// 3.0: chat 应用内只保留用户级设置（项目、账号）。
// 模型/工具/系统等管理功能统一由 /console 管理后台承担。
const ALL_TABS = ["Projects", "Account"] as const
export type Tab = (typeof ALL_TABS)[number]

const Settings = ({ tab }: { tab: Tab }) => {
  const { t } = useTranslation()
  const openDrawer = useSetAtom(openDrawerAtom)
  const isLoggedInOAP = useAtomValue(isLoggedInOAPAtom)
  const oapUser = useAtomValue(oapUserAtom)
  const oapLevel = useAtomValue(OAPLevelAtom)
  const setSettingTab = useSetAtom(settingTabAtom)

  const tabs = ALL_TABS

  useEffect(() => {
    setSettingTab(tab)
  }, [tab, setSettingTab])

  const handleOAP = async () => {
    window.open(`${ENV_CONFIG.HUB_BASE_URL}/dashboard`, '_blank')
  }

  const openConsole = () => {
    // 管理后台 = /console/dashboard（管理页），而非 /console/（主页 Home）
    window.open(`${ENV_CONFIG.HUB_BASE_URL}/dashboard`, '_blank')
  }

  return (
    <div className="settings-drawer-container">
      <div className="settings-drawer-body">
        <div className="settings-drawer-sidebar">
          {tabs.map((__tab) => (
            <div
              key={__tab}
              className="settings-drawer-sidebar-item-wrap"
            >
              <div
                className={`settings-drawer-sidebar-item ${__tab === tab ? "active" : ""}`}
                onClick={() => openDrawer({ id: "Settings", page: "Settings", tab: __tab })}
              >
                {t(`setting.tabs.${__tab}`)}
              </div>
            </div>
          ))}
          <div className="settings-drawer-sidebar-item-wrap">
            <div
              className="settings-drawer-sidebar-item"
              onClick={() => openDrawer({ id: "Tools", page: "Tools" })}
            >
              {t("setting.tabs.Tools", "工具（MCP）")}
            </div>
          </div>
          <div className="settings-drawer-sidebar-item-wrap">
            <div
              className="settings-drawer-sidebar-item"
              onClick={openConsole}
            >
              {t("setting.tabs.Console", "管理后台")} ↗
            </div>
          </div>
          {isLoggedInOAP && (
            <div className="settings-drawer-sidebar-category link" onClick={handleOAP}>
              <div className="settings-drawer-sidebar-category-left">
                <img src={`${imgPrefix}logo_oap.png`} alt="oap" className="provider-icon no-filter" />
                <div className="oap-info">
                  <div className="oap-name">{oapUser?.username || t("sidebar.New mindhub")}</div>
                  <div className="oap-plan-badge">{oapLevel || 'BASE'}</div>
                </div>
              </div>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 17 16" fill="none">
                <path d="M3.83333 14C3.46667 14 3.15278 13.8694 2.89167 13.6083C2.63056 13.3472 2.5 13.0333 2.5 12.6667V3.33333C2.5 2.96667 2.63056 2.65278 2.89167 2.39167C3.15278 2.13056 3.46667 2 3.83333 2H7.83333C8.02222 2 8.18056 2.06389 8.30833 2.19167C8.43611 2.31944 8.5 2.47778 8.5 2.66667C8.5 2.85556 8.43611 3.01389 8.30833 3.14167C8.18056 3.26944 8.02222 3.33333 7.83333 3.33333H3.83333V12.6667H13.1667V8.66667C13.1667 8.47778 13.2306 8.31944 13.3583 8.19167C13.4861 8.06389 13.6444 8 13.8333 8C14.0222 8 14.1806 8.06389 14.3083 8.19167C14.4361 8.31944 14.5 8.47778 14.5 8.66667V12.6667C14.5 13.0333 14.3694 13.3472 14.1083 13.6083C13.8472 13.8694 13.5333 14 13.1667 14H3.83333ZM13.1667 4.26667L7.43333 10C7.31111 10.1222 7.15556 10.1833 6.96667 10.1833C6.77778 10.1833 6.62222 10.1222 6.5 10C6.37778 9.87778 6.31667 9.72222 6.31667 9.53333C6.31667 9.34444 6.37778 9.18889 6.5 9.06667L12.2333 3.33333H10.5C10.3111 3.33333 10.1528 3.26944 10.025 3.14167C9.89722 3.01389 9.83333 2.85556 9.83333 2.66667C9.83333 2.47778 9.89722 2.31944 10.025 2.19167C10.1528 2.06389 10.3111 2 10.5 2H13.8333C14.0222 2 14.1806 2.06389 14.3083 2.19167C14.4361 2.31944 14.5 2.47778 14.5 2.66667V6C14.5 6.18889 14.4361 6.34722 14.3083 6.475C14.1806 6.60278 14.0222 6.66667 13.8333 6.66667C13.6444 6.66667 13.4861 6.60278 13.3583 6.475C13.2306 6.34722 13.1667 6.18889 13.1667 6V4.26667Z" fill="currentColor"/>
              </svg>
            </div>
          )}
        </div>
        <div className="settings-drawer-content">
          {(() => {
            switch (tab) {
              case "Projects":
                return <ProjectManagement />
              case "Account":
                return <Account />
              default:
                return null
            }
          })()}
        </div>
      </div>
    </div>
  )
}

export default React.memo(Settings)
