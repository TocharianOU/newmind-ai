/// <reference types="vite/client" />

export type ModelResults = {
  error?: string
  results: string[]
}

declare global {
  interface Window {
    PLATFORM: "web"
    isDev: boolean
  }
}
