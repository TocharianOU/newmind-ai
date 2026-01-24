import React from "react"
import { useClickOutside } from "../hooks/useClickOutside"

export const ClickOutside = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { onClickOutside?: (event?: MouseEvent) => void }>(
  ({ onClickOutside, ...props }, ref) => {
    const clickOutsideRef = useClickOutside(onClickOutside || (() => {}))

    return <div {...props} ref={clickOutsideRef} />
  }
)