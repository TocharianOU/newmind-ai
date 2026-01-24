import { useEffect, useRef } from "react"

export function useClickOutside(callback: (event?: MouseEvent) => void) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        callback(event)
      }
    }

    window.addEventListener("pointerdown", handleClickOutside, true)
    return () => {
      window.removeEventListener("pointerdown", handleClickOutside, true)
    }
  }, [callback])

  return ref
}