import { analyzeRelatedEchoes } from "../../../extension/lib/echo-related"

import {
  GUARDED_MIN_LEXICAL,
  GUARDED_MIN_VECTOR_SPREAD,
  SURFACE_LIMIT,
  TOP_K,
  VECTOR_MIN_SIM,
  VECTOR_MIN_SPREAD
} from "./config"
import { cosine, embedQuery } from "./embed"
import type { BenchmarkEcho, RankedHit, StrategyRun } from "./types"

const labelOf = (echo: BenchmarkEcho) =>
  echo.userThought || echo.title || echo.triggerText.slice(0, 60)

const passageOf = (echo: BenchmarkEcho) =>
  [echo.userThought, echo.title, echo.triggerText, echo.inferredThought]
    .filter(Boolean)
    .join("\n")

export const runBm25 = (
  echoes: BenchmarkEcho[],
  selection: string,
  currentUrl?: string
): StrategyRun => {
  const started = performance.now()
  const analysis = analyzeRelatedEchoes(
    echoes as any,
    selection,
    SURFACE_LIMIT,
    currentUrl
  )
  const lexicalMs = performance.now() - started
  const hits: RankedHit[] = analysis.results.map((result: any) => ({
    id: result.echo.id,
    score: result.score,
    label: labelOf(result.echo),
    source: "bm25" as const,
    reason: result.reason
  }))
  return {
    name: "bm25",
    hits,
    latencyMs: lexicalMs,
    stages: { lexicalMs },
    abstained: hits.length === 0
  }
}

export const runVector = async (
  echoes: BenchmarkEcho[],
  embeddings: Map<string, number[]>,
  selection: string,
  gated: boolean
): Promise<StrategyRun> => {
  const stages: Record<string, number> = {}
  const q0 = performance.now()
  const queryVector = await embedQuery(selection)
  stages.queryEmbedMs = performance.now() - q0

  const r0 = performance.now()
  const ranked = echoes
    .map((echo) => {
      const vector = embeddings.get(echo.id)
      if (!vector) return null
      return {
        id: echo.id,
        score: cosine(queryVector, vector),
        label: labelOf(echo),
        source: "vector" as const
      }
    })
    .filter((hit): hit is RankedHit => hit !== null)
    .sort((left, right) => right.score - left.score)
  stages.rankMs = performance.now() - r0

  let hits = ranked.slice(0, TOP_K)
  if (gated) {
    const spread =
      hits.length >= 3 ? hits[0].score - hits[2].score : hits.length >= 2
        ? hits[0].score - hits[1].score
        : 1
    if (hits[0] && (hits[0].score < VECTOR_MIN_SIM || spread < VECTOR_MIN_SPREAD)) {
      hits = []
    } else {
      hits = hits
        .filter((hit) => hit.score >= VECTOR_MIN_SIM)
        .slice(0, SURFACE_LIMIT)
    }
  } else {
    hits = hits.slice(0, SURFACE_LIMIT)
  }

  return {
    name: "vector",
    hits,
    latencyMs: Object.values(stages).reduce((sum, value) => sum + value, 0),
    stages,
    abstained: hits.length === 0
  }
}

/**
 * Hybrid: lexical accepted results first (precision-first product gate),
 * then fill remaining slots with high-confidence vector-only ids.
 */
export const runHybrid = async (
  lexicalEchoes: BenchmarkEcho[],
  vectorEchoes: BenchmarkEcho[],
  embeddings: Map<string, number[]>,
  selection: string,
  currentUrl?: string
): Promise<StrategyRun> => {
  const stages: Record<string, number> = {}
  const l0 = performance.now()
  const lexical = runBm25(lexicalEchoes, selection, currentUrl)
  stages.lexicalMs = performance.now() - l0

  const v0 = performance.now()
  const queryVector = await embedQuery(selection)
  stages.queryEmbedMs = performance.now() - v0

  const r0 = performance.now()
  const vectorRanked = vectorEchoes
    .map((echo) => {
      const vector = embeddings.get(echo.id)
      if (!vector) return null
      return {
        id: echo.id,
        score: cosine(queryVector, vector),
        label: labelOf(echo),
        source: "vector" as const,
        reason: `cosine ${cosine(queryVector, vector).toFixed(3)}`
      }
    })
    .filter((hit): hit is RankedHit => hit !== null)
    .sort((left, right) => right.score - left.score)
  stages.vectorRankMs = performance.now() - r0

  const seen = new Set<string>()
  const hits: RankedHit[] = []
  for (const hit of lexical.hits) {
    if (hits.length >= SURFACE_LIMIT) break
    seen.add(hit.id)
    hits.push({ ...hit, source: "bm25" })
  }

  const spread =
    vectorRanked.length >= 3
      ? vectorRanked[0].score - vectorRanked[2].score
      : 1

  for (const hit of vectorRanked) {
    if (hits.length >= SURFACE_LIMIT) break
    if (seen.has(hit.id)) continue
    if (hit.score < VECTOR_MIN_SIM) continue
    if (spread < VECTOR_MIN_SPREAD && lexical.hits.length === 0) continue
    seen.add(hit.id)
    hits.push({
      ...hit,
      reason: `vector-only fill · ${hit.reason}`
    })
  }

  return {
    name: "hybrid",
    hits,
    latencyMs: Object.values(stages).reduce((sum, value) => sum + value, 0),
    stages,
    abstained: hits.length === 0
  }
}

/**
 * Precision-first fusion tuned only on the Report 4 dev set.
 * Surface one result when both retrievers strongly agree, or when the vector
 * top result is clearly separated from the rest. Otherwise stay quiet.
 */
export const runGuardedHybrid = async (
  lexicalEchoes: BenchmarkEcho[],
  vectorEchoes: BenchmarkEcho[],
  embeddings: Map<string, number[]>,
  selection: string,
  currentUrl?: string
): Promise<StrategyRun> => {
  const lexical = runBm25(lexicalEchoes, selection, currentUrl)
  const vector = await runVector(vectorEchoes, embeddings, selection, false)
  const lexicalTop = lexical.hits[0]
  const vectorTop = vector.hits[0]
  const vectorThird = vector.hits[2]
  const vectorSpread =
    vectorTop && vectorThird ? vectorTop.score - vectorThird.score : 0

  let hits: RankedHit[] = []
  if (
    lexicalTop &&
    vectorTop &&
    lexicalTop.id === vectorTop.id &&
    lexicalTop.score >= GUARDED_MIN_LEXICAL
  ) {
    hits = [
      {
        ...lexicalTop,
        source: "bm25",
        reason: `guarded agreement · lexical ${lexicalTop.score.toFixed(0)} · vector ${vectorTop.score.toFixed(3)}`
      }
    ]
  } else if (
    vectorTop &&
    vectorTop.score >= VECTOR_MIN_SIM &&
    vectorSpread >= GUARDED_MIN_VECTOR_SPREAD
  ) {
    hits = [
      {
        ...vectorTop,
        source: "vector",
        reason: `guarded vector rescue · spread ${vectorSpread.toFixed(3)}`
      }
    ]
  }

  return {
    name: "guarded-hybrid",
    hits,
    latencyMs: lexical.latencyMs + vector.latencyMs,
    stages: {
      lexicalMs: lexical.latencyMs,
      vectorMs: vector.latencyMs,
      vectorSpread
    },
    abstained: hits.length === 0
  }
}

export const buildPassageMap = (echoes: BenchmarkEcho[]) =>
  new Map(echoes.map((echo) => [echo.id, passageOf(echo)]))
