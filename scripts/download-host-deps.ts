import spawn from "cross-spawn"
import path from "node:path"
import os from "node:os"

const platform = os.platform()
const arch = os.arch()

let uvPath = "uv"
if (platform === "win32") {
  uvPath = path.join(__dirname, "..", "bin", "uv", "win-x64", "uv.exe")
} else if (platform === "darwin") {
  if (arch === "arm64") {
    uvPath = path.join(__dirname, "..", "bin", "uv", "darwin-arm64", "uv")
  } else {
    uvPath = path.join(__dirname, "..", "bin", "uv", "darwin-x64", "uv")
  }
} else if (platform === "linux") {
  uvPath = path.join(__dirname, "..", "bin", "uv", "linux-x64", "uv")
}

spawn(uvPath, ["sync", "--frozen"], { stdio: "inherit", cwd: path.join(__dirname, "..", "mcp-host") })
