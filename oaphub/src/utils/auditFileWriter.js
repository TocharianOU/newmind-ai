/**
 * Audit file writer — appends audit events to daily rotating JSONL files.
 *
 * Each event is written as a single JSON line to:
 *   <AUDIT_LOG_DIR>/audit-YYYY-MM-DD.jsonl
 *
 * Files are named by UTC date so they align with the database `createdAt` field.
 * A cleanup task deletes files older than AUDIT_LOG_RETENTION_DAYS (default 90).
 *
 * Designed for SIEM agents (Filebeat, Fluentd, Vector, etc.) that tail local files.
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import logger from './logger.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname  = path.dirname(__filename)

// ── Config ───────────────────────────────────────────────────────────────────

const AUDIT_LOG_DIR = process.env.AUDIT_LOG_DIR
  ? path.resolve(process.env.AUDIT_LOG_DIR)
  : path.resolve(__dirname, '../../logs/audit')

const RETENTION_DAYS = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS ?? '90', 10)

// Ensure the directory exists once at module load time.
try {
  fs.mkdirSync(AUDIT_LOG_DIR, { recursive: true })
} catch (err) {
  logger.error('[AuditFile] Failed to create audit log directory:', err)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns today's UTC date string: "2026-03-03" */
function todayUtc() {
  return new Date().toISOString().slice(0, 10)
}

/** Returns the absolute path for the current day's log file. */
function currentLogPath() {
  return path.join(AUDIT_LOG_DIR, `audit-${todayUtc()}.jsonl`)
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Append one audit event as a JSON line to today's log file.
 * Fire-and-forget — never throws, failures are only logged.
 *
 * @param {object} entry - Audit event data (same shape as AuditLog DB record).
 */
export function appendAuditFile(entry) {
  try {
    const line = JSON.stringify(entry) + '\n'
    fs.appendFile(currentLogPath(), line, (err) => {
      if (err) logger.error('[AuditFile] Failed to append audit entry:', err)
    })
  } catch (err) {
    logger.error('[AuditFile] Failed to serialize audit entry:', err)
  }
}

/**
 * Start the daily cleanup task.
 * Runs immediately on call, then every 24 hours.
 * Deletes .jsonl files whose date is older than RETENTION_DAYS.
 */
export function startAuditFileCleanup() {
  const run = () => {
    try {
      const files = fs.readdirSync(AUDIT_LOG_DIR)
      const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000

      for (const file of files) {
        // Only process files matching our naming pattern: audit-YYYY-MM-DD.jsonl
        const match = file.match(/^audit-(\d{4}-\d{2}-\d{2})\.jsonl$/)
        if (!match) continue

        const fileDate = new Date(match[1]).getTime()
        if (!isNaN(fileDate) && fileDate < cutoff) {
          const fullPath = path.join(AUDIT_LOG_DIR, file)
          fs.unlink(fullPath, (err) => {
            if (err) logger.error(`[AuditFile] Failed to delete old log file ${file}:`, err)
            else logger.info(`[AuditFile] Deleted old audit log: ${file}`)
          })
        }
      }
    } catch (err) {
      logger.error('[AuditFile] Cleanup scan failed:', err)
    }
  }

  run() // run once immediately on startup
  setInterval(run, 24 * 60 * 60 * 1000) // then every 24 hours

  logger.info(`[AuditFile] Audit file writer active — dir: ${AUDIT_LOG_DIR}, retention: ${RETENTION_DAYS} days`)
}
