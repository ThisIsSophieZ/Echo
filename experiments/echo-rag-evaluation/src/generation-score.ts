import type {
  GeneratedAnswer,
  GenerationScore,
  RagQuestion
} from "./types"

export const scoreGeneration = (
  question: RagQuestion,
  answer: GeneratedAnswer,
  providedEvidenceIds: string[]
): GenerationScore => {
  const provided = new Set(providedEvidenceIds)
  const citedIds = [...new Set(answer.claims.flatMap((claim) => claim.citations))]
  const cited = new Set(citedIds)
  const hasRequired = question.requiredEvidence.length > 0

  return {
    behaviorCorrect:
      (question.expectedBehavior === "answer" && answer.status === "answered") ||
      (question.expectedBehavior === "abstain" && answer.status === "abstained"),
    citedIds,
    invalidCitationIds: citedIds.filter((id) => !provided.has(id)),
    uncitedClaims: answer.claims.filter((claim) => claim.citations.length === 0)
      .length,
    requiredEvidenceCitationCoverage: hasRequired
      ? question.requiredEvidence.filter((id) => cited.has(id)).length /
        question.requiredEvidence.length
      : null,
    allRequiredEvidenceCited: hasRequired
      ? question.requiredEvidence.every((id) => cited.has(id))
      : null
  }
}
