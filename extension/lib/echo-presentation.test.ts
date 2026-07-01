import { describe, expect, it } from "vitest"

import type { Echo } from "../db/echoes"
import {
  echoClipboardMarkdown,
  isLongCollect,
  longCollectPresentation
} from "./echo-presentation"

const echo = (overrides: Partial<Echo> = {}): Echo => ({
  id: "echo-1",
  triggerText: "A useful source fragment",
  sourceApp: "gemini",
  url: "https://gemini.google.com/app/example",
  title: "Example",
  createdAt: "2026-07-01T00:00:00.000Z",
  status: "raw",
  ...overrides
})

describe("long Collect presentation", () => {
  it("keeps a long Collect compact after a quick thought is added", () => {
    const record = echo({
      triggerText: "source ".repeat(80),
      userThought: "This is useful",
      status: "confirmed"
    })

    expect(isLongCollect(record)).toBe(true)
  })

  it("does not treat a long manual Keep as a long Collect", () => {
    const thought = "my thought ".repeat(80).trim()
    const record = echo({
      triggerText: thought,
      userThought: thought,
      status: "confirmed"
    })

    expect(isLongCollect(record)).toBe(false)
  })

  it("keeps structured metadata in the compact presentation", () => {
    const record = echo({
      triggerText: "Priority\tAction\nP0\tFix capture",
      capture: {
        version: 1,
        markdown: "| Priority | Action |\n| --- | --- |\n| P0 | Fix capture |",
        preview: "P0 Fix capture",
        features: {
          charCount: 30,
          lineCount: 2,
          tableCount: 1,
          tableRowCount: 2,
          listItemCount: 0,
          codeBlockCount: 0
        },
        title: {
          value: "Recommended priorities",
          source: "selected-heading"
        },
        anchor: {
          quote: {
            exactStart: "Priority Action"
          }
        }
      }
    })

    expect(longCollectPresentation(record)).toMatchObject({
      title: "Recommended priorities",
      preview: "P0 Fix capture",
      meta: "Table · 2 rows · Gemini"
    })
  })
})

describe("Echo clipboard Markdown", () => {
  it("copies stored structured Markdown instead of flattened text", () => {
    const markdown = "| A | B |\n| --- | --- |\n| 1 | 2 |"
    const record = echo({
      triggerText: "A B 1 2",
      capture: {
        version: 1,
        markdown,
        preview: "A B",
        features: {
          charCount: 7,
          lineCount: 1,
          tableCount: 1,
          tableRowCount: 2,
          listItemCount: 0,
          codeBlockCount: 0
        },
        anchor: {
          quote: {
            exactStart: "A B"
          }
        }
      }
    })

    expect(echoClipboardMarkdown(record)).toBe(markdown)
  })

  it("combines a quick thought and source Markdown once", () => {
    const record = echo({
      triggerText: "- first\n- second",
      userThought: "Compare this with the other model",
      status: "confirmed",
      capture: {
        version: 1,
        markdown: "- first\n- second",
        preview: "first",
        features: {
          charCount: 12,
          lineCount: 2,
          tableCount: 0,
          tableRowCount: 0,
          listItemCount: 2,
          codeBlockCount: 0
        },
        anchor: {
          quote: {
            exactStart: "first"
          }
        }
      }
    })

    expect(echoClipboardMarkdown(record)).toBe(
      "## 想法\n\nCompare this with the other model\n\n## 来源片段\n\n- first\n- second"
    )
  })

  it("copies a manual Keep without duplicating it", () => {
    const record = echo({
      triggerText: "A thought of my own",
      userThought: "A thought of my own",
      status: "confirmed"
    })

    expect(echoClipboardMarkdown(record)).toBe("A thought of my own")
  })
})
