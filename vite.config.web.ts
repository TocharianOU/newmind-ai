import path from "node:path"
import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import jotaiDebugLabel from "jotai/babel/plugin-debug-label"
import jotaiReactRefresh from "jotai/babel/plugin-react-refresh"

// Web build config — no Electron plugin, no Tauri.
// The produced dist-web/ is served statically from AttackTraceHub at /app/*.
// All relative-path API calls (/api/chat, /api/tools, etc.) are resolved
// against the Hub's origin; Hub proxies them to the MCP Host internally.
export default defineConfig({
  base: "/app/",
  build: {
    outDir: "dist-web",
    target: "esnext",
    emptyOutDir: true,
  },
  define: {
    "import.meta.env.VITE_PLATFORM": JSON.stringify("web"),
    "import.meta.env.VITE_API_BASE_URL": JSON.stringify(""),
    "import.meta.env.VITE_APP_NAME": JSON.stringify(process.env.VITE_APP_NAME || "NewMind AI"),
    "import.meta.env.VITE_PLATFORM_NAME": JSON.stringify(process.env.VITE_PLATFORM_NAME || "NewMind AI Platform"),
  },
  resolve: {
    alias: {
      "@": path.join(__dirname, "src"),
      // Stub out all Tauri packages — they are not available in web mode.
      "@tauri-apps/api/core": path.join(__dirname, "src/stubs/tauri.ts"),
      "@tauri-apps/api/event": path.join(__dirname, "src/stubs/tauri.ts"),
      "@tauri-apps/api/path": path.join(__dirname, "src/stubs/tauri.ts"),
      "@tauri-apps/plugin-fs": path.join(__dirname, "src/stubs/tauri.ts"),
      "@tauri-apps/plugin-os": path.join(__dirname, "src/stubs/tauri.ts"),
      "@tauri-apps/plugin-http": path.join(__dirname, "src/stubs/tauri.ts"),
      "@tauri-apps/plugin-opener": path.join(__dirname, "src/stubs/tauri.ts"),
      "@tauri-apps/plugin-autostart": path.join(__dirname, "src/stubs/tauri.ts"),
      "@tauri-apps/plugin-updater": path.join(__dirname, "src/stubs/tauri.ts"),
      "@tauri-apps/plugin-clipboard-manager": path.join(__dirname, "src/stubs/tauri.ts"),
      "@codemirror/state": path.resolve(
        __dirname,
        "./node_modules/@codemirror/state/dist/index.js"
      ),
      "@codemirror/view": path.resolve(
        __dirname,
        "./node_modules/@codemirror/view/dist/index.js"
      ),
      "@codemirror/lint": path.resolve(
        __dirname,
        "./node_modules/@codemirror/lint/dist/index.js"
      ),
      "@codemirror/lang-json": path.resolve(
        __dirname,
        "./node_modules/@codemirror/lang-json/dist/index.js"
      ),
      "@codemirror/linter": path.resolve(
        __dirname,
        "./node_modules/@codemirror/linter/dist/index.js"
      ),
      "@codemirror/theme-one-dark": path.resolve(
        __dirname,
        "./node_modules/@codemirror/theme-one-dark/dist/index.js"
      ),
      "@codemirror/autocomplete": path.resolve(
        __dirname,
        "./node_modules/@codemirror/autocomplete/dist/index.js"
      ),
      "@codemirror/commands": path.resolve(
        __dirname,
        "./node_modules/@codemirror/commands/dist/index.js"
      ),
      "@codemirror/language": path.resolve(
        __dirname,
        "./node_modules/@codemirror/language/dist/index.js"
      ),
      "@codemirror/search": path.resolve(
        __dirname,
        "./node_modules/@codemirror/search/dist/index.js"
      ),
      "@uiw/react-codemirror": path.resolve(
        __dirname,
        "node_modules/@uiw/react-codemirror/esm/index.js",
      ),
      "@uiw/codemirror-extensions-basic-setup": path.resolve(
        __dirname,
        "node_modules/@uiw/codemirror-extensions-basic-setup/esm/index.js"
      ),
    },
  },
  plugins: [
    react({ babel: { plugins: [jotaiDebugLabel, jotaiReactRefresh] } }),
  ],
  server: {
    port: 5174,
    proxy: {
      // In dev, forward MCP Host API calls to a locally running Hub (which itself proxies to MCP Host).
      // Or point directly at MCP Host for quick local testing.
      "/api/chat": { target: "http://localhost:3000", changeOrigin: true },
      "/api/tools": { target: "http://localhost:3000", changeOrigin: true },
      "/api/config": { target: "http://localhost:3000", changeOrigin: true },
      "/api/memory": { target: "http://localhost:3000", changeOrigin: true },
      "/api/sync": { target: "http://localhost:3000", changeOrigin: true },
      "/api/plugins": { target: "http://localhost:3000", changeOrigin: true },
      "/api/auth": { target: "http://localhost:3000", changeOrigin: true },
      "/api/v1": { target: "http://localhost:3000", changeOrigin: true },
      "/v1/openai": { target: "http://localhost:3000", changeOrigin: true },
      "/model_verify": { target: "http://localhost:3000", changeOrigin: true },
    },
  },
})
