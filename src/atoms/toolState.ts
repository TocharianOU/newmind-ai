import { atom } from "jotai"
import { apiFetch } from "@/utils/api"

// Helper for retrying fetches (useful when backend is reloading)
const fetchWithRetry = async (url: string, options: any, retries = 5, delay = 500) => {
  let lastError;
  for (let i = 0; i < retries; i++) {
    try {
      const res = await apiFetch(url, options);
      if (res.ok) return res;
      // Retry on server errors
      if (res.status >= 500) {
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return res;
    } catch (e) {
      console.warn(`Fetch failed for ${url} (attempt ${i + 1}/${retries}):`, e);
      lastError = e;
      await new Promise(r => setTimeout(r, delay));
    }
  }
  throw lastError;
}

export interface MCP {
  type: "oap" | "custom"
  plan?: string
  description: string
  icon?: string
  disabled?: boolean
  enabled?: boolean
  error?: string
  env?: Record<string, unknown>
  version?: string
  configSchema?: Record<string, any>
}

export interface MCPConfig {
  [key: string]: MCP
}

export interface SubTool {
  name: string
  description?: string
  enabled: boolean
}

export interface Tool {
  name: string
  oapId?: string
  type?: "oap" | "custom"
  description?: string
  icon?: string
  tools?: SubTool[]
  error?: string
  enabled: boolean
  disabled?: boolean
  status?: "failed" | "running"
}

export const toolsAtom = atom<Tool[]>([])

export const enabledToolsAtom = atom<Tool[]>(
  (get) => {
    const tools = get(toolsAtom)
    return tools.filter((tool) => tool.enabled)
  }
)

export const successToolsAtom = atom<Tool[]>(
  (get) => {
    const tools = get(toolsAtom)
    return tools.filter((tool) => tool.enabled && !tool.error)
  }
)

export const loadToolsAtom = atom(
  null,
  async (get, set) => {
    // Add cache buster to force fresh data
    const cacheBuster = `?_t=${Date.now()}`
    
    try {
      const response = await fetchWithRetry(`/api/tools${cacheBuster}`, {
        cache: 'no-cache'
      })
      const data = await response.json()
      
      const mcpserverResponse = await fetchWithRetry(`/api/config/mcpserver${cacheBuster}`, {
        cache: 'no-cache'
      })
      const mcpserverData = await mcpserverResponse.json()
      
      if (data.success) {
        let tools = data.tools
        if (mcpserverData.success) {
          tools = tools.filter((tool: Tool) => {
            const mcpserver = Object.keys(mcpserverData.config.mcpServers).find((mcpServer: string) => mcpServer === tool.name)
            return mcpserver ? tool : null
          })
        }
        
        // Deduplicate tools by name (case-insensitive)
        const seenNames = new Map<string, Tool>();
        const deduplicatedTools = tools.filter((tool: Tool) => {
          const lowerName = tool.name.toLowerCase();
          if (!seenNames.has(lowerName)) {
            seenNames.set(lowerName, tool);
            return true;
          }
          // If duplicate, log it for debugging
          console.warn(`Duplicate tool found and removed: ${tool.name}`);
          return false;
        });
        
        set(toolsAtom, deduplicatedTools)
      }

      return data
    } catch (error) {
      console.error("Failed to load tools:", error);
      // Return a safe default instead of crashing
      return { success: false, tools: [], error: String(error) };
    }
  }
)

export const mcpConfigAtom = atom<{mcpServers: MCPConfig}>({mcpServers: {}})

export const loadMcpConfigAtom = atom(
  null,
  async (get, set) => {
    // Add cache buster to force fresh data
    const cacheBuster = `?_t=${Date.now()}`
    
    try {
      const response = await fetchWithRetry(`/api/config/mcpserver${cacheBuster}`, {
        cache: 'no-cache'
      })
      const data = await response.json()
      if (data.success) {
        set(mcpConfigAtom, data.config)
      } else {
        set(mcpConfigAtom, {mcpServers: {}})
      }

      return data
    } catch (error) {
      console.error("Failed to load MCP config:", error);
      set(mcpConfigAtom, {mcpServers: {}})
      return { success: false, config: {mcpServers: {}}, error: String(error) };
    }
  }
)

export const installToolBufferAtom = atom<{name: string, config: Record<string, MCP>}[]>([])
