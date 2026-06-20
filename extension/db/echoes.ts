import Dexie, { type Table } from "dexie"

export type EchoStatus = "raw" | "inferred" | "confirmed" | "ignored" | "pinned"

export type Echo = {
  id: string
  triggerText: string
  inferredThought?: string
  userThought?: string
  sourceApp: string
  url: string
  title: string
  createdAt: string
  status: EchoStatus
}

type LegacyEcho = Partial<Echo> & {
  thought?: string
  quote?: string
  status?: EchoStatus | "active" | "promoted"
}

class EchoDatabase extends Dexie {
  // Store name is kept as `sparks` to preserve existing local IndexedDB data.
  sparks!: Table<Echo, string>

  constructor() {
    super("echo-sidebar")
    this.version(1).stores({
      sparks: "id, createdAt, status, sourceApp, url"
    })
    this.version(2).stores({
      sparks: "id, createdAt, status, sourceApp, url"
    })
    this.version(3)
      .stores({
        sparks: "id, createdAt, status, sourceApp, url"
      })
      .upgrade(async (transaction) => {
        const table = transaction.table("sparks")
        const records = await table.toArray()

        await Promise.all(records.map((record) => table.put(normalizeEcho(record))))
      })
  }
}

export const db = new EchoDatabase()

export const listRecentEchoes = async () => {
  const records = await db.sparks.toArray()
  const echoes = records
    .map((record) => normalizeEcho(record))
    .filter((record) => ["raw", "inferred", "confirmed", "pinned"].includes(record.status))

  return echoes.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export type CreateEchoInput = {
  triggerText: string
  inferredThought?: string
  userThought?: string
  sourceApp?: string
  url?: string
  title?: string
  status?: EchoStatus
}

export const createEcho = async (echo: CreateEchoInput) => {
  const record: Echo = {
    id: crypto.randomUUID(),
    triggerText: echo.triggerText,
    inferredThought: echo.inferredThought,
    userThought: echo.userThought,
    sourceApp: echo.sourceApp ?? "browser",
    url: echo.url ?? "",
    title: echo.title ?? "",
    createdAt: new Date().toISOString(),
    status: echo.status ?? "raw"
  }

  await db.sparks.add(record)
  return record
}

export const deleteEcho = async (id: string) => {
  await db.sparks.delete(id)
}

const normalizeStatus = (status?: LegacyEcho["status"]): EchoStatus => {
  if (status === "active" || status === "promoted") return "confirmed"
  if (status === "raw" || status === "inferred" || status === "confirmed" || status === "ignored" || status === "pinned") {
    return status
  }

  return "raw"
}

export const normalizeEcho = (record: LegacyEcho): Echo => {
  const legacyThought = record.thought ?? ""
  const triggerText = record.triggerText ?? record.quote ?? legacyThought
  const userThought = record.userThought ?? (record.thought ? legacyThought : undefined)

  return {
    id: record.id ?? crypto.randomUUID(),
    triggerText,
    inferredThought: record.inferredThought,
    userThought,
    sourceApp: record.sourceApp ?? "browser",
    url: record.url ?? "",
    title: record.title ?? "",
    createdAt: record.createdAt ?? new Date().toISOString(),
    status: normalizeStatus(record.status)
  }
}
