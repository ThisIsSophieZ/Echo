import { describe, expect, it } from "vitest"

import type { Echo } from "../db/echoes"
import type { RelatedEchoAnalysis } from "./echo-related"
import { formatProbeReport } from "./probe-report"

const record: Echo = {
  id: "echo-1",
  triggerText: "Use a checklist for English copy",
  sourceApp: "grok",
  url: "https://grok.com/example",
  title: "Copy review",
  createdAt: "2026-07-03T00:00:00.000Z",
  status: "raw"
}

describe("Probe report", () => {
  it("exports compact evidence and summarizes zero-score candidates", () => {
    const analysis: RelatedEchoAnalysis = {
      selection: "native English checklist",
      queryTokens: ["native", "english", "checklist"],
      scannedCount: 2,
      acceptedCount: 1,
      results: [],
      candidates: [
        {
          echo: record,
          score: 72,
          accepted: true,
          reason: "来源正文中出现相同短语",
          strongestField: "来源正文",
          matchedTerms: ["native", "english"],
          details: [
            "最佳字段：来源正文 · 权重 1",
            "BM25 4.50 + 短语奖励 1.25"
          ]
        },
        {
          echo: { ...record, id: "zero", title: "No evidence item" },
          score: 0,
          accepted: false,
          reason: "没有共同的有效词",
          rejection: "no-overlap",
          strongestField: "来源正文",
          matchedTerms: [],
          details: ["所有字段 BM25：0.00"]
        }
      ]
    }

    const report = formatProbeReport(
      analysis,
      new Date("2026-07-04T00:00:00.000Z")
    )

    expect(report).toContain(
      "<!-- ECHO_PROBE_REPORT_START 2026-07-04T00:00:00.000Z -->"
    )
    expect(report).toContain("# Echo Probe Report · 2026-07-04T00:00:00.000Z")
    expect(report).toContain("native English checklist")
    expect(report).toContain("| 2 | 1 | 1 | 1 |")
    expect(report).toContain("### 1. [72] Copy review")
    expect(report).toContain("- Decision: accepted")
    expect(report).toContain("BM25 4.50 + 短语奖励 1.25")
    expect(report).not.toContain("No evidence item")
    expect(report).not.toContain("所有字段 BM25：0.00")
    expect(report).toContain(
      "<!-- ECHO_PROBE_REPORT_END 2026-07-04T00:00:00.000Z -->"
    )
  })
})
