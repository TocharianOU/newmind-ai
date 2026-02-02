import { atom } from "jotai"
import { apiFetch } from "@/utils/api"

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
    const response = await apiFetch("/api/tools")
    const data = await response.json()
    const mcpserverResponse = await apiFetch("/api/config/mcpserver")
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
  }
)

export const mcpConfigAtom = atom<{mcpServers: MCPConfig}>({mcpServers: {}})

export const loadMcpConfigAtom = atom(
  null,
  async (get, set) => {
    const response = await apiFetch("/api/config/mcpserver")
    const data = await response.json()
    if (data.success) {
      set(mcpConfigAtom, data.config)
    } else {
      set(mcpConfigAtom, {mcpServers: {}})
    }

    return data
  }
)

export const installToolBufferAtom = atom<{name: string, config: Record<string, MCP>}[]>([])
