import { atom } from "jotai"

export type DrawerType = {
  id: string
  page: "Settings" | "IntegrationMarket" | "ToolEdit" | "ModelEdit" | "ParameterSettings" | "Tools"
  tab?: string
  props?: Record<string, any>
}

export const drawerStackAtom = atom<DrawerType[]>([])

export const openDrawerAtom = atom(
  null,
  (get, set, drawer: DrawerType) => {
    const currentDrawers = get(drawerStackAtom)
    // Only allow one drawer at a time, replace if exists
    const filteredDrawers = currentDrawers.filter(d => d.id !== drawer.id)
    set(drawerStackAtom, [...filteredDrawers, drawer])
  }
)

export const closeDrawerAtom = atom(
  null,
  (get, set, drawerId?: string) => {
    if (drawerId) {
      const currentDrawers = get(drawerStackAtom)
      set(drawerStackAtom, currentDrawers.filter(d => d.id !== drawerId))
    } else {
      // Close the top drawer
      const currentDrawers = get(drawerStackAtom)
      currentDrawers.pop()
      set(drawerStackAtom, [...currentDrawers])
    }
  }
)

export const closeAllDrawersAtom = atom(
  null,
  (_get, set) => {
    set(drawerStackAtom, [])
  }
)

// Helper to get the active drawer (top of stack)
export const activeDrawerAtom = atom(
  (get) => {
    const stack = get(drawerStackAtom)
    return stack[stack.length - 1] || null
  }
)
