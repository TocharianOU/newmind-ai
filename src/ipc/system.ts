export async function getIPCAutoLaunch() {
  return false
}

export async function setIPCAutoLaunch(setting: boolean) {
  void setting
}

export async function getIPCMinimalToTray(): Promise<boolean> {
  return false
}

export async function setIPCMinimalToTray(setting: boolean) {
  void setting
}

export async function getSyncStatus(): Promise<{ enabled: boolean; lastSyncAt: string }> {
  return { enabled: false, lastSyncAt: "" }
}

export async function setSyncEnabled(enabled: boolean): Promise<void> {
  void enabled
}

export async function runSync(): Promise<{ success: boolean; pushed: number; pulled: number; error?: string }> {
  return { success: false, pushed: 0, pulled: 0, error: "Not supported" }
}