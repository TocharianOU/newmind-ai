import { isElectron, isTauri } from "./env"
import { fetch as tauriFetch } from "@tauri-apps/plugin-http"
import { watch, readTextFile, exists } from "@tauri-apps/plugin-fs"
import * as path from "@tauri-apps/api/path"
import { invoke } from "@tauri-apps/api/core"
import { listen } from "@tauri-apps/api/event"
import { setOapHost } from "./oap"

let electronHostPort = 0
let electronPortListenerRegistered = false

async function waitHostBus(): Promise<number> {
  const home = await path.homeDir()
  const appDir = await path.join(home, ".attacktrace")
  const hostCacheDir = await path.join(appDir, "host_cache")
  const file = await path.join(hostCacheDir, "bus")
  const read = async (file: string) => {
    const body = await readTextFile(file)
    if (!body) {
      return
    }

    const content = JSON.parse(body)
    if (content?.server?.listen?.port) {
      return content.server.listen.port
    }
  }

  if (await exists(file)) {
    const port = await read(file)
    if (port) {
      return port
    }
  }

  return new Promise((resolve) => {
    const interval = setInterval(async () => {
      const port = await read(file)
      if (port) {
        unwatch.then(unwatch => unwatch())
        clearInterval(interval)
        resolve(port)
      }
    }, 5000)

    const unwatch = watch(
      file,
      async () => {
        const port = await read(file)
        if (port) {
          unwatch.then(unwatch => unwatch())
          clearInterval(interval)
          resolve(port)
        }
      },
      { delayMs: 100 }
    )
  })
}

const GET_PORT_TIMEOUT_MS = 15_000

async function getPort() {
  if (isElectron) {
    return new Promise<number>((resolve) => {
      // Safety valve: if the host never reports a port within 15 s,
      // resolve with 0 so the UI can proceed (fetch will fail gracefully).
      const timeout = setTimeout(() => {
        console.warn("[getPort] Timed out waiting for host port, proceeding with port 0")
        clearInterval(i)
        resolve(0)
      }, GET_PORT_TIMEOUT_MS)

      window.ipcRenderer.onReceivePort((port) => {
        clearTimeout(timeout)
        clearInterval(i)
        electronHostPort = +port
        resolve(port)
      })

      const i = setInterval(() => {
        window.ipcRenderer.port().then(port => {
          if (+port) {
            clearTimeout(timeout)
            electronHostPort = +port
            resolve(port)
            clearInterval(i)
          }
        })
      }, 1000)
    })
  }

  return waitHostBus()
}

export async function initFetch() {
  const port = await getPort()
  console.log("host port", port)
  setOapHost(`http://localhost:${port}`)

  if (isElectron) {
    return initElectronFetch(+port)
  }

  if (isTauri) {
    return initTauriFetch(+port)
  }

  return globalThis.fetch
}

// Export the original fetch for special cases where absolute URLs are needed.
export const nativeFetch = window.fetch;

async function initElectronFetch(port: number) {
  electronHostPort = port

  if (!electronPortListenerRegistered) {
    electronPortListenerRegistered = true
    window.ipcRenderer.onReceivePort((newPort) => {
      electronHostPort = +newPort
      setOapHost(`http://localhost:${electronHostPort}`)
      console.log("[initFetch] Host port updated:", electronHostPort)
    })
  }

  const originalFetch = window.fetch
  const withDesktopHeader = (inputHeaders?: HeadersInit) => {
    const headers = new Headers(inputHeaders || {})
    headers.set("X-Requested-With", "attacktrace-desktop")
    return headers
  }
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const targetPort = electronHostPort || port
    // If the input is a full URL, use the original fetch.
    if (input.toString().startsWith('http')) {
      return originalFetch(input, {
        ...init,
        headers: withDesktopHeader(init?.headers),
      })
    }
    return originalFetch(`http://localhost:${targetPort}${input}`, {
      ...init,
      headers: withDesktopHeader(init?.headers),
    })
  }
}

async function initTauriFetch(port: number) {
  const withDesktopHeader = (inputHeaders?: HeadersInit) => {
    const headers = new Headers(inputHeaders || {})
    headers.set("X-Requested-With", "attacktrace-desktop")
    return headers
  }
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    console.log(input, init)
    return tauriFetch(`http://localhost:${port}${input}`, {
      ...init,
      headers: withDesktopHeader(init?.headers),
    })
  }
}

export async function startReceiveDownloadDependencyLog() {
  if (isElectron) {
    return
  }

  return invoke("start_recv_download_dependency_log")
}

export async function onReceiveDownloadDependencyLog(callback: (log: string) => void): Promise<() => void> {
  if (isElectron) {
    return window.ipcRenderer.onReceiveInstallHostDependenciesLog(callback)
  }

  return listen<{ type: string; data: any }>("install-host-dependencies-log", (event) => {
    switch (event.payload.type) {
      case "output":
        callback(event.payload.data)
        break
      case "error":
        callback(event.payload.data)
        break
      case "progress":
        // ignore
        break
      case "finished":
        callback("finish")
        break
    }
  })
}