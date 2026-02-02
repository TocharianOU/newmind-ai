import { ipcMain, IpcMainInvokeEvent } from "electron"

const registeredHandlers = new Set<string>()

/**
 * Safely register an IPC handler, automatically removing any existing handler first
 * to prevent "Attempted to register a second handler" errors during hot reload
 */
export function safeRegisterHandler<T = any>(
  channel: string,
  handler: (event: IpcMainInvokeEvent, ...args: any[]) => Promise<T> | T
): void {
  // Remove existing handler if it exists
  if (registeredHandlers.has(channel)) {
    ipcMain.removeHandler(channel)
  }
  
  // Register the new handler
  ipcMain.handle(channel, handler)
  
  // Track that this channel is now registered
  registeredHandlers.add(channel)
}

/**
 * Remove a specific IPC handler
 */
export function removeHandler(channel: string): void {
  if (registeredHandlers.has(channel)) {
    ipcMain.removeHandler(channel)
    registeredHandlers.delete(channel)
  }
}

/**
 * Remove all registered handlers (useful for cleanup)
 */
export function removeAllHandlers(): void {
  registeredHandlers.forEach(channel => {
    ipcMain.removeHandler(channel)
  })
  registeredHandlers.clear()
}

/**
 * Get list of all registered handler channels (for debugging)
 */
export function getRegisteredHandlers(): string[] {
  return Array.from(registeredHandlers)
}
