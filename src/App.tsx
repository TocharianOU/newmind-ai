import { RouterProvider } from "react-router-dom"
import { router } from "./router"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { loadConfigAtom, reloadOapConfigAtom, removeOapConfigAtom, writeOapConfigAtom } from "./atoms/configState"
import { showToastAtom } from "./atoms/toastState"
import { useEffect, useRef, useState } from "react"
import { handleGlobalHotkey } from "./atoms/hotkeyState"
import { handleWindowResizeAtom } from "./atoms/sidebarState"
import { systemThemeAtom } from "./atoms/themeState"
import Updater from "./updater"
import { oapUsageAtom, oapUserAtom, updateOAPUsageAtom } from "./atoms/oapState"
import { queryGroup } from "./helper/model"
import { modelGroupsAtom, modelSettingsAtom } from "./atoms/modelState"
import { installToolBufferAtom, loadMcpConfigAtom, loadToolsAtom } from "./atoms/toolState"
import { loadCurrentProjectIdAtom } from "./atoms/projectState"
import { clearHistoriesAtom, loadHistoriesAtom } from "./atoms/historyState"
import { useTranslation } from "react-i18next"
import { setModelSettings } from "./ipc/config"
import { oapGetMe, oapGetToken, oapLogout, registBackendEvent } from "./ipc"
import { refreshConfig } from "./ipc/host"
import { openDrawerAtom } from "./atoms/drawerState"
import PopupConfirm from "./components/PopupConfirm"
import DrawerPortal from "./components/Drawer/DrawerPortal"
import ModalPortal from "./components/Modal/ModalPortal"
import { currentChatIdAtom } from "./atoms/chatState"

function App() {
  const { t } = useTranslation()

  const setSystemTheme = useSetAtom(systemThemeAtom)
  const handleWindowResize = useSetAtom(handleWindowResizeAtom)
  const setOAPUser = useSetAtom(oapUserAtom)
  const setOAPUsage = useSetAtom(oapUsageAtom)
  const updateOAPUsage = useSetAtom(updateOAPUsageAtom)
  const loadConfig = useSetAtom(loadConfigAtom)
  const writeOapConfig = useSetAtom(writeOapConfigAtom)
  const removeOapConfig = useSetAtom(removeOapConfigAtom)
  const reloadOapConfig = useSetAtom(reloadOapConfigAtom)
  const [modelSetting] = useAtom(modelSettingsAtom)
  const modelGroups = useAtomValue(modelGroupsAtom)
  const loadTools = useSetAtom(loadToolsAtom)
  const { i18n } = useTranslation()
  const loadMcpConfig = useSetAtom(loadMcpConfigAtom)
  const openDrawer = useSetAtom(openDrawerAtom)
  const loadCurrentProjectId = useSetAtom(loadCurrentProjectIdAtom)
  const clearHistories = useSetAtom(clearHistoriesAtom)
  const loadHistories = useSetAtom(loadHistoriesAtom)
  const setCurrentChatId = useSetAtom(currentChatIdAtom)

  const showToast = useSetAtom(showToastAtom)
  const setInstallToolBuffer = useSetAtom(installToolBufferAtom)
  const installToolBuffer = useRef<{ name: string, config: any } | null>(null)
  const [installToolConfirm, setInstallToolConfirm] = useState(false)

  useEffect(() => {
    console.log("set model setting", modelSetting)
    if (modelSetting) {
      setModelSettings(modelSetting)
    }
  }, [modelSetting])

  useEffect(() => {
    const init = async () => {
      console.log("[App] Starting initialization...")
      await loadCurrentProjectId()
      console.log("[App] Project ID loaded, now loading configs and tools...")
      await loadConfig()
      loadMcpConfig()
      loadTools()
      console.log("[App] Initialization complete")
    }
    init()
  }, [loadCurrentProjectId, loadConfig, loadTools, loadMcpConfig])

  // init app
  useEffect(() => {
    window.postMessage({ payload: "removeLoading" }, window.location.origin || "*")
    window.addEventListener("resize", handleWindowResize)
    window.addEventListener("keydown", handleGlobalHotkey)
    return () => {
      window.removeEventListener("resize", handleWindowResize)
      window.removeEventListener("keydown", handleGlobalHotkey)
    }
  }, [])

  const updateOAPUser = async () => {
    const token = await oapGetToken()
    if (token) {
      const user = await oapGetMe()
      setOAPUser(user.data)
      await updateOAPUsage()
      console.log("oap user", user.data)
    }
  }

  const openToolPageWithMcpServerJson = (data?: { name: string, config: any }) => {
    if (!data && !installToolBuffer.current) {
      return
    }

    try {
      data = data || installToolBuffer.current!
      const { name, config } = data
      setInstallToolBuffer(prev => [...prev, { name, config }])
      openDrawer({ id: "Settings", page: "Settings", tab: "Tools" })
    } catch(e) {
      console.error("mcp install error", e)
    }
  }

  // handle backend event
  useEffect(() => {
    const unregistLogin = registBackendEvent("login", () => {
      console.info("oap login")
      setCurrentChatId("")
      clearHistories()
      // Navigate to root so stale /chat/:id URLs from a previous session
      // are cleared — prevents the new user from inheriting the old chat URL
      // and accidentally POSTing messages into another user's conversation.
      router.navigate("/", { replace: true }).catch(() => {})
      updateOAPUser()
        .catch(console.error)
        .then(() => removeOapConfig())
        .then(() => loadConfig())
        .then(() => writeOapConfig())
        .then(() => loadCurrentProjectId())
        .then(() => loadMcpConfig())
        .then(() => loadTools())
        .then(() => loadHistories())
        .catch(console.error)
    })

    const unregistLogout = registBackendEvent("logout", () => {
      console.info("oap logout")
      setCurrentChatId("")
      clearHistories()
      removeOapConfig()
      setOAPUser(null)
      setOAPUsage(null)
    })

    const unlistenRefresh = registBackendEvent("refresh", () => {
      console.info("oap refresh")
      refreshConfig()
        .then(loadTools)
        .catch(console.error)

      updateOAPUser()
        .catch(console.error)
        .then(reloadOapConfig)
        .catch(console.error)

      // Re-pull chat history so the sidebar stays populated after a
      // Hub-initiated config refresh (admin model changes, plan updates, etc).
      loadHistories()
    })

    const unlistenMcpInstall = registBackendEvent("mcp.install", (data: { name: string, config: string }) => {
      try {
        if (!data?.config || typeof data.config !== "string") return
        const _config = JSON.parse(atob(data.config))
        if (!_config || typeof _config !== "object" || !_config.transport) return

        if (_config.transport === "stdio") {
          setInstallToolConfirm(true)
          installToolBuffer.current = { name: data.name, config: _config }
          return
        }

        openToolPageWithMcpServerJson({ name: data.name, config: _config })
      } catch (e) {
        console.error("[deeplink] mcp.install: invalid payload", e)
        showToast({ message: t("deeplink.mcpInstallInvalid"), type: "error", duration: 4000 })
      }
    })

    return () => {
      unregistLogin()
      unregistLogout()
      unlistenRefresh()
      unlistenMcpInstall()
    }
  }, [])

  // init oap user
  useEffect(() => {
    updateOAPUser().then(() => {
      setOAPUser(user => {
        if (!user) {
          console.warn("no user found, logout")
          oapLogout()
          return null
        }

        if (user && queryGroup({ modelProvider: "oap" }, modelGroups).length === 0) {
          loadConfig().then(() => writeOapConfig()).catch(console.error)
        } else if (user) {
          loadConfig().then(() => reloadOapConfig()).catch(console.error)
        } else {
          removeOapConfig()
        }

        return user
      })
    })
    .catch(console.error)
  }, [])

  // keychain decrypt failure notification
  useEffect(() => {
    if (!window.ipcRenderer?.keychainOnDecryptFailed) return
    const unlisten = window.ipcRenderer.keychainOnDecryptFailed(() => {
      showToast({
        message: t("tools.keychain.decryptFailed"),
        type: "warning",
        duration: 8000,
        closable: true
      })
    })
    return () => { unlisten?.() }
  }, [])

  // set system theme
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleChange = () => {
      setSystemTheme(mediaQuery.matches ? "dark" : "light")
    }

    mediaQuery.addEventListener("change", handleChange)
    return () => {
      mediaQuery.removeEventListener("change", handleChange)
    }
  }, [])

  useEffect(() => {
    const langCode = i18n.language || "en"
    document.documentElement.lang = langCode
  }, [i18n.language])

  const closeInstallTool = () => {
    setInstallToolConfirm(false)
    installToolBuffer.current = null
  }

  return (
    <>
      <RouterProvider router={router} />
      <Updater />
      <DrawerPortal />
      <ModalPortal />

      {installToolConfirm &&
        <PopupConfirm
          confirmText={t("common.confirm")}
          cancelText={t("common.cancel")}
          onConfirm={() => {
            openToolPageWithMcpServerJson()
            closeInstallTool()
          }}
          onCancel={closeInstallTool}
          onClickOutside={closeInstallTool}
          noBorder
          footerType="center"
          zIndex={1000}
          className="mcp-install-confirm-modal"
        >
          {t("deeplink.mcpInstallConfirm")}
          <pre>{installToolBuffer.current?.config?.command} {installToolBuffer.current?.config?.args?.join(" ")}</pre>
        </PopupConfirm>
    }
    </>
  )
}

export default App
