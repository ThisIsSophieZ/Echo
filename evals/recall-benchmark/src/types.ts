/** Fixture Echo shape matching the product Dexie record (subset used by recall). */
export type BenchmarkEcho = {
  id: string
  userThought?: string
  inferredThought?: string
  title: string
  triggerText: string
  sourceApp: string
  url: string
  status: "raw" | "inferred" | "confirmed" | "ignored" | "pinned"
  createdAt: string
}

export type ExpectedBehavior = "surface" | "abstain"

export type BenchmarkQuery = {
  id: string
  text: string
  /** Echo ids that SHOULD be recalled if the system surfaces anything. */
  relevant: string[]
  /** Topic-adjacent but should NOT be treated as hits (hard negatives). */
  hardNegatives: string[]
  /** Whether a quiet product should surface at least one relevant Echo. */
  expectedBehavior: ExpectedBehavior
  /** Annotation note: why this query exists / what failure mode it probes. */
  rationale: string
  tags: string[]
}

export type StrategyName = "bm25" | "vector" | "hybrid"

export type RankedHit = {
  id: string
  score: number
  label: string
  source: StrategyName | "bm25" | "vector"
  reason?: string
}

export type StrategyRun = {
  name: StrategyName
  hits: RankedHit[]
  latencyMs: number
  stages?: Record<string, number>
  abstained: boolean
}

export type QueryMetrics = {
  queryId: string
  precisionAt3: number
  recallAt3: number
  mrr: number
  falseSurface: boolean
  abstentionCorrect: boolean | null
  firstRelevantRank: number
}
