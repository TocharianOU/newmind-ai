import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"
import { apiFetch } from "../utils/api"

// Entity types
export type EntityType = "person" | "project" | "concept" | "infrastructure" | "index" | "other"

// Entity interface
export interface Memory {
  name: string
  entity_type: EntityType
  content: string
  metadata: Record<string, any>
  created_at: string
  updated_at: string
  relevance: number
  source_chat_id?: string
}

// Memory statistics
export interface MemoryStats {
  total: number
  person: number
  project: number
  concept: number
  infrastructure: number
  index: number
  other: number
}

// Atoms for memory state
export const memoriesAtom = atom<Memory[]>([])

export const selectedMemoryTypeAtom = atom<EntityType | "all">("all")

export const memorySearchQueryAtom = atom<string>("")

export const memoryStatsAtom = atom<MemoryStats>({
  total: 0,
  person: 0,
  project: 0,
  concept: 0,
  infrastructure: 0,
  index: 0,
  other: 0,
})

// Memory panel visibility
export const showMemoryPanelAtom = atomWithStorage("showMemoryPanel", false)

// Loading state
export const memoriesLoadingAtom = atom<boolean>(false)

// Load memories action
export const loadMemoriesAtom = atom(
  null,
  async (get, set, entityType?: EntityType) => {
    try {
      set(memoriesLoadingAtom, true)
      
      const url = entityType 
        ? `/api/memory/entities?entity_type=${entityType}`
        : "/api/memory/entities"
      
      console.log("🔍 [Memory] Loading memories from:", url)
      const response = await apiFetch(url)
      const data = await response.json()
      
      console.log("🔍 [Memory] API response:", data)
      console.log("🔍 [Memory] Entities count:", data.data?.entities?.length || 0)
      
      if (data.success && data.data) {
        set(memoriesAtom, data.data.entities || [])
      } else {
        console.warn("🔍 [Memory] Invalid response structure:", data)
      }
    } catch (error) {
      console.error("Failed to load memories:", error)
    } finally {
      set(memoriesLoadingAtom, false)
    }
  }
)

// Search memories action
export const searchMemoriesAtom = atom(
  null,
  async (get, set, query: string, entityType?: EntityType) => {
    try {
      set(memoriesLoadingAtom, true)
      
      const params = new URLSearchParams({ q: query })
      if (entityType) {
        params.append("entity_type", entityType)
      }
      
      const response = await apiFetch(`/api/memory/search?${params}`)
      const data = await response.json()
      
      if (data.success && data.data) {
        set(memoriesAtom, data.data.entities || [])
      }
    } catch (error) {
      console.error("Failed to search memories:", error)
    } finally {
      set(memoriesLoadingAtom, false)
    }
  }
)

// Load memory statistics action
export const loadMemoryStatsAtom = atom(
  null,
  async (get, set) => {
    try {
      console.log("🔍 [Memory] Loading memory stats...")
      const response = await apiFetch("/api/memory/stats")
      const data = await response.json()
      
      console.log("🔍 [Memory] Stats API response:", data)
      
      if (data.success && data.data) {
        console.log("🔍 [Memory] Setting stats:", data.data)
        set(memoryStatsAtom, data.data)
      } else {
        console.warn("🔍 [Memory] Invalid stats response structure:", data)
      }
    } catch (error) {
      console.error("Failed to load memory stats:", error)
    }
  }
)

// Create memory action
export const createMemoryAtom = atom(
  null,
  async (get, set, memory: Omit<Memory, "created_at" | "updated_at">) => {
    try {
      const response = await apiFetch("/api/memory/entities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(memory),
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Reload memories after creation
        const selectedType = get(selectedMemoryTypeAtom)
        await set(loadMemoriesAtom, selectedType === "all" ? undefined : selectedType as EntityType)
        return true
      }
      
      return false
    } catch (error) {
      console.error("Failed to create memory:", error)
      return false
    }
  }
)

// Update memory action
export const updateMemoryAtom = atom(
  null,
  async (get, set, entityType: EntityType, entityName: string, updates: Partial<Memory>) => {
    try {
      const response = await apiFetch(`/api/memory/entities/${entityType}/${encodeURIComponent(entityName)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Reload memories after update
        const selectedType = get(selectedMemoryTypeAtom)
        await set(loadMemoriesAtom, selectedType === "all" ? undefined : selectedType as EntityType)
        return true
      }
      
      return false
    } catch (error) {
      console.error("Failed to update memory:", error)
      return false
    }
  }
)

// Delete memory action
export const deleteMemoryAtom = atom(
  null,
  async (get, set, entityType: EntityType, entityName: string) => {
    try {
      const response = await apiFetch(`/api/memory/entities/${entityType}/${encodeURIComponent(entityName)}`, {
        method: "DELETE",
      })
      
      const data = await response.json()
      
      if (data.success) {
        // Reload memories after deletion
        const selectedType = get(selectedMemoryTypeAtom)
        await set(loadMemoriesAtom, selectedType === "all" ? undefined : selectedType as EntityType)
        return true
      }
      
      return false
    } catch (error) {
      console.error("Failed to delete memory:", error)
      return false
    }
  }
)

// Delete all memories action
export const deleteAllMemoriesAtom = atom(
  null,
  async (get, set) => {
    try {
      const response = await apiFetch("/api/memory/entities", {
        method: "DELETE",
      })
      
      const data = await response.json()
      
      if (data.success) {
        set(memoriesAtom, [])
        set(memoryStatsAtom, {
          total: 0,
          person: 0,
          project: 0,
          concept: 0,
          infrastructure: 0,
          index: 0,
          other: 0,
        })
        return true
      }
      
      return false
    } catch (error) {
      console.error("Failed to delete all memories:", error)
      return false
    }
  }
)

