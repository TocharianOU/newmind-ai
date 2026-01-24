import React, { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import "@/styles/pages/_Login.scss"
import { useAtomValue, useSetAtom } from "jotai"
import { useNavigate } from "react-router-dom"
import { isLoggedInOAPAtom, oapUserAtom } from "../atoms/oapState"
import { openOapLoginPage, oapGetMe, oapLogin, oapLoginWithToken, oapGetOAuthConfig, oapLoginWithOAuth } from "../ipc/oap"
import Button from "../components/Button"
import EmbeddedLogin from "../components/EmbeddedLogin"

interface OAuthProvider {
  name: string;
  displayName: string;
}

interface OAuthConfig {
  oauthEnabled: boolean;
  brandText: string;
  providers: OAuthProvider[];
}

const Login = () => {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const isLoggedInOAP = useAtomValue(isLoggedInOAPAtom)
  const setOapUser = useSetAtom(oapUserAtom)
  const [showEmbeddedLogin, setShowEmbeddedLogin] = useState(false)
  const [oauthConfig, setOAuthConfig] = useState<OAuthConfig | null>(null)

  useEffect(() => {
    if (isLoggedInOAP) {
      setIsInitialized(true)
    }
  }, [isLoggedInOAP])

  // 获取OAuth配置
  useEffect(() => {
    const fetchOAuthConfig = async () => {
      try {
        const response = await oapGetOAuthConfig()
        if (response.success && response.data) {
          setOAuthConfig(response.data)
          console.log('OAuth config loaded:', response.data)
        }
      } catch (error) {
        console.error('Failed to fetch OAuth config:', error)
      }
    }
    
    fetchOAuthConfig()
  }, [])

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

  const handleOAuthLogin = async (provider: string) => {
    console.log(`Starting OAuth login with ${provider}`)
    try {
      await oapLoginWithOAuth(provider)
    } catch (error) {
      console.error(`OAuth login failed for ${provider}:`, error)
    }
  }

  return (
    <>
      <div className="login-page-container">
        <div className="header">
          <h1 className="main-title">AttackTrace</h1>
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
            {/* 品牌文案 */}
            {oauthConfig?.brandText && (
              <div className="oauth-brand-badge">
                {oauthConfig.brandText}
              </div>
            )}
            
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
              
              {/* OAuth登录选项（动态显示） */}
              {oauthConfig?.oauthEnabled && oauthConfig.providers.length > 0 && (
                <>
                  <div className="oauth-divider">
                    <span>{t("login.orUse") || "或使用"}</span>
                  </div>
                  {oauthConfig.providers.map((provider) => (
                    <Button
                      key={provider.name}
                      color="gray"
                      size="full"
                      padding="n"
                      onClick={() => handleOAuthLogin(provider.name)}
                    >
                      {provider.displayName} {t("common.login") || "登录"}
                    </Button>
                  ))}
                </>
              )}
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