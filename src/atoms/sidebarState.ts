import { atom } from "jotai"

// 默认在桌面端显示侧边栏
export const sidebarVisibleAtom = atom(typeof window !== 'undefined' && window.innerWidth >= 960)
const originalSidebarWidthAtom = atom(typeof window !== 'undefined' && window.innerWidth >= 960)

export const toggleSidebarAtom = atom(
  null,
  (get, set) => {
    const newState = !get(sidebarVisibleAtom)
    set(sidebarVisibleAtom, newState)
    set(originalSidebarWidthAtom, newState)
  }
)

export const closeAllSidebarsAtom = atom(
  null,
  (get, set) => {
    set(sidebarVisibleAtom, false)
    set(originalSidebarWidthAtom, false)
  }
)

export const handleWindowResizeAtom = atom(
  null,
  (get, set) => {
    if (window.innerWidth < 960) {
      set(sidebarVisibleAtom, false)
    } else if (window.innerWidth >= 960 && get(originalSidebarWidthAtom)) {
      set(sidebarVisibleAtom, true)
    }
  }
)