import assert from "node:assert/strict"
import test from "node:test"

import { scoreGeneration } from "./generation-score"
import type { GeneratedAnswer, RagQuestion } from "./types"

const question: RagQuestion = {
  id: "Q1",
  question: "Why?",
  expectedBehavior: "answer",
  requiredEvidence: ["e1", "e2"],
  supportingEvidence: [],
  hardNegatives: [],
  acceptableClaims: [],
  forbiddenClaims: [],
  testTypes: [],
  whyThisTestMatters: "test"
}

const answer: GeneratedAnswer = {
  status: "answered",
  answer: "Because.",
  claims: [{ text: "Because.", citations: ["e1"] }],
  reason: "Evidence supports it."
}

test("scores behavior and required citation coverage", () => {
  const score = scoreGeneration(question, answer, ["e1", "e2"])

  assert.equal(score.behaviorCorrect, true)
  assert.equal(score.requiredEvidenceCitationCoverage, 0.5)
  assert.equal(score.allRequiredEvidenceCited, false)
})

test("flags citations that were not supplied to the model", () => {
  const score = scoreGeneration(
    question,
    { ...answer, claims: [{ text: "Because.", citations: ["e9"] }] },
    ["e1", "e2"]
  )

  assert.deepEqual(score.invalidCitationIds, ["e9"])
})

test("scores correct abstention without inventing citation coverage", () => {
  const score = scoreGeneration(
    { ...question, expectedBehavior: "abstain", requiredEvidence: [] },
    { status: "abstained", answer: "", claims: [], reason: "No evidence." },
    []
  )

  assert.equal(score.behaviorCorrect, true)
  assert.equal(score.requiredEvidenceCitationCoverage, null)
})
