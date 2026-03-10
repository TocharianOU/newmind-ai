import fs from "fs"
import https from "https"
import path from "path"
import { exec } from "child_process"
import { rimraf } from "rimraf"
import { promisify } from "util"
import { fileURLToPath } from "url"

const execPromise = promisify(exec)
const PYTHON_VERSION = "3.12"
const PLATFORM = process.argv[2] || "win-x64"
const TEMP_DIR = "./tmp"
const __dirname = path.dirname(fileURLToPath(import.meta.url))

// python-build-standalone (the same source uv uses) for cross-platform downloads.
// Windows x64 install_only tarball — contains python.exe + Lib/ + DLLs.
const PBS_DATE    = "20241219"
const PBS_PY_VER  = "3.12.8"
const PBS_WIN_URL = `https://github.com/astral-sh/python-build-standalone/releases/download/${PBS_DATE}/cpython-${PBS_PY_VER}+${PBS_DATE}-x86_64-pc-windows-msvc-install_only.tar.gz`

// Helper: follow redirects and download file
function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadFile(res.headers.location!, dest).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
      }
      const file = fs.createWriteStream(dest)
      res.pipe(file)
      file.on("finish", () => { file.close(); resolve() })
      file.on("error", reject)
    })
    req.on("error", reject)
  })
}

// Helper: copy directory tree (preserves permissions)
function copyFolderRecursiveSync(source: string, target: string) {
  const targetFolder = path.join(target, path.basename(source))
  if (!fs.existsSync(targetFolder)) {
    fs.mkdirSync(targetFolder, { recursive: true })
  }
  if (fs.lstatSync(source).isDirectory()) {
    fs.readdirSync(source).forEach((file) => {
      const src = path.join(source, file)
      if (fs.lstatSync(src).isDirectory()) {
        copyFolderRecursiveSync(src, targetFolder)
      } else {
        fs.copyFileSync(src, path.join(targetFolder, file))
        fs.chmodSync(path.join(targetFolder, file), fs.statSync(src).mode)
      }
    })
  }
}

// Copy all files/dirs from srcDir into destDir (flat, not nested)
function copyDirContents(srcDir: string, destDir: string) {
  fs.mkdirSync(destDir, { recursive: true })
  for (const file of fs.readdirSync(srcDir)) {
    const src = path.join(srcDir, file)
    if (fs.lstatSync(src).isDirectory()) {
      copyFolderRecursiveSync(src, destDir)
    } else {
      fs.copyFileSync(src, path.join(destDir, file))
      fs.chmodSync(path.join(destDir, file), fs.statSync(src).mode)
    }
  }
}

// Download Windows Python from python-build-standalone (for cross-platform Docker builds)
async function downloadWindowsPython(targetDir: string) {
  console.log(`Downloading Windows Python ${PBS_PY_VER} from python-build-standalone...`)
  const tarFile = path.join(TEMP_DIR, path.basename(PBS_WIN_URL))
  const extractDir = path.join(TEMP_DIR, "py-win-extract")

  fs.mkdirSync(TEMP_DIR, { recursive: true })
  fs.mkdirSync(extractDir, { recursive: true })
  fs.mkdirSync(targetDir, { recursive: true })

  await downloadFile(PBS_WIN_URL, tarFile)
  console.log("Extracting Windows Python...")
  await execPromise(`tar -xzf "${tarFile}" -C "${extractDir}"`)

  // The tarball contains a single top-level directory (usually "python/")
  const entries = fs.readdirSync(extractDir)
  if (entries.length === 0) throw new Error("Windows Python tarball extracted nothing")
  const innerDir = path.join(extractDir, entries[0])

  console.log(`Copying Windows Python to ./${targetDir}`)
  copyDirContents(innerDir, targetDir)

  console.log("Cleaning up...")
  rimraf(TEMP_DIR).catch(() => {})
  console.log(`Done! Windows Python ${PBS_PY_VER} has been installed to ./${targetDir}`)
}

async function main() {
  const targetDir = path.join("bin", "python", PLATFORM)

  // Check if Python binary already exists
  const pythonBinary = PLATFORM.startsWith("win")
    ? path.join(targetDir, "python.exe")
    : path.join(targetDir, "bin", "python3")

  if (fs.existsSync(pythonBinary)) {
    console.log(`Python v${PYTHON_VERSION} already exists in ./${targetDir}`)
    return
  }

  // Cross-platform case: building Windows target on Linux — uv would install
  // Linux Python, so we download the Windows standalone build directly instead.
  if (PLATFORM === "win-x64" && process.platform === "linux") {
    try {
      await downloadWindowsPython(targetDir)
    } catch (error) {
      console.error("Error downloading Windows Python:", error)
      rimraf(TEMP_DIR).catch(() => {})
      process.exit(1)
    }
    return
  }

  // Native / same-arch case: use uv to install Python for the current or target platform.
  fs.mkdirSync(TEMP_DIR, { recursive: true })
  fs.mkdirSync(targetDir, { recursive: true })

  try {
    console.log(`Installing Python v${PYTHON_VERSION} using UV...`)

    const env = {
      ...process.env,
      UV_PYTHON_INSTALL_DIR: path.resolve(TEMP_DIR),
    }

    let command: string
    let args: string[]

    if (PLATFORM === "darwin-x64" && process.arch === "arm64" && process.platform === "darwin") {
      command = "arch"
      const uvPath = path.join(__dirname, "../bin/uv/darwin-x64/uv")
      args = ["-x86_64", uvPath, "python", "install", PYTHON_VERSION]
    } else if (PLATFORM === "darwin-arm64" && process.arch === "x64" && process.platform === "darwin") {
      command = "arch"
      const uvPath = path.join(__dirname, "../bin/uv/darwin-arm64/uv")
      args = ["-arm64", uvPath, "python", "install", PYTHON_VERSION]
    } else {
      command = "uv"
      args = ["python", "install", PYTHON_VERSION]
    }

    const { stdout, stderr } = await execPromise(`${command} ${args.join(" ")}`, { env })
    if (stderr) console.error("UV stderr:", stderr)
    if (stdout) console.log(stdout)

    // Find the directory uv created (starts with "cpython")
    const cpythonDir = fs.readdirSync(TEMP_DIR).find(dir => dir.startsWith("cpython"))
    if (!cpythonDir) throw new Error("Could not find installed Python directory in tmp folder")

    const cpythonPath = path.join(TEMP_DIR, cpythonDir)
    console.log(`Copying entire Python directory to ./${targetDir}`)
    copyDirContents(cpythonPath, targetDir)

    // Ensure the python3 binary is executable on Unix
    if (!PLATFORM.startsWith("win") && fs.existsSync(path.join(targetDir, "bin", "python3"))) {
      fs.chmodSync(path.join(targetDir, "bin", "python3"), 0o755)
    }

    console.log("Cleaning up...")
    rimraf(TEMP_DIR).catch(() => {})
    console.log(`Done! Python v${PYTHON_VERSION} has been installed to ./${targetDir}`)
  } catch (error) {
    console.error("Error:", error)
    rimraf(TEMP_DIR).catch(() => {})
    process.exit(1)
  }
}

main()
