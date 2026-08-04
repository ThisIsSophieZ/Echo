import type { BenchmarkQuery, QueryMetrics, RankedHit } from "./types"

export const precisionAtK = (
  hits: RankedHit[],
  relevant: Set<string>,
  k: number
) => {
  const top = hits.slice(0, k)
  if (!top.length) return 0
  return top.filter((hit) => relevant.has(hit.id)).length / top.length
}

export const recallAtK = (
  hits: RankedHit[],
  relevant: Set<string>,
  k: number
) => {
  if (!relevant.size) return 0
  const top = new Set(hits.slice(0, k).map((hit) => hit.id))
  let found = 0
  for (const id of relevant) if (top.has(id)) found += 1
  return found / relevant.size
}

export const mrr = (hits: RankedHit[], relevant: Set<string>) => {
  const index = hits.findIndex((hit) => relevant.has(hit.id))
  return index < 0 ? 0 : 1 / (index + 1)
}

export const firstRelevantRank = (hits: RankedHit[], relevant: Set<string>) => {
  const index = hits.findIndex((hit) => relevant.has(hit.id))
  return index < 0 ? 0 : index + 1
}

/**
 * False surface: system showed something, and none of the top-3 are relevant
 * (or expected abstain and anything surfaced).
 */
export const isFalseSurface = (
  query: BenchmarkQuery,
  hits: RankedHit[]
) => {
  if (!hits.length) return false
  if (query.expectedBehavior === "abstain") return true
  const relevant = new Set(query.relevant)
  return !hits.slice(0, 3).some((hit) => relevant.has(hit.id))
}

export const abstentionCorrect = (
  query: BenchmarkQuery,
  hits: RankedHit[]
): boolean | null => {
  if (query.expectedBehavior !== "abstain") return null
  return hits.length === 0
}

export const scoreQuery = (
  query: BenchmarkQuery,
  hits: RankedHit[]
): QueryMetrics => {
  const relevant = new Set(query.relevant)
  return {
    queryId: query.id,
    precisionAt3: precisionAtK(hits, relevant, 3),
    recallAt3: recallAtK(hits, relevant, 3),
    mrr: mrr(hits, relevant),
    falseSurface: isFalseSurface(query, hits),
    abstentionCorrect: abstentionCorrect(query, hits),
    firstRelevantRank: firstRelevantRank(hits, relevant)
  }
}

export type AggregateMetrics = {
  strategy: string
  n: number
  precisionAt3: number
  recallAt3: number
  mrr: number
  falseSurfacesPer100: number
  abstentionAccuracy: number | null
  latencyMsAvg: number
}

export const aggregate = (
  strategy: string,
  rows: Array<QueryMetrics & { latencyMs: number }>
): AggregateMetrics => {
  const n = rows.length
  const abstainRows = rows.filter((row) => row.abstentionCorrect !== null)
  return {
    strategy,
    n,
    precisionAt3: rows.reduce((sum, row) => sum + row.precisionAt3, 0) / n,
    recallAt3: rows.reduce((sum, row) => sum + row.recallAt3, 0) / n,
    mrr: rows.reduce((sum, row) => sum + row.mrr, 0) / n,
    falseSurfacesPer100:
      (rows.filter((row) => row.falseSurface).length / n) * 100,
    abstentionAccuracy: abstainRows.length
      ? abstainRows.filter((row) => row.abstentionCorrect).length /
        abstainRows.length
      : null,
    latencyMsAvg: rows.reduce((sum, row) => sum + row.latencyMs, 0) / n
  }
}
