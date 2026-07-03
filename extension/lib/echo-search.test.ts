import { describe, expect, it } from "vitest"

import type { Echo } from "../db/echoes"
import {
  matchesEchoSearch,
  normalizeSearchText,
  rankEchoSearch,
  searchEchoes
} from "./echo-search"

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

  it("ranks the user's thought above a source-text match", () => {
    const sourceMatch = echo({
      id: "source",
      triggerText: "quiet",
      userThought: undefined,
      inferredThought: undefined,
      title: "",
      createdAt: "2026-07-02T12:00:00.000Z"
    })
    const thoughtMatch = echo({
      id: "thought",
      triggerText: "unrelated source",
      userThought: "quiet",
      inferredThought: undefined,
      title: "",
      createdAt: "2026-07-01T12:00:00.000Z"
    })

    expect(searchEchoes([sourceMatch, thoughtMatch], "quiet")[0].echo.id).toBe(
      "thought"
    )
  })

  it("uses newest-first ordering when relevance scores tie", () => {
    const oldEcho = echo({
      id: "old",
      triggerText: "search target",
      userThought: undefined,
      inferredThought: undefined,
      title: "",
      createdAt: "2026-07-01T12:00:00.000Z"
    })
    const newEcho = echo({
      ...oldEcho,
      id: "new",
      createdAt: "2026-07-02T12:00:00.000Z"
    })

    expect(searchEchoes([oldEcho, newEcho], "search target")[0].echo.id).toBe(
      "new"
    )
  })

  it("boosts an exact phrase above separated terms in the same field", () => {
    const exactPhrase = echo({
      id: "exact",
      userThought: "quiet product",
      createdAt: "2026-07-01T12:00:00.000Z"
    })
    const separatedTerms = echo({
      id: "separated",
      userThought: "quiet and useful product",
      createdAt: "2026-07-02T12:00:00.000Z"
    })

    expect(
      searchEchoes([separatedTerms, exactPhrase], "quiet product")[0].echo.id
    ).toBe("exact")
  })

  it("returns a focused snippet for a match inside long source text", () => {
    const record = echo({
      triggerText: `${"opening ".repeat(30)}critical phrase${" ending".repeat(30)}`,
      userThought: undefined,
      inferredThought: undefined,
      title: ""
    })
    const result = rankEchoSearch(record, "critical")

    expect(result?.match?.field).toBe("triggerText")
    expect(result?.match?.snippet).toContain("critical")
    expect(result?.match?.terms).toEqual(["critical"])
    expect(result?.match?.snippet.length).toBeLessThanOrEqual(152)
  })

  it("matches a structured capture title", () => {
    const record = echo({
      title: "Generic page title",
      capture: {
        version: 1,
        markdown: "Source",
        preview: "Source",
        features: {
          charCount: 6,
          lineCount: 1,
          tableCount: 0,
          tableRowCount: 0,
          listItemCount: 0,
          codeBlockCount: 0
        },
        title: {
          value: "Recommended priorities",
          source: "selected-heading"
        },
        anchor: {
          quote: {
            exactStart: "Source"
          }
        }
      }
    })

    expect(rankEchoSearch(record, "recommended priorities")?.match?.field).toBe(
      "title"
    )
  })
})
