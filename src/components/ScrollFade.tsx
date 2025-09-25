import React, { useEffect, useRef } from "react"
import "@/styles/components/_ScrollFade.scss"

const ScrollFade = ({
  children,
  className,
  color = "var(--bg)"
}: { children: any, className?: string, color?: string }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const fadeLeft = useRef<HTMLDivElement>(null)
  const fadeRight = useRef<HTMLDivElement>(null)

  const checkScrollPosition = () => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const scrollLeft = container.scrollLeft
    const scrollWidth = container.scrollWidth
    const clientWidth = container.clientWidth
    const maxScrollLeft = scrollWidth - clientWidth

    // Check if at the beginning
    if (fadeLeft.current && (scrollLeft <= 10 || scrollWidth <= clientWidth)) {
      fadeLeft.current.style.opacity = "0"
    } else if (fadeLeft.current) {
      fadeLeft.current.style.opacity = "1"
    }

    // Check if at the end
    if (fadeRight.current && (scrollLeft >= maxScrollLeft - 10 || scrollWidth <= clientWidth)) {
      fadeRight.current.style.opacity = "0"
    } else if (fadeRight.current) {
      fadeRight.current.style.opacity = "1"
    }
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    checkScrollPosition()

    container.addEventListener("scroll", checkScrollPosition)
    return () => {
      container.removeEventListener("scroll", checkScrollPosition)
    }
  }, [])

  return (
    <div className="scroll-fade">
      <div className="fade-left" id="fadeLeft" ref={fadeLeft} style={{ opacity: 0, background: `linear-gradient(to right, ${color}, rgba(255, 255, 255, 0))` }}></div>
      <div ref={containerRef} className={className} style={{ overflowX: "auto" }}>
        {children}
      </div>
      <div className="fade-right" id="fadeRight" ref={fadeRight} style={{ opacity: 0, background: `linear-gradient(to left, ${color}, rgba(255, 255, 255, 0))` }}></div>
    </div>
  )
}

export default React.memo(ScrollFade)

