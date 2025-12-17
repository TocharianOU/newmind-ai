import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import "@/styles/pages/_Login.scss"
import { useAtomValue, useSetAtom } from "jotai"
import { useNavigate } from "react-router-dom"
import { isLoggedInOAPAtom, oapUserAtom } from "../atoms/oapState"
import { openOapLoginPage, oapGetMe, oapLogin, oapLoginWithToken } from "../ipc/oap"
import Button from "../components/Button"
import EmbeddedLogin from "../components/EmbeddedLogin"

const Login = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const isLoggedInOAP = useAtomValue(isLoggedInOAPAtom)
  const setOapUser = useSetAtom(oapUserAtom)
  const [showEmbeddedLogin, setShowEmbeddedLogin] = useState(false)

  useEffect(() => {
    if (isLoggedInOAP) {
      setIsInitialized(true)
    }
  }, [isLoggedInOAP])

  const setIsInitialized = (value: boolean) => {
    localStorage.setItem("isInitialized", value ? "true" : "false")
  }

  const handleEmbeddedLoginSuccess = async (token: string) => {
    try {
      console.log('🚀 Starting embedded login with token:', token.substring(0, 8) + '...')
      
      // Use the new oapLoginWithToken function to trigger the complete OAP login flow
      // This will call setOAPTokenToHost which triggers all the proper events and state updates
      await oapLoginWithToken(token)
      
      console.log('✅ OAP login flow initiated successfully')
      
      setShowEmbeddedLogin(false)
      setIsInitialized(true)
      
    } catch (error) {
      console.error('❌ Login integration error:', error)
      // Fallback: still close modal and continue
      setShowEmbeddedLogin(false)
      setIsInitialized(true)
    }
  }

  const handleRegisterClick = () => {
    // Open browser for registration (existing behavior)
    openOapLoginPage(true) // true for registration
  }

  const handleLoginClick = () => {
    console.log('Login button clicked - showing embedded modal')
    // Show embedded login modal
    setShowEmbeddedLogin(true)
  }

  const handleSSOLogin = (provider: string) => {
    // Get the API base URL from environment
    const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:23000'
    const ssoUrl = `${apiBaseUrl}/api/auth/sso/${provider}/start?appRedirect=dive`
    
    console.log('🔗 Opening SSO login:', ssoUrl)
    
    // Open SSO login in external browser (same as OAP login)
    if (window.ipcRenderer && window.ipcRenderer.invoke) {
      window.ipcRenderer.invoke('open-external-url', ssoUrl)
    } else {
      window.open(ssoUrl, '_blank')
    }
  }

  return (
    <>
      <div className="login-page-container">
        <div className="header">
          <h1 className="main-title">Start Your NewChat</h1>
          <p className="subtitle">
            {t("login.subtitle")}
          </p>
        </div>

        <div className="options-container">
          <div className="option-card">
            <h2 className="option-title">{t("login.title1")}</h2>
            <p className="option-description">
              {t("login.description1")}
            </p>
            <div className="button-container">
              <Button
                color="blue"
                size="fit"
                padding="xxl"
                onClick={() => {
                  navigate("/setup")
                  setIsInitialized(true)
                }}
              >{t("login.button1")}</Button>
            </div>
          </div>

          <div className="option-gap"></div>

          <div className="option-card">
            <h2 className="option-title">{t("login.title2")}</h2>
            <p className="option-description">
              {t("login.description2")}
            </p>
            <div className="button-container">
              <Button
                color="blue"
                size="full"
                padding="n"
                onClick={handleRegisterClick}
              >{t("login.button2")}</Button>
              <Button
                color="blue"
                size="full"
                padding="n"
                onClick={handleLoginClick}
              >{t("login.button3")}</Button>
              
              {/* SSO Login Options */}
              <div className="sso-divider">
                <span>or continue with</span>
              </div>
              
              <button
                className="sso-button google-button"
                onClick={() => handleSSOLogin('google')}
              >
                <svg className="sso-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                Continue with Google
              </button>
            </div>
          </div>
        </div>
        
        {/* Debug info */}
        <div style={{ 
          position: 'fixed', 
          bottom: '10px', 
          right: '10px', 
          background: 'rgba(0,0,0,0.7)', 
          color: 'white', 
          padding: '10px', 
          borderRadius: '4px',
          fontSize: '12px',
          zIndex: 999
        }}>
          Embedded Login: {showEmbeddedLogin ? 'SHOWN' : 'HIDDEN'}
        </div>
      </div>

      {showEmbeddedLogin && (
        <EmbeddedLogin
          onCancel={() => setShowEmbeddedLogin(false)}
          onSuccess={handleEmbeddedLoginSuccess}
        />
      )}
    </>
  )
}

export default React.memo(Login)