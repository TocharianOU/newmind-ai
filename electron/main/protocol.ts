import { net, protocol, app } from "electron"
import path from "node:path"
import os from "node:os"

protocol.registerSchemesAsPrivileged([
  {
    scheme: "local-file",
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true,
    }
  }
])

protocol.registerSchemesAsPrivileged([
  {
    scheme: "img",
    privileges: {
      secure: true,
      supportFetchAPI: true,
      bypassCSP: true,
      stream: true,
    }
  }
])

/** Directories that local-file:// is allowed to serve from. */
const LOCAL_FILE_ALLOWED_ROOTS = () => [
  path.join(os.homedir(), ".newmind"),
  app.getPath("temp"),
  app.getPath("userData"),
]

function isPathInsideRoot(filePath: string, roots: string[]): boolean {
  const resolved = path.resolve(filePath)
  return roots.some(root => {
    const resolvedRoot = path.resolve(root)
    return resolved === resolvedRoot || resolved.startsWith(resolvedRoot + path.sep)
  })
}

export function initProtocol() {
  protocol.handle("local-file", (req) => {
    // Extract the file path from the custom URL
    const rawPath = decodeURIComponent(
      req.url.replace(/^local-file:\/\/\/?/, "")
    )

    // On Windows the path starts with the drive letter (C:/...); on other
    // platforms it is an absolute path starting with /.
    const filePath = process.platform === "win32" ? rawPath : `/${rawPath}`
    const resolved = path.resolve(filePath)

    if (!isPathInsideRoot(resolved, LOCAL_FILE_ALLOWED_ROOTS())) {
      console.warn(`[protocol] local-file blocked: ${resolved}`)
      return new Response("Forbidden", { status: 403 })
    }

    const fileUrl = process.platform === "win32"
      ? `file:///${resolved.replace(/\\/g, "/")}`
      : `file://${resolved}`
    return net.fetch(fileUrl)
  })

  protocol.handle("img", (req) => {
    const rawUrl = req.url.replace(/^img:\/\//, "")
    const publicDir = path.resolve(process.env.VITE_PUBLIC ?? "")
    const imageDir = path.join(publicDir, "image")

    // Prevent path traversal: resolve against imageDir and verify it stays inside
    const assetPath = path.resolve(imageDir, rawUrl)
    if (!assetPath.startsWith(imageDir + path.sep) && assetPath !== imageDir) {
      console.warn(`[protocol] img:// blocked: ${assetPath}`)
      return new Response("Forbidden", { status: 403 })
    }

    const fileUrl = process.platform === "win32"
      ? `file:///${assetPath.replace(/\\/g, "/")}`
      : `file://${assetPath}`
    return net.fetch(fileUrl)
  })
}