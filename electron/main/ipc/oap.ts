import { BrowserWindow, ipcMain, shell } from "electron"
import { getToken, oapClient } from "../oap"
import os from "node:os"
import { OAP_ROOT_URL } from "../../../shared/oap"
import { setOAPTokenToHost } from "../deeplink"

import type { OAPModelDescriptionParam, MCPServerSearchParam } from "../../../types/oap"

const LOGIN_URL = `${OAP_ROOT_URL}/signin`
const REGISTER_URL = `${OAP_ROOT_URL}/signup`

export function ipcOapHandler(_win: BrowserWindow) {
  ipcMain.handle("oap:login", async (_, regist: boolean) => {
    const url = `${regist ? REGISTER_URL : LOGIN_URL}?client=dive&name=${os.hostname()}&system=${process.platform}`
    shell.openExternal(url)
  })

  ipcMain.handle("oap:logout", async () => {
    oapClient.logout()
  })

  ipcMain.handle("oap:getToken", async () => {
    return await getToken()
  })

  ipcMain.handle("oap:searchMCPServer", async (_, params: MCPServerSearchParam) => {
    return await oapClient.searchMCPServer(params)
  })

  ipcMain.handle("oap:modelDescription", async (_, params?: OAPModelDescriptionParam) => {
    return await oapClient.modelDescription(params)
  })

  ipcMain.handle("oap:applyMCPServer", async (_, ids: string[]) => {
    return await oapClient.applyMCPServer(ids)
  })

  ipcMain.handle("oap:getMCPServers", async () => {
    return await oapClient.getMCPServers()
  })

  ipcMain.handle("oap:getMe", async () => {
    return await oapClient.getMe()
  })

  ipcMain.handle("oap:getUsage", async () => {
    return await oapClient.getUsage()
  })

  // New IPC handler for embedded login
  ipcMain.handle("oap:loginWithToken", async (_, token: string) => {
    console.log("Embedded login with token:", token.substring(0, 8) + "...")
    setOAPTokenToHost(token)
    return { success: true }
  })

  // OAuth Configuration - 获取可用的OAuth提供商
  ipcMain.handle("oap:getOAuthConfig", async () => {
    try {
      const response = await fetch(`${OAP_ROOT_URL}/api/auth/config`)
      const data = await response.json()
      console.log("OAuth config fetched:", data.data)
      return data
    } catch (error) {
      console.error("Failed to fetch OAuth config:", error)
      return {
        success: false,
        data: {
          oauthEnabled: false,
          brandText: "",
          providers: []
        },
        error: "Failed to fetch OAuth configuration"
      }
    }
  })

  // OAuth Login - 启动OAuth登录流程
  ipcMain.handle("oap:loginWithOAuth", async (_, provider: string) => {
    try {
      const url = `${OAP_ROOT_URL}/api/auth/${provider}?client=dive&platform=${process.platform}&hostname=${os.hostname()}`
      console.log(`Starting OAuth login with ${provider}:`, url)
      await shell.openExternal(url)
      return { success: true }
    } catch (error) {
      console.error(`Failed to start OAuth login with ${provider}:`, error)
      return { success: false, error: "Failed to open OAuth login" }
    }
  })
}
