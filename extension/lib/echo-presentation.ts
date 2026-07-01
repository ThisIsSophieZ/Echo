import type { Echo } from "~db/echoes"

const LONG_CHAR_THRESHOLD = 360
const LONG_LINE_THRESHOLD = 8

const normalizeInline = (value: string) => value.replace(/\s+/g, " ").trim()

export const sourceLabel = (source?: string) => {
  if (!source) return "Browser"
  return source.charAt(0).toUpperCase() + source.slice(1)
}

const fallbackPreview = (text: string) => {
  const lines = text
    .split("\n")
    .map(normalizeInline)
    .filter(Boolean)
  const value = lines.find((line) => line.length >= 8) ?? normalizeInline(text)
  return value.length > 180 ? `${value.slice(0, 180).trim()}…` : value
}

export const isLongCollect = (echo: Echo) => {
  if (echo.userThought) return false

  const features = echo.capture?.features
  if (!features) {
    return (
      echo.triggerText.length > LONG_CHAR_THRESHOLD ||
      echo.triggerText.split("\n").length > LONG_LINE_THRESHOLD
    )
  }

  return (
    features.charCount > LONG_CHAR_THRESHOLD ||
    features.lineCount > LONG_LINE_THRESHOLD ||
    features.tableCount > 0 ||
    features.listItemCount > 4 ||
    features.codeBlockCount > 0
  )
}

export const longCollectPresentation = (echo: Echo) => {
  const features = echo.capture?.features
  const source = sourceLabel(echo.sourceApp)
  const title = echo.capture?.title?.value || `Long capture from ${source}`
  const preview = echo.capture?.preview || fallbackPreview(echo.triggerText)

  let descriptor = "Long capture"
  if (features?.tableCount) {
    descriptor = features.tableCount > 1 ? `${features.tableCount} tables` : "Table"
  } else if (features?.codeBlockCount) {
    descriptor =
      features.codeBlockCount > 1 ? `${features.codeBlockCount} code blocks` : "Code"
  } else if (features?.listItemCount) {
    descriptor = `List · ${features.listItemCount} items`
  }

  const detail = features?.tableCount
    ? `${features.tableRowCount} rows`
    : `${features?.charCount ?? echo.triggerText.length} chars`

  return {
    title,
    preview,
    meta: `${descriptor} · ${detail} · ${source}`,
    markdown: echo.capture?.markdown || echo.triggerText
  }
}
