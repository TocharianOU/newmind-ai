import dotenv from "dotenv"
import { notarize } from "@electron/notarize"

dotenv.config()

export default async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context
  
  // Skip notarization if explicitly requested or if code signing is skipped
  if (process.env.SKIP_NOTARIZATION === "true" || process.env.CSC_IDENTITY_AUTO_DISCOVERY === "false") {
    console.log("Skipping notarization (development build)")
    return
  }
  
  if (electronPlatformName !== "darwin") {
    return
  }

  const appName = context.packager.appInfo.productFilename

  // Only attempt notarization if Apple credentials are provided
  if (!process.env.APPLEID || !process.env.APPLEIDPASS || !process.env.APPLETEAMID) {
    console.warn("Skipping notarization: Apple ID, password, or team ID not provided.")
    return
  }

  return await notarize({
    tool: "notarytool",
    teamId: process.env.APPLETEAMID,
    appBundleId: "ai.oaphub.dive",
    appPath: `${appOutDir}/${appName}.app`,
    appleId: process.env.APPLEID,
    appleIdPassword: process.env.APPLEIDPASS,
  })
}