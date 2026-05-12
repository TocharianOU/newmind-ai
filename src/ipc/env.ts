export const isWeb = true

// Use dev server assets in dev, custom protocol in production.
// In web mode the SPA is served under /app/, so images live at /app/image/.
export const imgPrefix = "/app/image/"

export async function initPlatform() {
  window.PLATFORM = "web" as any
}