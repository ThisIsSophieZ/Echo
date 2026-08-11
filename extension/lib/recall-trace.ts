import type {
  RelatedEchoAnalysis,
  RelatedEchoRejection
} from "~lib/echo-related"

export type RecallTraceStages = {
  lexicalMs?: number
  totalMs?: number
}

export type RecallTrace = {
  traceId: string
  generatedAt: string
  privacy: "local-only"
  queryLength: number
  corpusSize: number
  selectionKind: string
  queryTokens: string[]
  stages: RecallTraceStages
  candidates: number
  evidenceAboveZero: number
  accepted: number
  rejections: Partial<Record<RelatedEchoRejection | "other", number>>
  acceptedIds: string[]
  topRejectReasons: Array<{ reason: string; count: number }>
  totalMs: number | null
}

export type BuildRecallTraceOptions = {
  generatedAt?: Date
  stages?: RecallTraceStages
}

export const buildRecallTrace = (
  analysis: RelatedEchoAnalysis,
  options: BuildRecallTraceOptions = {}
): RecallTrace => {
  const generatedAt = options.generatedAt ?? new Date()
  const rejections: RecallTrace["rejections"] = {}
  const reasonCounts = new Map<string, number>()

  for (const candidate of analysis.candidates) {
    if (candidate.accepted) continue
    const key = candidate.rejection ?? "other"
    rejections[key] = (rejections[key] ?? 0) + 1
    const label = candidate.reason || key
    reasonCounts.set(label, (reasonCounts.get(label) ?? 0) + 1)
  }

  const evidenceAboveZero = analysis.candidates.filter(
    (candidate) => candidate.score > 0
  ).length

  const stages = options.stages ?? {}
  const totalMs =
    stages.totalMs ??
    (typeof stages.lexicalMs === "number" ? stages.lexicalMs : null)

  return {
    traceId: `echo-trace-${generatedAt.toISOString()}`,
    generatedAt: generatedAt.toISOString(),
    privacy: "local-only",
    queryLength: analysis.selection.length,
    corpusSize: analysis.scannedCount,
    selectionKind: analysis.selectionKind,
    queryTokens: analysis.queryTokens,
    stages,
    candidates: analysis.candidates.length,
    evidenceAboveZero,
    accepted: analysis.acceptedCount,
    rejections,
    acceptedIds: analysis.results.map((result) => result.echo.id),
    topRejectReasons: [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((left, right) => right.count - left.count)
      .slice(0, 8),
    totalMs
  }
}

export const serializeRecallTrace = (trace: RecallTrace) =>
  `${JSON.stringify(trace, null, 2)}\n`

export const downloadRecallTraceFile = (trace: RecallTrace) => {
  const stamp = trace.generatedAt.slice(0, 19).replace(/[:T]/g, "-")
  const blob = new Blob([serializeRecallTrace(trace)], {
    type: "application/json"
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `echo-recall-trace-${stamp}.json`
  link.click()
  URL.revokeObjectURL(url)
}
