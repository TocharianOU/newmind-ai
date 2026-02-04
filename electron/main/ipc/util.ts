import { BrowserWindow, dialog, nativeImage, clipboard, shell } from "electron"
import fse from "fs-extra"
import path from "node:path"
import { configDir, scriptsDir } from "../constant"
import { CancelError, download } from "electron-dl"
import { ModelGroupSetting } from "../../../types/model"
import { refreshConfig } from "../deeplink"
import { getInstallHostDependenciesLog } from "../service"
import { safeRegisterHandler } from "../utils/ipcRegistry"

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
    const image = url.startsWith(localProtocol)
      ? nativeImage.createFromPath(url.substring(localProtocol.length))
      : await getImageFromRemote(url)

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

  safeRegisterHandler("util:getInstallHostDependenciesLog", async () => {
    return getInstallHostDependenciesLog()
  })

  safeRegisterHandler("open-external-url", async (_, url: string) => {
    console.log('🔗 Opening external URL:', url);
    shell.openExternal(url);
  })

  safeRegisterHandler("util:readLocalLogo", async (_, logoPath: string) => {
    try {
      if (!fse.existsSync(logoPath)) {
        console.warn(`Logo file not found: ${logoPath}`)
        return null
      }

      const fileBuffer = await fse.readFile(logoPath)
      const ext = path.extname(logoPath).toLowerCase()
      
      // Determine MIME type
      let mimeType = 'image/svg+xml'
      if (ext === '.png') mimeType = 'image/png'
      else if (ext === '.jpg' || ext === '.jpeg') mimeType = 'image/jpeg'
      
      // Convert to base64 data URL
      const base64 = fileBuffer.toString('base64')
      return `data:${mimeType};base64,${base64}`
    } catch (error) {
      console.error(`Error reading logo file ${logoPath}:`, error)
      return null
    }
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
