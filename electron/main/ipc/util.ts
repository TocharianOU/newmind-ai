import { BrowserWindow, dialog, nativeImage, clipboard, shell } from "electron"
import fse from "fs-extra"
import path from "node:path"
import { configDir, scriptsDir, appDir } from "../constant"
import { CancelError, download } from "electron-dl"
import { ModelGroupSetting } from "../../../types/model"
import { refreshConfig } from "../deeplink"
import { getInstallHostDependenciesLog, restartHost } from "../service"
import { safeRegisterHandler } from "../utils/ipcRegistry"
import { runSync, isSyncEnabled, setSyncEnabled, getLastSyncAt } from "../syncService"

export function ipcUtilHandler(win: BrowserWindow) {
  safeRegisterHandler("util:fillPathToConfig", async (_, _config: string) => {
    try {
      const { mcpServers: servers } = JSON.parse(_config) as {mcpServers: Record<string, {enabled: boolean, command?: string, args?: string[]}>}
      const mcpServers = Object.keys(servers).reduce((acc, server) => {
        const { args } = servers[server]

        if (!args)
          return acc

        const pathToScript = args.find((arg) => arg.endsWith("js") || arg.endsWith("ts"))
        if (!pathToScript)
          return acc

        const isScriptsExist = fse.existsSync(pathToScript)
        if (isScriptsExist)
          return acc

        const argsIndex = args.reduce((acc, arg, index) => pathToScript === arg ? index : acc, -1)
        if (fse.existsSync(path.join(scriptsDir, pathToScript))) {
          args[argsIndex] = path.join(scriptsDir, pathToScript)
        }

        const filename = path.parse(pathToScript).base
        if (fse.existsSync(path.join(scriptsDir, filename))) {
          args[argsIndex] = path.join(scriptsDir, filename)
        }

        acc[server] = {
          ...servers[server],
          args,
        }

        return acc
      }, servers)

      return JSON.stringify({ mcpServers })
    } catch (_error) {
      return _config
    }
  })

  safeRegisterHandler("util:download", async (event, { url }) => {
    let filename = getFilenameFromUrl(url)
    await fetch(url, { method: "HEAD" })
      .then(response => {
        const contentDisposition = response.headers.get("content-disposition")
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename="([^"]+)"/)
          if (filenameMatch) {
            filename = filenameMatch[1]
          }
        }
      })
      .catch(() => {
        console.error("Failed to get filename from url")
      })

    filename = filename || "file"
    const result = await dialog.showSaveDialog({
      properties: ["createDirectory", "showOverwriteConfirmation"],
      defaultPath: filename,
    })

    if (result.canceled) {
      return
    }

    try {
      await download(win, url, { directory: path.dirname(result.filePath), filename: path.basename(result.filePath) })
    } catch (error) {
      if (error instanceof CancelError) {
        console.info("item.cancel() was called")
      } else {
        console.error(error)
      }
    }
  })

  safeRegisterHandler("util:copyimage", async (_, url: string) => {
    const getImageFromRemote = async (url: string) => {
      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }

      const buffer = await response.arrayBuffer()
      const image = nativeImage.createFromBuffer(Buffer.from(buffer))
      if (image.isEmpty()) {
        throw new Error("Failed to create image from buffer")
      }

      return image
    }

    const localProtocol = "local-file:///"
    let image
    if (url.startsWith(localProtocol)) {
      const rawPath = url.substring(localProtocol.length)
      const resolved = path.resolve(rawPath)
      // Restrict to user's home .attacktrace dir and temp dir
      const allowedRoots = [path.resolve(appDir), path.resolve(require("os").tmpdir())]
      const allowed = allowedRoots.some(root => resolved === root || resolved.startsWith(root + path.sep))
      if (!allowed) {
        console.warn(`[IPC] util:copyimage blocked path: ${resolved}`)
        return
      }
      image = nativeImage.createFromPath(resolved)
    } else {
      image = await getImageFromRemote(url)
    }

    clipboard.writeImage(image)
  })

  safeRegisterHandler("util:getModelSettings", async (_) => {
    const modelSettingsPath = path.join(configDir, "model_settings.json")
    
    // Auto-create with default settings if not exists
    if (!fse.existsSync(modelSettingsPath)) {
      await fse.ensureDir(configDir)
      const defaultSettings = {
        groups: [],
        common: {},
        disableDiveSystemPrompt: false
      }
      await fse.writeJson(modelSettingsPath, defaultSettings, { spaces: 2 })
      return defaultSettings
    }

    return fse.readJson(modelSettingsPath)
  })

  safeRegisterHandler("util:setModelSettings", async (_, settings: ModelGroupSetting) => {
    const modelSettingsPath = path.join(configDir, "model_settings.json")
    // Ensure config directory exists before writing
    await fse.ensureDir(configDir)
    return fse.writeJson(modelSettingsPath, settings, { spaces: 2 })
  })

  safeRegisterHandler("util:refreshConfig", async () => {
    return refreshConfig()
  })

  safeRegisterHandler("util:restartHost", async () => {
    console.log("[IPC] Received restartHost request")
    return restartHost()
  })

  safeRegisterHandler("util:getInstallHostDependenciesLog", async () => {
    return getInstallHostDependenciesLog()
  })

  safeRegisterHandler("open-external-url", async (_, url: string) => {
    // Only allow http/https to prevent file://, javascript:, and other dangerous schemes
    if (typeof url === "string" && (url.startsWith("https://") || url.startsWith("http://"))) {
      await shell.openExternal(url)
    }
  })

  safeRegisterHandler("util:readLocalLogo", async (_, logoPath: string) => {
    try {
      if (typeof logoPath !== "string") return null

      // Resolve to an absolute path and verify it stays within allowed directories
      const resolved = path.resolve(logoPath)
      const allowedRoots = [configDir, scriptsDir, appDir]
      const isAllowed = allowedRoots.some(root => resolved.startsWith(path.resolve(root) + path.sep) || resolved === path.resolve(root))
      if (!isAllowed) {
        console.warn(`[Security] readLocalLogo: path outside allowed dirs: ${resolved}`)
        return null
      }

      if (!fse.existsSync(resolved)) {
        return null
      }

      const fileBuffer = await fse.readFile(resolved)
      const ext = path.extname(resolved).toLowerCase()

      let mimeType = 'image/svg+xml'
      if (ext === '.png') mimeType = 'image/png'
      else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg'

      const base64 = fileBuffer.toString('base64')
      return `data:${mimeType};base64,${base64}`
    } catch (error) {
      console.error(`Error reading logo file:`, error)
      return null
    }
  })

  // ── Sync handlers ──────────────────────────────────────────────────────
  safeRegisterHandler("sync:getStatus", async () => ({
    enabled: isSyncEnabled(),
    lastSyncAt: getLastSyncAt(),
  }))

  safeRegisterHandler("sync:setEnabled", async (_, enabled: boolean) => {
    setSyncEnabled(enabled)
    return { success: true }
  })

  safeRegisterHandler("sync:run", async () => {
    return runSync()
  })
}

function getFilenameFromUrl(url: string) {
  try {
    const _url = new URL(url)
    return _url.pathname.split("/").pop()
  } catch (_error) {
    return null
  }
}
