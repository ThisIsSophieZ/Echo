import { describe, expect, it } from "vitest"

import type { Echo } from "../db/echoes"
import {
  findRelatedEchoes,
  rankRelatedEcho,
  relatedTokens
} from "./echo-related"

const echo = (overrides: Partial<Echo> = {}): Echo => ({
  id: "echo-1",
  triggerText: "按结果收费可以减少用户对订阅浪费的担心",
  userThought: undefined,
  inferredThought: undefined,
  sourceApp: "chatgpt",
  url: "https://chatgpt.com/c/example",
  title: "定价方案讨论",
  createdAt: "2026-07-01T00:00:00.000Z",
  status: "raw",
  ...overrides
})

describe("Echo related selection", () => {
  it("creates English words and Chinese bigrams", () => {
    expect(relatedTokens("Pricing reflection 定价策略")).toEqual(
      expect.arrayContaining(["pricing", "reflection", "定价", "价策", "策略"])
    )
  })

  it("finds an explainable Chinese overlap", () => {
    const result = rankRelatedEcho(echo(), "我们需要重新考虑按结果收费的定价策略")

    expect(result?.reason).toContain("命中")
    expect(result?.match.terms.length).toBeGreaterThan(0)
  })

  it("ignores a weak single-token connection", () => {
    expect(
      rankRelatedEcho(
        echo({ triggerText: "A pricing note", title: "" }),
        "pricing strategy for enterprise"
      )
    ).toBeNull()
  })

  it("does not return the exact selected source", () => {
    const record = echo()
    expect(rankRelatedEcho(record, record.triggerText)).toBeNull()
  })

  it("prioritizes a user thought and limits the result count", () => {
    const records = [
      echo({ id: "source-1" }),
      echo({ id: "source-2", createdAt: "2026-07-02T00:00:00.000Z" }),
      echo({ id: "source-3", createdAt: "2026-07-03T00:00:00.000Z" }),
      echo({
        id: "thought",
        triggerText: "unrelated source",
        title: "",
        userThought: "按结果收费是一种更可信的定价方式"
      })
    ]

    const results = findRelatedEchoes(records, "重新考虑按结果收费的定价", 3)
    expect(results).toHaveLength(3)
    expect(results[0].echo.id).toBe("thought")
  })
})
