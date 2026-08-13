import type { RagQuestion, RetrievalHit, RetrievalScore } from "./types"

export const scoreRetrieval = (
  question: RagQuestion,
  hits: RetrievalHit[]
): RetrievalScore => {
  const hitIds = new Set(hits.map((hit) => hit.id))
  const requiredFound = question.requiredEvidence.filter((id) => hitIds.has(id))
  const hasRequiredEvidence = question.requiredEvidence.length > 0

  return {
    requiredEvidenceCoverage: hasRequiredEvidence
      ? requiredFound.length / question.requiredEvidence.length
      : null,
    allRequiredEvidenceRetrieved: hasRequiredEvidence
      ? requiredFound.length === question.requiredEvidence.length
      : null,
    anyRequiredEvidenceRetrieved: hasRequiredEvidence
      ? requiredFound.length > 0
      : null,
    missingRequiredEvidence: question.requiredEvidence.filter(
      (id) => !hitIds.has(id)
    ),
    hardNegativeHits: question.hardNegatives.filter((id) => hitIds.has(id)),
    retrievalAbstained: hits.length === 0
  }
}
const percentile = (values: number[], ratio: number) => {
  if (!values.length) return 0
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.ceil(sorted.length * ratio) - 1]
}

export const aggregateRetrieval = (
  rows: Array<{ question: RagQuestion; latencyMs: number; score: RetrievalScore }>
) => {
  const answerRows = rows.filter(
    ({ question }) => question.expectedBehavior === "answer"
  )
  const abstainRows = rows.filter(
    ({ question }) => question.expectedBehavior === "abstain"
  )
  const latencies = rows.map(({ latencyMs }) => latencyMs)

  return {
    questions: rows.length,
    answerQuestions: answerRows.length,
    abstentionQuestions: abstainRows.length,
    requiredEvidenceCoverageAvg: answerRows.length
      ? answerRows.reduce(
          (sum, { score }) => sum + (score.requiredEvidenceCoverage ?? 0),
          0
        ) / answerRows.length
      : 0,
    allRequiredEvidenceRetrievedRate: answerRows.length
      ? answerRows.filter(({ score }) => score.allRequiredEvidenceRetrieved).length /
        answerRows.length
      : 0,
    anyRequiredEvidenceRetrievedRate: answerRows.length
      ? answerRows.filter(({ score }) => score.anyRequiredEvidenceRetrieved).length /
        answerRows.length
      : 0,
    retrievalSilenceOnAbstentionRate: abstainRows.length
      ? abstainRows.filter(({ score }) => score.retrievalAbstained).length /
        abstainRows.length
      : null,
    questionsWithHardNegativeExposure: rows.filter(
      ({ score }) => score.hardNegativeHits.length > 0
    ).length,
    latencyMsAvg: latencies.length
      ? latencies.reduce((sum, value) => sum + value, 0) / latencies.length
      : 0,
    latencyMsP50: percentile(latencies, 0.5),
    latencyMsP95: percentile(latencies, 0.95)
  }
}

