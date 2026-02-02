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
    console.log('[Root] Initializing host...')
    try {
      await initFetch()
    } catch (e) {
      console.warn('[Root] initFetch failed, continuing anyway:', e)
    }

    // wait for host to start
    console.log('[Root] Waiting for host to start...')
    
    // Set a timeout to avoid infinite waiting
    const timeoutPromise = new Promise(resolve => setTimeout(() => {
        console.log('[Root] Host check timeout, proceeding anyway...')
        resolve(0)
    }, 5000))

    const checkPromise = new Promise(resolve => {
      let attempts = 0
      const i = setInterval(() => {
        attempts++
        fetch("/api/tools/").then(() => {
          console.log('[Root] Host is ready!')
          resolve(0)
          clearInterval(i)
        }).catch(err => {
          if (attempts % 20 === 0) {
            console.log(`[Root] Still waiting for host... (${attempts} attempts)`, err.message)
          }
        })
      }, 50)
    })

    await Promise.race([checkPromise, timeoutPromise])
  }, [])

  useEffect(() => {
    if (init.current) {
      return
    }

    init.current = true

    initHost()
      .then(() => {
        console.log('[Root] Loading hotkey map...')
        return loadHotkeyMap()
      })
      .then(() => {
        console.log('[Root] Loading config...')
        return loadConfig()
      })
      .then(async (res) => {
        console.log('[Root] Loading model settings...')
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
      .catch(err => {
        console.error('[Root] Initialization error:', err)
      })
      .finally(() => {
        console.log('[Root] Initialization complete, showing app...')
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
