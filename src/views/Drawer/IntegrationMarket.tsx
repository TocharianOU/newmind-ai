import { memo, useCallback, useEffect, useRef, useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import React from "react"
import { useSetAtom } from "jotai"
import { showToastAtom } from "../../atoms/toastState"
import { OAPMCPServer, InstanceInfo } from "../../../types/oap"
import { oapSearchMCPServer } from "../../ipc"
import Button from "../../components/Button"
import WrappedInput from "../../components/WrappedInput"
import InfiniteScroll from "../../components/InfiniteScroll"
import SchemaForm from "../Overlay/Tools/Popup/SchemaForm"
import Tooltip from "../../components/Tooltip"
import { OAP_ROOT_URL } from "../../../shared/oap"

interface IntegrationMarketProps {
  onIntegrationAdded?: (instanceName: string, instanceConfig: any, fullConfig?: any) => void
  onClose?: () => void
}

interface ToolItem extends OAPMCPServer {
  isInstalled?: boolean
  isAdding?: boolean
  isInstalling?: boolean
  installProgress?: number
  installedInstanceName?: string
  logoUrl?: string
}

type ViewMode = "browse" | "configure" | "installing"

const IntegrationMarket = ({ onIntegrationAdded, onClose }: IntegrationMarketProps) => {
  const { t } = useTranslation()
  const showToast = useSetAtom(showToastAtom)
  const [toolList, setToolList] = useState<ToolItem[]>([])
  const [installedInstances, setInstalledInstances] = useState<InstanceInfo[]>([])
  const [searchText, setSearchText] = useState("")
  const [hasNextPage, setHasNextPage] = useState(true)
  const [isFetching, setIsFetching] = useState(false)
  const pageRef = useRef(0)
  const isInitializedRef = useRef(false)
  const PAGE_SIZE = 25

  const [viewMode, setViewMode] = useState<ViewMode>("browse")
  const [selectedTool, setSelectedTool] = useState<ToolItem | null>(null)
  const [instanceName, setInstanceName] = useState("")
  const [configData, setConfigData] = useState<[string, unknown, boolean][]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [installProgress, setInstallProgress] = useState(0)
  const [installStatus, setInstallStatus] = useState("")
  const installAbortControllerRef = useRef<AbortController | null>(null)

  const loadInstalledInstances = useCallback(async () => {
    try {
      const res = await fetch("/api/plugins/oap-platform/instances")
      const data = await res.json()
      if (data.status === "success") {
        setInstalledInstances(data.instances)
      }
    } catch (error) {
      console.error("Failed to load installed instances:", error)
    }
  }, [])

  const resetState = useCallback(() => {
    pageRef.current = 0
    setToolList([])
    setHasNextPage(true)
    setIsFetching(false)
  }, [])

  const handleLoadNextPage = useCallback(async () => {
    if (isFetching || !hasNextPage) {
      return
    }
    
    setIsFetching(true)

    try {
      const params = {
        page: pageRef.current,
        search_input: searchText,
        "mcp-sort-order": 0 as 0 | 1,
        filter: 0 as 0 | 1 | 2,
      }

      const res = await oapSearchMCPServer(params)
      
      if (res.status !== "success" || !res.data) {
        console.error("Failed to fetch integrations:", res)
        showToast({
          message: "Failed to load integrations",
          type: "error"
        })
        setHasNextPage(false)
        return
      }
      
      if (res.data.length > 0) {
        console.log("MCP Server data from Hub:", res.data)
        const data = res.data.map((tool: OAPMCPServer) => {
          const logoUrl = tool.logo || (tool.banner ? `${OAP_ROOT_URL}${tool.banner}` : null)
          console.log(`Tool ${tool.name}:`, {
            logo: tool.logo,
            banner: tool.banner,
            logoUrl: logoUrl,
            hasLogo: !!logoUrl
          })
          const instance = installedInstances.find(inst => inst.tool_id === tool.id)
          return {
            ...tool,
            logoUrl: logoUrl || undefined,
            isInstalled: !!instance,
            installedInstanceName: instance?.instance_name,
            isAdding: false,
          }
        })
        
        setToolList(prev => {
          const existingIds = new Set(prev.map(t => t.id))
          const uniqueData = data.filter((t: any) => !existingIds.has(t.id))
          return [...prev, ...uniqueData]
        })
      }

      if (res.data.length >= PAGE_SIZE) {
        setHasNextPage(true)
        pageRef.current += 1
      } else {
        setHasNextPage(false)
      }
    } catch (error) {
      console.error("Failed to load integrations:", error)
      setHasNextPage(false)
    } finally {
      setIsFetching(false)
    }
  }, [isFetching, hasNextPage, searchText, installedInstances, showToast])

  useEffect(() => {
    if (!isInitializedRef.current) {
      isInitializedRef.current = true
      const init = async () => {
        await loadInstalledInstances()
        handleLoadNextPage()
      }
      init()
    }
  }, [loadInstalledInstances, handleLoadNextPage])

  useEffect(() => {
    if (isInitializedRef.current && searchText !== "") {
      resetState()
      handleLoadNextPage()
    }
  }, [searchText, resetState, handleLoadNextPage])

  const handleAddClick = async (tool: ToolItem) => {
    setSelectedTool(tool)
    setInstanceName(tool.name || "")
    
    try {
      const needsConfig = tool.configSchema?.properties && Object.keys(tool.configSchema.properties).length > 0
      
      if (needsConfig) {
        setViewMode("installing")
        setInstallProgress(0)
        setInstallStatus(t("tools.marketplace.preparing") || "Preparing integration...")
        
        await installPackage(tool)
        
        const initialConfig: [string, unknown, boolean][] = []
        const properties = tool.configSchema.properties || {}
        Object.entries(properties).forEach(([key, prop]: [string, any]) => {
          initialConfig.push([key, prop.default || "", false])
        })
        setConfigData(initialConfig)
        setViewMode("configure")
      } else {
        setViewMode("installing")
        setInstallProgress(0)
        setInstallStatus(t("tools.marketplace.installing") || "Installing integration...")
        
        await new Promise(resolve => setTimeout(resolve, 300))
        setInstallProgress(50)
        
        await createInstance(tool, {})
        
        setViewMode("browse")
        setSelectedTool(null)
      }
    } catch (error) {
      // Check if it's a cancellation
      const errorMessage = error instanceof Error ? error.message : String(error)
      if (errorMessage.includes('cancelled') || errorMessage.includes('canceled')) {
        // Cancellation is already handled by handleCancelInstallation
        console.log("[IntegrationMarket] Installation cancelled by user")
        return
      }
      
      // Handle actual errors
      console.error("[IntegrationMarket] Installation failed:", error)
      showToast({
        message: t("tools.installFailed") || "Installation failed",
        type: "error"
      })
      setViewMode("browse")
      setSelectedTool(null)
    }
  }
  
  const installPackage = async (tool: ToolItem) => {
    try {
      if (!tool.downloadUrl || !tool.version) {
        return
      }
      
      // Create abort controller for cancellation
      const abortController = new AbortController()
      installAbortControllerRef.current = abortController
      
      const response = await fetch("/api/plugins/oap-platform/packages/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tool.name,
          version: tool.version,
          download_url: tool.downloadUrl
        }),
        signal: abortController.signal
      })
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`)
      }
      
      const reader = response.body?.getReader()
      if (!reader) {
        throw new Error("Failed to get response reader")
      }
      
      const decoder = new TextDecoder()
      let buffer = ""
      
      while (true) {
        // Check if cancelled
        if (abortController.signal.aborted) {
          reader.cancel()
          throw new Error("Installation cancelled by user")
        }
        
        const { done, value } = await reader.read()
        if (done) break
        
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6))
              
              if (data.status === "downloading" || data.status === "exists") {
                setInstallProgress(data.progress || 0)
                setInstallStatus(data.message || "Downloading...")
              } else if (data.status === "success") {
                setInstallProgress(100)
                setInstallStatus("Package ready")
                return
              } else if (data.status === "error") {
                throw new Error(data.message || "Download failed")
              }
            } catch (e) {
              console.error("[IntegrationMarket] Failed to parse SSE data:", line, e)
            }
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError' || (error as Error).message?.includes('cancelled')) {
        console.log("[IntegrationMarket] Installation cancelled")
        throw new Error("Installation cancelled")
      }
      console.error("[IntegrationMarket] Download error:", error)
      throw error
    } finally {
      installAbortControllerRef.current = null
    }
  }

  const createInstance = async (tool: ToolItem, config: Record<string, any>) => {
    setToolList(prev => {
      const newList = [...prev]
      const index = newList.findIndex(t => t.id === tool.id)
      if (index >= 0) {
        newList[index].isAdding = true
      }
      return newList
    })

    try {
      const stringifiedConfig: Record<string, string> = {}
      Object.entries(config).forEach(([key, value]) => {
        if (typeof value === 'boolean') {
          stringifiedConfig[key] = value ? "1" : "0"
        } else if (typeof value === 'number') {
          stringifiedConfig[key] = String(value)
        } else if (value !== null && value !== undefined) {
          stringifiedConfig[key] = String(value)
        }
      })
      
      if (stringifiedConfig.tlsMode) {
        const tlsMode = stringifiedConfig.tlsMode
        delete stringifiedConfig.tlsMode
        stringifiedConfig.NODE_TLS_REJECT_UNAUTHORIZED = tlsMode === "skip" ? "0" : "1"
      }
      
      const derivedLogo = tool.logo || (tool.banner ? tool.banner.replace("logo-240", "logo-48") : undefined)
      const requestBody = {
        tool_id: tool.id,
        tool_name: tool.name,
        instance_name: instanceName || tool.name,
        transport: tool.transport || "stdio",
        command: tool.command || undefined,
        args: tool.args || undefined,
        url: tool.url || undefined,
        env: stringifiedConfig || {},
        enabled: true,
        version: tool.version || undefined,
        download_url: tool.downloadUrl || undefined,
        config_schema: tool.configSchema || undefined,
        plan_tag: tool.plan || "base",
        description: tool.description || "",
        logo: derivedLogo,
        banner: tool.banner || undefined,
      }
      
      Object.keys(requestBody).forEach(key => {
        if (requestBody[key] === undefined) {
          delete requestBody[key]
        }
      })
      
      const res = await fetch("/api/plugins/oap-platform/instances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      })
      
      if (!res.ok) {
        const errorText = await res.text()
        console.error("[IntegrationMarket] Error response:", errorText)
        let errorMessage = "Failed to create instance"
        try {
          const errorData = JSON.parse(errorText)
          if (errorData.detail) {
            if (Array.isArray(errorData.detail)) {
              const errors = errorData.detail.map((err: any) => {
                const field = err.loc ? err.loc.join('.') : 'unknown'
                return `${field}: ${err.msg}`
              }).join(', ')
              errorMessage = errors
            } else if (typeof errorData.detail === 'string') {
              errorMessage = errorData.detail
            }
          } else if (errorData.message) {
            errorMessage = errorData.message
          }
        } catch (e) {
          errorMessage = errorText || errorMessage
        }
        showToast({
          message: errorMessage,
          type: "error"
        })
        return
      }
      
      const data = await res.json()
      
      if (data.status === "success") {
        showToast({
          message: t("tools.instance.created") || "Instance created successfully",
          type: "success"
        })
        
        const enhancedConfig = {
          ...data.instance.config,
          extraData: {
            ...data.instance.config?.extraData,
            oap: {
              ...data.instance.config?.extraData?.oap,
              id: tool.id,
              name: tool.name,
              logo: derivedLogo,
              banner: tool.banner,
              planTag: tool.plan,
              description: tool.description,
              instanceId: data.instance.instance_id,
              configSchema: tool.configSchema
            }
          }
        }
        
        // Reload installed instances to update the UI
        await loadInstalledInstances()
        
        // Update tool list to mark this tool as installed
        setToolList(prev => prev.map(t => 
          t.id === tool.id 
            ? { ...t, isInstalled: true, installedInstanceName: data.instance.instance_name, isAdding: false }
            : t
        ))
        
        // CRITICAL: Call callback with full_config from backend for immediate update
        if (onIntegrationAdded && data.instance.config) {
          await onIntegrationAdded(data.instance.instance_name, enhancedConfig, data.full_config)
        }
      } else {
        showToast({
          message: data.message || "Failed to create instance",
          type: "error"
        })
      }
    } catch (error) {
      console.error("Error adding integration:", error)
      showToast({
        message: t("tools.instance.createFailed") || "Failed to create instance",
        type: "error"
      })
    } finally {
      setToolList(prev => {
        const newList = [...prev]
        const index = newList.findIndex(t => t.id === tool.id)
        if (index >= 0) {
          newList[index].isAdding = false
        }
        return newList
      })
    }
  }

  const handleConfigSubmit = async () => {
    if (!selectedTool) return

    setIsSubmitting(true)

    try {
      const config: Record<string, any> = {}
      configData.forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          if (typeof value === 'boolean') {
            config[key] = value ? "1" : "0"
          } else if (typeof value === 'number') {
            config[key] = String(value)
          } else {
            config[key] = value
          }
        }
      })

      if (selectedTool.configSchema?.required) {
        const missingFields = selectedTool.configSchema.required.filter((field: string) => {
          const value = config[field]
          return value === undefined || value === "" || value === null
        })

        if (missingFields.length > 0) {
          showToast({
            message: `${t("tools.jsonFormatError.requiredError", { mcp: selectedTool.name, field: missingFields.join(", ") })}`,
            type: "error"
          })
          setIsSubmitting(false)
          return
        }
      }

      await createInstance(selectedTool, config)
      
      // Show success message briefly
      showToast({
        message: t("tools.instance.created") || "Integration added successfully!",
        type: "success"
      })
      
      // Success - close drawer and show tools list
      if (onClose) {
        onClose()
      }
      
      // Reset state
      setViewMode("browse")
      setSelectedTool(null)
      setInstanceName("")
      setConfigData([])
    } catch (error) {
      console.error("Error in configuration submit:", error)
      showToast({
        message: error instanceof Error ? error.message : t("tools.instance.createFailed") || "Failed to create instance",
        type: "error"
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBackToBrowse = () => {
    setViewMode("browse")
    setSelectedTool(null)
  }

  const handleCancelInstallation = () => {
    // Abort the installation
    if (installAbortControllerRef.current) {
      installAbortControllerRef.current.abort()
    }
    
    // Reset state
    setViewMode("browse")
    setSelectedTool(null)
    setInstallProgress(0)
    setInstallStatus("")
    
    // Reset tool list state
    setToolList(prev => prev.map(tool => ({
      ...tool,
      isAdding: false,
      isInstalling: false
    })))
    
    showToast({
      message: t("tools.marketplace.installationCancelled") || "Installation cancelled",
      type: "info"
    })
  }

  const mcpNameMask = (name: string, maxLength: number = 18) => {
    return name.length > maxLength ? `${name.slice(0, maxLength)}...` : name
  }

  const IntegrationList = useMemo(() => {
    return (
      <div className="tool-edit-list integration-list">
        <div className="integration-list-header">
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-weak)' }}>
            {t("tools.marketplace.available") || "Available"} ({toolList.length})
          </span>
        </div>
        {toolList.slice(0, 30).map((tool) => (
          <Tooltip
            key={tool.id}
            content={tool.description || tool.name}
            side="right"
          >
            <div
              className={`tool-edit-list-item ${selectedTool?.id === tool.id ? "active" : ""}`}
              onClick={() => handleAddClick(tool)}
              style={{ cursor: 'pointer' }}
            >
              <div className="tool-edit-list-item-content">
                {tool.logoUrl && (
                  <img 
                    src={tool.logoUrl} 
                    alt={tool.name}
                    style={{
                      width: '24px',
                      height: '24px',
                      objectFit: 'contain',
                      marginRight: '8px',
                      flexShrink: 0
                    }}
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )}
                <div className="left">
                  <label>{mcpNameMask(tool.name, 14)}</label>
                </div>
              </div>
            </div>
          </Tooltip>
        ))}
      </div>
    )
  }, [toolList, selectedTool, t])

  const ContentArea = useMemo(() => {
    if (viewMode === "installing" && selectedTool) {
      return (
        <div className="tool-edit-popup-content">
          <div className="tool-edit-header">
            <span>{t("tools.marketplace.installing") || "Installing Integration"}</span>
          </div>
          
          <div className="tool-edit-content">
            <div className="installation-progress-container">
              <div className="installation-icon">
                <div className="oap-item-img" style={{
                  width: '120px',
                  height: '120px',
                  background: selectedTool.logoUrl ? 'var(--bg-op-dark-ultraweak)' : 'linear-gradient(135deg, var(--bg-pri-blue) 0%, var(--bg-hover-blue) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '48px',
                  fontWeight: '700',
                  borderRadius: '16px',
                  margin: '0 auto 24px'
                }}>
                  {selectedTool.logoUrl ? (
                    <img 
                      src={selectedTool.logoUrl} 
                      alt={selectedTool.name}
                      style={{
                        width: '80px',
                        height: '80px',
                        objectFit: 'contain'
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        const parent = e.currentTarget.parentElement
                        if (parent) {
                          parent.style.background = 'linear-gradient(135deg, var(--bg-pri-blue) 0%, var(--bg-hover-blue) 100%)'
                          parent.textContent = selectedTool.name.substring(0, 2).toUpperCase()
                        }
                      }}
                    />
                  ) : (
                    selectedTool.name.substring(0, 2).toUpperCase()
                  )}
                </div>
              </div>
              
              <div className="installation-info">
                <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '8px', textAlign: 'center' }}>
                  {selectedTool.name}
                </h3>
                <p style={{ color: 'var(--text-weak)', marginBottom: '32px', textAlign: 'center' }}>
                  {selectedTool.version && `v${selectedTool.version}`}
                </p>
              </div>
              
              <div className="progress-section">
                <div className="progress-status" style={{ 
                  marginBottom: '12px', 
                  color: 'var(--text-weak)',
                  fontSize: '14px',
                  textAlign: 'center'
                }}>
                  {installStatus}
                </div>
                
                <div className="progress-bar-container" style={{
                  width: '100%',
                  height: '8px',
                  background: 'var(--bg-op-dark-weak)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  marginBottom: '8px'
                }}>
                  <div className="progress-bar" style={{
                    width: `${installProgress}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, var(--bg-pri-blue) 0%, var(--bg-hover-blue) 100%)',
                    transition: 'width 0.3s ease',
                    borderRadius: '4px'
                  }} />
                </div>
                
                <div className="progress-percentage" style={{
                  textAlign: 'center',
                  fontSize: '24px',
                  fontWeight: '700',
                  color: 'var(--text-pri-blue)',
                  marginBottom: '24px'
                }}>
                  {installProgress}%
                </div>
                
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '24px' }}>
                  <Button onClick={handleCancelInstallation} color="white">
                    {t("tools.cancel") || "取消安装"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }
    
    if (viewMode === "configure" && selectedTool) {
      return (
        <div className="tool-edit-popup-content configure-integration">
          <div className="tool-edit-header">
            <span>{t("tools.marketplace.configure") || "Configure Integration"}</span>
          </div>
          
          <div className="tool-edit-content">
            <div className="configure-container">
              <div className="integration-info-card">
                <div className="integration-logo">
                  {selectedTool.logoUrl ? (
                    <img 
                      src={selectedTool.logoUrl} 
                      alt={selectedTool.name}
                      onError={(e) => {
                        e.currentTarget.style.display = 'none'
                        const parent = e.currentTarget.parentElement
                        if (parent) {
                          parent.style.background = 'linear-gradient(135deg, var(--bg-pri-blue) 0%, var(--bg-hover-blue) 100%)'
                          parent.innerHTML = `<span style="color: white; font-size: 32px; font-weight: 700;">${selectedTool.name.substring(0, 2).toUpperCase()}</span>`
                        }
                      }}
                    />
                  ) : (
                    <div style={{
                      background: 'linear-gradient(135deg, var(--bg-pri-blue) 0%, var(--bg-hover-blue) 100%)',
                      width: '100%',
                      height: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'white',
                      fontSize: '32px',
                      fontWeight: '700'
                    }}>
                      {selectedTool.name.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>
                
                <div className="integration-details">
                  <h3 className="integration-name">{selectedTool.name}</h3>
                  {selectedTool.version && (
                    <span className="integration-version">v{selectedTool.version}</span>
                  )}
                  {selectedTool.description && (
                    <p className="integration-description">{selectedTool.description}</p>
                  )}
                </div>
              </div>
              
              <div className="configure-form">
                <div className="oap-edit-notice">
                  {t("tools.oap.edit_managed_notice") || "This integration is managed by OAP Platform. Configure the required settings below."}
                </div>
                
                <div className="field-item">
                  <label>
                    {t("tools.namePlaceholder") || "Instance Name"}
                    <span className="required"> *</span>
                  </label>
                  <input
                    type="text"
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value)}
                    placeholder={t("tools.namePlaceholder") || "Enter instance name"}
                  />
                </div>
                
                {selectedTool.configSchema && (
                  <div className="schema-form-wrapper">
                    <SchemaForm
                      schema={selectedTool.configSchema}
                      config={configData}
                      onChange={setConfigData}
                      disabled={isSubmitting}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="tool-edit-popup-content integration-market-browse">
        <div className="tool-edit-header">
          <span>{t("tools.marketplace.title") || "Integration Marketplace"}</span>
        </div>
        
        <div className="tool-edit-content">
          <div className="oap-container">
            <div className="oap-search-wrapper">
              <div className="oap-search-container">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 22 22" width="22" height="22">
                  <path stroke="currentColor" strokeLinecap="round" strokeMiterlimit="10" strokeWidth="2" d="m15 15 5 5"></path>
                  <path stroke="currentColor" strokeMiterlimit="10" strokeWidth="2" d="M9.5 17a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15Z"></path>
                </svg>
                <WrappedInput
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  placeholder={t("tools.marketplace.search") || "Search integrations..."}
                  className="oap-search-input"
                />
              </div>
            </div>

            <div className="oap-item-wrapper">
              <div className="oap-grid">
                <InfiniteScroll
                  onNext={handleLoadNextPage}
                  hasMore={hasNextPage}
                >
                  {toolList.map((tool) => (
                    <div key={tool.id} className="oap-item">
                      <div className="oap-item-container">
                        <div className="oap-item-img" style={{
                          background: tool.logoUrl ? 'var(--bg-op-dark-ultraweak)' : 'linear-gradient(135deg, var(--bg-pri-blue) 0%, var(--bg-hover-blue) 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '28px',
                          fontWeight: '700',
                          position: 'relative',
                          overflow: 'hidden'
                        }}>
                          {tool.logoUrl ? (
                            <img 
                              src={tool.logoUrl} 
                              alt={tool.name}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                padding: '12px'
                              }}
                              onError={(e) => {
                                e.currentTarget.style.display = 'none'
                                const parent = e.currentTarget.parentElement
                                if (parent) {
                                  parent.style.background = 'linear-gradient(135deg, var(--bg-pri-blue) 0%, var(--bg-hover-blue) 100%)'
                                  parent.textContent = tool.name.substring(0, 2).toUpperCase()
                                }
                              }}
                            />
                          ) : (
                            tool.name.substring(0, 2).toUpperCase()
                          )}
                        </div>
                        <div className="oap-item-content">
                          <div className="oap-item-content-top">
                            <div className="oap-content">
                              <div className="oap-content-title">
                                <div className="oap-title-text">{tool.name}</div>
                                {tool.version && (
                                  <span style={{ 
                                    fontSize: '11px',
                                    padding: '2px 6px',
                                    borderRadius: '4px',
                                    background: 'var(--bg-op-dark-ultraweak)',
                                    color: 'var(--text-weak)',
                                    fontWeight: '500',
                                    marginLeft: '8px'
                                  }}>
                                    v{tool.version}
                                  </span>
                                )}
                              </div>
                              <div className="oap-description">{tool.description || 'No description available'}</div>
                            </div>
                          </div>
                          <div className="oap-item-content-bottom">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                              <div style={{ fontSize: '12px', color: 'var(--text-weak)' }}>
                                {tool.isInstalled && tool.version 
                                  ? `${t("tools.marketplace.installed") || "已安装"} v${tool.version}`
                                  : t("tools.marketplace.notInstalled") || "未安装"
                                }
                              </div>
                              <Button
                                onClick={() => handleAddClick(tool)}
                                disabled={tool.isAdding}
                                color="blue"
                                size="fit"
                              >
                                {tool.isAdding 
                                  ? (
                                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      <div className="loading-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></div>
                                      {t("tools.marketplace.adding") || "Adding..."}
                                    </span>
                                  )
                                  : (t("tools.marketplace.addButton") || "Add Integration")
                                }
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </InfiniteScroll>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }, [viewMode, selectedTool, instanceName, configData, isSubmitting, searchText, toolList, hasNextPage, t, handleLoadNextPage, installProgress, installStatus])

  return (
    <div className={`integration-market-drawer ${viewMode !== "browse" ? "single-column" : ""}`}>
      <div className="tool-edit-popup">
        {viewMode === "browse" && IntegrationList}
        {ContentArea}
      </div>
      
      {viewMode === "configure" && (
        <div className="drawer-footer">
          <Button onClick={handleBackToBrowse} color="white" disabled={isSubmitting}>
            {t("tools.cancel") || "取消"}
          </Button>
          <Button onClick={handleConfigSubmit} color="blue" disabled={isSubmitting}>
            {isSubmitting ? <div className="loading-spinner"></div> : (t("tools.marketplace.addButton") || "添加集成")}
          </Button>
        </div>
      )}
    </div>
  )
}

export default memo(IntegrationMarket)
