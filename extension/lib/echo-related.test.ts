import { describe, expect, it } from "vitest"

import type { Echo } from "../db/echoes"
import {
  analyzeRelatedEchoes,
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
  it("segments English and Chinese words without generic character fragments", () => {
    const tokens = relatedTokens("Pricing reflection 这个定价策略很实用")

    expect(tokens).toEqual(
      expect.arrayContaining(["pricing", "reflection", "定价", "策略"])
    )
    expect(tokens).not.toEqual(expect.arrayContaining(["这个", "实用", "价策"]))
  })

  it("filters Chinese filler and segmentation fragments from selections", () => {
    const tokens = relatedTokens(
      "外部时间锚点：每完成一个任务就明确记录现在是几点我干了什么（类似你给 gemini 做的事）"
    )

    expect(tokens).toEqual(
      expect.arrayContaining(["外部", "时间", "任务", "明确", "记录", "gemini"])
    )
    expect(tokens).not.toEqual(
      expect.arrayContaining([
        "什么",
        "做的",
        "类似",
        "现在",
        "一个",
        "是不是",
        "咱们",
        "好像",
        "是在",
        "的是"
      ])
    )
  })

  it("drops borderline query tokens like 还给 while keeping corpus tokens", () => {
    const query = relatedTokens("把钱还给用户做二次确认")
    expect(query).not.toContain("还给")

    const analysis = analyzeRelatedEchoes(
      [echo({ userThought: "记得把钱还给借款人" })],
      "把钱还给用户做二次确认"
    )
    expect(analysis.queryTokens).not.toContain("还给")
    expect(analysis.scannedCount).toBe(1)
  })

  it("finds an explainable Chinese overlap", () => {
    const result = rankRelatedEcho(echo(), "我们需要重新考虑按结果收费的定价策略")

    expect(result?.reason).toMatch(/相同短语|有重叠/)
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

  it("explains why candidates were rejected", () => {
    const analysis = analyzeRelatedEchoes(
      [
        echo({ id: "weak", triggerText: "A pricing note", title: "" }),
        echo({ id: "none", triggerText: "A browser note", title: "" })
      ],
      "pricing strategy for enterprise"
    )

    expect(analysis.scannedCount).toBe(2)
    expect(analysis.acceptedCount).toBe(0)
    expect(analysis.candidates[0]).toMatchObject({
      rejection: "low-evidence"
    })
    expect(analysis.candidates[1].rejection).toBe("no-overlap")
  })

  it("keeps two non-consecutive content terms in debug only", () => {
    const unrelated = Array.from({ length: 10 }, (_, index) =>
      echo({
        id: `unrelated-${index}`,
        triggerText: "browser capture note",
        title: ""
      })
    )
    const analysis = analyzeRelatedEchoes(
      [
        echo({
          id: "candidate",
          triggerText: "pricing note for enterprise",
          title: ""
        }),
        ...unrelated
      ],
      "pricing enterprise strategy"
    )

    expect(analysis.results).toHaveLength(0)
    expect(
      analysis.candidates.find((candidate) => candidate.echo.id === "candidate")
        ?.rejection
    ).toBe("possible-only")
  })

  it("surfaces three independent content terms", () => {
    const analysis = analyzeRelatedEchoes(
      [
        echo({
          triggerText: "strategy note with pricing for enterprise",
          title: ""
        })
      ],
      "pricing enterprise strategy launch"
    )

    expect(analysis.results).toHaveLength(1)
  })

  it("does not let Tier 2 words create eligibility", () => {
    const analysis = analyzeRelatedEchoes(
      [
        echo({
          triggerText: "产品真正帮助用户理解定价",
          title: ""
        })
      ],
      "产品真正帮助用户重新考虑定价"
    )

    expect(analysis.results).toHaveLength(0)
  })

  it("allows the same quote from a different conversation", () => {
    const record = echo()
    const result = rankRelatedEcho(
      record,
      record.triggerText,
      "https://chatgpt.com/c/another"
    )

    expect(result).not.toBeNull()
  })

  it("suppresses generic long-selection noise and keeps specific evidence", () => {
    const selection = `
      实用检查单应该逐条过一遍，用这个 checklist 快速筛选英文文案，
      判断它是否像 native English speaker 写的。这个方法自然、快速，
      也可以用于检查语气、可信度与表达。
    `
    const records = [
      echo({
        id: "relevant",
        triggerText:
          "Use this checklist to review whether the copy sounds like a native English speaker.",
        title: "English copy review"
      }),
      echo({
        id: "generic",
        triggerText: "这个方案非常实用，也可以快速完成相关内容。",
        title: "更新后的完整系统提示"
      }),
      echo({
        id: "unrelated",
        triggerText: "用户需要一个安静的多模型侧边栏。",
        title: "产品方向"
      })
    ]

    const analysis = analyzeRelatedEchoes(records, selection)

    expect(analysis.queryTokens.length).toBeLessThanOrEqual(16)
    expect(analysis.queryTokens).not.toEqual(
      expect.arrayContaining(["这个", "实用", "快速"])
    )
    expect(analysis.results.map((result) => result.echo.id)).toEqual(["relevant"])
    expect(analysis.candidates[0].details).toEqual(
      expect.arrayContaining([
        expect.stringContaining("最佳字段"),
        expect.stringContaining("BM25"),
        expect.stringContaining("词项贡献")
      ])
    )
  })

  it("prioritizes a user thought and suppresses duplicate source Echoes", () => {
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
    expect(results).toHaveLength(2)
    expect(results[0].echo.id).toBe("thought")
    expect(
      new Set(results.map((result) => result.echo.triggerText)).size
    ).toBe(results.length)
  })
})
