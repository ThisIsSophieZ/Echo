import type { Echo } from "~db/echoes"

export type EchoSearchField =
  | "userThought"
  | "title"
  | "inferredThought"
  | "triggerText"
  | "sourceApp"

export type EchoSearchMatch = {
  field: EchoSearchField
  label: string
  snippet: string
}

export type EchoSearchResult = {
  echo: Echo
  score: number
  match?: EchoSearchMatch
}

const FIELD_CONFIG: Array<{
  field: EchoSearchField
  label: string
  weight: number
}> = [
  { field: "userThought", label: "你的想法", weight: 8 },
  { field: "title", label: "标题", weight: 7 },
  { field: "inferredThought", label: "关联想法", weight: 6 },
  { field: "triggerText", label: "来源正文", weight: 4 },
  { field: "sourceApp", label: "来源", weight: 2 }
]

export const normalizeSearchText = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim()

const fieldText = (echo: Echo, field: EchoSearchField) => {
  if (field === "title") {
    return [echo.capture?.title?.value, echo.title].filter(Boolean).join("\n")
  }

  return echo[field] ?? ""
}

const matchSnippet = (value: string, terms: string[], maxLength = 150) => {
  const compact = value.replace(/\s+/g, " ").trim()
  if (compact.length <= maxLength) return compact

  const normalized = normalizeSearchText(compact)
  const indexes = terms
    .map((term) => normalized.indexOf(term))
    .filter((index) => index >= 0)
  const firstMatch = indexes.length ? Math.min(...indexes) : 0
  const start = Math.max(0, firstMatch - 36)
  const end = Math.min(compact.length, start + maxLength)

  return `${start > 0 ? "…" : ""}${compact.slice(start, end).trim()}${
    end < compact.length ? "…" : ""
  }`
}

export const rankEchoSearch = (echo: Echo, query: string): EchoSearchResult | null => {
  const terms = normalizeSearchText(query).split(" ").filter(Boolean)
  if (!terms.length) return { echo, score: 0 }

  const normalizedQuery = terms.join(" ")
  const fields = FIELD_CONFIG.map((config) => {
    const text = fieldText(echo, config.field)
    const normalized = normalizeSearchText(text)
    const matchedTerms = terms.filter((term) => normalized.includes(term))
    let score = matchedTerms.length * config.weight

    if (normalized.includes(normalizedQuery)) score += config.weight * 4
    if (matchedTerms.length === terms.length) score += config.weight * 2

    return {
      ...config,
      text,
      normalized,
      score
    }
  })

  const searchableText = fields.map((field) => field.normalized).join("\n")
  if (!terms.every((term) => searchableText.includes(term))) return null

  const strongestField = [...fields].sort((a, b) => b.score - a.score)[0]

  return {
    echo,
    score: fields.reduce((total, field) => total + field.score, 0),
    match:
      strongestField?.score > 0
        ? {
            field: strongestField.field,
            label: strongestField.label,
            snippet: matchSnippet(strongestField.text, terms)
          }
        : undefined
  }
}

export const matchesEchoSearch = (echo: Echo, query: string) =>
  rankEchoSearch(echo, query) !== null

export const searchEchoes = (echoes: Echo[], query: string): EchoSearchResult[] =>
  echoes
    .map((echo) => rankEchoSearch(echo, query))
    .filter((result): result is EchoSearchResult => result !== null)
    .sort(
      (a, b) =>
        b.score - a.score || b.echo.createdAt.localeCompare(a.echo.createdAt)
    )
