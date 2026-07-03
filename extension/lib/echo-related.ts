import type { Echo } from "~db/echoes"
import type { EchoSearchField, EchoSearchMatch } from "~lib/echo-search"

export type RelatedEchoResult = {
  echo: Echo
  score: number
  reason: string
  match: EchoSearchMatch
}

const FIELD_CONFIG: Array<{
  field: EchoSearchField
  label: string
  weight: number
}> = [
  { field: "userThought", label: "你的想法", weight: 5 },
  { field: "title", label: "标题", weight: 4 },
  { field: "inferredThought", label: "关联想法", weight: 3 },
  { field: "triggerText", label: "来源正文", weight: 2 }
]

const STOP_WORDS = new Set([
  "and",
  "are",
  "but",
  "for",
  "from",
  "have",
  "that",
  "the",
  "this",
  "with",
  "you",
  "your"
])

export const normalizeRelatedText = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim()

export const relatedTokens = (value: string) => {
  const normalized = normalizeRelatedText(value)
  const tokens = new Set<string>()

  for (const word of normalized.match(/[a-z0-9][a-z0-9_-]{2,}/g) ?? []) {
    if (!STOP_WORDS.has(word)) tokens.add(word)
  }

  for (const run of normalized.match(/[\u3400-\u9fff]+/g) ?? []) {
    if (run.length === 1) tokens.add(run)
    for (let index = 0; index < run.length - 1; index += 1) {
      tokens.add(run.slice(index, index + 2))
    }
  }

  return [...tokens]
}

const fieldText = (echo: Echo, field: EchoSearchField) => {
  if (field === "title") {
    return [echo.capture?.title?.value, echo.title].filter(Boolean).join("\n")
  }
  return echo[field] ?? ""
}

const compactSnippet = (value: string, token: string) => {
  const compact = value.replace(/\s+/g, " ").trim()
  if (compact.length <= 120) return compact

  const normalized = normalizeRelatedText(compact)
  const index = Math.max(0, normalized.indexOf(token))
  const start = Math.max(0, index - 28)
  const end = Math.min(compact.length, start + 120)
  return `${start ? "…" : ""}${compact.slice(start, end).trim()}${
    end < compact.length ? "…" : ""
  }`
}

export const rankRelatedEcho = (
  echo: Echo,
  selection: string
): RelatedEchoResult | null => {
  const normalizedSelection = normalizeRelatedText(selection)
  const queryTokens = relatedTokens(selection)
  if (!normalizedSelection || queryTokens.length < 2) return null
  if (normalizeRelatedText(echo.triggerText) === normalizedSelection) return null

  const fields = FIELD_CONFIG.map((config) => {
    const text = fieldText(echo, config.field)
    const normalized = normalizeRelatedText(text)
    const matched = queryTokens.filter((token) => normalized.includes(token))
    let score = matched.length * config.weight

    if (
      normalizedSelection.length >= 6 &&
      normalized.includes(normalizedSelection)
    ) {
      score += config.weight * 3
    }
    if (matched.length >= 2) score += config.weight

    return { ...config, matched, score, text }
  })

  const strongest = [...fields].sort((left, right) => right.score - left.score)[0]
  const totalScore = fields.reduce((total, field) => total + field.score, 0)
  if (!strongest || totalScore < 6 || strongest.matched.length === 0) return null

  const terms = strongest.matched.slice(0, 3)
  return {
    echo,
    score: totalScore,
    reason: `${strongest.label}命中：${terms.join("、")}`,
    match: {
      field: strongest.field,
      label: strongest.label,
      snippet: compactSnippet(strongest.text, terms[0]),
      terms
    }
  }
}

export const findRelatedEchoes = (
  echoes: Echo[],
  selection: string,
  limit = 3
) =>
  echoes
    .map((echo) => rankRelatedEcho(echo, selection))
    .filter((result): result is RelatedEchoResult => result !== null)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.echo.createdAt.localeCompare(left.echo.createdAt)
    )
    .slice(0, limit)
