/**
 * Tauri API stub for web mode.
 * All Tauri packages are aliased to this file in vite.config.web.ts so the
 * bundler never pulls in Tauri-specific code when building for the browser.
 *
 * Every export is a no-op or returns a sensible default so that any import
 * that slips through at runtime fails gracefully rather than hard-crashing.
 */

export function invoke(_cmd: string, _args?: unknown): Promise<never> {
  return Promise.reject(new Error("[web] Tauri invoke is not available in web mode"))
}

// @tauri-apps/api/core stubs
export const convertFileSrc = (src: string, _protocol?: string) => src

export function listen(_event: string, _handler: unknown): Promise<() => void> {
  return Promise.resolve(() => {})
}

// @tauri-apps/api/path stubs
export const homeDir = () => Promise.resolve("/")
export const join = (...parts: string[]) => Promise.resolve(parts.join("/"))

// @tauri-apps/plugin-fs stubs
export const exists = (_path: string) => Promise.resolve(false)
export const readTextFile = (_path: string) => Promise.resolve("")
export const writeTextFile = (_path: string, _content: string) => Promise.resolve()
export const watch = (_path: string, _cb: unknown) => Promise.resolve(() => {})

// @tauri-apps/plugin-os stubs
export const platform = () => "web"

// @tauri-apps/plugin-http stubs
export const fetch = globalThis.fetch

// @tauri-apps/plugin-opener stubs
export const openUrl = (url: string) => { window.open(url, "_blank"); return Promise.resolve() }

// @tauri-apps/plugin-autostart stubs
export const enable = () => Promise.resolve()
export const disable = () => Promise.resolve()
export const isEnabled = () => Promise.resolve(false)

// @tauri-apps/plugin-updater stubs
export const check = () => Promise.resolve(null)

// @tauri-apps/plugin-clipboard-manager stubs
export const writeText = (_text: string) => Promise.resolve()
export const readText = () => Promise.resolve("")

// @tauri-apps/api/event stubs (re-export listen for named import compatibility)
export { listen as listen2 }

export default {}
