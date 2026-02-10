/**
 * Keychain/Credential Storage IPC Handlers
 * Uses Electron's safeStorage API which automatically uses:
 * - macOS: Keychain
 * - Windows: DPAPI
 * - Linux: libsecret/Secret Service API
 */

import { ipcMain, safeStorage } from "electron"
import fse from "fs-extra"
import * as path from "path"
import { app } from "electron"

// Storage for keychain entries (encrypted values are stored here)
const KEYCHAIN_DIR = path.join(app.getPath("userData"), ".keychain")
const KEYCHAIN_INDEX_FILE = path.join(KEYCHAIN_DIR, "index.json")

interface KeychainIndex {
  [keyName: string]: {
    service: string
    account: string
    encryptedFile: string
    createdAt: string
    updatedAt: string
  }
}

/**
 * Ensure keychain directory exists
 */
async function ensureKeychainDir(): Promise<void> {
  await fse.ensureDir(KEYCHAIN_DIR)
}

/**
 * Load keychain index
 */
async function loadIndex(): Promise<KeychainIndex> {
  try {
    if (await fse.pathExists(KEYCHAIN_INDEX_FILE)) {
      return await fse.readJson(KEYCHAIN_INDEX_FILE)
    }
  } catch (error) {
    console.error("[Keychain] Failed to load index:", error)
  }
  return {}
}

/**
 * Save keychain index
 */
async function saveIndex(index: KeychainIndex): Promise<void> {
  await fse.writeJson(KEYCHAIN_INDEX_FILE, index, { spaces: 2 })
}

/**
 * Set a password in keychain
 */
export async function setPassword(
  service: string,
  account: string,
  password: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureKeychainDir()

    if (!safeStorage.isEncryptionAvailable()) {
      return {
        success: false,
        error: "Encryption not available on this system"
      }
    }

    // Encrypt the password
    const encrypted = safeStorage.encryptString(password)

    // Generate file name for encrypted data
    const keyName = `${service}:${account}`
    const fileName = `${Buffer.from(keyName).toString("base64")}.enc`
    const filePath = path.join(KEYCHAIN_DIR, fileName)

    // Save encrypted data to file
    await fse.writeFile(filePath, encrypted)

    // Update index
    const index = await loadIndex()
    index[keyName] = {
      service,
      account,
      encryptedFile: fileName,
      createdAt: index[keyName]?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    await saveIndex(index)

    console.log(`[Keychain] Stored credential: ${service}:${account}`)
    return { success: true }
  } catch (error) {
    console.error("[Keychain] Failed to set password:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

/**
 * Get a password from keychain
 */
export async function getPassword(
  service: string,
  account: string
): Promise<{ success: boolean; password?: string; error?: string }> {
  try {
    await ensureKeychainDir()

    const keyName = `${service}:${account}`
    const index = await loadIndex()
    const entry = index[keyName]

    if (!entry) {
      return {
        success: false,
        error: "Credential not found"
      }
    }

    const filePath = path.join(KEYCHAIN_DIR, entry.encryptedFile)

    if (!(await fse.pathExists(filePath))) {
      return {
        success: false,
        error: "Encrypted file not found"
      }
    }

    // Read and decrypt
    const encrypted = await fse.readFile(filePath)
    const password = safeStorage.decryptString(encrypted)

    console.log(`[Keychain] Retrieved credential: ${service}:${account}`)
    return { success: true, password }
  } catch (error) {
    console.error("[Keychain] Failed to get password:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

/**
 * Delete a password from keychain
 */
export async function deletePassword(
  service: string,
  account: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await ensureKeychainDir()

    const keyName = `${service}:${account}`
    const index = await loadIndex()
    const entry = index[keyName]

    if (!entry) {
      return {
        success: false,
        error: "Credential not found"
      }
    }

    // Delete encrypted file
    const filePath = path.join(KEYCHAIN_DIR, entry.encryptedFile)
    if (await fse.pathExists(filePath)) {
      await fse.remove(filePath)
    }

    // Remove from index
    delete index[keyName]
    await saveIndex(index)

    console.log(`[Keychain] Deleted credential: ${service}:${account}`)
    return { success: true }
  } catch (error) {
    console.error("[Keychain] Failed to delete password:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

/**
 * List all stored credentials (without passwords)
 */
export async function listCredentials(): Promise<{
  success: boolean
  credentials?: Array<{ service: string; account: string; createdAt: string; updatedAt: string }>
  error?: string
}> {
  try {
    await ensureKeychainDir()
    const index = await loadIndex()

    const credentials = Object.values(index).map(entry => ({
      service: entry.service,
      account: entry.account,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt
    }))

    return { success: true, credentials }
  } catch (error) {
    console.error("[Keychain] Failed to list credentials:", error)
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error"
    }
  }
}

/**
 * Check if encryption is available
 */
export function isEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable()
}

/**
 * Register IPC handlers
 */
export function registerKeychainHandlers(): void {
  ipcMain.handle("keychain:setPassword", async (_, service: string, account: string, password: string) => {
    return setPassword(service, account, password)
  })

  ipcMain.handle("keychain:getPassword", async (_, service: string, account: string) => {
    return getPassword(service, account)
  })

  ipcMain.handle("keychain:deletePassword", async (_, service: string, account: string) => {
    return deletePassword(service, account)
  })

  ipcMain.handle("keychain:list", async () => {
    return listCredentials()
  })

  ipcMain.handle("keychain:isAvailable", async () => {
    return { success: true, available: isEncryptionAvailable() }
  })

  console.log("[Keychain] IPC handlers registered")
}
