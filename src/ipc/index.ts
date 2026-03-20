import { isElectron, isWeb } from "./env"
import { listen } from "@tauri-apps/api/event"
import { invoke as tauriInvoke } from "@tauri-apps/api/core"

export * from "./env"
export * from "./init"
export * from "./oap"
export * from "./host"
export * from "./config"
export * from "./llm"
export * from "./project"

export function listenIPC(event: string, listener: (...args: any[]) => void): () => void {
  if (isElectron) {
    window.ipcRenderer.on(event, listener)
    return () => window.ipcRenderer.off(event, listener)
  }
  if (isWeb) {
    return () => {}
  }

  const unlisten = listen(event, listener)
  return async () => (await unlisten)()
}

export async function invokeIPC(cmd: string, ...args: any[]) {
  if (isElectron) {
    return window.ipcRenderer.invoke(cmd, ...args)
  }
  if (isWeb) {
    console.warn(`[web] invokeIPC("${cmd}") skipped — not available in web mode`)
    return undefined
  }

  return tauriInvoke(cmd, ...args)
}