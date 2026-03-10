import React, { useState, useEffect } from "react"
import { useTranslation } from "react-i18next"
import "@/styles/pages/_Login.scss"
import { ENV_CONFIG } from "../config/env"
import { openOapLoginPage, oapLoginWithToken, oapGetOAuthConfig, oapLoginWithOAuth } from "../ipc/oap"
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
  const { t } = useTranslation()
  const [showEmbeddedLogin, setShowEmbeddedLogin] = useState(false)
  const [oauthConfig, setOAuthConfig] = useState<OAuthConfig | null>(null)

  // 获取OAuth配置
  useEffect(() => {
    const fetchOAuthConfig = async () => {
      try {
        const response = await oapGetOAuthConfig()
        if (response.status === "success" && response.data) {
          setOAuthConfig(response.data)
          console.log('OAuth config loaded:', response.data)
        }
      } catch (error) {
        console.error('Failed to fetch OAuth config:', error)
      }
    }
    
    fetchOAuthConfig()
  }, [])

  const handleEmbeddedLoginSuccess = async (token: string) => {
    try {
      console.log('🚀 Starting embedded login with token:', token.substring(0, 8) + '...')
      
      // Use the new oapLoginWithToken function to trigger the complete OAP login flow
      // This will call setOAPTokenToHost which triggers all the proper events and state updates
      await oapLoginWithToken(token)
      
      console.log('✅ OAP login flow initiated successfully')
      
      setShowEmbeddedLogin(false)
      
    } catch (error) {
      console.error('❌ Login integration error:', error)
      setShowEmbeddedLogin(false)
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
          <h1 className="main-title">{ENV_CONFIG.APP_NAME}</h1>
          <p className="subtitle">
            {t("login.subtitle")}
          </p>
        </div>

        <div className="options-container">
          <div className="option-card">
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