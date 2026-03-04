// @ts-nocheck
import React, { useEffect, useState, useMemo, useRef } from "react"
import { useTranslation } from "react-i18next"
import Select from "../../../../components/Select"
import Tooltip from "../../../../components/Tooltip"
import { 
  isKeychainReference, 
  parseKeychainReference, 
  generateKeychainReference,
  isKeychainAvailable
} from "../../../../ipc/keychain"

interface SchemaFormProps {
  schema: Record<string, any>
  config: [string, unknown, boolean][]
  onChange: (newConfig: [string, unknown, boolean][]) => void
  disabled?: boolean
}

interface OneOfGroupsProps {
  schema: Record<string, any>
  formData: Record<string, any>
  disabled?: boolean
  renderField: (key: string, fieldSchema: any) => React.ReactNode
  t: (key: string) => string
}

const OneOfGroups: React.FC<OneOfGroupsProps> = ({ schema, formData, disabled, renderField, t }) => {
  const [activeModeIndex, setActiveModeIndex] = useState(0)

  useEffect(() => {
    if (!schema.oneOf) return
    const currentOption = schema.oneOf[activeModeIndex]
    const currentModeHasValues = currentOption?.required?.some(
      (field: string) => formData[field] && formData[field] !== ""
    )
    if (currentModeHasValues) return

    const matchIndex = schema.oneOf.findIndex((option: any) => {
      if (!option.required) return false
      return option.required.every((field: string) => formData[field] && formData[field] !== "")
    })
    if (matchIndex !== -1 && matchIndex !== activeModeIndex) {
      setActiveModeIndex(matchIndex)
    }
  }, [formData, schema.oneOf, activeModeIndex])

  if (!schema.oneOf) return null

  const options = schema.oneOf.map((option: any, index: number) => ({
    label: option.title || `Option ${index + 1}`,
    value: index,
    option
  }))

  const activeOption = schema.oneOf[activeModeIndex]
  const activeFields = activeOption?.required || Object.keys(activeOption?.properties || {})

  return (
    <div className="schema-form-oneof-container">
      {options.length > 1 && (
        <div className="field-item mode-selector">
          <label>{t("tools.authMode") || "Authentication Mode"}</label>
          <Select
            options={options}
            value={activeModeIndex}
            onSelect={(val) => setActiveModeIndex(val as number)}
            disabled={disabled}
          />
        </div>
      )}

      {activeFields.map((fieldKey: string) => {
        const fieldSchema = schema.properties?.[fieldKey] || activeOption?.properties?.[fieldKey]
        if (fieldSchema) {
          return renderField(fieldKey, fieldSchema)
        }
        return null
      })}
    </div>
  )
}

const SchemaForm: React.FC<SchemaFormProps> = ({ schema, config, onChange, disabled }) => {
  const { t } = useTranslation()
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [keychainPasswordInputs, setKeychainPasswordInputs] = useState<Record<string, string>>({})
  const [keychainAvailable, setKeychainAvailable] = useState(false)
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // Check if keychain is available
  useEffect(() => {
    isKeychainAvailable().then(setKeychainAvailable)
  }, [])

  // Initialize form data from config array
  useEffect(() => {
    const initialData: Record<string, any> = {}
    config.forEach(([key, value]) => {
      initialData[key] = value
    })
    setFormData(prev => {
      const isEqual = Object.keys(prev).length === Object.keys(initialData).length &&
        Object.keys(initialData).every(k => prev[k] === initialData[k])
      return isEqual ? prev : initialData
    })
  }, [config])

  // Auto-generate keychain references for empty/plain-text sensitive fields when keychain is available
  useEffect(() => {
    if (!keychainAvailable) return

    const properties = schema.properties || {}
    const updates: Record<string, string> = {}

    Object.entries(properties).forEach(([key, fieldSchema]: [string, any]) => {
      const isSensitive =
        fieldSchema?.format === "password" ||
        key.includes("KEY") || key.includes("PASSWORD") || key.includes("SECRET")
      if (!isSensitive) return

      const currentValue = formData[key]
      if (!currentValue || !isKeychainReference(String(currentValue))) {
        updates[key] = generateKeychainReference(`attacktrace-${key.toLowerCase()}`, "default")
      }
    })

    if (Object.keys(updates).length === 0) return

    const newFormData = { ...formData, ...updates }
    setFormData(newFormData)

    const mergedConfig: [string, unknown, boolean][] = config.map(([k, v, err]) => [
      k, updates[k] !== undefined ? updates[k] : v, err
    ])
    onChange(mergedConfig)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keychainAvailable])

  // Handle field change
  const handleChange = (key: string, value: any) => {
    const newData = { ...formData, [key]: value }
    setFormData(newData)

    // Convert back to [key, value, error] format
    const newConfig: [string, unknown, boolean][] = Object.entries(newData).map(([k, v]) => [k, v, false])
    
    // Merge with existing config to preserve keys not in schema (if any) or existing errors
    const mergedConfig = [...config]
    
    // Update existing keys
    Object.entries(newData).forEach(([k, v]) => {
      const index = mergedConfig.findIndex(([existingKey]) => existingKey === k)
      if (index >= 0) {
        mergedConfig[index][1] = v
      } else {
        mergedConfig.push([k, v, false])
      }
    })

    // Remove keys that are null/undefined if needed, or handle removal logic
    // For now, we keep all keys generated by the form

    onChange(mergedConfig)
  }

  // Determine which fields to show based on oneOf/dependencies
  const visibleFields = useMemo(() => {
    const fields = new Set<string>(Object.keys(schema.properties || {}))
    
    // Handle conditional field visibility based on TLS mode selections
    const tlsModeValue = formData['tlsMode']
    if (tlsModeValue !== 'ca-cert') {
      fields.delete('ES_CA_CERT')
      fields.delete('KIBANA_CA_CERT')
    }
    
    // Legacy support for NODE_TLS_REJECT_UNAUTHORIZED / tlsVerification
    if (schema.dependencies?.NODE_TLS_REJECT_UNAUTHORIZED) {
      const tlsValue = formData['NODE_TLS_REJECT_UNAUTHORIZED']
      if (tlsValue !== 'ca-cert') {
        fields.delete('ES_CA_CERT')
        fields.delete('KIBANA_CA_CERT')
      }
    }
    if (schema.dependencies?.tlsVerification) {
      const tlsValue = formData['tlsVerification']
      if (tlsValue !== 'ca-cert') {
        fields.delete('ES_CA_CERT')
        fields.delete('KIBANA_CA_CERT')
      }
    }

    // Generic: hide fields required only by inactive branches of schema.dependencies
    // e.g. keyMode='hub' hides VIRUSTOTAL_API_KEY (required only in byok branch)
    if (schema.dependencies) {
      for (const [depField, depSchema] of Object.entries(schema.dependencies as any)) {
        if (!depSchema?.oneOf) continue
        // Resolve current value, falling back to the field's declared default
        const rawVal = formData[depField]
        const depValue = (rawVal !== undefined && rawVal !== '')
          ? rawVal
          : schema.properties?.[depField]?.default
        if (depValue === undefined) continue
        for (const branch of depSchema.oneOf) {
          const branchEnum = branch.properties?.[depField]?.enum
          if (!branchEnum) continue
          const isActive = branchEnum.includes(depValue)
          if (!isActive && branch.required) {
            branch.required.forEach((f: string) => fields.delete(f))
          }
        }
      }
    }

    return Array.from(fields)
  }, [schema, formData])

  const renderField = (key: string, fieldSchema: any) => {
    const value = formData[key] ?? fieldSchema.default ?? ""
    const isRequired = schema.required?.includes(key)
    const title = fieldSchema.title || key
    const description = fieldSchema.description
    
    // Secret/Password field — always use keychain when available
    if (fieldSchema.format === "password" || key.includes("KEY") || key.includes("PASSWORD") || key.includes("SECRET")) {
      const parsedKeychain = isKeychainReference(value) ? parseKeychainReference(value) : null
      const keychainService = parsedKeychain?.service ?? `attacktrace-${key.toLowerCase()}`
      const keychainAccount = parsedKeychain?.account ?? "default"

      return (
        <div key={key} className="field-item">
          <label>
            {title} {isRequired && <span className="required">*</span>}
            {description && (
              <Tooltip content={description}>
                <span className="info-icon">ⓘ</span>
              </Tooltip>
            )}
          </label>

          {keychainAvailable ? (
            <input
              id={`keychain-password-${key}`}
              type="password"
              value={keychainPasswordInputs[key] || ""}
              onChange={(e) => setKeychainPasswordInputs(prev => ({ ...prev, [key]: e.target.value }))}
              placeholder={t("tools.keychain.enterPassword") || "Enter password"}
              disabled={disabled}
              className="schema-form-input"
              data-keychain-service={keychainService}
              data-keychain-account={keychainAccount}
            />
          ) : (
            <input
              type="password"
              value={value || ""}
              onChange={(e) => handleChange(key, e.target.value)}
              disabled={disabled}
              placeholder={fieldSchema.placeholder || t("tools.enterValue")}
              className="schema-form-input"
            />
          )}
        </div>
      )
    }

    // File field (format: "file")
    if (fieldSchema.format === "file") {
      const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
          // Try to get file.path (Electron feature)
          const filePath = (file as any).path || file.name
          if (filePath) {
            handleChange(key, filePath)
          }
        }
        // Reset input to allow selecting the same file again
        if (fileInputRefs.current[key]) {
          fileInputRefs.current[key]!.value = ""
        }
      }

      const handleBrowseClick = () => {
        fileInputRefs.current[key]?.click()
      }

      return (
        <div key={key} className="field-item">
          <label>
            {title} {isRequired && <span className="required">*</span>}
            {description && (
              <Tooltip content={description}>
                <span className="info-icon">ⓘ</span>
              </Tooltip>
            )}
          </label>
          <div className="schema-form-file-path">
            <input
              type="text"
              value={value || ""}
              onChange={(e) => handleChange(key, e.target.value)}
              disabled={disabled}
              placeholder={fieldSchema.placeholder || "选择文件..."}
              className="schema-form-input"
              readOnly={false}
            />
            <input
              ref={(el) => { fileInputRefs.current[key] = el }}
              type="file"
              style={{ display: "none" }}
              onChange={handleFileSelect}
              disabled={disabled}
            />
            <button
              type="button"
              className="schema-form-browse-btn"
              onClick={handleBrowseClick}
              disabled={disabled}
            >
              选择文件
            </button>
          </div>
        </div>
      )
    }

    // Boolean/Switch
    if (fieldSchema.type === "boolean") {
      // Convert various boolean representations to actual boolean
      const isChecked = value === true || value === "true" || value === 1 || value === "1"
      
      // Special handling for NODE_TLS_REJECT_UNAUTHORIZED - use Select instead of Switch
      if (key === "NODE_TLS_REJECT_UNAUTHORIZED") {
        return (
          <div key={key} className="field-item">
            <label>
              {title}
              {description && (
                <Tooltip content={description}>
                  <span className="info-icon">ⓘ</span>
                </Tooltip>
              )}
            </label>
            <Select
              options={[
                { label: t("tools.tls.verify"), value: "1" },
                { label: t("tools.tls.skip"), value: "0" }
              ]}
              value={isChecked ? "1" : "0"}
              onSelect={(val) => handleChange(key, val === "1")}
              disabled={disabled}
              placeholder={t("tools.selectValue")}
            />
          </div>
        )
      }
      
      return (
        <div key={key} className="field-item">
          <label>
            {title}
            {description && (
              <Tooltip content={description}>
                <span className="info-icon">ⓘ</span>
              </Tooltip>
            )}
          </label>
          <div className="schema-form-switch">
            <Switch
              checked={isChecked}
              onChange={(e) => handleChange(key, e.target.checked)}
              disabled={disabled}
            />
          </div>
        </div>
      )
    }

    // Select/Enum
    if (fieldSchema.enum) {
        // Use custom enumLabels if provided, otherwise use default i18n labels
        const getEnumLabel = (opt: string, idx: number): string => {
          // enumLabels: object map { value: label }
          if (fieldSchema.enumLabels && fieldSchema.enumLabels[opt]) {
            return fieldSchema.enumLabels[opt]
          }
          // enumNames: array aligned with enum values (JSON Schema extension)
          if (fieldSchema.enumNames && fieldSchema.enumNames[idx]) {
            return fieldSchema.enumNames[idx]
          }
          
          // Fallback to i18n for common cases
          const defaultLabels: Record<string, string> = {
            '0': t('tools.tls.skip') || 'Skip Verification (Insecure)',
            '1': t('tools.tls.verify') || 'Default Verification',
            'skip': t('tools.tls.skip') || 'Skip Verification (Insecure)',
            'default': t('tools.tls.verify') || 'Default Verification',
            'ca-cert': t('tools.tls.caCert') || 'Custom CA Certificate'
          }
          
          return defaultLabels[opt] || opt
        }
        
        return (
            <div key={key} className="field-item">
                <label>
                    {title} {isRequired && <span className="required">*</span>}
                    {description && (
                        <Tooltip content={description}>
                            <span className="info-icon">ⓘ</span>
                        </Tooltip>
                    )}
                </label>
                <Select
                    options={fieldSchema.enum.map((opt: string, idx: number) => ({ 
                        label: getEnumLabel(opt, idx), 
                        value: opt 
                    }))}
                    value={value}
                    onSelect={(val) => handleChange(key, val)}
                    disabled={disabled}
                    placeholder={fieldSchema.placeholder || t("tools.selectValue")}
                />
            </div>
        )
    }

    // Default String/Number Input
    return (
      <div key={key} className="field-item">
        <label>
          {title} {isRequired && <span className="required">*</span>}
          {description && (
            <Tooltip content={description}>
              <span className="info-icon">ⓘ</span>
            </Tooltip>
          )}
        </label>
        <input
          type={fieldSchema.type === "number" ? "number" : "text"}
          value={value}
          onChange={(e) => handleChange(key, fieldSchema.type === "number" ? Number(e.target.value) : e.target.value)}
          disabled={disabled}
          placeholder={fieldSchema.placeholder || t("tools.enterValue")}
          className="schema-form-input"
        />
      </div>
    )
  }

  return (
    <div className="schema-form-container">
      {/* Render common fields (those not in oneOf groups or explicitly common) */}
      {visibleFields.map(key => {
        const inOneOf = schema.oneOf?.some((opt: any) => opt.required?.includes(key) || opt.properties?.[key])
        if (inOneOf) return null
        return renderField(key, schema.properties[key])
      })}

      {/* Render mutually exclusive fields */}
      {schema.oneOf && (
        <OneOfGroups
          schema={schema}
          formData={formData}
          disabled={disabled}
          renderField={renderField}
          t={t}
        />
      )}
    </div>
  )
}

/**
 * Collect and save all keychain passwords from the form
 * This should be called before saving the configuration
 */
export async function saveAllKeychainPasswords(): Promise<{ success: boolean; errors: string[]; savedCount: number }> {
  const errors: string[] = []
  let savedCount = 0
  
  // Find all keychain password inputs
  const keychainInputs = document.querySelectorAll('input[data-keychain-service][data-keychain-account]')
  
  for (const input of keychainInputs) {
    const passwordInput = input as HTMLInputElement
    const service = passwordInput.getAttribute('data-keychain-service')
    const account = passwordInput.getAttribute('data-keychain-account')
    const password = passwordInput.value
    
    if (!service || !account) continue
    
    // Skip if password is empty (means user didn't fill it, keep existing keychain value)
    if (!password || password.trim() === '') {
      console.log(`[Keychain] Skipping empty password for ${service}:${account}`)
      continue
    }
    
    try {
      const { setPassword } = await import('../../../../ipc/keychain')
      const result = await setPassword(service, account, password)
      
      if (result.success) {
        console.log(`[Keychain] Saved password for ${service}:${account}`)
        savedCount++
        // Clear the input for security
        passwordInput.value = ''
      } else {
        const error = `Failed to save ${service}:${account}: ${result.error}`
        console.error(`[Keychain] ${error}`)
        errors.push(error)
      }
    } catch (error) {
      const errorMsg = `Failed to save ${service}:${account}: ${error}`
      console.error(`[Keychain] ${errorMsg}`)
      errors.push(errorMsg)
    }
  }
  
  return {
    success: errors.length === 0,
    errors,
    savedCount
  }
}

export default SchemaForm
