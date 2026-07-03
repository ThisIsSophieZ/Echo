import { useState } from "react"

import { SearchHighlight } from "~components/SearchHighlight"

const COLLAPSED_LINES = 5
// Sidebar width ~280px; rough wrapped-line estimate when text has no explicit newlines.
const CHARS_PER_LINE = 42

type ExpandableTextProps = {
  text: string
  tone?: "primary" | "quote"
  highlightTerms?: string[]
}

const estimateWrappedLines = (text: string) => {
  const blocks = text.split("\n")
  return blocks.reduce((total, block) => {
    const trimmed = block.trim()
    if (!trimmed) return total + 1
    return total + Math.max(1, Math.ceil(trimmed.length / CHARS_PER_LINE))
  }, 0)
}

export const needsExpandCollapse = (text: string) =>
  estimateWrappedLines(text) > COLLAPSED_LINES

export const ExpandableText = ({
  text,
  tone = "primary",
  highlightTerms
}: ExpandableTextProps) => {
  const [expanded, setExpanded] = useState(false)
  const collapsible = needsExpandCollapse(text)
  const toneClass = tone === "quote" ? "text-on-surface-variant" : "text-on-surface"

  return (
    <div>
      <p
        className={`whitespace-pre-wrap break-words text-body-md leading-snug ${toneClass} ${
          collapsible && !expanded ? "line-clamp-5" : ""
        }`}>
        <SearchHighlight terms={highlightTerms} text={text} />
      </p>
      {collapsible ? (
        <button
          className="mt-1 text-label-sm font-medium text-primary transition hover:underline"
          onClick={() => setExpanded((value) => !value)}
          type="button">
          {expanded ? "收起" : "展开全文"}
        </button>
      ) : null}
    </div>
  )
}
