import { app, BrowserWindow } from "electron"
import path from "node:path"
import fse, { mkdirp } from "fs-extra"
import { compareFilesAndReplace, npmInstall } from "./util.js"
import {
  scriptsDir,
  configDir,
  DEF_MCP_SERVER_CONFIG,
  cwd,
  DEF_MODEL_CONFIG,
  DEF_ATTACKTRACE_HTTPD_CONFIG,
  hostCacheDir,
  __dirname,
  legacyConfigDir,
  envPath,
  VITE_DEV_SERVER_URL,
  DEF_PLUGIN_CONFIG,
} from "./constant.js"
import spawn from "cross-spawn"
import { ChildProcess, SpawnOptions, StdioOptions } from "node:child_process"
import { EventEmitter } from "node:events"
import { Writable } from "node:stream"
import crypto from "node:crypto"
import { hostCache } from "./store.js"
import { getPassword } from "./ipc/keychain"

// Always use the same configDir as defined in constant.ts for consistency
const baseConfigDir = configDir

/**
 * Parse keychain reference from value
 * Format: @keychain:service:account
 */
function parseKeychainReference(value: string): { service: string; account: string } | null {
  if (typeof value !== "string" || !value.startsWith("@keychain:")) {
    return null
  }
  
  const match = value.match(/^@keychain:([^:]+):([^:]+)$/)
  if (!match) {
    return null
  }
  
  return {
    service: match[1],
    account: match[2]
  }
}

/**
 * Extract all keychain references from MCP config
 * Returns a map of keychain refs to their service/account info
 */
async function extractKeychainReferences(mcpConfigPath: string): Promise<Map<string, { service: string; account: string }>> {
  const keychainRefs = new Map<string, { service: string; account: string }>()
  
  if (!(await fse.pathExists(mcpConfigPath))) {
    return keychainRefs
  }
  
  try {
    const config = await fse.readJSON(mcpConfigPath)
    const servers = config.mcpServers || {}
    
    // Recursively search for keychain references in the config
    const searchForKeychainRefs = (obj: any, path: string = "") => {
      if (typeof obj === "string") {
        const parsed = parseKeychainReference(obj)
        if (parsed) {
          const refKey = `${parsed.service}:${parsed.account}`
          keychainRefs.set(refKey, parsed)
        }
      } else if (Array.isArray(obj)) {
        obj.forEach((item, index) => searchForKeychainRefs(item, `${path}[${index}]`))
      } else if (obj && typeof obj === "object") {
        Object.entries(obj).forEach(([key, value]) => searchForKeychainRefs(value, path ? `${path}.${key}` : key))
      }
    }
    
    searchForKeychainRefs(servers)
    
    return keychainRefs
  } catch (error) {
    console.error("[Keychain] Failed to parse MCP config:", error)
    return keychainRefs
  }
}

/**
 * Load keychain credentials and inject as environment variables
 * Environment variable format: ATTACKTRACE_KEYCHAIN_<SERVICE>_<ACCOUNT> = password
 */
async function injectKeychainCredentials(projectId: string, env: Record<string, string>): Promise<void> {
  try {
    const projectsDir = path.join(configDir, "..", "projects")
    const mcpConfigPath = path.join(projectsDir, projectId, "mcp_config.json")
    
    const keychainRefs = await extractKeychainReferences(mcpConfigPath)
    
    if (keychainRefs.size === 0) {
      console.log("[Keychain] No keychain references found in MCP config")
      return
    }
    
    console.log(`[Keychain] Found ${keychainRefs.size} keychain reference(s) in project ${projectId}`)
    
    for (const [refKey, { service, account }] of keychainRefs) {
      const result = await getPassword(service, account)
      
      if (result.success && result.password) {
        // Convert to safe environment variable name
        const envKey = `ATTACKTRACE_KEYCHAIN_${service.toUpperCase().replace(/[^A-Z0-9]/g, "_")}_${account.toUpperCase().replace(/[^A-Z0-9]/g, "_")}`
        env[envKey] = result.password
        console.log(`[Keychain] Injected credential: ${envKey} (from ${service}:${account})`)
      } else {
        console.warn(`[Keychain] Failed to load credential for ${service}:${account}:`, result.error)
      }
    }
  } catch (error) {
    console.error("[Keychain] Failed to inject keychain credentials:", error)
  }
}

const onServiceUpCallbacks: ((ip: string, port: number) => Promise<void>)[] = []
export const clearServiceUpCallbacks = () => onServiceUpCallbacks.length = 0
export const setServiceUpCallback = (callback: (ip: string, port: number) => Promise<void>) => onServiceUpCallbacks.push(callback)

export const serviceStatus = {
  ip: "localhost",
  port: 0,
}

let hostProcess: ChildProcess | null = null
const ipcEventEmitter = new EventEmitter()

const spawned: Set<ChildProcess> = new Set()

let installHostDependenciesLog: string[] = []
export const getInstallHostDependenciesLog = () => installHostDependenciesLog

async function initApp() {
  // create dirs
  await fse.mkdir(baseConfigDir, { recursive: true })

  await migratePrebuiltScripts().catch(console.error)
  await migrateLegacyConfig().catch(console.error)

  // NOTE: mcp_config.json is now managed by backend in project-specific directory
  // (projects/default/mcp_config.json), not in .config directory

  // create custom rules file if not exists
  const customRulesPath = path.join(baseConfigDir, "customrules")
  await createFileIfNotExists(customRulesPath, "")

  // create model config file if not exists
  const modelConfigPath = path.join(baseConfigDir, "model_config.json")
  await createFileIfNotExists(modelConfigPath, JSON.stringify(DEF_MODEL_CONFIG, null, 2))

  // create attacktrace_httpd config file if not exists
  const attacktraceHttpdConfigPath = path.join(baseConfigDir, "attacktrace_httpd.json")
  await createFileIfNotExists(attacktraceHttpdConfigPath, JSON.stringify(DEF_ATTACKTRACE_HTTPD_CONFIG, null, 2))

  // create plugin config file if not exists
  const pluginConfigPath = path.join(baseConfigDir, "plugin_config.json")
  await createFileIfNotExists(pluginConfigPath, JSON.stringify(DEF_PLUGIN_CONFIG, null, 2))

  // create command alias file if not exists
  const commandAliasPath = path.join(baseConfigDir, "command_alias.json")
  await createFileIfNotExists(commandAliasPath, JSON.stringify(process.platform === "win32" && app.isPackaged ? {
    "npx": path.join(process.resourcesPath, "node", "npx.cmd"),
    "npm": path.join(process.resourcesPath, "node", "npm.cmd"),
  } : {}, null, 2))
}

async function mergeDefaultMCPConfig(configPath: string) {
  let existingConfig: any = { mcpServers: {} }
  if (await fse.pathExists(configPath)) {
    try {
      existingConfig = await fse.readJSON(configPath)
    } catch (error) {
      console.error("Failed to read existing MCP config, will use default", error)
    }
  }
  const defaultServers = DEF_MCP_SERVER_CONFIG.mcpServers
  const existingServers = existingConfig.mcpServers || {}
  for (const [serverName, serverConfig] of Object.entries(defaultServers)) {
    if (!existingServers[serverName]) {
      existingServers[serverName] = serverConfig
      console.log(`Adding default MCP server: ${serverName}`)
    }
  }
  existingConfig.mcpServers = existingServers
  await fse.writeFile(configPath, JSON.stringify(existingConfig, null, 2))
  console.log("MCP config merged successfully")
}


async function createFileIfNotExists(_path: string, content: string) {
  if (!(await fse.pathExists(_path))) {
    console.log("creating file", _path)
    await fse.ensureDir(path.dirname(_path))
    await fse.writeFile(_path, content)
  }
}

export async function initMCPClient(win: BrowserWindow) {
  const handler = (message: any) => {
    if (message.server.listen.port) {
      serviceStatus.ip = message.server.listen.ip
      serviceStatus.port = message.server.listen.port
      win.webContents.send("app-port", message.server.listen.port)
      ipcEventEmitter.off("ipc", handler)

      // wait for the service to be ready
      setTimeout(() => {
        // call the callback
        onServiceUpCallbacks.forEach((callback) =>
          callback(message.server.listen.ip, message.server.listen.port)
            .catch((error) => console.error("Failed to call service up callback:", error)))
        clearServiceUpCallbacks()
      }, 100)
    }
  }
  ipcEventEmitter.on("ipc", handler)

  await initApp().catch(console.error)
  await installHostDependencies(win).catch(console.error)
  await startHostService().catch(console.error)
}

export async function cleanup() {
  console.log("cleanup")

  for (const child of spawned) {
    if (!child.killed) {
      child.kill("SIGTERM")
    }
  }
  spawned.clear()

  if (hostProcess) {
    console.log("killing host process")
    hostProcess.kill("SIGTERM")
    await new Promise(resolve => setTimeout(resolve, 100))
    if (!hostProcess.killed) {
      console.log("killing host process again")
      hostProcess?.kill("SIGKILL")
    }
  }

  // reset bus
  await fse.writeFile(path.join(hostCacheDir, "bus"), "")
}

/**
 * Restart Host process (for project switching)
 * Kills the current host and starts a new one with the current project context
 */
export async function restartHost(): Promise<{ success: boolean; port?: number; error?: string }> {
  try {
    console.log("[restartHost] Starting host restart process...")
    
    // Create a promise that resolves when the new host is ready
    const hostReadyPromise = new Promise<number>((resolve, reject) => {
      const timeout = setTimeout(() => {
        ipcEventEmitter.off("ipc", handler)
        reject(new Error("Host startup timeout after 30 seconds"))
      }, 30000)
      
      const handler = (message: any) => {
        if (message.server?.listen?.port) {
          clearTimeout(timeout)
          ipcEventEmitter.off("ipc", handler)
          console.log(`[restartHost] Received port from new host: ${message.server.listen.port}`)
          serviceStatus.ip = message.server.listen.ip
          serviceStatus.port = message.server.listen.port
          resolve(message.server.listen.port)
        }
      }
      
      ipcEventEmitter.on("ipc", handler)
    })
    
    // Step 1: Kill current host process
    if (hostProcess && !hostProcess.killed) {
      console.log("[restartHost] Killing current host process...")
      hostProcess.kill("SIGTERM")
      await new Promise(resolve => setTimeout(resolve, 200))
      
      if (!hostProcess.killed) {
        console.log("[restartHost] Force killing host process...")
        hostProcess.kill("SIGKILL")
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    
    // Step 2: Reset bus file
    const busPath = path.join(hostCacheDir, "bus")
    await fse.writeFile(busPath, "")
    console.log("[restartHost] Bus file reset")
    
    // Step 3: Reset service status
    serviceStatus.port = 0
    
    // Step 4: Start new host process
    console.log("[restartHost] Starting new host process...")
    await startHostService()
    
    // Step 5: Wait for host to be ready
    const port = await hostReadyPromise
    
    console.log(`[restartHost] Host restarted successfully on port ${port}`)
    return { success: true, port }
    
  } catch (error) {
    console.error("[restartHost] Failed to restart host:", error)
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error" 
    }
  }
}

async function migrateLegacyConfig() {
  const files = [
    "config.json",
    "model.json",
    ".customrules",
  ]

  const newFiles = [
    "mcp_config.json",
    "model_config.json",
    "customrules",
  ]

  for (let i = 0; i < files.length; i++) {
    const filePath = path.join(legacyConfigDir, files[i])
    const newFilePath = path.join(configDir, newFiles[i])
    if (await fse.pathExists(filePath) && !(await fse.pathExists(newFilePath))) {
      console.log("copying legacy config", filePath, newFilePath)
      await fse.copy(filePath, newFilePath)
    }
  }

  const modelConfigPath = path.join(configDir, "model_config.json")
  const modelConfig = await fse.readJSON(modelConfigPath)
  if (!modelConfig.enableTools && modelConfig.enable_tools) {
    modelConfig.enableTools = modelConfig.enable_tools
    delete modelConfig.enable_tools
  }

  modelConfig.configs = Object.keys(modelConfig.configs).reduce((acc, key) => {
    const config = modelConfig.configs[key]
    if (config.modelProvider === "openai" && !config.apiKey) {
      config.apiKey = ""
    }

    if ("baseURL" in config && !config.baseURL) {
      delete config.baseURL
    }

    if (config.configuration && "baseURL" in config.configuration && !config.configuration.baseURL) {
      delete config.configuration.baseURL
    }

    acc[key] = config
    return acc
  }, {} as any)

  await fse.writeJSON(modelConfigPath, modelConfig)
}

async function migratePrebuiltScripts() {
  console.log("migrating prebuilt scripts")

  // copy scripts
  const rebuiltScriptsPath = path.join(app.isPackaged ? process.resourcesPath : process.cwd(), "prebuilt/scripts")
  if(!(await fse.pathExists(scriptsDir))) {
    await fse.mkdir(scriptsDir, { recursive: true })
    await fse.copy(rebuiltScriptsPath, scriptsDir)
  }

  // copy mcp-server-echo if exists (完整独立复制，包含所有依赖)
  const echoSourcePath = path.join(rebuiltScriptsPath, "mcp-server-echo")
  const echoTargetPath = path.join(scriptsDir, "mcp-server-echo")
  if (await fse.pathExists(echoSourcePath)) {
    console.log("Processing mcp-server-echo...")
    
    const hasNodeModules = await fse.pathExists(path.join(echoSourcePath, "node_modules"))
    const hasDist = await fse.pathExists(path.join(echoSourcePath, "dist"))
    
    if (!hasNodeModules || !hasDist) {
      console.warn("⚠️  Warning: mcp-server-echo is missing node_modules or dist directory")
      console.warn("Please run: npm run build:mcp-echo && npm run prepare:mcp-echo")
    }
    
    let needsCopy = true
    if (await fse.pathExists(echoTargetPath)) {
      const sourcePackageJson = await fse.readJSON(path.join(echoSourcePath, "package.json")).catch(() => ({}))
      const targetPackageJson = await fse.readJSON(path.join(echoTargetPath, "package.json")).catch(() => ({}))
      
      if (sourcePackageJson.version === targetPackageJson.version) {
        console.log(`mcp-server-echo v${sourcePackageJson.version} already exists, skipping copy`)
        needsCopy = false
      } else {
        console.log(`Updating mcp-server-echo from v${targetPackageJson.version} to v${sourcePackageJson.version}`)
        await fse.remove(echoTargetPath)
      }
    }
    
    if (needsCopy) {
      console.log("Copying mcp-server-echo (complete with all dependencies)...")
      await fse.copy(echoSourcePath, echoTargetPath, {
        dereference: true,
        filter: (src) => {
          const relativePath = path.relative(echoSourcePath, src)
          if (relativePath.includes('.git') || 
              relativePath.includes('tsconfig.json') ||
              relativePath.startsWith('src/')) {
            return false
          }
          return true
        }
      })
      console.log("✓ Copied mcp-server-echo successfully")
    }
  }

  // copy mcp-server-kibana if exists (完整独立复制，包含所有依赖)
  const kibanaSourcePath = path.join(rebuiltScriptsPath, "mcp-server-kibana")
  const kibanaTargetPath = path.join(scriptsDir, "mcp-server-kibana")
  if (await fse.pathExists(kibanaSourcePath)) {
    console.log("Processing mcp-server-kibana...")
    
    // 1. 检查源目录是否有必要的文件
    const hasNodeModules = await fse.pathExists(path.join(kibanaSourcePath, "node_modules"))
    const hasDist = await fse.pathExists(path.join(kibanaSourcePath, "dist"))
    
    if (!hasNodeModules || !hasDist) {
      console.warn("⚠️  Warning: mcp-server-kibana is missing node_modules or dist directory")
      console.warn("Please run: npm run build:mcp-kibana && npm run prepare:mcp-kibana")
    }
    
    // 2. 只在需要时删除和复制（比较版本或时间戳）
    let needsCopy = true
    if (await fse.pathExists(kibanaTargetPath)) {
      const sourcePackageJson = await fse.readJSON(path.join(kibanaSourcePath, "package.json")).catch(() => ({}))
      const targetPackageJson = await fse.readJSON(path.join(kibanaTargetPath, "package.json")).catch(() => ({}))
      
      if (sourcePackageJson.version === targetPackageJson.version) {
        console.log(`mcp-server-kibana v${sourcePackageJson.version} already exists, skipping copy`)
        needsCopy = false
      } else {
        console.log(`Updating mcp-server-kibana from v${targetPackageJson.version} to v${sourcePackageJson.version}`)
        await fse.remove(kibanaTargetPath)
      }
    }
    
    // 3. 完整复制，解析所有符号链接为真实文件
    if (needsCopy) {
      console.log("Copying mcp-server-kibana (complete with all dependencies)...")
      await fse.copy(kibanaSourcePath, kibanaTargetPath, {
        dereference: true,  // 解析符号链接，复制真实文件
        filter: (src) => {
          // 排除不必要的文件
          const relativePath = path.relative(kibanaSourcePath, src)
          if (relativePath.includes('.git') || 
              relativePath.includes('tsconfig.json') ||
              relativePath.includes('jest.config.js') ||
              relativePath.startsWith('src/') ||
              relativePath === 'index.ts') {
            return false
          }
          return true
        }
      })
      console.log("✓ Copied mcp-server-kibana successfully (complete independent package)")
    }
  }

}

async function startHostService() {
  const isWindows = process.platform === "win32"
  const resourcePath = app.isPackaged ? process.resourcesPath : cwd
  const pyBinPath = path.join(resourcePath, "python", "bin")
  const pyPath = isWindows ? path.join(resourcePath, "python", "python.exe") : path.join(pyBinPath, "python3")
  const hostDepsPath = path.join(hostCacheDir, "deps")
  const hostSrcPath = path.join(resourcePath, "mcp-host")

  const httpdExec = app.isPackaged ? pyPath : "uv"
  const httpdParam = app.isPackaged
    ? process.platform === "darwin"
      ? ["-I", path.join(pyBinPath, "attacktrace_httpd")]
      : ["-I", "-c", `import sys; sys.path.extend(['${hostSrcPath.replace(/\\/g, "\\\\")}', '${hostDepsPath.replace(/\\/g, "\\\\")}']); from attacktrace_mcp_host.httpd._main import main; main()`]
    : ["run", "attacktrace_httpd"]

  const httpdEnv: any = {
    ...process.env,
    ATTACKTRACE_CONFIG_DIR: baseConfigDir,
    RESOURCE_DIR: hostCacheDir,
  }

  // Inject keychain credentials as environment variables
  try {
    const currentProjectFile = path.join(configDir, "..", "current_project.json")
    if (await fse.pathExists(currentProjectFile)) {
      const { projectId } = await fse.readJSON(currentProjectFile)
      if (projectId) {
        await injectKeychainCredentials(projectId, httpdEnv)
      }
    }
  } catch (error) {
    console.error("[Keychain] Failed to load current project for keychain injection:", error)
  }

  console.log("httpd executing path: ", httpdExec)

  const busPath = path.join(hostCacheDir, "bus")
  await createFileIfNotExists(busPath, "")
  if (process.platform !== "win32") {
    await fse.chmod(busPath, 0o666)
  }

  fse.watch(busPath, async (eventType, filename) => {
    if (!filename)
      return

    if (eventType !== "change")
      return

    const buffer = Buffer.alloc(1024 * 32)
    await fse.read(await fse.open(busPath, "r"), buffer, 0, buffer.length, 0)

    if (!buffer.length)
      return

    try {
      const content = buffer.toString().trim().replace(/\0/g, "")
      if (!content)
        return

      const message = JSON.parse(content)
      if (message) {
        ipcEventEmitter.emit("ipc", message)
        console.log("received message from host service", message)
      }
    } catch (error) {
      console.error("Failed to parse bus content:", buffer.toString().trim(), error)
    }
  })

  const spawnParam = [
    ...httpdParam,
    "--port",
    "0",
    "--report_status_file",
    busPath,
    "--cors",
    "*",
    "--log_dir",
    path.join(envPath.log, "host"),
    "--plugin_config",
    path.join(baseConfigDir, "plugin_config.json")
  ]

  const options: SpawnOptions = {
    env: httpdEnv,
    stdio: VITE_DEV_SERVER_URL ? "inherit" : "pipe",
  }

  if (VITE_DEV_SERVER_URL) {
    options.cwd = path.join(__dirname, "..", "..", "mcp-host")
  }

  console.log("spawn host with", httpdExec, spawnParam.join(" "))
  hostProcess = spawn(httpdExec, spawnParam, options)

  if (app.isPackaged) {
    hostProcess?.stdout?.pipe(new Writable({
      write(chunk, encoding, callback) {
        console.log("[dived]", chunk.toString())
        callback()
      }
    }))

    hostProcess?.stderr?.pipe(new Writable({
      write(chunk, encoding, callback) {
        const str = chunk.toString()
        if (str.startsWith("INFO") || str.startsWith("DEBUG")) {
          console.log("[dived]", str)
        } else if (str.startsWith("WARNING")) {
          console.warn("[dived]", str)
        } else {
          console.error("[dived]", str)
        }
        callback()
      }
    }))
  }

  hostProcess!.on("error", (error) => {
    console.error("Failed to start host process:", error)
  })

  hostProcess!.on("close", (code) => {
    console.log(`host process exited with code ${code}`)
  })

  hostProcess!.on("spawn", () => {
    console.log("host process spawned")
  })
}

async function installHostDependencies(win: BrowserWindow) {
  const done = () => {
    win.webContents.send("install-host-dependencies-log", "finish")
    installHostDependenciesLog = ["finish"]
  }

  if (!app.isPackaged || process.platform === "darwin") {
    return done()
  }

  console.log("installing host dependencies")
  const isWindows = process.platform === "win32"
  const pyBinPath = path.join(process.resourcesPath, "python", "bin")
  const pyPath = isWindows ? path.join(process.resourcesPath, "python", "python.exe") : path.join(pyBinPath, "python3")
  const uvPath = path.join(process.resourcesPath, "uv", isWindows ? "uv.exe" : "uv")
  const requirementsPath = path.join(hostCacheDir, "requirements.txt")
  const hostPath = path.join(process.resourcesPath, "mcp-host")

  if (!(await fse.pathExists(path.join(hostPath, "uv.lock")))) {
    return done()
  }

  const depsTargetPath = path.join(hostCacheDir, "deps")
  const lockHash = await createMD5(path.join(hostPath, "uv.lock"))
  if (lockHash === hostCache.get("lockHash") && await fse.pathExists(depsTargetPath)) {
    return done()
  }

  await mkdirp(depsTargetPath)

  const pipParam = ["pip", "install", "-r", requirementsPath, "--target", depsTargetPath, "--python", pyPath]

  return promiseSpawn(uvPath, ["export", "-o", requirementsPath], hostPath, "ignore")
    .then(() => promiseSpawn(uvPath, pipParam, hostPath, "pipe", 60 * 1000 * 10, data => {
      installHostDependenciesLog.push(data)
      win.webContents.send("install-host-dependencies-log", data)
      hostCache.set("lockHash", lockHash)
    }))
    .finally(done)
}

function promiseSpawn(command: string, args: any[], cwd: string, stdio: StdioOptions = "inherit", timeout = 60 * 1000 * 5, stdout?: (data: string) => void) {
  return new Promise((resolve, reject) => {
    // timeout after 5 minutes
    setTimeout(reject, timeout)

    const child = spawn(command, args, { cwd, stdio })
    spawned.add(child)
    child.on("close", () => {
      spawned.delete(child)
      resolve(1)
    })

    child.on("error", e => {
      console.error(e)
      spawned.delete(child)
      reject(e)
    })

    child?.stdout?.pipe(new Writable({
      write(chunk, encoding, callback) {
        stdout?.(chunk.toString())
        callback()
      }
    }))

    child?.stderr?.pipe(new Writable({
      write(chunk, encoding, callback) {
        stdout?.(chunk.toString())
        callback()
      }
    }))
  })
}

function createMD5(filePath: string) {
  return new Promise((res, _rej) => {
    const hash = crypto.createHash("md5")

    const rStream = fse.createReadStream(filePath)
    rStream.on("data", (data) => {
      hash.update(data)
    })
    rStream.on("end", () => {
      res(hash.digest("hex"))
    })
  })
}
