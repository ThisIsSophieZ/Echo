import { describe, expect, it } from "vitest"

import {
  ECHO_BACKUP_FORMAT,
  ECHO_BACKUP_VERSION,
  parseEchoBackup,
  serializeEchoBackup,
  type EchoBackupFile
} from "./echo-backup"
import type { Echo } from "./echoes"

const sampleEcho = (overrides: Partial<Echo> = {}): Echo => ({
  id: "11111111-1111-1111-1111-111111111111",
  triggerText: "一条值得留下的片段",
  userThought: "这方向值得跟",
  sourceApp: "chatgpt",
  url: "https://chatgpt.com/",
  title: "Sample",
  createdAt: "2026-07-22T00:00:00.000Z",
  status: "confirmed",
  ...overrides
})

describe("echo backup format", () => {
  it("round-trips a backup payload", () => {
    const backup: EchoBackupFile = {
      format: ECHO_BACKUP_FORMAT,
      version: ECHO_BACKUP_VERSION,
      exportedAt: "2026-07-22T00:00:00.000Z",
      count: 1,
      echoes: [sampleEcho()]
    }

    const parsed = parseEchoBackup(serializeEchoBackup(backup))
    expect(parsed.format).toBe(ECHO_BACKUP_FORMAT)
    expect(parsed.echoes).toHaveLength(1)
    expect(parsed.echoes[0]?.userThought).toBe("这方向值得跟")
  })

  it("rejects unrelated JSON", () => {
    expect(() => parseEchoBackup(JSON.stringify({ hello: "world" }))).toThrow(
      /不是 Echo 备份文件/
    )
  })

  it("normalizes legacy fields inside backup echoes", () => {
    const raw = JSON.stringify({
      format: ECHO_BACKUP_FORMAT,
      version: ECHO_BACKUP_VERSION,
      exportedAt: "2026-07-22T00:00:00.000Z",
      count: 1,
      echoes: [
        {
          id: "22222222-2222-2222-2222-222222222222",
          quote: "旧字段 quote",
          status: "active",
          sourceApp: "claude",
          createdAt: "2026-07-01T00:00:00.000Z"
        }
      ]
    })

    const parsed = parseEchoBackup(raw)
    expect(parsed.echoes[0]?.triggerText).toBe("旧字段 quote")
    expect(parsed.echoes[0]?.status).toBe("confirmed")
  })

  it("keeps valid records and reports malformed rows for import skipping", () => {
    const raw = JSON.stringify({
      format: ECHO_BACKUP_FORMAT,
      version: ECHO_BACKUP_VERSION,
      echoes: [sampleEcho(), { triggerText: "missing id" }, null]
    })

    const parsed = parseEchoBackup(raw)
    expect(parsed.count).toBe(3)
    expect(parsed.echoes).toHaveLength(1)
    expect(parsed.echoes[0]?.id).toBe(sampleEcho().id)
  })
})
