export type PublicEcho = {
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

export type RagQuestion = {
  id: string
  question: string
  expectedBehavior: "answer" | "abstain"
  requiredEvidence: string[]
  supportingEvidence: string[]
  hardNegatives: string[]
  acceptableClaims: string[]
  forbiddenClaims: string[]
  testTypes: string[]
  whyThisTestMatters: string
}

export type QuestionSet = {
  datasetVersion: string
  datasetRole: "development" | "holdout"
  frozenAt?: string
  corpus: string
  privacy: string
  scoringBoundary: string
  sampleSizeWarning?: string
  questions: RagQuestion[]
}

export type CorpusFile = {
  fixtureVersion: string
  echoes: PublicEcho[]
}

export type RetrievalHit = {
  id: string
  title: string
  score: number
  reason: string
}

export type RetrievalScore = {
  requiredEvidenceCoverage: number | null
  allRequiredEvidenceRetrieved: boolean | null
  anyRequiredEvidenceRetrieved: boolean | null
  missingRequiredEvidence: string[]
  hardNegativeHits: string[]
  retrievalAbstained: boolean
}

export type RetrievalRow = {
  question: RagQuestion
  hits: RetrievalHit[]
  latencyMs: number
  score: RetrievalScore
}

export type GeneratedClaim = {
  text: string
  citations: string[]
}

export type GeneratedAnswer = {
  status: "answered" | "abstained"
  answer: string
  claims: GeneratedClaim[]
  reason: string
}

export type GenerationUsage = {
  promptTokens: number
  outputTokens: number
  totalDurationMs: number
  loadDurationMs: number
  promptEvalDurationMs: number
  generationDurationMs: number
  estimatedApiCostUsd: number
}

export type GenerationScore = {
  behaviorCorrect: boolean
  citedIds: string[]
  invalidCitationIds: string[]
  uncitedClaims: number
  requiredEvidenceCitationCoverage: number | null
  allRequiredEvidenceCited: boolean | null
}
