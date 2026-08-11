import { describe, expect, it } from "vitest"

import type { Echo } from "../db/echoes"
import type { RelatedEchoAnalysis } from "./echo-related"
import { buildRecallTrace } from "./recall-trace"

const record: Echo = {
  id: "echo-1",
  triggerText: "Use a checklist for English copy",
  sourceApp: "grok",
  url: "https://grok.com/example",
  title: "Copy review",
  createdAt: "2026-07-03T00:00:00.000Z",
  status: "raw"
}

describe("Recall trace", () => {
  it("summarizes accepts, rejects, and timings without uploading", () => {
    const analysis: RelatedEchoAnalysis = {
      selection: "native English checklist",
      selectionKind: "task-material",
      selectionKindReason: "selection looks like task material",
      queryTokens: ["native", "english", "checklist"],
      scannedCount: 2,
      acceptedCount: 1,
      results: [
        {
          echo: record,
          score: 72,
          strength: "strong",
          reason: "phrase",
          match: {
            field: "triggerText",
            label: "来源正文",
            snippet: "Use a checklist",
            terms: ["checklist"]
          }
        }
      ],
      candidates: [
        {
          echo: record,
          score: 72,
          accepted: true,
          reason: "来源正文中出现相同短语",
          echoIntent: "task-material",
          echoIntentReason: "task",
          matchKind: "task-material-recall",
          matchKindReason: "match",
          matchedTerms: ["native"],
          details: []
        },
        {
          echo: { ...record, id: "echo-2" },
          score: 12,
          accepted: false,
          reason: "证据不足",
          rejection: "low-evidence",
          echoIntent: "unknown",
          echoIntentReason: "none",
          matchKind: "unknown",
          matchKindReason: "none",
          matchedTerms: [],
          details: []
        }
      ]
    }

    const trace = buildRecallTrace(analysis, {
      generatedAt: new Date("2026-08-03T00:00:00.000Z"),
      stages: { lexicalMs: 14, totalMs: 14 }
    })

    expect(trace.privacy).toBe("local-only")
    expect(trace.traceId).toContain("2026-08-03")
    expect(trace.corpusSize).toBe(2)
    expect(trace.accepted).toBe(1)
    expect(trace.acceptedIds).toEqual(["echo-1"])
    expect(trace.rejections["low-evidence"]).toBe(1)
    expect(trace.totalMs).toBe(14)
    expect(trace.stages.lexicalMs).toBe(14)
  })
})
