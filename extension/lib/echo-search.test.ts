import { describe, expect, it } from "vitest"

import type { Echo } from "../db/echoes"
import { matchesEchoSearch, normalizeSearchText } from "./echo-search"

const echo = (overrides: Partial<Echo> = {}): Echo => ({
  id: "echo-1",
  triggerText: "多模型帮我补全视角",
  userThought: "Keep the product quiet",
  inferredThought: "Contextual recall",
  sourceApp: "gemini",
  url: "https://gemini.google.com/app/example",
  title: "Echo product discussion",
  createdAt: "2026-07-01T00:00:00.000Z",
  status: "confirmed",
  ...overrides
})

describe("Echo search", () => {
  it("matches Chinese substrings", () => {
    expect(matchesEchoSearch(echo(), "补全视角")).toBe(true)
  })

  it("normalizes case and Unicode width", () => {
    expect(normalizeSearchText("ＥＣＨＯ  Product")).toBe("echo product")
    expect(matchesEchoSearch(echo(), "ECHO PRODUCT")).toBe(true)
  })

  it("requires every whitespace-separated term", () => {
    expect(matchesEchoSearch(echo(), "quiet gemini")).toBe(true)
    expect(matchesEchoSearch(echo(), "quiet claude")).toBe(false)
  })

  it("matches optional thought and source fields", () => {
    expect(matchesEchoSearch(echo(), "contextual")).toBe(true)
    expect(matchesEchoSearch(echo(), "gemini")).toBe(true)
  })
})
