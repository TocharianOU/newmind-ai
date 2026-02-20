import React from "react"
import * as Portal from "@radix-ui/react-portal"
import { DismissableLayer } from "@radix-ui/react-dismissable-layer"
import { useAtom } from "jotai"
import { sidebarVisibleAtom } from "../atoms/sidebarState"
import WindowControls from "./WindowControls"

export type PopupStylePorps = {
  zIndex?: number
  noBackground?: boolean
}

type PopupWindowProps = PopupStylePorps & {
  children: React.ReactNode
  overlay?: boolean
  onClickOutside?: () => void
  onFinish?: () => void
}

export default function PopupWindow({
  children,
  zIndex = 100,
  onClickOutside = () => {},
  overlay = false,
  noBackground = false,
  onFinish = () => {},
}: PopupWindowProps) {
  const [isSidebarVisible] = useAtom(sidebarVisibleAtom)
  const root = document.body

  return (
    <Portal.Root container={root}>
      <div className={`container-wrapper ${noBackground ? "transparent" : ""} ${overlay ? "popup-overlay" : ""} ${!isSidebarVisible ? "full-width" : ""}`} style={{ zIndex }}>
        {overlay && (
          <div className="overlay-window-controls">
            <WindowControls variant="header" />
          </div>
        )}
        <DismissableLayer onPointerDownOutside={onClickOutside}>
          {children}
        </DismissableLayer>
      </div>
    </Portal.Root>
  )
}
