import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import Button from "./Button"
import "@/styles/components/_EmbeddedLogin.scss"
import { nativeFetch } from "../ipc/init"

interface EmbeddedLoginProps {
  onCancel: () => void
  onSuccess: (token: string) => void
}

const EmbeddedLogin: React.FC<EmbeddedLoginProps> = ({ onCancel, onSuccess }) => {
  const { t } = useTranslation()
  
  // Test accounts for quick selection
  const testAccounts = [
    { email: 'base@test.com', password: 'password123', plan: 'BASE', description: 'BASE 计划 - 基础功能' },
    { email: 'pro@test.com', password: 'password123', plan: 'PRO', description: 'PRO 计划 - 专业功能' },
    { email: 'enterprise@test.com', password: 'password123', plan: 'ENTERPRISE', description: 'ENTERPRISE 计划 - 全部功能' }
  ]
  
  // Default to enterprise test account for development
  const [formData, setFormData] = useState({
    email: 'enterprise@test.com',
    password: 'password123'
  })
  const [errors, setErrors] = useState<{ [key: string]: string }>({})
  const [isLoading, setIsLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {}
    
    if (!formData.email) {
      newErrors.email = '邮箱地址必填'
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = '邮箱格式不正确'
    }
    
    if (!formData.password) {
      newErrors.password = '密码必填'
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) return
    
    setIsLoading(true)
    
    try {
      // Use the exported nativeFetch to bypass the wrapped fetch that causes URL issues.
      const FULL_LOGIN_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}/api/auth/login`;

      const response = await nativeFetch(FULL_LOGIN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
        credentials: 'include'
      })
      
      const data = await response.json()
      
      if (data.success) {
        onSuccess(data.data.accessToken)
      } else {
        setErrors({ general: data.error || '登录失败' })
      }
    } catch (error) {
      console.error('Login error:', error)
      setErrors({ general: '网络错误，请检查NewmindHub服务是否运行' })
    } finally {
      setIsLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({
        ...prev,
        [name]: ''
      }))
    }
  }

  const handleAccountSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedAccount = testAccounts.find(acc => acc.email === e.target.value)
    if (selectedAccount) {
      setFormData({
        email: selectedAccount.email,
        password: selectedAccount.password
      })
      // Clear any existing errors
      setErrors({})
    }
  }

  return (
    <div className="embedded-login-overlay">
      <div className="embedded-login-modal">
        <div className="embedded-login-header">
          <h2>登录 NewmindHub</h2>
          <button className="close-button" onClick={onCancel}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="embedded-login-form">
          {/* Test account selection */}
          <div style={{ 
            padding: '12px', 
            backgroundColor: '#e8f4f8', 
            borderRadius: '6px',
            marginBottom: '15px',
            fontSize: '13px',
            color: '#0066cc',
            border: '1px solid #b3d9e6'
          }}>
            <strong>🔑 选择测试账号</strong><br/>
            <div style={{ marginTop: '8px' }}>
              <select 
                value={formData.email} 
                onChange={handleAccountSelect}
                style={{
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: '4px',
                  border: '1px solid #ccc',
                  fontSize: '12px',
                  backgroundColor: 'white'
                }}
              >
                {testAccounts.map(account => (
                  <option key={account.email} value={account.email}>
                    {account.email} - {account.description}
                  </option>
                ))}
              </select>
            </div>
            <div style={{fontSize: '11px', color: '#666', marginTop: '5px'}}>
              所有测试账号密码均为：password123
            </div>
          </div>
          
          {errors.general && (
            <div className="error-message general-error">
              {errors.general}
            </div>
          )}
          
          <div className="form-group">
            <label htmlFor="email">邮箱地址</label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              className={errors.email ? 'error' : ''}
              placeholder="请输入邮箱地址"
            />
            {errors.email && <span className="error-message">{errors.email}</span>}
          </div>
          
          <div className="form-group">
            <label htmlFor="password">密码</label>
            <div className="password-input-container">
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={errors.password ? 'error' : ''}
                placeholder="请输入密码"
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
            {errors.password && <span className="error-message">{errors.password}</span>}
          </div>
          
          <div className="form-actions">
            <Button
              type="button"
              color="gray"
              onClick={onCancel}
              disabled={isLoading}
            >
              取消
            </Button>
            <Button
              type="submit"
              color="blue"
              disabled={isLoading}
            >
              {isLoading ? '登录中...' : '登录'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EmbeddedLogin
