/**
 * Chat history sync service.
 *
 * Flow:
 *   push  →  GET  http://localhost:{port}/api/sync/export?since=<ts>
 *            POST {OAP_ROOT_URL}/api/v1/user/sync/push   (Hub stores data)
 *
 *   pull  →  GET  {OAP_ROOT_URL}/api/v1/user/sync/pull?since=<ts>  (Hub returns data)
 *            POST http://localhost:{port}/api/sync/import            (write to local SQLite)
 *
 * Both operations are incremental: only records newer than `lastSyncAt` are
 * transferred.  The Hub is expected to implement the two endpoints listed
 * above; until then, sync calls will fail gracefully without affecting local
 * usage.
 */

import { OAP_ROOT_URL } from "../../shared/oap"
import { serviceStatus } from "./service"
import { preferencesStore } from "./store"
import { getToken } from "./oap"
import { getCurrentProjectId } from "./ipc/project"

// ---------------------------------------------------------------------------
// Types (match the Python Pydantic models in routers/sync.py)
// ---------------------------------------------------------------------------

interface SyncChatRecord {
  id: string
  title: string
  created_at: string
  updated_at: string | null
  starred_at: string | null
}

interface SyncMessageRecord {
  message_id: string
  chat_id: string
  content: string
  role: string
  created_at: string
  files: string
  tool_calls: unknown[] | null
}

/**
 * Sync transfer unit scoped to a single (user, project) pair.
 * `project_id` is used by the Hub to keep projects isolated across devices.
 */
interface SyncPayload {
  project_id: string
  chats: SyncChatRecord[]
  messages: SyncMessageRecord[]
}

interface SyncResult {
  success: boolean
  pushed: number
  pulled: number
  error?: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function localBase(): string {
  return `http://localhost:${serviceStatus.port}`
}

function localHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-Auth-Token": serviceStatus.authToken,
  }
}

function hubHeaders(): Record<string, string> {
  const token = getToken()
  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function localExport(since: string): Promise<SyncPayload> {
  const url = `${localBase()}/api/sync/export${since ? `?since=${encodeURIComponent(since)}` : ""}`
  const res = await fetch(url, { headers: localHeaders() })
  if (!res.ok) throw new Error(`Local export failed: ${res.status}`)
  const json = await res.json()
  if (!json.success) throw new Error(`Local export error: ${json.message}`)
  return json.data as SyncPayload
}

async function localImport(payload: SyncPayload): Promise<{ chatCount: number; msgCount: number }> {
  const res = await fetch(`${localBase()}/api/sync/import`, {
    method: "POST",
    headers: localHeaders(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Local import failed: ${res.status}`)
  const json = await res.json()
  if (!json.success) throw new Error(`Local import error: ${json.message}`)
  // Parse counts from message e.g. "Imported 3 chats, 12 messages"
  const m = (json.message as string).match(/(\d+) chats.*?(\d+) messages/)
  return {
    chatCount: m ? parseInt(m[1]) : 0,
    msgCount: m ? parseInt(m[2]) : 0,
  }
}

async function hubPush(payload: SyncPayload): Promise<void> {
  const res = await fetch(`${OAP_ROOT_URL}/api/v1/user/sync/push`, {
    method: "POST",
    headers: hubHeaders(),
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`Hub push failed: ${res.status}`)
  const json = await res.json()
  if (!json.success) throw new Error(`Hub push error: ${json.message}`)
}

async function hubPull(since: string, projectId: string): Promise<SyncPayload> {
  const params = new URLSearchParams({ project_id: projectId })
  if (since) params.set("since", since)
  const url = `${OAP_ROOT_URL}/api/v1/user/sync/pull?${params.toString()}`
  const res = await fetch(url, { headers: hubHeaders() })
  if (!res.ok) throw new Error(`Hub pull failed: ${res.status}`)
  const json = await res.json()
  if (!json.success) throw new Error(`Hub pull error: ${json.message}`)
  return json.data as SyncPayload
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Periodic sync interval: every 5 minutes. */
const SYNC_INTERVAL_MS = 5 * 60 * 1000
let syncTimer: NodeJS.Timeout | null = null

/** Start (or restart) the periodic background sync timer. */
export function startPeriodicSync(): void {
  if (syncTimer) clearInterval(syncTimer)
  syncTimer = setInterval(() => {
    runSync().catch(console.error)
  }, SYNC_INTERVAL_MS)
}

/** Stop the periodic sync timer (e.g. on logout or sync disabled). */
export function stopPeriodicSync(): void {
  if (syncTimer) {
    clearInterval(syncTimer)
    syncTimer = null
  }
}

export function isSyncEnabled(): boolean {
  return !!(preferencesStore.get("syncEnabled") as boolean)
}

export function setSyncEnabled(enabled: boolean): void {
  preferencesStore.set("syncEnabled", enabled)
  if (enabled) {
    startPeriodicSync()
  } else {
    stopPeriodicSync()
  }
}

export function getLastSyncAt(): string {
  return (preferencesStore.get("lastSyncAt") as string) || ""
}

function setLastSyncAt(ts: string): void {
  preferencesStore.set("lastSyncAt", ts)
}

/**
 * Run a full sync cycle: push local changes → Hub, then pull Hub changes → local.
 *
 * Safe to call multiple times; uses `lastSyncAt` for incremental transfers.
 * Silently returns early if sync is disabled or the mcp-host is not yet up.
 */
export async function runSync(): Promise<SyncResult> {
  if (!isSyncEnabled()) {
    return { success: true, pushed: 0, pulled: 0 }
  }

  if (!serviceStatus.port) {
    return { success: false, pushed: 0, pulled: 0, error: "mcp-host not ready" }
  }

  const since = getLastSyncAt()
  const projectId = getCurrentProjectId()
  // Record the sync start time BEFORE fetching so we don't miss records
  // created between export and the next sync.
  const syncStartedAt = new Date().toISOString()

  let pushed = 0
  let pulled = 0

  try {
    // 1. Push local changes to Hub.
    // The payload already contains project_id (set by mcp-host export endpoint).
    const localData = await localExport(since)
    if (localData.chats.length > 0 || localData.messages.length > 0) {
      await hubPush(localData)
      pushed = localData.messages.length
      console.log(`[Sync] Pushed ${localData.chats.length} chats, ${localData.messages.length} messages (project: ${projectId})`)
    }

    // 2. Pull Hub changes for the current (user, project) pair → local SQLite.
    const hubData = await hubPull(since, projectId)
    if (hubData.chats.length > 0 || hubData.messages.length > 0) {
      const { chatCount, msgCount } = await localImport(hubData)
      pulled = msgCount
      console.log(`[Sync] Pulled and imported ${chatCount} chats, ${msgCount} messages (project: ${projectId})`)
    }

    setLastSyncAt(syncStartedAt)
    return { success: true, pushed, pulled }
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err)
    console.error("[Sync] Sync failed:", error)
    return { success: false, pushed, pulled, error }
  }
}
