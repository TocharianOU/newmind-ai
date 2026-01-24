import "../styles/pages/_InstallHostDependencies.scss"

import React, { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { systemThemeAtom, themeAtom } from "../atoms/themeState"
import { useAtom } from "jotai"
import { onReceiveDownloadDependencyLog, startReceiveDownloadDependencyLog } from "../ipc"

type Log = {
  timestamp: string
  message: string
}

type Props = {
  onFinish: () => void
  onUpdate: (log: string) => void
}

const InstallHostDependencies = ({ onFinish, onUpdate }: Props) => {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<Log[]>([])
  const [theme] = useAtom(themeAtom)
  const [systemTheme] = useAtom(systemThemeAtom)
  const logsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const unlisten = onReceiveDownloadDependencyLog((log) => {
      if (log === "finish") {
        setLogs(prevLogs => {
          return [
            ...prevLogs,
            {
              timestamp: new Date().toLocaleString(),
              message: "install host dependencies finished, wait for mcp host to start...",
            },
          ]
        })

        return onFinish()
      }

      onUpdate(log)
      setLogs(prevLogs => {
        const newLogs = [...prevLogs, { timestamp: new Date().toLocaleString(), message: log }]
        if (newLogs.length > 100) {
          return newLogs.slice(newLogs.length - 100)
        }
        return newLogs
      })

        setTimeout(() => {
          if (logsRef.current) {
            logsRef.current.scrollTop = logsRef.current.scrollHeight
          }
        }, 100)
    })

    startReceiveDownloadDependencyLog()
    return () => {
      unlisten.then(fn => fn())
    }
  }, [])

  return (
    <div className="downloading-container" data-theme={theme === "system" ? systemTheme : theme}>
      <div className="downloading-content">
        <h1 className="downloading-title">
          <div className="spinner">
            <svg xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink" viewBox="0 0 22 22" preserveAspectRatio="xMidYMid">
              <circle cx="11" cy="11" r="9" stroke="#ECEFF4" strokeWidth="2" strokeLinecap="round" fill="none"></circle>
              <circle cx="11" cy="11" r="9" stroke="#02c3c3" strokeWidth="2" strokeLinecap="round" fill="none">
                <animateTransform attributeName="transform" type="rotate" repeatCount="indefinite" dur="1.5s" values="0 11 11;180 11 11;720 11 11" keyTimes="0;0.5;1"></animateTransform>
                <animate attributeName="stroke-dasharray" repeatCount="indefinite" dur="1.5s" values="1 100; 50 50; 1 100" keyTimes="0;0.5;1"></animate>
              </circle>
            </svg>
          </div>
          {t("InstallHostDependencies.title")}
        </h1>

        <div className="downloading-log" ref={logsRef}>
          {logs.map((log) => (
            <div key={log.timestamp} className="downloading-log-item">
              <span className="downloading-log-item-timestamp">
                [<span className="downloading-log-item-timestamp-time">{log.timestamp}</span>]
              </span>
              <span className="downloading-log-item-message">
                {log.message}
              </span>
            </div>
          ))}
        </div>

        <div className="button-container">
          {t("InstallHostDependencies.tip")}
        </div>
      </div>
    </div>
  )
}

export default React.memo(InstallHostDependencies)
