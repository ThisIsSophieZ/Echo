import { db, normalizeEcho, type Echo } from "./echoes"

export const ECHO_BACKUP_FORMAT = "echo-sidebar-backup" as const
export const ECHO_BACKUP_VERSION = 1 as const

export type EchoBackupFile = {
  format: typeof ECHO_BACKUP_FORMAT
  version: typeof ECHO_BACKUP_VERSION
  exportedAt: string
  count: number
  echoes: Echo[]
}

export type EchoImportResult = {
  total: number
  imported: number
  skipped: number
}

type BackupEchoInput = Parameters<typeof normalizeEcho>[0]

const normalizeBackupEcho = (value: unknown): Echo | null => {
  if (!value || typeof value !== "object") return null

  const candidate = value as BackupEchoInput
  if (typeof candidate.id !== "string" || !candidate.id.trim()) return null

  const normalized = normalizeEcho(candidate)
  return normalized.triggerText.trim() ? normalized : null
}

/** Full local dump, including ignored rows, for backup/restore. */
export const listEchoesForBackup = async () => {
  const records = await db.sparks.toArray()
  return records
    .map((record) => normalizeEcho(record))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
}

export const buildEchoBackup = async (
  exportedAt = new Date().toISOString()
): Promise<EchoBackupFile> => {
  const echoes = await listEchoesForBackup()
  return {
    format: ECHO_BACKUP_FORMAT,
    version: ECHO_BACKUP_VERSION,
    exportedAt,
    count: echoes.length,
    echoes
  }
}

export const serializeEchoBackup = (backup: EchoBackupFile) =>
  `${JSON.stringify(backup, null, 2)}\n`

export const parseEchoBackup = (raw: string): EchoBackupFile => {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("备份文件不是有效 JSON")
  }

  if (!parsed || typeof parsed !== "object") {
    throw new Error("备份文件格式无效")
  }

  const candidate = parsed as Partial<EchoBackupFile>
  if (candidate.format !== ECHO_BACKUP_FORMAT) {
    throw new Error("这不是 Echo 备份文件")
  }

  if (candidate.version !== ECHO_BACKUP_VERSION) {
    throw new Error(`不支持的备份版本：${String(candidate.version)}`)
  }

  if (!Array.isArray(candidate.echoes)) {
    throw new Error("备份缺少 echoes 列表")
  }

  const echoes = candidate.echoes.flatMap((echo) => {
    const normalized = normalizeBackupEcho(echo)
    return normalized ? [normalized] : []
  })

  return {
    format: ECHO_BACKUP_FORMAT,
    version: ECHO_BACKUP_VERSION,
    exportedAt:
      typeof candidate.exportedAt === "string"
        ? candidate.exportedAt
        : new Date().toISOString(),
    // Keep the original row count so the import result can report malformed
    // rows as skipped rather than silently pretending they never existed.
    count: candidate.echoes.length,
    echoes
  }
}

/** Upsert by id. Existing rows with the same id are overwritten. */
export const importEchoBackup = async (
  backup: EchoBackupFile
): Promise<EchoImportResult> => {
  let imported = 0
  let skipped = Math.max(backup.count - backup.echoes.length, 0)

  await db.transaction("rw", db.sparks, async () => {
    for (const echo of backup.echoes) {
      const normalized = normalizeBackupEcho(echo)
      if (!normalized) {
        skipped += 1
        continue
      }

      await db.sparks.put(normalized)
      imported += 1
    }
  })

  return {
    total: backup.count,
    imported,
    skipped
  }
}

export const downloadEchoBackupFile = async () => {
  const backup = await buildEchoBackup()
  const stamp = backup.exportedAt.slice(0, 19).replace(/[:T]/g, "-")
  const blob = new Blob([serializeEchoBackup(backup)], {
    type: "application/json"
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `echo-backup-${stamp}.json`
  link.click()
  URL.revokeObjectURL(url)
  return backup.count
}
