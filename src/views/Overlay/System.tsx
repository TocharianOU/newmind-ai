import { useAtom, useAtomValue } from "jotai"
import { useTranslation } from "react-i18next"
import Select from "../../components/Select"
import React, { useState } from "react"

import ThemeSwitch from "../../components/ThemeSwitch"
import Switch from "../../components/Switch"
import { disableDiveSystemPromptAtom, updateDisableDiveSystemPromptAtom } from "../../atoms/configState"
import "../../styles/overlay/_System.scss"

const System = () => {
  const { t, i18n } = useTranslation()
  const [language, setLanguage] = useState(i18n.language)
  const disableDiveSystemPrompt = useAtomValue(disableDiveSystemPromptAtom)
  const [, updateDisableDiveSystemPrompt] = useAtom(updateDisableDiveSystemPromptAtom)

  const languageOptions = [
    { label: t("system.languageDefault"), value: "default" },
    { label: "简体中文", value: "zh-CN" },
    { label: "English", value: "en" },
  ]

  const handleLanguageChange = async (value: string) => {
    setLanguage(value)
    await i18n.changeLanguage(value === "default" ? navigator.language : value)
  }

  const handleDefaultSystemPromptChange = async (value: boolean) => {
    await updateDisableDiveSystemPrompt({ value })
  }

  return (
    <div className="system-page">
      <div className="system-container">
        <div className="system-header">
          <div className="system-title-container">
            <div>{t("system.title")}</div>
          </div>
        </div>
        <div className="system-content">

          {/* theme */}
          <div className="system-list-section">
            <div className="system-list-content">
              <span className="system-list-name">{t("system.theme")}</span>
              <div className="system-list-switch-container">
                <ThemeSwitch />
              </div>
            </div>
            <span className="system-list-description">{t("system.themeDescription")}</span>
          </div>

          {/* language */}
          <div className="system-list-section">
            <div className="system-list-content">
              <span className="system-list-name">{t("system.language")}</span>
              <div className="system-list-switch-container">
                <Select
                  options={languageOptions}
                  value={language}
                  onSelect={(value) => handleLanguageChange(value)}
                  align="end"
                />
              </div>
            </div>
            <span className="system-list-description">{t("system.languageDescription")}</span>
          </div>

          {/* default System Prompt */}
          <div className="system-list-section">
            <div className="system-list-content">
              <span className="system-list-name">{t("system.defaultSystemPrompt")}</span>
              <div className="system-list-switch-container">
                <Switch
                  checked={!disableDiveSystemPrompt}
                  onChange={e => handleDefaultSystemPromptChange(!e.target.checked)}
                />
              </div>
            </div>
            <span className="system-list-description">{t("system.defaultSystemPromptDescription")}</span>
          </div>

        </div>
      </div>
    </div>
  )
}

export default React.memo(System)
