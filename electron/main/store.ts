import Store from "electron-store"

export const preferencesStore = new Store({
  name: "preferences",
  defaults: {
    autoLaunch: false,
    minimalToTray: false,
    syncEnabled: false,
    lastSyncAt: "",
  }
})

export const oapStore = new Store<{
  oap: { token: string }
  token: string
  encryptedToken: string
  encryptedRefreshToken: string
}>({
  name: "oap",
  defaults: {
    oap: { token: "" },
    token: "",
    encryptedToken: "",
    encryptedRefreshToken: "",
  }
})

export const hostCache = new Store({
  name: "host-cache",
  defaults: {
    lockHash: "",
  }
})