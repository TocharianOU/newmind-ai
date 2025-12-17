import { useAtom, useSetAtom, useAtomValue } from "jotai"
import { useEffect, useState, useRef } from "react"
import { useTranslation } from "react-i18next"
import {
  memoriesAtom,
  selectedMemoryTypeAtom,
  memorySearchQueryAtom,
  loadMemoriesAtom,
  searchMemoriesAtom,
  loadMemoryStatsAtom,
  deleteMemoryAtom,
  deleteAllMemoriesAtom,
  memoriesLoadingAtom,
  memoryStatsAtom,
  type EntityType,
  type Memory,
} from "../atoms/memoryState"
import { showToastAtom } from "../atoms/toastState"

const EntityTypeLabels: Record<EntityType | "all", string> = {
  all: "全部",
  person: "人物",
  project: "项目",
  concept: "概念",
  infrastructure: "基础设施",
  index: "索引",
  other: "其他",
}

const EntityTypeColors: Record<EntityType, string> = {
  person: "#4A90E2",
  project: "#7B68EE",
  concept: "#50C878",
  infrastructure: "#FF6B6B",
  index: "#FFA500",
  other: "#808080",
}

export default function MemoryPanel() {
  const { t } = useTranslation()
  const [memories, setMemories] = useAtom(memoriesAtom)
  const [selectedType, setSelectedType] = useAtom(selectedMemoryTypeAtom)
  const [searchQuery, setSearchQuery] = useAtom(memorySearchQueryAtom)
  const loadMemories = useSetAtom(loadMemoriesAtom)
  const searchMemories = useSetAtom(searchMemoriesAtom)
  const loadStats = useSetAtom(loadMemoryStatsAtom)
  const deleteMemory = useSetAtom(deleteMemoryAtom)
  const deleteAllMemories = useSetAtom(deleteAllMemoriesAtom)
  const showToast = useSetAtom(showToastAtom)
  const isLoading = useAtomValue(memoriesLoadingAtom)
  const stats = useAtomValue(memoryStatsAtom)

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [selectedMemory, setSelectedMemory] = useState<Memory | null>(null)

  useEffect(() => {
    loadStats()
    if (selectedType === "all") {
      loadMemories()
    } else {
      loadMemories(selectedType)
    }
  }, [selectedType, loadMemories, loadStats])

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      if (selectedType === "all") {
        await loadMemories()
      } else {
        await loadMemories(selectedType)
      }
      return
    }

    await searchMemories(
      searchQuery,
      selectedType === "all" ? undefined : selectedType
    )
  }

  const handleDelete = async (memory: Memory) => {
    const success = await deleteMemory(memory.entity_type as EntityType, memory.name)
    if (success) {
      showToast({
        message: t("memory.deleteSuccess"),
        type: "success",
      })
      setSelectedMemory(null)
      // Reload stats after deletion (deleteMemory already reloads memories list)
      await loadStats()
    } else {
      showToast({
        message: t("memory.deleteFailed"),
        type: "error",
      })
    }
  }

  const handleDeleteAll = async () => {
    const success = await deleteAllMemories()
    if (success) {
      showToast({
        message: t("memory.deleteAllSuccess"),
        type: "success",
      })
      setShowDeleteConfirm(false)
      // No need to reload - deleteAllMemories already updates local state
      // This prevents race condition where server deletion might not be complete yet
    } else {
      showToast({
        message: t("memory.deleteAllFailed"),
        type: "error",
      })
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString() + " " + date.toLocaleTimeString()
  }

  return (
    <div className="memory-panel">
      {/* Header with stats - no title since modal already has it */}
      <div className="memory-panel-header">
        <div className="memory-stats">
          <span className="stat-item">
            {t("memory.total")}: {stats.total}
          </span>
        </div>
      </div>

      {/* Type Filter */}
      <div className="memory-type-filter">
        {(Object.keys(EntityTypeLabels) as Array<EntityType | "all">).map((type) => (
          <button
            key={type}
            className={`type-filter-btn ${selectedType === type ? "active" : ""}`}
            onClick={() => setSelectedType(type)}
          >
            {EntityTypeLabels[type]}
            {type !== "all" && ` (${stats[type] || 0})`}
          </button>
        ))}
      </div>

      {/* Search Bar */}
      <div className="memory-search">
        <input
          type="text"
          placeholder={t("memory.searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSearch()
            }
          }}
        />
        <button
          className="search-btn"
          onClick={handleSearch}
          disabled={isLoading}
        >
          {t("memory.search")}
        </button>
        {searchQuery && (
          <button
            className="clear-search-btn"
            onClick={() => {
              setSearchQuery("")
              if (selectedType === "all") {
                loadMemories()
              } else {
                loadMemories(selectedType)
              }
            }}
            title={t("memory.clearSearch")}
          >
            ✕
          </button>
        )}
      </div>

      {/* Memory List */}
      <div className="memory-list">
        {isLoading ? (
          <div className="memory-loading">{t("common.loading")}</div>
        ) : memories.length === 0 ? (
          <div className="memory-empty">
            {searchQuery ? t("memory.noResults") : t("memory.empty")}
          </div>
        ) : (
          memories.map((memory) => (
            <div
              key={`${memory.entity_type}-${memory.name}`}
              className={`memory-item ${selectedMemory?.name === memory.name ? "selected" : ""}`}
            >
              <div
                className="memory-item-content"
                onClick={() => setSelectedMemory(memory)}
              >
                <div className="memory-item-header">
                  <span
                    className="memory-type-badge"
                    style={{ backgroundColor: EntityTypeColors[memory.entity_type as EntityType] }}
                  >
                    {EntityTypeLabels[memory.entity_type as EntityType]}
                  </span>
                  <h3 className="memory-name">{memory.name}</h3>
                  <span className="memory-relevance">
                    {(memory.relevance * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="memory-content">{memory.content}</p>
                <div className="memory-meta">
                  <span className="memory-date">
                    {t("memory.updated")}: {formatDate(memory.updated_at)}
                  </span>
                  {memory.source_chat_id && (
                    <span className="memory-source">
                      {t("memory.fromChat")}: {memory.source_chat_id.substring(0, 8)}
                    </span>
                  )}
                </div>
                {Object.keys(memory.metadata).length > 0 && (
                  <div className="memory-metadata">
                    {Object.entries(memory.metadata).map(([key, value]) => (
                      <span key={key} className="metadata-tag">
                        {key}: {String(value)}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                className="memory-item-delete"
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(memory)
                }}
                title={t("memory.deleteItem")}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>

      {/* Memory Detail Panel */}
      {selectedMemory && (
        <div className="memory-detail">
          <div className="memory-detail-header">
            <h3>{selectedMemory.name}</h3>
            <button
              className="close-btn"
              onClick={() => setSelectedMemory(null)}
            >
              ×
            </button>
          </div>
          <div className="memory-detail-content">
            <div className="detail-section">
              <label>{t("memory.type")}</label>
              <span className="memory-type-badge" style={{ backgroundColor: EntityTypeColors[selectedMemory.entity_type as EntityType] }}>
                {EntityTypeLabels[selectedMemory.entity_type as EntityType]}
              </span>
            </div>
            <div className="detail-section">
              <label>{t("memory.content")}</label>
              <p>{selectedMemory.content}</p>
            </div>
            <div className="detail-section">
              <label>{t("memory.relevance")}</label>
              <span>{(selectedMemory.relevance * 100).toFixed(0)}%</span>
            </div>
            <div className="detail-section">
              <label>{t("memory.created")}</label>
              <span>{formatDate(selectedMemory.created_at)}</span>
            </div>
            <div className="detail-section">
              <label>{t("memory.updated")}</label>
              <span>{formatDate(selectedMemory.updated_at)}</span>
            </div>
            {Object.keys(selectedMemory.metadata).length > 0 && (
              <div className="detail-section">
                <label>{t("memory.metadata")}</label>
                <div className="metadata-list">
                  {Object.entries(selectedMemory.metadata).map(([key, value]) => (
                    <div key={key} className="metadata-item">
                      <strong>{key}:</strong> {String(value)}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="memory-detail-actions">
            <button
              onClick={() => handleDelete(selectedMemory)}
              className="delete-btn"
            >
              {t("common.delete")}
            </button>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="memory-actions">
        <button
          className="danger-btn"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={stats.total === 0 || isLoading}
        >
          {t("memory.deleteAll")} ({stats.total})
        </button>
      </div>

      {/* Delete All Confirmation */}
      {showDeleteConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-dialog">
            <h3>{t("memory.confirmDeleteAll")}</h3>
            <p>{t("memory.deleteAllWarning")}</p>
            <div className="confirm-actions">
              <button
                className="cancel-btn"
                onClick={() => setShowDeleteConfirm(false)}
              >
                {t("common.cancel")}
              </button>
              <button
                className="danger-btn"
                onClick={handleDeleteAll}
              >
                {t("common.confirm")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

