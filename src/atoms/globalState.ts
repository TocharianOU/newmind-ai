import { atom } from "jotai"
import { Tab } from "../views/Drawer/Settings"

export const commonFlashAtom = atom<string | null>(null)

export const settingTabAtom = atom<Tab>("Projects")
