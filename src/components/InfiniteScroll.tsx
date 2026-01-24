import { useEffect, useState } from "react"
import { useInView } from "react-intersection-observer"
import "@/styles/components/_InfiniteScroll.scss"

type Props = {
  children: React.ReactNode,
  onNext: () => void
  hasMore: boolean
  loader?: React.ReactNode
  loaderText?: string
}

/** Infinite scroll loading */
const InfiniteScroll = ({
  children,
  onNext,
  hasMore,
  loader,
  loaderText,
}: Props) => {
  const { ref: watcherRef, inView } = useInView()

  useEffect(() => {
    if (inView && hasMore) {
      onNext()
    }
  }, [inView, hasMore])

  return (
    <>
      {children}

      { hasMore && (
        <div ref={watcherRef} className="watcher-container">
          {loader ?
            loader
            :
            <div className="default-loader">
              <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 0 22 22" preserveAspectRatio="xMidYMid">
                <circle cx="11" cy="11" r="9" stroke="#ECEFF4" strokeWidth="2" strokeLinecap="round" fill="none"></circle>
                <circle cx="11" cy="11" r="9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none">
                  <animateTransform attributeName="transform" type="rotate" repeatCount="indefinite" dur="1.5s" values="0 11 11;180 11 11;720 11 11" keyTimes="0;0.5;1"></animateTransform>
                  <animate attributeName="stroke-dasharray" repeatCount="indefinite" dur="1.5s" values="1 100; 50 50; 1 100" keyTimes="0;0.5;1"></animate>
                </circle>
              </svg>
              {loaderText && <span>{loaderText}</span>}
            </div>
          }
        </div>
      )}
    </>
  )
}

export default InfiniteScroll
