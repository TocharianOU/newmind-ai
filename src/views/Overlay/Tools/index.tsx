// @ts-nocheck
import React, { useEffect, useState, useRef, useMemo, useCallback, memo } from "react"
import { useTranslation } from "react-i18next"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { showToastAtom } from "../../../atoms/toastState"
import Switch from "../../../components/Switch"
import { loadMcpConfigAtom, loadToolsAtom, MCPConfig, mcpConfigAtom, Tool, toolsAtom, installToolBufferAtom } from "../../../atoms/toolState"
import Tooltip from "../../../components/Tooltip"
import PopupConfirm from "../../../components/PopupConfirm"
import Dropdown from "../../../components/DropDown"
import { imgPrefix } from "../../../ipc"
import Tabs from "../../../components/Tabs"
import { OAPMCPServer } from "../../../types/oap"
import { isLoggedInOAPAtom } from "../../../atoms/oapState"
import { currentProjectIdAtom } from "../../../atoms/projectState"
import { OAP_ROOT_URL } from "../../../../shared/oap"
import { openUrl, readLocalLogo } from "../../../ipc/util"
import cloneDeep from "lodash/cloneDeep"
import { ClickOutside } from "../../../components/ClickOutside"
import Button from "../../../components/Button"
import CustomEdit from "./Popup/CustomEdit"
import { openDrawerAtom } from "../../../atoms/drawerState"
import "../../../styles/overlay/_Tools.scss"

interface ToolsCache {
  [key: string]: {
    type: "oap" | "custom"
    oapId?: string
    plan?: string
    description: string
    icon?: string
    subTools: {
      name: string
      description: string
      enabled: boolean
    }[]
    disabled: boolean
  }
}

const ToolLog = memo(({ toolLog }: { toolLog: string }) => {
  return (
    <div>
      {toolLog.split("\n").map((line: string, index: number) => (
        <div key={index}>{line}</div>
      ))}
    </div>
  )
})

export interface mcpServersProps {
  enabled?: boolean
  command?: string
  args?: string[]
  env?: [string, unknown, boolean][]
  url?: string
  transport?: string
  initialTimeout?: number
  version?: string
  configSchema?: Record<string, any>
}

const Tools = () => {
  const { t } = useTranslation()
  const [tools, setTools] = useAtom(toolsAtom)
  const [mcpConfig, setMcpConfig] = useAtom(mcpConfigAtom)
  const [isLoading, setIsLoading] = useState(false)
  const showToast = useSetAtom(showToastAtom)
  const toolsCacheRef = useRef<ToolsCache>({})
  const loadTools = useSetAtom(loadToolsAtom)
  const [showDeletePopup, setShowDeletePopup] = useState(false)
  const [showCustomEditPopup, setShowCustomEditPopup] = useState(false)
  const openDrawer = useSetAtom(openDrawerAtom)
  const [showUnsavedSubtoolsPopup, setShowUnsavedSubtoolsPopup] = useState(false)
  const [changingTool, setChangingTool] = useState<string>("")
  const [currentTool, setCurrentTool] = useState<string>("")
  const abortControllerRef = useRef<AbortController | null>(null)
  const [toolLog, setToolLog] = useState<LogType[]>([])
  const [toolType, setToolType] = useState<"all" | "oap" | "custom">("all")
  const isLoggedInOAP = useAtomValue(isLoggedInOAPAtom)
  const currentProjectId = useAtomValue(currentProjectIdAtom)
  const loadMcpConfig = useSetAtom(loadMcpConfigAtom)
  const [isResort, setIsResort] = useState(true)
  const sortedConfigOrderRef = useRef<string[]>([])
  const [expandedSections, setExpandedSections] = useState<string[]>([])
  const [installToolBuffer, setInstallToolBuffer] = useAtom(installToolBufferAtom)
  const [localLogos, setLocalLogos] = useState<Record<string, string>>({})
  const getMcpConfig = () => new Promise((resolve) => {
    setMcpConfig(prevConfig => {
      resolve(prevConfig)
      return prevConfig
    })
  })

  // consume install tool buffer
  useEffect(() => {
    if (!installToolBuffer.length) {
      return
    }

    const cfg = cloneDeep(mcpConfig.mcpServers)
    const install = ({ name, config }: { name: string, config: Record<string, MCP> }) => {
      if (name in cfg) {
        cfg[name] = {
          ...mcpConfig.mcpServers[name],
          enabled: true,
        }

        return
      }

      cfg[name] = {
        ...config,
        enabled: true,
      }
    }

    installToolBuffer.forEach(install)
    setInstallToolBuffer([])
    handleCustomSubmit({ mcpServers: cfg })
  }, [installToolBuffer.length])

  useEffect(() => {
    (async () => {
      console.log(`[Tools] Cache reload triggered for project: ${currentProjectId}`)
      const cacheKey = `toolsCache_${currentProjectId}`
      // Check if we should clear cache (useful after OAP integration)
      const shouldClearCache = sessionStorage.getItem("clearToolsCache")
      if (shouldClearCache === "true") {
        localStorage.removeItem(cacheKey)
        sessionStorage.removeItem("clearToolsCache")
        toolsCacheRef.current = {}
      } else {
        const cachedTools = localStorage.getItem(cacheKey)
        if (cachedTools) {
          console.log(`[Tools] Loaded cache for project ${currentProjectId}:`, Object.keys(JSON.parse(cachedTools)))
          toolsCacheRef.current = JSON.parse(cachedTools)
        } else {
          console.log(`[Tools] No cache found for project ${currentProjectId}`)
          toolsCacheRef.current = {}
        }
      }

      await updateToolsCache()
    })()

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }, [currentProjectId, showCustomEditPopup])

  // Listen for project-switched event (alternative to page reload)
  useEffect(() => {
    const handleProjectSwitch = (event: CustomEvent) => {
      const newProjectId = event.detail?.projectId
      console.log(`[Tools] Project switched event received: ${newProjectId}`)
      
      // Clear old cache reference to force reload
      toolsCacheRef.current = {}
      
      // Reload tools and config for new project
      loadMcpConfig()
      loadTools()
    }

    window.addEventListener('project-switched', handleProjectSwitch as EventListener)
    
    return () => {
      window.removeEventListener('project-switched', handleProjectSwitch as EventListener)
    }
  }, [loadMcpConfig, loadTools])

  const isOapTool = (toolName: string) => {
    // Check by extraData.oap metadata, not by name matching
    // This allows users to rename instances without losing OAP features
    const mcpServer = mcpConfig.mcpServers?.[toolName]
    return !!mcpServer?.extraData?.oap
  }

  const getOapData = (toolName: string) => {
    const mcpServer = mcpConfig.mcpServers?.[toolName]
    return mcpServer?.extraData?.oap || null
  }

  const updateToolsCache = async (skipLoadTools = false) => {
    if (!skipLoadTools) {
      await loadTools()
    }
    const _mcpConfig = await getMcpConfig()

    const newCache: ToolsCache = {}
    setTools(prevTools => {
      prevTools.forEach((tool: Tool) => {
        // Check if tool is OAP by extraData, not by name matching
        const mcpServer = _mcpConfig.mcpServers?.[tool.name]
        const isOap = !!mcpServer?.extraData?.oap
        const oapData = mcpServer?.extraData?.oap
        
        newCache[tool.name] = {
          type: isOap ? "oap" : "custom",
          plan: isOap ? oapData?.planTag : undefined,
          description: tool.description || "",
          icon: tool.icon,
          subTools: tool.tools?.map(subTool => ({
            name: subTool.name,
            description: subTool.description || "",
            enabled: subTool.enabled
          })) || [],
          disabled: tool.error ? true : false
        }
      })

      // Replace cache entirely instead of merging to prevent stale entries
      toolsCacheRef.current = newCache
      localStorage.setItem(`toolsCache_${currentProjectId}`, JSON.stringify(toolsCacheRef.current))
      return prevTools
    })
  }

  const updateMCPConfig = async (newConfig: Record<string, any> | string, force = false) => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    // Save all keychain passwords before updating config
    try {
      const { saveAllKeychainPasswords } = await import('./Popup/SchemaForm')
      const keychainResult = await saveAllKeychainPasswords()
      
      if (!keychainResult.success) {
        showToast({
          message: `保存密码失败: ${keychainResult.errors.join(", ")}`,
          type: "error"
        })
        return { success: false, error: "Failed to save keychain passwords" }
      }
    } catch (error) {
      console.error('[Keychain] Failed to save keychain passwords:', error)
      // Continue anyway - passwords might not be required
    }

    abortControllerRef.current = new AbortController()
    const config = typeof newConfig === "string" ? JSON.parse(newConfig) : newConfig
    Object.keys(config.mcpServers).forEach(key => {
      const cfg = config.mcpServers[key]
      if (!cfg.transport) {
        config.mcpServers[key].transport = cfg.url ? "sse" : "stdio"
      }

      if (!config.mcpServers[key].url) {
        config.mcpServers[key].url = null
      }

      if (!config.mcpServers[key].env) {
        config.mcpServers[key].env = {}
      }

      if (!config.mcpServers[key].command) {
        config.mcpServers[key].command = null
      }

      if (!config.mcpServers[key].args) {
        config.mcpServers[key].args = []
      }

      if (!("enabled" in config.mcpServers[key])) {
        config.mcpServers[key].enabled = true
      }

      if (!("exclude_tools" in config.mcpServers[key])) {
        config.mcpServers[key].exclude_tools = []
      }
    })

    return await fetch(`/api/config/mcpserver${force ? "?force=1" : ""}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
      signal: abortControllerRef.current.signal
    })
      .then(async (response) => await response.json())
      .catch((error) => {
        if (error.name === "AbortError") {
          abortControllerRef.current = null
          showToast({
            message: t("tools.configSaveAborted"),
            type: "error"
          })
          return {}
        } else {
          showToast({
            message: error instanceof Error ? error.message : t("tools.configFetchFailed"),
            type: "error"
          })
        }
      })
  }

  const handleUpdateConfigResponse = (data: { errors: { error: string; serverName: string }[] }, isShowToast = false) => {
    if (data.errors && data.errors.length && Array.isArray(data.errors)) {
      data.errors.forEach(({ error, serverName }: { error: string; serverName: string }) => {
        if(isShowToast) {
          showToast({
            message: t("tools.updateFailed", { serverName, error }),
            type: "error",
            closable: true
          })
        }
        setMcpConfig(prevConfig => {
          const newConfig = {...prevConfig}
          if((newConfig.mcpServers as Record<string, any>)[serverName]) {
            (newConfig.mcpServers as Record<string, any>)[serverName].disabled = true
          }
          return newConfig
        })
      })
    }
    if(data?.detail?.filter((item: any) => item.type.includes("error")).length > 0) {
      data?.detail?.filter((item: any) => item.type.includes("error"))
        .map((e: any) => [e.loc[2], e.msg])
        .forEach(([serverName, error]: [string, string]) => {
          if(isShowToast) {
            showToast({
              message: t("tools.updateFailed", { serverName, error }),
              type: "error",
              closable: true
            })
          }
        })
    }
    if(!data.errors?.some((error: any) => tools.find(tool => tool.name === error.serverName)) &&
        !data?.detail?.some((item: any) => item.type.includes("error"))) {
        showToast({
          message: t("tools.saveSuccess"),
          type: "success"
        })
    }
  }

  const handleCustomSubmit = async (newConfig: {mcpServers: MCPConfig} | null) => {
    // If config is null, it means we just need to refresh (e.g. OAP instance update)
    if (!newConfig) {
      setShowCustomEditPopup(false)
      await loadMcpConfig()
      await updateToolsCache()
      setIsResort(true)
      return
    }

    setIsLoading(true)
    try {
      // const filledConfig = await window.ipcRenderer.fillPathToConfig(JSON.stringify(newConfig))
      const filledConfig = { ...newConfig }

      filledConfig.mcpServers = {
        ...newConfig.mcpServers
      }

      const data = await updateMCPConfig(filledConfig)
      if (data?.errors && Array.isArray(data.errors) && data.errors.length) {
        data.errors
          .map((e: any) => e.serverName)
          .forEach((serverName: string) => {
            if(filledConfig.mcpServers[serverName]) {
              filledConfig.mcpServers[serverName].disabled = true
            }
          })

        // reset enable
        await updateMCPConfig(newConfig)
      }
      if(data?.detail?.filter((item: any) => item.type.includes("error")).length > 0) {
        data?.detail?.filter((item: any) => item.type.includes("error"))
          .map((e: any) => [e.loc[2], e.msg])
          .forEach(([serverName, error]: [string, string]) => {
            showToast({
              message: t("tools.updateFailed", { serverName, error }),
              type: "error",
              closable: true
            })
          })
      }
      if (data?.success) {
        setMcpConfig(filledConfig)
        setShowCustomEditPopup(false)
        await loadMcpConfig()
        await updateToolsCache()
        handleUpdateConfigResponse(data)
        setIsResort(true)
      }
    } catch (error) {
      console.error("Failed to update MCP config:", error)
      showToast({
        message: t("tools.saveFailed"),
        type: "error"
      })
      setShowCustomEditPopup(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteTool = async(toolName: string) => {
    setCurrentTool(toolName)
    setShowDeletePopup(true)
  }

  const deleteTool = async (toolName: string) => {
    setIsLoading(true)
    
    try {
      if (isOapTool(toolName)) {
        console.log(`[deleteTool] Starting deletion for OAP tool: ${toolName}`)
        
        // Delete OAP instance via new instance API
        const res = await fetch(`/api/plugins/oap-platform/instances/${toolName}`, {
          method: "DELETE",
          headers: {
            "X-Project-ID": currentProjectId
          }
        })
        
        if (!res.ok) {
          const errorText = await res.text()
          console.error(`[deleteTool] Delete failed with status ${res.status}: ${errorText}`)
          throw new Error(`Failed to delete instance: ${errorText}`)
        }
        
        const data = await res.json()
        console.log(`[deleteTool] Delete response:`, data)
        
        // Use the full_config from backend response if available (fast path)
        if (data.full_config) {
          console.log(`[deleteTool] Using full_config from backend response`)
          setMcpConfig(data.full_config)
        }
        
        // Clear cache for deleted tool
        const newCache = { ...toolsCacheRef.current }
        delete newCache[toolName]
        toolsCacheRef.current = newCache
        localStorage.setItem(`toolsCache_${currentProjectId}`, JSON.stringify(newCache))
        console.log(`[deleteTool] Cleared cache for ${toolName}`)
        
        // Wait a bit for backend to fully complete reload
        await new Promise(resolve => setTimeout(resolve, 1000))
        
        // Reload tools to get fresh state from backend
        console.log(`[deleteTool] Reloading tools...`)
        await loadTools()
        
        // Update cache after loading fresh data
        await updateToolsCache(true)
        console.log(`[deleteTool] Cache updated`)
        
        // Verify deletion
        const currentConfig = await getMcpConfig()
        if (currentConfig.mcpServers && currentConfig.mcpServers[toolName]) {
          console.error(`[deleteTool] VERIFICATION FAILED: ${toolName} still exists in frontend config!`)
          throw new Error("Deletion verification failed - tool still exists")
        }
        
        console.log(`[deleteTool] ✓ Deletion verified: ${toolName} no longer exists`)
        
        showToast({
          message: t("tools.instance.deleted") || "Instance deleted successfully",
          type: "success"
        })
      } else {
        // Delete custom MCP (old logic)
        console.log(`[deleteTool] Deleting custom MCP: ${toolName}`)
        const newConfig = JSON.parse(JSON.stringify(mcpConfig))
        delete newConfig.mcpServers[toolName]
        await updateMCPConfig(newConfig)
        setMcpConfig(newConfig)
        await loadTools()
        await updateToolsCache()
      }
      
      setIsResort(true)
    } catch (error) {
      console.error("[deleteTool] Error:", error)
      showToast({
        message: t("tools.deleteFailed") || "Failed to delete",
        type: "error"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const toggleTool = async (tool: Tool) => {
    try {
      setIsLoading(true)
      const currentEnabled = tool.enabled

      const newConfig = JSON.parse(JSON.stringify(mcpConfig))
      newConfig.mcpServers[tool.name].enabled = !currentEnabled
      if(newConfig.mcpServers[tool.name].enabled && tool.tools && tool.tools.every(subTool => !subTool.enabled)) {
        newConfig.mcpServers[tool.name].exclude_tools = []
      }

      const data = await updateMCPConfig(newConfig)
      if (data.errors && Array.isArray(data.errors) && data.errors.length) {
        data.errors
          .map((e: any) => e.serverName)
          .forEach((serverName: string) => {
            if(newConfig.mcpServers[serverName]) {
              newConfig.mcpServers[serverName].disabled = true
            }
          })

        // reset enable
        await updateMCPConfig(newConfig)
      }
      if(data?.detail?.filter((item: any) => item.type.includes("error")).length > 0) {
        data?.detail?.filter((item: any) => item.type.includes("error"))
          .map((e: any) => [e.loc[2], e.msg])
          .forEach(([serverName, error]: [string, string]) => {
            showToast({
              message: t("tools.updateFailed", { serverName, error }),
              type: "error",
              closable: true
            })
          })
      }

      if(data.errors?.filter((error: any) => error.serverName === tool.name).length === 0 &&
        data?.detail?.filter((item: any) => item.type.includes("error")).length === 0) {
        showToast({
          message: t("tools.saveSuccess"),
          type: "success"
        })
      }

      if (data.success) {
        setMcpConfig(newConfig)
        await updateToolsCache()
        handleUpdateConfigResponse(data, false)
      }
    } catch (error) {
      showToast({
        message: error instanceof Error ? error.message : t("tools.toggleFailed"),
        type: "error"
      })
    } finally {
      setIsLoading(false)
    }
  }

  const toggleToolSection = (name: string) => {
    setExpandedSections(prev =>
      prev.includes(name)
        ? prev.filter(n => n !== name)
        : [...prev, name]
    )
  }

  const handleUnsavedSubtools = (toolName: string, event?: MouseEvent) => {
    // check current changing tool is the same as the toolName
    if(changingTool !== "" && changingTool === toolName) {
      event?.preventDefault()
      setShowUnsavedSubtoolsPopup(true)
    }
    return
  }
  // SubTool start //
  const arrayEqual = (arr1: any[], arr2: any[]) => {
    if (arr1.length !== arr2.length)
      return false
    const sortedA = [...arr1].sort()
    const sortedB = [...arr2].sort()
    return sortedA.every((val, index) => val === sortedB[index])
  }

  const toggleSubTool = async (toolName: string, subToolName: string, action: "add" | "remove") => {
    const newTools = [...tools]
    const tool = newTools.find(tool => tool.name === toolName)
    const subToolIndex = tool?.tools?.findIndex(subTool => subTool.name === subToolName)

    if(tool?.enabled) {
      if(tool?.tools && subToolIndex > -1) {
        if(action === "add") {
          tool.tools[subToolIndex].enabled = false
        } else {
          tool.tools[subToolIndex].enabled = true
        }
      }

      if(tool?.tools && tool.tools.filter(subTool => subTool.enabled).length === 0) {
        tool.enabled = false
        //if closing all subtools, make tool disabled, check if tool is disabled originally
        //disabled Originally: it means it still in draft, recover all subtools state
        if(!mcpConfig.mcpServers[toolName].enabled) {
          tool.tools.map(subTool => {
            subTool.enabled = true
            if(mcpConfig.mcpServers[toolName].exclude_tools.includes(subTool.name)) {
              subTool.enabled = false
            }
          })
        }
      } else {
        tool.enabled = true
      }
    } else {
      tool.enabled = true
      if(tool?.tools) {
        tool.tools.map(subTool => {
          subTool.enabled = false
          if(subTool.name === subToolName) {
            subTool.enabled = true
          }
        })
      }
    }

    setTools(newTools)

    //Compare disabled tools of tools(temporary disabled tools) and mcpConfig.mcpServers[toolName].exclude_tools(actually disabled tools)
    const newDisabledSubTools = newTools.find(tool => tool.name === toolName)?.tools.filter(subTool => !subTool.enabled).map(subTool => subTool.name)
    if(!arrayEqual(newDisabledSubTools, mcpConfig.mcpServers[toolName].exclude_tools) ||
    tool?.enabled !== mcpConfig.mcpServers[toolName].enabled) {
      setChangingTool(toolName)
    } else {
      setChangingTool("")
    }
  }

  const toggleSubToolConfirm = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation()
    setShowUnsavedSubtoolsPopup(false)
    setChangingTool("")
    setIsLoading(true)
    const newConfig = JSON.parse(JSON.stringify(mcpConfig))
    Object.keys(newConfig.mcpServers).forEach(toolName => {
      const tool = tools.find(tool => tool.name === toolName)
      const newDisabledSubTools = tool?.tools.filter(subTool => !subTool.enabled).map(subTool => subTool.name)
      if(tool?.tools.length === newDisabledSubTools.length) {
        newConfig.mcpServers[toolName].enabled = false
      } else {
        newConfig.mcpServers[toolName].enabled = tool?.enabled
      }
      newConfig.mcpServers[toolName].exclude_tools = newDisabledSubTools
    })

    setMcpConfig(newConfig)
    await updateMCPConfig(newConfig)
    await loadTools()
    setIsLoading(false)
  }

  const toggleSubToolCancel = async () => {
    setShowUnsavedSubtoolsPopup(false)
    setChangingTool("")
    setIsLoading(true)
    await loadTools()
    setIsLoading(false)
  }
  // SubTool end //

  const handleReloadMCPServers = async (toolsNeedingConfig?: string[]) => {
    setIsLoading(true)
    
    // Clear tool cache to prevent duplicates
    localStorage.removeItem(`toolsCache_${currentProjectId}`)
    toolsCacheRef.current = {}
    
    try {
      await fetch("/api/plugins/oap-platform/config/refresh", {
        method: "POST",
      })
      
      // Reload everything fresh
      await loadMcpConfig()
      await updateMCPConfig(mcpConfig, true)
      await loadTools()
      await updateToolsCache()
      
      const mcpServers = (mcpConfig.mcpServers as Record<string, any>)
      const disabledTools = Object.keys(toolsCacheRef.current).filter(tool => toolsCacheRef.current[tool]?.disabled && mcpServers[tool]?.enabled)
      const newDisabledTools = Object.keys(toolsCacheRef.current).filter(tool => toolsCacheRef.current[tool]?.disabled && mcpServers[tool]?.enabled)
      const hasToolsEnabled = disabledTools.some(tool => !newDisabledTools.includes(tool))

      if (hasToolsEnabled) {
        showToast({
          message: t("tools.saveSuccess"),
          type: "success"
        })
      }

      if (newDisabledTools.length > 0) {
        if(newDisabledTools.length === 1) {
          showToast({
            message: t("tools.reloadFailed", { toolName: newDisabledTools[0] }),
            type: "error",
            closable: true
          })
        } else {
          showToast({
            message: t("tools.reloadAllFailed", { number: newDisabledTools.length }),
            type: "error",
            closable: true
          })
        }
      }
    } catch (error) {
      console.error("Error reloading MCP servers:", error)
      // Even if reload fails, we might still want to show the config popup if we know which tool was added
      showToast({
        message: "Some tools failed to start (likely missing config). Please configure them.",
        type: "warning",
      })
    } finally {
      setIsResort(true)
      setIsLoading(false)
      
      // CRITICAL: Always check if we need to configure tools, even if the refresh above failed.
      // The tool entry might exist in the file system even if the process crashed.
      if (toolsNeedingConfig && toolsNeedingConfig.length > 0) {
        // Ensure we have the latest config loaded if possible, or at least try to edit
        // We use a small timeout to let the UI settle
        setTimeout(() => {
          setCurrentTool(toolsNeedingConfig[0])
          setShowCustomEditPopup(true)
          
          showToast({
            message: t("tools.oap.config_needed") || `Please configure environment variables for ${toolsNeedingConfig[0]}`,
            type: "info",
            closable: true,
            duration: 10000 // Show longer
          })
        }, 500)
      }
    }
  }

  const sortedTools = useMemo(() => {
    // Remove duplicates from config order (case-insensitive deduplication)
    const configOrder = mcpConfig.mcpServers 
      ? Object.keys(mcpConfig.mcpServers) 
      : []
    
    // Group by lower case name to find duplicates, prioritizing OAP tools
    const uniqueNamesMap = new Map<string, string>();
    configOrder.forEach(name => {
      const lowerName = name.toLowerCase();
      if (!uniqueNamesMap.has(lowerName)) {
        uniqueNamesMap.set(lowerName, name);
      } else {
        // If collision, check if the current one is an OAP tool while the existing one isn't
        const existingName = uniqueNamesMap.get(lowerName)!;
        const currentIsOap = isOapTool(name);
        const existingIsOap = isOapTool(existingName);
        if (currentIsOap && !existingIsOap) {
          uniqueNamesMap.set(lowerName, name);
        }
      }
    });
    
    const deduplicatedConfigOrder = Array.from(uniqueNamesMap.values());

    const toolSort = (a: string, b: string) => {
      const aIsOap = isOapTool(a)
      const aEnabled = tools.find(tool => tool.name === a)?.enabled
      const bEnabled = tools.find(tool => tool.name === b)?.enabled
      if (isResort) {
        if (aEnabled && !bEnabled)
          return -1
        if (!aEnabled && bEnabled)
          return 1
        return aIsOap ? -1 : 1
      } else {
        const aIndex = sortedConfigOrderRef.current.indexOf(a)
        const bIndex = sortedConfigOrderRef.current.indexOf(b)
        return aIndex - bIndex
      }

      return 0
    }

    const sortedConfigOrder = deduplicatedConfigOrder.sort(toolSort)
    if(isResort) {
      sortedConfigOrderRef.current = sortedConfigOrder
    }
    setIsResort(false)
    const toolMap = new Map(
      tools.filter(tool => !(isOapTool(tool.name) && !isLoggedInOAP))
          .map(tool => [tool.name, tool])
    )

    const configTools = sortedConfigOrder.map(name => {
      const oapData = getOapData(name)
      
      if (toolMap.has(name)) {
        const tool = toolMap.get(name)!
        return {
          ...tool,
          disabled: Boolean(tool?.error),
          type: isOapTool(name) ? "oap" : "custom",
          plan: oapData?.planTag,
          oapId: oapData?.id,
        }
      }

      const cachedTool = toolsCacheRef.current[name]
      const mcpServers = (mcpConfig.mcpServers as Record<string, any>)
      if (cachedTool) {
        return {
          name,
          description: cachedTool.description,
          icon: cachedTool.icon,
          enabled: false,
          tools: cachedTool.subTools.map(subTool => ({
            name: subTool.name,
            description: subTool.description,
            enabled: subTool.enabled,
          })),
          url: mcpServers[name]?.url,
          error: mcpServers[name]?.error,
          disabled: Boolean(mcpServers[name]?.disabled || mcpServers[name]?.error),
          type: isOapTool(name) ? "oap" : "custom",
          plan: oapData?.planTag,
          oapId: oapData?.id
        }
      }

      return {
        name,
        description: "",
        enabled: false,
        url: mcpServers[name]?.url,
        disabled: Boolean(mcpServers[name]?.disabled || mcpServers[name]?.error),
        type: isOapTool(name) ? "oap" : "custom",
        plan: oapData?.planTag,
        oapId: oapData?.id
      }
    })

    return [...configTools].filter(tool => toolType === "all" || tool.type === toolType)
  }, [tools, mcpConfig.mcpServers, toolType])

  const toolMenu = (tool: Tool & { type: string }) => {
    return [
      { label:
          <div className="tool-edit-menu-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 17 16" fill="none">
              <path d="M3.83333 14C3.46667 14 3.15278 13.8694 2.89167 13.6083C2.63056 13.3472 2.5 13.0333 2.5 12.6667V3.33333C2.5 2.96667 2.63056 2.65278 2.89167 2.39167C3.15278 2.13056 3.46667 2 3.83333 2H7.83333C8.02222 2 8.18056 2.06389 8.30833 2.19167C8.43611 2.31944 8.5 2.47778 8.5 2.66667C8.5 2.85556 8.43611 3.01389 8.30833 3.14167C8.18056 3.26944 8.02222 3.33333 7.83333 3.33333H3.83333V12.6667H13.1667V8.66667C13.1667 8.47778 13.2306 8.31944 13.3583 8.19167C13.4861 8.06389 13.6444 8 13.8333 8C14.0222 8 14.1806 8.06389 14.3083 8.19167C14.4361 8.31944 14.5 8.47778 14.5 8.66667V12.6667C14.5 13.0333 14.3694 13.3472 14.1083 13.6083C13.8472 13.8694 13.5333 14 13.1667 14H3.83333ZM13.1667 4.26667L7.43333 10C7.31111 10.1222 7.15556 10.1833 6.96667 10.1833C6.77778 10.1833 6.62222 10.1222 6.5 10C6.37778 9.87778 6.31667 9.72222 6.31667 9.53333C6.31667 9.34444 6.37778 9.18889 6.5 9.06667L12.2333 3.33333H10.5C10.3111 3.33333 10.1528 3.26944 10.025 3.14167C9.89722 3.01389 9.83333 2.85556 9.83333 2.66667C9.83333 2.47778 9.89722 2.31944 10.025 2.19167C10.1528 2.06389 10.3111 2 10.5 2H13.8333C14.0222 2 14.1806 2.06389 14.3083 2.19167C14.4361 2.31944 14.5 2.47778 14.5 2.66667V6C14.5 6.18889 14.4361 6.34722 14.3083 6.475C14.1806 6.60278 14.0222 6.66667 13.8333 6.66667C13.6444 6.66667 13.4861 6.60278 13.3583 6.475C13.2306 6.34722 13.1667 6.18889 13.1667 6V4.26667Z" fill="currentColor"/>
            </svg>
            {t("tools.toolMenu.detail")}
          </div>,
        onClick: () => {
          openUrl(`${OAP_ROOT_URL}/mcp/${tool.oapId}`)
        },
        active: isOapTool(tool.name)
      },
      { label:
          <div className="tool-edit-menu-item">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              <g clipPath="url(#clip0_6_586)">
                <path d="M11 5C9.41775 5 7.87103 5.46919 6.55544 6.34824C5.23985 7.22729 4.21446 8.47672 3.60896 9.93853C3.00346 11.4003 2.84504 13.0089 3.15372 14.5607C3.4624 16.1126 4.22433 17.538 5.34315 18.6569C6.46197 19.7757 7.88743 20.5376 9.43928 20.8463C10.9911 21.155 12.5997 20.9965 14.0615 20.391C15.5233 19.7855 16.7727 18.7602 17.6518 17.4446C18.5308 16.129 19 14.5823 19 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                <path d="M16.4382 5.40544C16.7147 5.20587 16.7147 4.79413 16.4382 4.59456L11.7926 1.24188C11.4619 1.00323 11 1.23952 11 1.64733L11 8.35267C11 8.76048 11.4619 8.99676 11.7926 8.75812L16.4382 5.40544Z" fill="currentColor"/>
              </g>
              <defs>
                <clipPath id="clip0_6_586">
                <rect width="22" height="22" fill="currentColor" transform="matrix(-1 0 0 1 22 0)"/>
                </clipPath>
              </defs>
            </svg>
            {t("tools.toolMenu.reload")}
          </div>,
        onClick: () => {
          handleReloadMCPServers()
        },
        active: tool.enabled && tool.disabled
      },
      { label:
          <div className="tool-edit-menu-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M3 13.6684V18.9998H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2.99991 13.5986L12.5235 4.12082C13.9997 2.65181 16.3929 2.65181 17.869 4.12082V4.12082C19.3452 5.58983 19.3452 7.97157 17.869 9.44058L8.34542 18.9183" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {t("tools.toolMenu.edit")}
          </div>,
        onClick: () => {
          setCurrentTool(tool.name)
          setShowCustomEditPopup(true)
        },
        active: true
      },
      { label:
          <div className="tool-edit-menu-item">
            <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M3 5H19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M17 7V18.2373C16.9764 18.7259 16.7527 19.1855 16.3778 19.5156C16.0029 19.8457 15.5075 20.0192 15 19.9983H7C6.49249 20.0192 5.99707 19.8457 5.62221 19.5156C5.24735 19.1855 5.02361 18.7259 5 18.2373V7" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              <path d="M8 10.04L14 16.04" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M14 10.04L8 16.04" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              <path d="M13.5 2H8.5C8.22386 2 8 2.22386 8 2.5V4.5C8 4.77614 8.22386 5 8.5 5H13.5C13.7761 5 14 4.77614 14 4.5V2.5C14 2.22386 13.7761 2 13.5 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
            </svg>
            {t("tools.toolMenu.delete")}
          </div>,
        onClick: () => {
          setCurrentTool(tool.name)
          setShowDeletePopup(true)
        },
        active: true
      }
    ].filter(option => option.active)
  }

  useEffect(() => {
    setExpandedSections(prev =>
      prev.filter(name => sortedTools.some(tool => tool.name === name))
    )
  }, [sortedTools])

  return (
    <div className="tools-page">
      <div className="tools-container">
        <div className="tools-header">
          <div>{t("tools.title")}</div>
          <div className="header-actions">
            {isLoggedInOAP && (
              <Tooltip content={t("tools.oap.marketplaceAlt") || "Browse available integrations from the cloud"}>
                <Button
                  onClick={() => openDrawer({
                    id: "integration-market",
                    page: "IntegrationMarket",
                    props: {
                      onIntegrationAdded: async (instanceName: string, instanceConfig: any, fullConfig?: any) => {
                        try {
                          console.log(`[Tools] Starting sync for new instance: ${instanceName}`)
                          
                          if (fullConfig) {
                            // ✅ Fast path: Use config directly from backend
                            console.log('[Tools] Using full config from backend (no API calls needed)')
                            setMcpConfig(fullConfig)
                            
                            console.log('[Tools] Step 1: Loading tools...')
                            await loadTools()
                            
                            console.log('[Tools] Step 2: Updating cache...')
                            await updateToolsCache()
                            
                            console.log('[Tools] Step 3: Triggering re-sort...')
                            setIsResort(true)
                            
                            console.log(`[Tools] ✓ Successfully synced new tool: ${instanceName} (fast path)`)
                          } else {
                            // Fallback: Reload from API (for backward compatibility)
                            console.log('[Tools] No full config provided, falling back to API reload')
                            
                            await new Promise(resolve => setTimeout(resolve, 500))
                            
                            console.log('[Tools] Step 1: Loading MCP config...')
                            await loadMcpConfig()
                            
                            console.log('[Tools] Step 2: Loading tools...')
                            await loadTools()
                            
                            console.log('[Tools] Step 3: Updating cache...')
                            await updateToolsCache()
                            
                            console.log('[Tools] Step 4: Triggering re-sort...')
                            setIsResort(true)
                            
                            console.log(`[Tools] ✓ Successfully synced new tool: ${instanceName} (fallback path)`)
                          }
                        } catch (error) {
                          console.error("[Tools] ✗ Background sync failed:", error)
                        }
                      }
                    }
                  })}
                  color="blue"
                  size="fit"
                  padding="xs"
                >
                  <img src={`${imgPrefix}logo_oap.png`} alt="OAP" style={{ width: '16px', height: '16px', marginRight: '4px' }} />
                  {t("tools.oap.marketplace") || "Browse Integrations"}
                </Button>
              </Tooltip>
            )}
            
            <Tooltip content={t("tools.custom.headerBtnAlt")}>
              <Button
                onClick={() => {
                  setCurrentTool("")
                  setShowCustomEditPopup(true)
                }}
                color="success-green"
                size="fit"
                padding="xs"
              >
                {t("tools.custom.headerBtn")}
              </Button>
            </Tooltip>
          </div>
        </div>

        <div className="tools-list">
          {isLoggedInOAP &&
            <Tabs
              className="tools-type-tabs"
              tabs={[{ label: t("tools.tab.all"), value: "all" }, { label: t("tools.tab.oap"), value: "oap" }, { label: t("tools.tab.custom"), value: "custom" }]}
              value={toolType}
              onChange={setToolType}
            />
          }
          {sortedTools.length === 0 && !isLoading &&
            <div className="no-oap-result-container">
              <div className="cloud-icon">
                <img src={`${imgPrefix}logo_oap.png`} alt="OAP" className="oap-placeholder-logo" />
              </div>
              <div>
                <div className="no-oap-result-title">
                  {t("tools.no_tool_title")}
                </div>
                <div className="no-oap-result-message">
                  {isLoggedInOAP ? t(`tools.no_oap_tool_message.${toolType}`) : t("tools.no_tool_message")}
                </div>
              </div>
            </div>
          }
          {sortedTools.map((tool, index) => (
            <div key={tool.name} id={`tool-${index}`} onClick={() => toggleToolSection(tool.name)} className={`tool-section ${tool.disabled ? "disabled" : ""} ${tool.enabled ? "enabled" : ""} ${expandedSections.includes(tool.name) ? "expanded" : ""}`}>
              <div className="tool-header-container">
                <div className="tool-header">
                  <div className="tool-header-content">
                    <div className="tool-status-light">
                      {tool.enabled && !tool.disabled &&
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                          <circle cx="50" cy="50" r="45" fill="none" stroke="#52c41a" strokeWidth="4" />
                          <circle cx="50" cy="50" r="25" fill="#52c41a" />
                        </svg>}
                      {tool.enabled && tool.disabled &&
                        <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" width="16" height="16">
                          <circle cx="50" cy="50" r="45" fill="none" stroke="#ff3333" strokeWidth="4" />
                          <circle cx="50" cy="50" r="25" fill="#ff0000" />
                        </svg>}
                    </div>
                    {(() => {
                      // Try to get logo from mcpConfig (for OAP tools with custom logos)
                      const toolConfig = mcpConfig.mcpServers?.[tool.name]
                      const installPath = toolConfig?.extraData?.oap?.installPath
                      let logoUrl = toolConfig?.extraData?.oap?.logo || toolConfig?.logo
                      
                      if (!logoUrl) {
                        const bannerUrl = toolConfig?.extraData?.oap?.banner
                        if (bannerUrl) {
                          logoUrl = bannerUrl.replace("logo-240", "logo-48")
                        }
                      }
                      
                      // If package is installed locally, load local logo asynchronously
                      if (installPath && logoUrl && !logoUrl.startsWith("http")) {
                        const logoFileName = logoUrl.split('/').pop()
                        const logoPath = `${installPath}/logos/${logoFileName}`
                        const cacheKey = `${tool.name}_${logoFileName}`
                        
                        // Check if already loaded
                        if (!localLogos[cacheKey]) {
                          // Load asynchronously
                          readLocalLogo(logoPath).then(base64Logo => {
                            if (base64Logo) {
                              setLocalLogos(prev => ({ ...prev, [cacheKey]: base64Logo }))
                            }
                          }).catch(err => {
                            console.error(`Failed to load logo for ${tool.name}:`, err)
                          })
                        }
                        
                        // Use cached logo or fallback to Hub URL while loading
                        logoUrl = localLogos[cacheKey] || `${OAP_ROOT_URL}${logoUrl}`
                      } else if (logoUrl && !logoUrl.startsWith("http")) {
                        // Fallback: use Hub URL if not installed locally
                        logoUrl = `${OAP_ROOT_URL}${logoUrl}`
                      }
                      
                      if (logoUrl) {
                        return <img className="tool-header-content-icon" src={logoUrl} alt={tool.name} />
                      } else if (tool.type === "oap") {
                        return <img className="tool-header-content-icon oap-logo" src={`${imgPrefix}logo_oap.png`} alt="info" />
                      } else {
                        return (
                          <svg className="tool-header-content-icon" width="20" height="20" viewBox="0 0 24 24">
                            <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z"/>
                          </svg>
                        )
                      }
                    })()}
                    <span className="tool-name">{tool.name}</span>
                    {isOapTool(tool.name) && tool.oapId &&
                      <>
                        <div className={`tool-tag ${tool.plan}`}>
                          {tool.plan}
                        </div>
                        <Tooltip content={t("tools.oapStoreLinkAlt")}>
                          <button className="oap-store-link" onClick={(e) => {
                            e.stopPropagation()
                            window.open(`${OAP_ROOT_URL}/mcp/${tool.oapId}`, "_blank")
                          }}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 17 16" fill="none">
                              <path d="M3.83333 14C3.46667 14 3.15278 13.8694 2.89167 13.6083C2.63056 13.3472 2.5 13.0333 2.5 12.6667V3.33333C2.5 2.96667 2.63056 2.65278 2.89167 2.39167C3.15278 2.13056 3.46667 2 3.83333 2H7.83333C8.02222 2 8.18056 2.06389 8.30833 2.19167C8.43611 2.31944 8.5 2.47778 8.5 2.66667C8.5 2.85556 8.43611 3.01389 8.30833 3.14167C8.18056 3.26944 8.02222 3.33333 7.83333 3.33333H3.83333V12.6667H13.1667V8.66667C13.1667 8.47778 13.2306 8.31944 13.3583 8.19167C13.4861 8.06389 13.6444 8 13.8333 8C14.0222 8 14.1806 8.06389 14.3083 8.19167C14.4361 8.31944 14.5 8.47778 14.5 8.66667V12.6667C14.5 13.0333 14.3694 13.3472 14.1083 13.6083C13.8472 13.8694 13.5333 14 13.1667 14H3.83333ZM13.1667 4.26667L7.43333 10C7.31111 10.1222 7.15556 10.1833 6.96667 10.1833C6.77778 10.1833 6.62222 10.1222 6.5 10C6.37778 9.87778 6.31667 9.72222 6.31667 9.53333C6.31667 9.34444 6.37778 9.18889 6.5 9.06667L12.2333 3.33333H10.5C10.3111 3.33333 10.1528 3.26944 10.025 3.14167C9.89722 3.01389 9.83333 2.85556 9.83333 2.66667C9.83333 2.47778 9.89722 2.31944 10.025 2.19167C10.1528 2.06389 10.3111 2 10.5 2H13.8333C14.0222 2 14.1806 2.06389 14.3083 2.19167C14.4361 2.31944 14.5 2.47778 14.5 2.66667V6C14.5 6.18889 14.4361 6.34722 14.3083 6.475C14.1806 6.60278 14.0222 6.66667 13.8333 6.66667C13.6444 6.66667 13.4861 6.60278 13.3583 6.475C13.2306 6.34722 13.1667 6.18889 13.1667 6V4.26667Z" fill="currentColor"/>
                            </svg>
                          </button>
                        </Tooltip>
                      </>
                    }
                  </div>
                  <div onClick={(e) => e.stopPropagation()}>
                    <Dropdown
                      options={toolMenu(tool)}
                    >
                      <div className="tool-edit-menu">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="25" height="25">
                          <path fill="currentColor" d="M19 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM11 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM3 13a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"></path>
                        </svg>
                      </div>
                    </Dropdown>
                  </div>
                  {tool.disabled && tool.enabled && <div className="tool-disabled-label">{t("tools.startFailed")}</div>}
                  {tool.disabled && !tool.enabled && <div className="tool-disabled-label">{t("tools.installFailed")}</div>}
                  <div className="tool-switch-container">
                    <Switch
                      checked={tool.enabled}
                      onChange={() => toggleTool(tool)}
                    />
                  </div>
                  <span className="tool-toggle">
                    {(tool.description || (tool.tools?.length ?? 0) > 0 || tool.error) && "▼"}
                  </span>
                </div>
                {!tool.enabled &&
                  <div className="tool-content-sub-title">
                    {t("tools.disabledDescription")}
                  </div>
                }
                {tool.enabled && !tool.disabled && tool.tools && tool.tools.length > 0 &&
                  <div className="tool-content-sub-title">
                    <span>
                      {t("tools.subToolsCount", { count: tool.tools?.filter(subTool => subTool.enabled).length || 0, total: tool.tools?.length || 0 })}
                    </span>
                  </div>
                }
              </div>
              {(tool.description || (tool.tools?.length ?? 0) > 0 || tool.error) && (
                <div onClick={(e) => {
                  if(changingTool !== "" && changingTool === tool.name) {
                    e.stopPropagation()
                  }
                }}>
                  <div className="tool-content-container">
                    {tool.error ? (
                      <div className="tool-content">
                        <div className="sub-tool-error">
                          <svg width="18px" height="18px" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none"/>
                            <line x1="12" y1="6" x2="12" y2="14" stroke="currentColor" strokeWidth="2"/>
                            <circle cx="12" cy="17" r="1.5" fill="currentColor"/>
                          </svg>
                          <div className="sub-tool-error-text">
                            <div className="sub-tool-error-text-title">Error Message</div>
                            <div className="sub-tool-error-text-content">{tool.error}</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <>
                        {tool.description && (
                          <div className="tool-content">
                            <div className="tool-description">{tool.description}</div>
                          </div>
                        )}
                        {tool.tools && tool.tools.length > 0 && (
                          <ClickOutside onClickOutside={(event) => handleUnsavedSubtools(tool.name, event)}>
                            <div className="tool-content">
                              <div className="sub-tools">
                                {tool.tools.map((subTool, subIndex) => (
                                  <Tooltip
                                    key={subIndex}
                                    content={subTool.description}
                                    disabled={!subTool.description}
                                    align="start"
                                  >
                                    <div key={subIndex} className={`sub-tool ${(subTool.enabled && tool.enabled) ? "active" : ""}`} onClick={(e) => {
                                      e.stopPropagation()
                                      toggleSubTool(tool.name, subTool.name, (!subTool.enabled || !tool.enabled) ? "remove" : "add")
                                    }}>
                                      <div className="sub-tool-content">
                                          <div className="sub-tool-name">{subTool.name}</div>
                                      </div>
                                    </div>
                                  </Tooltip>
                                ))}
                              </div>
                            </div>
                            <div className="sub-tools-footer">
                              <button className={`sub-tools-footer-confirm-btn ${changingTool === tool.name ? "active" : ""}`} onClick={toggleSubToolConfirm}>{t("common.save")}</button>
                            </div>
                          </ClickOutside>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="global-loading-overlay">
          <div className="loading-spinner"></div>
        </div>
      )}

      {showDeletePopup && (
        <PopupConfirm
          title={t("tools.deleteTitle", { mcp: currentTool })}
          noBorder
          footerType="center"
          zIndex={1000}
          onCancel={() => setShowDeletePopup(false)}
          onConfirm={async () => {
            setShowDeletePopup(false)
            setShowCustomEditPopup(false)
            await deleteTool(currentTool)
            setCurrentTool("")
          }}
        />
      )}

      {showCustomEditPopup && (
        <CustomEdit
          _type={currentTool === "" ? "add" : "edit"}
          _config={mcpConfig}
          _toolName={currentTool}
          onDelete={handleDeleteTool}
          onCancel={() => {
            abortControllerRef.current?.abort()
            setShowCustomEditPopup(false)
          }}
          onSubmit={handleCustomSubmit}
          toolLog={toolLog}
        />
      )}


      {showUnsavedSubtoolsPopup && (
        <PopupConfirm
          noBorder
          className="unsaved-popup"
          footerType="center"
          zIndex={1000}
          onConfirm={toggleSubToolConfirm}
          onCancel={toggleSubToolCancel}
          cancelText={t("tools.unsaved.cancel")}
        >
          <div className="unsaved-content">
            <div className="unsaved-header">
              {t("tools.unsaved.title")}
            </div>
            <div className="unsaved-desc">
              {t("tools.unsaved.desc")}
            </div>
          </div>
        </PopupConfirm>
      )}
    </div>
  )
}

export default React.memo(Tools)