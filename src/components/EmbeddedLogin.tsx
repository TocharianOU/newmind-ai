import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import Button from "./Button"
import "@/styles/components/_EmbeddedLogin.scss"
import { nativeFetch } from "../ipc/init"
import CryptoJS from "crypto-js"

interface EmbeddedLoginProps {
  onCancel: () => void
  onSuccess: (token: string) => void
}

const EmbeddedLogin: React.FC<EmbeddedLoginProps> = ({ onCancel, onSuccess }) => {
  const { t } = useTranslation()

  const [formData, setFormData] = useState({
    email: '',
    password: ''
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

      // Encrypt password before sending
      const encryptionKey = 'newmind'
      const encryptedPassword = CryptoJS.AES.encrypt(formData.password, encryptionKey).toString()

      const response = await nativeFetch(FULL_LOGIN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: formData.email,
          password: encryptedPassword,
          encrypted: true // Flag to indicate password is encrypted
        }),
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

  const handleSSOLogin = (provider: string) => {
    // Get the API base URL from environment
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:23000'
    const ssoUrl = `${apiBaseUrl}/api/auth/sso/${provider}/start?appRedirect=dive`

    console.log('🔗 Opening SSO login from embedded modal:', ssoUrl)

    // Close the modal first
    onCancel()

    // Open SSO login in external browser
    if (window.ipcRenderer && window.ipcRenderer.invoke) {
      window.ipcRenderer.invoke('open-external-url', ssoUrl)
    } else {
      window.open(ssoUrl, '_blank')
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

          {/* SSO Login Options */}
          <div className="sso-section">
            <div className="sso-divider">
              <span>或使用</span>
            </div>

            <button
              type="button"
              className="sso-button google-button"
              onClick={() => handleSSOLogin('google')}
              disabled={isLoading}
            >
              <svg className="sso-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              使用 Google 登录
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EmbeddedLogin
