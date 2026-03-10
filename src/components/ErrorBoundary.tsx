import { Component, ReactNode } from "react"

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  message: string
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, message: "" }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error?.message ?? "Unknown error" }
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error("[ErrorBoundary] Uncaught render error:", error, info.componentStack)
  }

  handleReload = () => {
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          gap: 16,
          fontFamily: "sans-serif",
          color: "var(--text-pri, #e5e7eb)",
          background: "var(--bg-pri, #111827)",
        }}>
          <div style={{ fontSize: 40 }}>⚠</div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>Something went wrong</div>
          <div style={{ fontSize: 13, opacity: 0.6, maxWidth: 480, textAlign: "center" }}>
            {this.state.message}
          </div>
          <button
            onClick={this.handleReload}
            style={{
              marginTop: 8,
              padding: "8px 24px",
              borderRadius: 6,
              border: "none",
              background: "var(--bg-blue, #2563eb)",
              color: "#fff",
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
