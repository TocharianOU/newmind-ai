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
  DEF_DIVE_HTTPD_CONFIG,
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

const baseConfigDir = app.isPackaged ? configDir : path.join(__dirname, "..", "..", ".config")

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

  // create config file if not exists
  const mcpServerConfigPath = path.join(baseConfigDir, "mcp_config.json")
  await mergeDefaultMCPConfig(mcpServerConfigPath)

  // create custom rules file if not exists
  const customRulesPath = path.join(baseConfigDir, "customrules")
  await createFileIfNotExists(customRulesPath, "")

  // create model config file if not exists
  const modelConfigPath = path.join(baseConfigDir, "model_config.json")
  await createFileIfNotExists(modelConfigPath, JSON.stringify(DEF_MODEL_CONFIG, null, 2))

  // create dive_httpd config file if not exists
  const diveHttpdConfigPath = path.join(baseConfigDir, "dive_httpd.json")
  await createFileIfNotExists(diveHttpdConfigPath, JSON.stringify(DEF_DIVE_HTTPD_CONFIG, null, 2))

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
  if (!(await fse.pathExists(scriptsDir))) {
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

  // copy mcp-server-elasticsearch-sl if exists (完整独立复制，包含所有依赖)
  const esSourcePath = path.join(rebuiltScriptsPath, "mcp-server-elasticsearch-sl")
  const esTargetPath = path.join(scriptsDir, "mcp-server-elasticsearch-sl")
  if (await fse.pathExists(esSourcePath)) {
    console.log("Processing mcp-server-elasticsearch-sl...")

    // 1. 检查源目录是否有必要的文件
    const hasNodeModules = await fse.pathExists(path.join(esSourcePath, "node_modules"))
    const hasDist = await fse.pathExists(path.join(esSourcePath, "dist"))

    if (!hasNodeModules || !hasDist) {
      console.warn("⚠️  Warning: mcp-server-elasticsearch-sl is missing node_modules or dist directory")
      console.warn("Please run: npm run build:mcp-elasticsearch && npm run prepare:mcp-elasticsearch")
    }

    // 2. 只在需要时删除和复制（比较版本或时间戳）
    let needsCopy = true
    if (await fse.pathExists(esTargetPath)) {
      const sourcePackageJson = await fse.readJSON(path.join(esSourcePath, "package.json")).catch(() => ({}))
      const targetPackageJson = await fse.readJSON(path.join(esTargetPath, "package.json")).catch(() => ({}))

      if (sourcePackageJson.version === targetPackageJson.version) {
        console.log(`mcp-server-elasticsearch-sl v${sourcePackageJson.version} already exists, skipping copy`)
        needsCopy = false
      } else {
        console.log(`Updating mcp-server-elasticsearch-sl from v${targetPackageJson.version} to v${sourcePackageJson.version}`)
        await fse.remove(esTargetPath)
      }
    }

    // 3. 完整复制，解析所有符号链接为真实文件
    if (needsCopy) {
      console.log("Copying mcp-server-elasticsearch-sl (complete with all dependencies)...")
      await fse.copy(esSourcePath, esTargetPath, {
        dereference: true,  // 解析符号链接，复制真实文件
        filter: (src) => {
          // 排除不必要的文件
          const relativePath = path.relative(esSourcePath, src)
          if (relativePath.includes('.git') ||
            relativePath.includes('tsconfig.json') ||
            relativePath.startsWith('src/') ||
            relativePath === 'index.ts' ||
            relativePath === 'catalog-info.yaml' ||
            relativePath === 'renovate.json') {
            return false
          }
          return true
        }
      })
      console.log("✓ Copied mcp-server-elasticsearch-sl successfully (complete independent package)")
    }
  }

  // copy mcp-server-mongodb if exists (完整独立复制，包含所有依赖)
  const mongodbSourcePath = path.join(rebuiltScriptsPath, "mcp-server-mongodb")
  const mongodbTargetPath = path.join(scriptsDir, "mcp-server-mongodb")
  if (await fse.pathExists(mongodbSourcePath)) {
    console.log("Processing mcp-server-mongodb...")

    const hasNodeModules = await fse.pathExists(path.join(mongodbSourcePath, "node_modules"))
    const hasIndexJs = await fse.pathExists(path.join(mongodbSourcePath, "index.js"))

    if (!hasNodeModules || !hasIndexJs) {
      console.warn("⚠️  Warning: mcp-server-mongodb is missing node_modules or index.js")
      console.warn("Please ensure mcp-server-mongodb is properly set up")
    }

    let needsCopy = true
    if (await fse.pathExists(mongodbTargetPath)) {
      const sourcePackageJson = await fse.readJSON(path.join(mongodbSourcePath, "package.json")).catch(() => ({}))
      const targetPackageJson = await fse.readJSON(path.join(mongodbTargetPath, "package.json")).catch(() => ({}))

      if (sourcePackageJson.version === targetPackageJson.version) {
        console.log(`mcp-server-mongodb v${sourcePackageJson.version} already exists, skipping copy`)
        needsCopy = false
      } else {
        console.log(`Updating mcp-server-mongodb from v${targetPackageJson.version} to v${sourcePackageJson.version}`)
        await fse.remove(mongodbTargetPath)
      }
    }

    if (needsCopy) {
      console.log("Copying mcp-server-mongodb (complete with all dependencies)...")
      await fse.copy(mongodbSourcePath, mongodbTargetPath, {
        dereference: true,
        filter: (src) => {
          const relativePath = path.relative(mongodbSourcePath, src)
          if (relativePath.includes('.git') ||
            relativePath.includes('tsconfig.json') ||
            relativePath.startsWith('test')) {
            return false
          }
          return true
        }
      })
      console.log("✓ Copied mcp-server-mongodb successfully (complete independent package)")
    }
  }

  // copy mcp-server-mysql if exists (完整独立复制，包含所有依赖)
  const mysqlSourcePath = path.join(rebuiltScriptsPath, "mcp-server-mysql")
  const mysqlTargetPath = path.join(scriptsDir, "mcp-server-mysql")
  if (await fse.pathExists(mysqlSourcePath)) {
    console.log("Processing mcp-server-mysql...")

    const hasNodeModules = await fse.pathExists(path.join(mysqlSourcePath, "node_modules"))
    const hasDist = await fse.pathExists(path.join(mysqlSourcePath, "dist"))

    if (!hasNodeModules || !hasDist) {
      console.warn("⚠️  Warning: mcp-server-mysql is missing node_modules or dist directory")
      console.warn("Please ensure mcp-server-mysql is properly built")
    }

    let needsCopy = true
    if (await fse.pathExists(mysqlTargetPath)) {
      const sourcePackageJson = await fse.readJSON(path.join(mysqlSourcePath, "package.json")).catch(() => ({}))
      const targetPackageJson = await fse.readJSON(path.join(mysqlTargetPath, "package.json")).catch(() => ({}))

      if (sourcePackageJson.version === targetPackageJson.version) {
        console.log(`mcp-server-mysql v${sourcePackageJson.version} already exists, skipping copy`)
        needsCopy = false
      } else {
        console.log(`Updating mcp-server-mysql from v${targetPackageJson.version} to v${sourcePackageJson.version}`)
        await fse.remove(mysqlTargetPath)
      }
    }

    if (needsCopy) {
      console.log("Copying mcp-server-mysql (complete with all dependencies)...")
      await fse.copy(mysqlSourcePath, mysqlTargetPath, {
        dereference: true,
        filter: (src) => {
          const relativePath = path.relative(mysqlSourcePath, src)
          if (relativePath.includes('.git') ||
            relativePath.includes('tsconfig.json') ||
            relativePath.startsWith('src/') ||
            relativePath.startsWith('tests/') ||
            relativePath === 'index.ts' ||
            relativePath === 'evals.ts') {
            return false
          }
          return true
        }
      })
      console.log("✓ Copied mcp-server-mysql successfully (complete independent package)")
    }
  }

  // copy mcp-server-pgsql if exists (完整独立复制，包含所有依赖)
  const pgsqlSourcePath = path.join(rebuiltScriptsPath, "mcp-server-pgsql")
  const pgsqlTargetPath = path.join(scriptsDir, "mcp-server-pgsql")
  if (await fse.pathExists(pgsqlSourcePath)) {
    console.log("Processing mcp-server-pgsql...")

    const hasNodeModules = await fse.pathExists(path.join(pgsqlSourcePath, "node_modules"))
    const hasBuild = await fse.pathExists(path.join(pgsqlSourcePath, "build"))

    if (!hasNodeModules || !hasBuild) {
      console.warn("⚠️  Warning: mcp-server-pgsql is missing node_modules or build directory")
      console.warn("Please ensure mcp-server-pgsql is properly built")
    }

    let needsCopy = true
    if (await fse.pathExists(pgsqlTargetPath)) {
      const sourcePackageJson = await fse.readJSON(path.join(pgsqlSourcePath, "package.json")).catch(() => ({}))
      const targetPackageJson = await fse.readJSON(path.join(pgsqlTargetPath, "package.json")).catch(() => ({}))

      if (sourcePackageJson.version === targetPackageJson.version) {
        console.log(`mcp-server-pgsql v${sourcePackageJson.version} already exists, skipping copy`)
        needsCopy = false
      } else {
        console.log(`Updating mcp-server-pgsql from v${targetPackageJson.version} to v${sourcePackageJson.version}`)
        await fse.remove(pgsqlTargetPath)
      }
    }

    if (needsCopy) {
      console.log("Copying mcp-server-pgsql (complete with all dependencies)...")
      await fse.copy(pgsqlSourcePath, pgsqlTargetPath, {
        dereference: true,
        filter: (src) => {
          const relativePath = path.relative(pgsqlSourcePath, src)
          if (relativePath.includes('.git') ||
            relativePath.includes('tsconfig.json') ||
            relativePath.startsWith('src/') ||
            relativePath.startsWith('docs/')) {
            return false
          }
          return true
        }
      })
      console.log("✓ Copied mcp-server-pgsql successfully (complete independent package)")
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
      ? ["-I", path.join(pyBinPath, "dive_httpd")]
      : ["-I", "-c", `import sys; sys.path.extend(['${hostSrcPath.replace(/\\/g, "\\\\")}', '${hostDepsPath.replace(/\\/g, "\\\\")}']); from dive_mcp_host.httpd._main import main; main()`]
    : ["run", "dive_httpd"]

  const httpdEnv: any = {
    ...process.env,
    DIVE_CONFIG_DIR: baseConfigDir,
    RESOURCE_DIR: hostCacheDir,
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
