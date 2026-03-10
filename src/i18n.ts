import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import LanguageDetector from "i18next-browser-languagedetector"

import en from "./locales/en/translation.json"
import zhCN from "./locales/zh-CN/translation.json"
import { ENV_CONFIG } from "./config/env"

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: {
        translation: en
      },
      "zh-CN": {
        translation: zhCN
      }
    },
    fallbackLng: "en",
    supportedLngs: ["zh-CN", "en"],
    interpolation: {
      escapeValue: false,
      // Branding variables available in every translation string
      defaultVariables: {
        appName:      ENV_CONFIG.APP_NAME,
        platformName: ENV_CONFIG.PLATFORM_NAME,
      },
    }
  })

export default i18n
