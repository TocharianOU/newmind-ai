import { memo, useCallback, useEffect, useRef, useState, useMemo } from "react"
import { useTranslation } from "react-i18next"
import React from "react"
import { useSetAtom } from "jotai"
import { showToastAtom } from "../../../../atoms/toastState"
import { OAPMCPServer, InstanceInfo } from "../../../../../types/oap"
import { oapSearchMCPServer } from "../../../../ipc"
import Button from "../../../../components/Button"
import WrappedInput from "../../../../components/WrappedInput"
import InfiniteScroll from "../../../../components/InfiniteScroll"
import PopupConfirm from "../../../../components/PopupConfirm"
import SchemaForm from "./SchemaForm"
import Tooltip from "../../../../components/Tooltip"

interface IntegrationMarketProps {
  onClose: () => void
  onIntegrationAdded?: (instanceName: string, instanceConfig: any) => void
}

interface ToolItem extends OAPMCPServer {
  isInstalled?: boolean
  isAdding?: boolean
  isInstalling?: boolean
  installProgress?: number
  installedInstanceName?: string
}

type ViewMode = "browse" | "configure" | "installing"

const IntegrationMarket = ({ onClose, onIntegrationAdded }: IntegrationMarketProps) => {
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

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>("browse")
  const [selectedTool, setSelectedTool] = useState<ToolItem | null>(null)
  const [instanceName, setInstanceName] = useState("")
  const [configData, setConfigData] = useState<[string, unknown, boolean][]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [installProgress, setInstallProgress] = useState(0)
  const [installStatus, setInstallStatus] = useState("")

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
        const data = res.data.map((tool: OAPMCPServer) => {
          const instance = installedInstances.find(inst => inst.tool_id === tool.id)
          return {
            ...tool,
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

  // Handle Add button click - Start with installation
  const handleAddClick = async (tool: ToolItem) => {
    setSelectedTool(tool)
    setInstanceName(tool.name || "")
    
    try {
      // Check if configuration is needed
      const needsConfig = tool.configSchema?.properties && Object.keys(tool.configSchema.properties).length > 0
      
      if (needsConfig) {
        // Show preparation progress before config
        setViewMode("installing")
        setInstallProgress(0)
        setInstallStatus(t("tools.marketplace.preparing") || "Preparing integration...")
        
        await installPackage(tool)
        
        // Initialize config data from schema defaults
        const initialConfig: [string, unknown, boolean][] = []
        const properties = tool.configSchema.properties || {}
        Object.entries(properties).forEach(([key, prop]: [string, any]) => {
          initialConfig.push([key, prop.default || "", false])
        })
        setConfigData(initialConfig)
        setViewMode("configure")
      } else {
        // Direct install without configuration - show installing view
        setViewMode("installing")
        setInstallProgress(0)
        setInstallStatus(t("tools.marketplace.installing") || "Installing integration...")
        
        // Brief visual feedback
        await new Promise(resolve => setTimeout(resolve, 300))
        setInstallProgress(50)
        
        // Create instance directly
        await createInstance(tool, {})
        
        // Success is handled in createInstance callback
        // Reset state for next operation
        setViewMode("browse")
        setSelectedTool(null)
      }
    } catch (error) {
      console.error("[IntegrationMarket] Installation failed:", error)
      showToast({
        message: t("tools.installFailed") || "Installation failed",
        type: "error"
      })
      setViewMode("browse")
      setSelectedTool(null)
    }
  }
  
  // Download package with real progress
  const installPackage = async (tool: ToolItem) => {
    try {
      if (!tool.downloadUrl || !tool.version) {
        // No download needed
        return
      }
      
      const response = await fetch("/api/plugins/oap-platform/packages/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: tool.name,
          version: tool.version,
          download_url: tool.downloadUrl
        })
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
      console.error("[IntegrationMarket] Download error:", error)
      throw error
    }
  }

  // Create instance
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
      // Ensure all env values are strings
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
      
      // Map TLS mode selection to NODE_TLS_REJECT_UNAUTHORIZED
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
        enabled: true,  // Auto-enable after configuration
        version: tool.version || undefined,
        download_url: tool.downloadUrl || undefined,
        config_schema: tool.configSchema || undefined,
        plan_tag: tool.plan || "base",
        description: tool.description || "",
        logo: derivedLogo,
        banner: tool.banner || undefined,
      }
      
      // Remove undefined values
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
            // Handle FastAPI validation errors (array of error objects)
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
        
        // Reload installed instances
        await loadInstalledInstances()
        
        // Update local state
        setToolList(prev =>
          prev.map(item =>
            item.id === tool.id 
              ? { ...item, isInstalled: true, installedInstanceName: data.instance.instance_name, isAdding: false }
              : item
          )
        )
        
        // Notify parent with instance name and configuration
        // Parent can directly use the config without reloading from file
        // Enhance config with OAP metadata (logo, banner, etc.)
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
        
        if (onIntegrationAdded && data.instance.config) {
          // Pass both instance name and enhanced configuration
          // No timeout needed since we're passing the config directly
          onIntegrationAdded(data.instance.instance_name, enhancedConfig)
        } else {
          onClose()
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

  // Handle configuration submit
  const handleConfigSubmit = async () => {
    if (!selectedTool) return

    setIsSubmitting(true)

    try {
      const config: Record<string, any> = {}
      configData.forEach(([key, value]) => {
        if (value !== "" && value !== null && value !== undefined) {
          // Convert all values to strings for env variables
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
      
      // createInstance handles success callback and closing
      // If we reach here without error, the instance was created successfully
    } catch (error) {
      console.error("Error in configuration submit:", error)
      showToast({
        message: error instanceof Error ? error.message : t("tools.instance.createFailed") || "Failed to create instance",
        type: "error"
      })
      // Don't reset view on error, allow user to fix and retry
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBackToBrowse = () => {
    setViewMode("browse")
    setSelectedTool(null)
  }

  const mcpNameMask = (name: string, maxLength: number = 18) => {
    return name.length > maxLength ? `${name.slice(0, maxLength)}...` : name
  }

  // Left sidebar list
  const IntegrationList = useMemo(() => {
    return (
      <div className="tool-edit-list integration-list">
        <div className="integration-list-header">
          <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-weak)' }}>
            {t("tools.marketplace.available") || "Available"} ({toolList.length})
          </span>
        </div>
        {toolList.slice(0, 30).map((tool, index) => (
          <Tooltip
            key={tool.id}
            content={tool.description || tool.name}
            side="right"
          >
            <div
              className={`tool-edit-list-item ${selectedTool?.id === tool.id ? "active" : ""} ${tool.isInstalled ? "installed" : ""}`}
              onClick={() => {
                if (!tool.isInstalled) {
                  handleAddClick(tool)
                }
              }}
              style={{
                cursor: tool.isInstalled ? 'not-allowed' : 'pointer',
                opacity: tool.isInstalled ? 0.6 : 1
              }}
            >
              <div className="tool-edit-list-item-content">
                <div className="left">
                  <label>{mcpNameMask(tool.name, 16)}</label>
                </div>
                <div className="right">
                  {tool.isInstalled && (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                      <circle cx="8" cy="8" r="7" fill="var(--bg-pri-green)" />
                      <path d="M5 8l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  )}
                </div>
              </div>
            </div>
          </Tooltip>
        ))}
      </div>
    )
  }, [toolList, selectedTool, handleAddClick, t])

  // Right content area
  const ContentArea = useMemo(() => {
    if (viewMode === "installing" && selectedTool) {
      // Installation progress view
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
                  background: 'linear-gradient(135deg, var(--bg-pri-blue) 0%, var(--bg-hover-blue) 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '48px',
                  fontWeight: '700',
                  borderRadius: '16px',
                  margin: '0 auto 24px'
                }}>
                  {selectedTool.name.substring(0, 2).toUpperCase()}
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
                  color: 'var(--text-pri-blue)'
                }}>
                  {installProgress}%
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }
    
    if (viewMode === "configure" && selectedTool) {
      // Configuration view
      return (
        <div className="tool-edit-popup-content">
          <div className="tool-edit-header">
            <span>{t("tools.marketplace.configure") || "Configure Integration"}</span>
          </div>
          
          <div className="tool-edit-content">
            <div className="tool-edit-field">
              <div className="field-content">
                <div className="oap-edit-notice">
                  {t("tools.oap.edit_managed_notice") || "This integration is managed by OAP Platform. Configure the required settings below."}
                </div>
                
                <div className="field-item">
                  <label>
                    {t("tools.namePlaceholder") || "Name"}
                    <span className="required"> *</span>
                  </label>
                  <input
                    type="text"
                    value={instanceName}
                    onChange={(e) => setInstanceName(e.target.value)}
                    placeholder={t("tools.namePlaceholder")}
                  />
                </div>
                
                <div className="field-item">
                  <label>{t("tools.packageInfo") || "Package"}</label>
                  <div className="field-item-package-info">
                    <div className="package-name">{selectedTool.name}</div>
                    {selectedTool.version && (
                      <div className="package-version">v{selectedTool.version}</div>
                    )}
                  </div>
                </div>
                
                {selectedTool.description && (
                  <div className="field-item">
                    <label>{t("tools.description") || "Description"}</label>
                    <div className="field-item-description">
                      {selectedTool.description}
                    </div>
                  </div>
                )}
                
                {selectedTool.configSchema && (
                  <SchemaForm
                    schema={selectedTool.configSchema}
                    config={configData}
                    onChange={setConfigData}
                    disabled={isSubmitting}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Browse view
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
                          background: 'linear-gradient(135deg, var(--bg-pri-blue) 0%, var(--bg-hover-blue) 100%)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: '28px',
                          fontWeight: '700',
                          position: 'relative'
                        }}>
                          {tool.name.substring(0, 2).toUpperCase()}
                          {tool.isInstalled && (
                            <div style={{
                              position: 'absolute',
                              top: '8px',
                              right: '8px',
                              width: '24px',
                              height: '24px',
                              borderRadius: '50%',
                              background: 'var(--bg-pri-green)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                <path d="M3 8l3 3 7-7" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </div>
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
                            <Button
                              onClick={() => handleAddClick(tool)}
                              disabled={tool.isAdding || tool.isInstalled}
                              color={tool.isInstalled ? "white" : "blue"}
                              size="fit"
                            >
                              {tool.isAdding 
                                ? (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <div className="loading-spinner" style={{ width: '14px', height: '14px', borderWidth: '2px' }}></div>
                                    {t("tools.marketplace.adding") || "Adding..."}
                                  </span>
                                )
                                : tool.isInstalled
                                ? (
                                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                                    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                                      <path d="M3 8l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                    </svg>
                                    {t("tools.marketplace.installed") || "Installed"}
                                  </span>
                                )
                                : (t("tools.marketplace.addButton") || "Add Integration")
                              }
                            </Button>
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
  }, [viewMode, selectedTool, instanceName, configData, isSubmitting, searchText, toolList, hasNextPage, t, handleLoadNextPage, handleAddClick, installProgress, installStatus])

  return (
    <PopupConfirm
      overlay
      className={`tool-edit-popup-container marketplace ${viewMode !== "browse" ? "single-column" : ""}`}
      onConfirm={viewMode === "configure" ? handleConfigSubmit : undefined}
      onCancel={viewMode === "configure" ? handleBackToBrowse : (viewMode === "installing" ? undefined : onClose)}
      disabled={isSubmitting || viewMode === "browse" || viewMode === "installing"}
      zIndex={1000}
      listenHotkey={false}
      confirmText={
        viewMode === "configure" 
          ? (isSubmitting ? <div className="loading-spinner"></div> : (t("tools.marketplace.addButton") || "Add Integration"))
          : viewMode === "installing"
          ? undefined
          : (t("tools.save") || "Close")
      }
      cancelText={
        viewMode === "configure" 
          ? (t("tools.cancel") || "Back") 
          : viewMode === "installing"
          ? undefined
          : undefined
      }
      footerType={viewMode === "browse" || viewMode === "installing" ? "right" : undefined}
    >
      <div className="tool-edit-popup-header">
        <Button className="header-close" size="round" border="none" onClick={onClose}>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" width="22" height="22">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5"></path>
          </svg>
        </Button>
        {t("tools.oap.marketplace") || "Browse Integrations"}
      </div>
      
      <div className="tool-edit-popup">
        {/* Only show list in browse mode */}
        {viewMode === "browse" && IntegrationList}
        {ContentArea}
      </div>
    </PopupConfirm>
  )
}

export default memo(IntegrationMarket)
