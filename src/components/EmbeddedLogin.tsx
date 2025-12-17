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

            <button
              type="button"
              className="sso-button azure-button"
              onClick={() => handleSSOLogin('azure')}
              disabled={isLoading}
            >
              <svg className="sso-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.05 16.45l-4.55.55 4.05 5c.2.25.55.4.9.4h5.35l-5.75-5.95z" fill="#0078D4" />
                <path d="M11.65 3L4.5 17.35l4.95-.55L16.2 3h-4.55z" fill="#00BCF2" />
              </svg>
              使用 Azure 登录
            </button>

            <button
              type="button"
              className="sso-button aws-button"
              onClick={() => handleSSOLogin('aws')}
              disabled={isLoading}
            >
              <svg className="sso-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M6.76 10.25c0 .33.03.63.09.91.06.28.15.58.3.87.05.09.07.18.07.26 0 .11-.07.22-.21.33l-.7.47c-.1.07-.2.1-.28.10-.11 0-.22-.05-.33-.16-.15-.16-.27-.33-.37-.52-.1-.19-.2-.4-.31-.64-.78.92-1.76 1.38-2.95 1.38-.84 0-1.51-.24-2-.72-.49-.48-.74-1.12-.74-1.92 0-.85.3-1.54.9-2.07.6-.53 1.4-.79 2.4-.79.33 0 .67.03 1.03.08.36.05.73.13 1.12.21v-.71c0-.74-.15-1.26-.46-1.55-.31-.29-.84-.44-1.58-.44-.34 0-.69.04-1.05.12-.36.08-.71.18-1.05.3-.16.06-.27.1-.34.11-.07.01-.12.02-.15.02-.13 0-.2-.09-.2-.28v-.44c0-.15.02-.26.06-.33.04-.07.12-.14.24-.21.34-.18.75-.33 1.23-.45.48-.12.99-.18 1.54-.18 1.18 0 2.04.27 2.59.8.54.53.81 1.35.81 2.44v3.21zm-4.07 1.53c.32 0 .65-.06 1-.18.35-.12.66-.33.93-.63.16-.19.28-.4.35-.64.07-.24.11-.52.11-.84v-.4c-.29-.06-.59-.11-.91-.15-.32-.04-.64-.06-.95-.06-.68 0-1.18.13-1.5.4-.32.27-.48.65-.48 1.15 0 .47.12.82.36 1.06.24.24.58.36 1.02.36.03 0 .05-.01.07-.01zm8.05 1.08c-.17 0-.28-.03-.36-.1-.08-.07-.15-.21-.21-.42l-2.33-7.66c-.06-.21-.09-.35-.09-.42 0-.17.08-.26.25-.26h1.03c.18 0 .3.03.37.1.08.07.14.21.2.42l1.67 6.58 1.55-6.58c.05-.21.11-.35.19-.42.08-.07.21-.1.38-.10h.84c.18 0 .3.03.38.10.08.07.15.21.19.42l1.57 6.66 1.72-6.66c.06-.21.13-.35.21-.42.08-.07.21-.10.37-.10h.98c.17 0 .26.08.26.26 0 .05-.01.11-.03.18-.02.07-.05.16-.09.29l-2.4 7.66c-.06.21-.13.35-.21.42-.08.07-.21.10-.36.10h-.91c-.18 0-.3-.03-.38-.10-.08-.07-.15-.22-.19-.42l-1.54-6.42-1.53 6.42c-.05.21-.11.35-.19.42-.08.07-.21.10-.38.10h-.91zm13.28.27c-.54 0-1.08-.06-1.61-.19-.53-.13-.94-.28-1.22-.45-.17-.1-.29-.21-.34-.32-.05-.11-.08-.23-.08-.35v-.46c0-.19.07-.28.21-.28.05 0 .11.01.16.03.05.02.13.05.23.09.31.14.65.25 1 .33.36.08.71.12 1.06.12.56 0 .99-.1 1.29-.29.3-.19.45-.47.45-.82 0-.24-.08-.45-.23-.61-.16-.16-.45-.31-.88-.45l-1.27-.4c-.64-.2-1.11-.5-1.42-.89-.31-.39-.46-.82-.46-1.29 0-.37.08-.7.24-1 .16-.3.38-.56.65-.77.27-.22.59-.38.95-.49.36-.11.75-.17 1.16-.17.23 0 .47.01.7.04.24.03.46.07.67.11.2.05.39.1.56.16.17.06.3.12.39.18.14.09.24.18.3.28.06.1.09.22.09.37v.43c0 .19-.07.29-.21.29-.08 0-.2-.04-.37-.13-.56-.26-1.19-.39-1.88-.39-.51 0-.91.09-1.19.26-.28.17-.42.43-.42.77 0 .24.08.45.25.62.17.17.48.33.93.47l1.24.39c.63.2 1.09.49 1.38.86.29.37.43.79.43 1.27 0 .38-.08.73-.24 1.04-.16.31-.39.58-.68.81-.29.23-.64.41-1.05.53-.41.12-.87.18-1.37.18z" fill="#FF9900" />
              </svg>
              使用 AWS 登录
            </button>

            <button
              type="button"
              className="sso-button wechatwork-button"
              onClick={() => handleSSOLogin('wechatwork')}
              disabled={isLoading}
            >
              <svg className="sso-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path d="M8.5 2C4.91 2 2 4.73 2 8.11c0 1.81.97 3.43 2.49 4.58-.17.6-.56 1.95-.6 2.11 0 0-.03.14.07.19.1.05.19 0 .19 0 .22-.03 2.03-1.32 2.32-1.55.49.11 1.01.17 1.53.17 3.59 0 6.5-2.73 6.5-6.11S12.09 2 8.5 2zm-2 7.75c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25zm4 0c-.69 0-1.25-.56-1.25-1.25s.56-1.25 1.25-1.25 1.25.56 1.25 1.25-.56 1.25-1.25 1.25z" fill="#1AAD19"/>
                <path d="M22 14.5c0-2.87-2.48-5.2-5.54-5.2-3.06 0-5.54 2.33-5.54 5.2s2.48 5.2 5.54 5.2c.44 0 .87-.05 1.3-.14.24.19 1.79 1.29 1.98 1.32 0 0 .08.04.16 0 .08-.04.06-.16.06-.16-.03-.14-.37-1.29-.51-1.8C20.79 17.42 22 16.07 22 14.5zm-7.29-.75c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm3.58 0c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" fill="#1AAD19"/>
              </svg>
              使用企业微信登录
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default EmbeddedLogin
