import { atom } from "jotai"
import { Tab } from "../views/Drawer/Settings"

export const newVersionAtom = atom<string | null>(null)

export const commonFlashAtom = atom<string | null>(null)

export const settingTabAtom = atom<Tab>("Tools")
