import React, { useState, useCallback } from "react"
import type { A2UIField, A2UISchema, A2UIFormData } from "../types/a2ui"
import "../styles/a2ui.scss"

interface A2UIRendererProps {
  schema: A2UISchema
  onSubmit: (data: A2UIFormData) => void
  onCancel: () => void
}

const A2UIRenderer: React.FC<A2UIRendererProps> = ({ schema, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<A2UIFormData>(() => {
    // Initialize form data with default values
    const initData: A2UIFormData = {}

    const initField = (field: A2UIField) => {
      if (field.type === 'section' && field.fields) {
        field.fields.forEach(initField)
      } else if (field.default !== undefined) {
        initData[field.id] = field.default
      } else if (field.type === 'checkbox') {
        initData[field.id] = false
      } else if (field.type === 'number') {
        initData[field.id] = field.min || 0
      } else {
        initData[field.id] = ''
      }
    }

    schema.fields.forEach(initField)
    return initData
  })

  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleFieldChange = useCallback((fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }))
    // Clear error when user starts typing
    if (errors[fieldId]) {
      setErrors(prev => {
        const newErrors = { ...prev }
        delete newErrors[fieldId]
        return newErrors
      })
    }
  }, [errors])

  // 检查字段是否可见（必须在 validateForm 之前定义）
  const isFieldVisible = useCallback((field: A2UIField): boolean => {
    if (!field.visibleWhen) return true

    const dependentValue = formData[field.visibleWhen.field]
    return dependentValue === field.visibleWhen.value
  }, [formData])

  const validateForm = useCallback((): boolean => {
    const newErrors: Record<string, string> = {}

    const validateField = (field: A2UIField) => {
      if (field.type === 'section' && field.fields) {
        field.fields.forEach(validateField)
        return
      }

      // 只验证可见的字段
      if (!isFieldVisible(field)) {
        return
      }

      if (field.required) {
        const value = formData[field.id]
        if (value === undefined || value === null || value === '') {
          newErrors[field.id] = `${field.label}是必填项`
        }
      }

      // Validate number fields
      if (field.type === 'number' && formData[field.id] !== '') {
        const value = Number(formData[field.id])
        if (isNaN(value)) {
          newErrors[field.id] = '请输入有效的数字'
        } else {
          if (field.min !== undefined && value < field.min) {
            newErrors[field.id] = `最小值为 ${field.min}`
          }
          if (field.max !== undefined && value > field.max) {
            newErrors[field.id] = `最大值为 ${field.max}`
          }
        }
      }
    }

    schema.fields.forEach(validateField)
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }, [formData, schema.fields, isFieldVisible])

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault()

    if (validateForm()) {
      if (schema.submitButton?.confirmMessage) {
        if (window.confirm(schema.submitButton.confirmMessage)) {
          onSubmit(formData)
        }
      } else {
        onSubmit(formData)
      }
    }
  }, [formData, validateForm, schema.submitButton, onSubmit])

  const renderField = (field: A2UIField): React.ReactNode => {
    // 检查字段是否应该显示（对所有类型都适用）
    if (!isFieldVisible(field)) {
      return null
    }

    const error = errors[field.id]
    const value = formData[field.id]

    if (field.type === 'section') {
      return (
        <div key={field.id} className="a2ui-section">
          <h3 className="a2ui-section-label">{field.label}</h3>
          <div className="a2ui-section-fields">
            {field.fields?.map(renderField)}
          </div>
        </div>
      )
    }

    return (
      <div key={field.id} className={`a2ui-field ${error ? 'a2ui-field-error' : ''}`}>
        <label htmlFor={field.id} className="a2ui-label">
          {field.label}
          {field.required && <span className="a2ui-required">*</span>}
        </label>

        {field.type === 'text' && (
          <input
            id={field.id}
            type="text"
            className="a2ui-input"
            value={value || ''}
            placeholder={field.placeholder}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
          />
        )}

        {field.type === 'number' && (
          <input
            id={field.id}
            type="number"
            className="a2ui-input"
            value={value || ''}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            step={field.step}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
          />
        )}

        {field.type === 'textarea' && (
          <textarea
            id={field.id}
            className="a2ui-textarea"
            value={value || ''}
            placeholder={field.placeholder}
            rows={4}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
          />
        )}

        {field.type === 'select' && (
          <select
            id={field.id}
            className="a2ui-select"
            value={value || ''}
            onChange={(e) => handleFieldChange(field.id, e.target.value)}
          >
            <option value="">请选择...</option>
            {field.options?.map(opt => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {field.type === 'checkbox' && (
          <label className="a2ui-checkbox-label">
            <input
              id={field.id}
              type="checkbox"
              className="a2ui-checkbox"
              checked={!!value}
              onChange={(e) => handleFieldChange(field.id, e.target.checked)}
            />
            <span className="a2ui-checkbox-text">{field.helpText || field.label}</span>
          </label>
        )}

        {field.type === 'radio' && (
          <div className="a2ui-radio-group">
            {field.options?.map(opt => (
              <label key={opt.value} className="a2ui-radio-label">
                <input
                  type="radio"
                  name={field.id}
                  className="a2ui-radio"
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={(e) => handleFieldChange(field.id, e.target.value)}
                />
                <span className="a2ui-radio-text">{opt.label}</span>
              </label>
            ))}
          </div>
        )}

        {field.helpText && field.type !== 'checkbox' && (
          <div className="a2ui-help-text">{field.helpText}</div>
        )}

        {error && (
          <div className="a2ui-error-text">{error}</div>
        )}
      </div>
    )
  }

  return (
    <form className="a2ui-form" onSubmit={handleSubmit}>
      <div className="a2ui-form-header">
        <h2 className="a2ui-form-title">{schema.title}</h2>
        {schema.description && (
          <p className="a2ui-form-description">{schema.description}</p>
        )}
      </div>

      <div className="a2ui-form-body">
        {schema.fields.map(renderField)}
      </div>

      <div className="a2ui-form-footer">
        <button
          type="button"
          className="a2ui-button a2ui-button-cancel"
          onClick={onCancel}
        >
          取消
        </button>
        <button
          type="submit"
          className="a2ui-button a2ui-button-submit"
        >
          {schema.submitButton?.label || '提交'}
        </button>
      </div>
    </form>
  )
}

export default A2UIRenderer

