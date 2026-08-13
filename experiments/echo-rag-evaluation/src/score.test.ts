import assert from "node:assert/strict"
import test from "node:test"

import { scoreRetrieval } from "./score"
import type { RagQuestion, RetrievalHit } from "./types"

const question = (overrides: Partial<RagQuestion> = {}): RagQuestion => ({
  id: "Q1",
  question: "Why?",
  expectedBehavior: "answer",
  requiredEvidence: ["e1", "e2"],
  supportingEvidence: [],
  hardNegatives: ["e9"],
  acceptableClaims: [],
  forbiddenClaims: [],
  testTypes: [],
  whyThisTestMatters: "test",
  ...overrides
})

const hit = (id: string): RetrievalHit => ({
  id,
  title: id,
  score: 90,
  reason: "test"
})

test("scores complete required-evidence coverage", () => {
  const score = scoreRetrieval(question(), [hit("e1"), hit("e2")])

  assert.equal(score.requiredEvidenceCoverage, 1)
  assert.equal(score.allRequiredEvidenceRetrieved, true)
  assert.deepEqual(score.missingRequiredEvidence, [])
})

test("separates partial coverage from hard-negative exposure", () => {
  const score = scoreRetrieval(question(), [hit("e1"), hit("e9")])

  assert.equal(score.requiredEvidenceCoverage, 0.5)
  assert.equal(score.allRequiredEvidenceRetrieved, false)
  assert.deepEqual(score.missingRequiredEvidence, ["e2"])
  assert.deepEqual(score.hardNegativeHits, ["e9"])
})

test("does not invent required-evidence metrics for abstention questions", () => {
  const score = scoreRetrieval(
    question({ expectedBehavior: "abstain", requiredEvidence: [] }),
    [hit("e9")]
  )

  assert.equal(score.requiredEvidenceCoverage, null)
  assert.equal(score.allRequiredEvidenceRetrieved, null)
  assert.equal(score.retrievalAbstained, false)
  assert.deepEqual(score.hardNegativeHits, ["e9"])
})

