import assert from "node:assert/strict"
import test from "node:test"

import { expandWithDevAliases } from "./bilingual-aliases"

test("expands a frozen bilingual phrase group", () => {
  const expanded = expandWithDevAliases("how does memory retrieval work?")

  assert.deepEqual(expanded.matchedGroupIds, ["memory-retrieval"])
  assert.match(expanded.selection, /记忆/)
  assert.match(expanded.selection, /检索/)
})

test("leaves unmatched queries unchanged", () => {
  const selection = "a completely unrelated query"
  const expanded = expandWithDevAliases(selection)

  assert.equal(expanded.selection, selection)
  assert.deepEqual(expanded.matchedGroupIds, [])
})

test("does not duplicate a phrase already present", () => {
  const expanded = expandWithDevAliases("小根堆 heap")
  const standaloneHeapOccurrences = expanded.selection
    .split(/\s+/)
    .filter((term) => term === "heap")

  assert.equal(standaloneHeapOccurrences.length, 1)
})
