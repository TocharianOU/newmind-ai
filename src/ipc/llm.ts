import { ModelProvider } from "../../types/model"
import { ModelResults } from "../vite-env"
import { getWebToken } from "./oap"

/**
 * In web mode, fetch available models directly from the Hub's OpenAI-compatible
 * /api/v1/models endpoint. This returns the Hub-managed model list (e.g.
 * medium-agent, strong-agent) scoped to the current user's plan.
 */
async function fetchWebModels(): Promise<ModelResults & { displayNames?: Record<string, string> }> {
  try {
    const token = getWebToken()
    const headers: HeadersInit = { "Content-Type": "application/json" }
    if (token) headers["Authorization"] = `Bearer ${token}`
    const res = await fetch("/api/v1/models", { headers })
    if (!res.ok) {
      return { results: [], error: `Hub returned ${res.status}` }
    }
    const data = await res.json()
    const items: { id: string; metadata?: { name?: string } }[] = data?.data ?? []
    const models = items.map(m => m.id)
    const displayNames: Record<string, string> = {}
    for (const m of items) {
      if (m.metadata?.name) displayNames[m.id] = m.metadata.name
    }
    return { results: models, displayNames }
  } catch (err: any) {
    return { results: [], error: err?.message ?? String(err) }
  }
}

export async function fetchModels(provider: ModelProvider, apiKey: string, baseURL: string = "", extra?: string[]) {
  void provider
  void apiKey
  void baseURL
  void extra
  return fetchWebModels()
}