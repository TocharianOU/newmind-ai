import { useState } from "react"
import { useAtomValue, useSetAtom } from "jotai"
import { currentProjectIdAtom, switchProjectAtom } from "@/atoms/projectState"
import { restartHost } from "@/ipc/host"

export function useProjectSwitch() {
  const currentProjectId = useAtomValue(currentProjectIdAtom)
  const switchProject = useSetAtom(switchProjectAtom)
  const [isRestarting, setIsRestarting] = useState(false)

  const switchToProject = async (projectId: string) => {
    if (projectId === currentProjectId) return

    setIsRestarting(true)

    try {
      // Step 1: Save new project ID to disk
      const result = await switchProject(projectId)
      if (!result.success) {
        console.error("[useProjectSwitch] Project switch failed")
        setIsRestarting(false)
        return
      }

      // Step 2: Restart Python host so it picks up the new project's MCP config
      const restartResult = await restartHost()
      if (!restartResult.success) {
        console.error("[useProjectSwitch] Host restart failed:", restartResult.error)
        alert(`Failed to restart MCP Host: ${restartResult.error}. Please restart the application manually.`)
        setIsRestarting(false)
        return
      }

      // Step 3: Full page reload to reset all UI state
      window.location.reload()
    } catch (error) {
      console.error("[useProjectSwitch] Error during project switch:", error)
      alert(`Failed to switch project: ${error instanceof Error ? error.message : "Unknown error"}`)
      setIsRestarting(false)
    }
  }

  return { switchToProject, isRestarting, currentProjectId }
}
