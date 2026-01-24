import React from "react"

interface HtmlPreviewProps {
  html: string
}

const HtmlPreview: React.FC<HtmlPreviewProps> = ({ html }) => {
  return (
    <iframe
      className="html-preview"
      sandbox="allow-scripts allow-same-origin allow-forms"
      title="HTML Preview"
      srcDoc={html}
    />
  )
}

export default React.memo(HtmlPreview)