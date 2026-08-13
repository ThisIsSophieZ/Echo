import {
  analyzeRelatedEchoes,
  type RelatedEchoCandidateDiagnostic
} from "../../../extension/lib/echo-related"

import type { PublicEcho, RetrievalHit } from "./types"

export type RetrievalStrategy = "product-gate" | "candidate-bm25"

const hitFromCandidate = (
  candidate: RelatedEchoCandidateDiagnostic
): RetrievalHit => ({
  id: candidate.echo.id,
  title: candidate.echo.title,
  score: candidate.score,
  reason: candidate.accepted
    ? candidate.reason
    : `candidate after ${candidate.rejection ?? "product rejection"}: ${candidate.reason}`
})

export const selectCandidateDiagnostics = (
  candidates: RelatedEchoCandidateDiagnostic[],
  limit = 5
) =>
  candidates
    .filter(
      (candidate) =>
        candidate.score > 0 &&
        candidate.matchedTerms.length > 0 &&
        candidate.rejection !== "exact-source" &&
        candidate.rejection !== "duplicate"
    )
    .slice(0, limit)

export const retrieve = (
  strategy: RetrievalStrategy,
  echoes: PublicEcho[],
  question: string
): RetrievalHit[] => {
  const analysis = analyzeRelatedEchoes(
    echoes as any,
    question,
    strategy === "product-gate" ? 3 : 5
  )

  if (strategy === "product-gate") {
    return analysis.results.map((result) => ({
      id: result.echo.id,
      title: result.echo.title,
      score: result.score,
      reason: result.reason
    }))
  }

  return selectCandidateDiagnostics(analysis.candidates).map(hitFromCandidate)
}

