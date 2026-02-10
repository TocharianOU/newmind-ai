import React from "react"
import { version } from "../../../package.json"
import { useTranslation } from "react-i18next"
import { imgPrefix } from "../../ipc"
import "../../styles/overlay/_About.scss"

const About = () => {
  const { t } = useTranslation()
  
  return (
    <div className="about-container">
      <div className="about-content">
        <div className="about-header">
          <img src={`${imgPrefix}logo_oap.png`} alt="App Logo" className="about-logo" />
          <h1 className="about-title">AttackTrace Agent</h1>
          <p className="about-version">Version {version}</p>
        </div>

        <div className="about-section">
          <h2>{t("about.description") || "Description"}</h2>
          <p>{t("about.descriptionText") || "A powerful AI-powered development assistant with MCP integration."}</p>
        </div>

        <div className="about-section">
          <h2>{t("about.credits") || "Credits"}</h2>
          <p>{t("about.creditsText") || "Built with Electron, React, and TypeScript."}</p>
        </div>

        <div className="about-footer">
          <p className="about-copyright">© 2024 AttackTrace. All rights reserved.</p>
        </div>
      </div>
    </div>
  )
}

export default React.memo(About)
