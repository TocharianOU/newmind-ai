import { useCallback, useEffect, useRef, useState } from "react"
import InstallHostDependencies from "./views/InstallHostDependencies"
import App from "./App"
import { loadConfigAtom } from "./atoms/configState"
import { useSetAtom } from "jotai"
import { loadHotkeyMapAtom } from "./atoms/hotkeyState"
import { modelSettingsAtom } from "./atoms/modelState"
import { fromRawConfigToModelGroupSetting } from "./helper/model"
import { initFetch } from "./ipc"
import { getModelSettings, setModelSettings } from "./ipc/config"

function Root() {
  const loadConfig = useSetAtom(loadConfigAtom)
  const loadHotkeyMap = useSetAtom(loadHotkeyMapAtom)
  const setModelSetting = useSetAtom(modelSettingsAtom)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState(window.PLATFORM !== "darwin")
  const init = useRef(false)

  const initHost = useCallback(async () => {
    await initFetch()

    // wait for host to start
    await new Promise(resolve => {
      const i = setInterval(() => {
        fetch("/api/tools/").then(() => {
          resolve(0)
          clearInterval(i)
        })
      }, 50)
    })
  }, [])

  useEffect(() => {
    if (init.current) {
      return
    }

    init.current = true

    initHost()
      .then(loadHotkeyMap)
      .then(loadConfig)
      .then(async (res) => {
        const existsSetting = await getModelSettings()
        if (existsSetting) {
          setModelSetting(existsSetting)
          return
        }

        if (res) {
          const settings = fromRawConfigToModelGroupSetting(res)
          setModelSetting(settings)
          return setModelSettings(settings)
        }
      })
      .finally(() => {
        setDownloading(false)
        setLoading(false)
      })
  }, [])

  const onFinish = () => {
    setDownloading(false)
  }

  const onUpdate = (log: string) => {
    if (log) {
      window.postMessage({ payload: "removeLoading" }, "*")
    }
  }

  if (downloading || loading) {
    return <InstallHostDependencies onFinish={onFinish} onUpdate={onUpdate} />
  }

  return <App />
}

export default Root
