import assert from "node:assert/strict"
import test from "node:test"

import { selectCandidateDiagnostics } from "./retrievers"

const candidate = (overrides: Record<string, unknown>) =>
  ({
    echo: { id: "e1", title: "test", createdAt: "2026-01-01" },
    score: 40,
    accepted: false,
    reason: "possible evidence",
    rejection: "possible-only",
    echoIntent: "knowledge",
    echoIntentReason: "test",
    matchKind: "knowledge-to-knowledge",
    matchKindReason: "test",
    matchedTerms: ["evidence"],
    details: [],
    ...overrides
  }) as any

test("keeps rejected candidates that still have lexical evidence", () => {
  const selected = selectCandidateDiagnostics([
    candidate({ rejection: "possible-only" })
  ])

  assert.equal(selected.length, 1)
})

test("excludes zero-overlap and duplicate candidates", () => {
  const selected = selectCandidateDiagnostics([
    candidate({ score: 0, matchedTerms: [], rejection: "no-overlap" }),
    candidate({ rejection: "duplicate" })
  ])

  assert.equal(selected.length, 0)
})

test("limits the broader candidate set", () => {
  const selected = selectCandidateDiagnostics(
    Array.from({ length: 8 }, (_, index) =>
      candidate({ echo: { id: `e${index}`, title: "test" } })
    ),
    5
  )

  assert.equal(selected.length, 5)
})

