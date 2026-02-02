import { BrowserWindow, Menu } from "electron"
import { safeRegisterHandler } from "../utils/ipcRegistry"

const selectionMenu = Menu.buildFromTemplate([
  { role: "copy" },
  { role: "selectAll" }
])

const inputMenu = Menu.buildFromTemplate([
  { role: "copy" },
  { role: "paste" },
  { role: "cut" },
  { role: "selectAll" }
])

export function ipcMenuHandler(_win: BrowserWindow) {
  safeRegisterHandler("show-selection-context-menu", () => {
    selectionMenu.popup()
  })

  safeRegisterHandler("show-input-context-menu", () => {
    inputMenu.popup()
  })
}