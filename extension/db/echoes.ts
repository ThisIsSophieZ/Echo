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
  // Resurface bookkeeping (added v4). Optional so legacy records stay valid.
  lastSurfacedAt?: string
  snoozeUntil?: string
}

type LegacyEcho = Omit<Partial<Echo>, "status"> & {
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
    // v4 adds optional lastSurfacedAt / snoozeUntil. Fields are not indexed, so
    // no schema change is needed beyond bumping the version.
    this.version(4).stores({
      sparks: "id, createdAt, status, sourceApp, url"
    })
  }
}

export const db = new EchoDatabase()

export const listRecentEchoes = async () => {
  const records = await db.sparks.toArray()
  const echoes = records
    .map((record) => normalizeEcho(record))
    .filter((record) => ["raw", "inferred", "confirmed", "pinned"].includes(record.status))

  return echoes.sort((a, b) => {
    const aPinned = a.status === "pinned" ? 1 : 0
    const bPinned = b.status === "pinned" ? 1 : 0
    if (aPinned !== bPinned) return bPinned - aPinned
    return b.createdAt.localeCompare(a.createdAt)
  })
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

export const setEchoStatus = async (id: string, status: EchoStatus) => {
  await db.sparks.update(id, { status })
}

// Toggle pin. Unpinning restores a sensible status: keep it a thought-bearing
// "confirmed" echo if the user wrote something, otherwise back to "raw".
export const togglePin = async (id: string) => {
  const record = await db.sparks.get(id)
  if (!record) return

  const current = normalizeEcho(record)
  const next: EchoStatus =
    current.status === "pinned" ? (current.userThought ? "confirmed" : "raw") : "pinned"

  await db.sparks.update(id, { status: next })
  return next
}

// --- Resurface lifecycle -------------------------------------------------

// Mark echoes as just shown, so they enter a cooldown and don't nag on every
// panel open. Does not notify the list (lastSurfacedAt has no visible effect).
export const markSurfaced = async (ids: string[]) => {
  const now = new Date().toISOString()
  await Promise.all(ids.map((id) => db.sparks.update(id, { lastSurfacedAt: now })))
}

// "稍后" — hide from resurfacing until `ms` from now.
export const snoozeEcho = async (id: string, ms: number) => {
  const until = new Date(Date.now() + ms).toISOString()
  await db.sparks.update(id, { snoozeUntil: until })
}

// Collect -> Keep upgrade: a raw quote becomes a thought-bearing echo when the
// user writes what it makes them think (typically at resurface time).
export const addThought = async (id: string, thought: string) => {
  const clean = thought.trim()
  if (!clean) return

  const record = await db.sparks.get(id)
  if (!record) return

  const current = normalizeEcho(record)
  await db.sparks.update(id, {
    userThought: clean,
    status: current.status === "pinned" ? "pinned" : "confirmed"
  })
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
    status: normalizeStatus(record.status),
    lastSurfacedAt: record.lastSurfacedAt,
    snoozeUntil: record.snoozeUntil
  }
}
