import type { Echo } from "~db/echoes"

// Two resurface loops (see docs/product-discussion-updated.md section 11):
// - keep:    an echo that already carries the user's own thought -> seek "啊对".
// - collect: a raw external quote -> resurface to provoke a thought (-> Keep).
export type ResurfaceMode = "keep" | "collect"

export type ResurfaceContext = {
  title?: string
  url?: string
  selection?: string
  now?: number
}

export type ResurfaceItem = {
  echo: Echo
  score: number
  reasons: string[]
  mode: ResurfaceMode
}

const DAY_MS = 24 * 60 * 60 * 1000
// Don't resurface the same echo again within this window after it was shown.
const RESURFACE_COOLDOWN_MS = 12 * 60 * 60 * 1000
// Give a fresh echo at least this long before nagging about neglect.
const MIN_AGE_DAYS = 1
const DEFAULT_LIMIT = 3

const STOPWORDS = new Set([
  "the", "and", "for", "that", "this", "with", "you", "your", "are", "was",
  "but", "not", "have", "has", "from", "they", "其实", "因为", "所以", "一个",
  "可以", "我们", "什么", "这个", "那个", "就是", "但是", "如果", "这样"
])

// Lightweight tokenizer: latin words (>=3 chars) + CJK character bigrams.
// Bigrams give crude Chinese matching without a segmentation library.
const tokenize = (text?: string): string[] => {
  if (!text) return []
  const lower = text.toLowerCase()
  const tokens: string[] = []

  for (const word of lower.match(/[a-z0-9]{3,}/g) ?? []) {
    if (!STOPWORDS.has(word)) tokens.push(word)
  }

  for (const run of lower.match(/[\u4e00-\u9fff]+/g) ?? []) {
    if (run.length === 1) {
      tokens.push(run)
      continue
    }
    for (let i = 0; i < run.length - 1; i++) {
      const bigram = run.slice(i, i + 2)
      if (!STOPWORDS.has(bigram)) tokens.push(bigram)
    }
  }

  return tokens
}

const overlapCount = (tokens: string[], reference: Set<string>): number => {
  const counted = new Set<string>()
  let hits = 0
  for (const token of tokens) {
    if (reference.has(token) && !counted.has(token)) {
      counted.add(token)
      hits++
    }
  }
  return hits
}

const echoText = (echo: Echo): string =>
  [echo.userThought, echo.inferredThought, echo.triggerText, echo.title]
    .filter(Boolean)
    .join(" ")

// ===========================================================================
// THE SEAM — this is the one function to tune while dogfooding. Pure, no IO.
// Returns a score and the human-readable reasons that fired ("why surfaced").
// An echo only surfaces if at least one reason fires (see selectResurfaced).
// ===========================================================================
export const scoreEcho = (
  echo: Echo,
  ctx: ResurfaceContext
): { score: number; reasons: string[] } => {
  const reasons: string[] = []
  let score = 0
  const now = ctx.now ?? Date.now()
  const ageDays = (now - new Date(echo.createdAt).getTime()) / DAY_MS

  // Keep loop is the priority: own thoughts get a small standing boost. This is
  // a tie-breaker, not a reason on its own.
  if (echo.userThought) score += 2

  // Recency-neglect: aging and never revisited -> due for a look.
  if (ageDays >= MIN_AGE_DAYS && !echo.lastSurfacedAt) {
    score += Math.min(ageDays, 14)
    reasons.push(`存了 ${Math.round(ageDays)} 天还没回看`)
  }

  // Context relevance: keyword overlap with the page you're on right now.
  const ctxText = [ctx.title, ctx.selection].filter(Boolean).join(" ")
  if (ctxText) {
    const overlap = overlapCount(tokenize(echoText(echo)), new Set(tokenize(ctxText)))
    if (overlap > 0) {
      score += overlap * 4
      reasons.push("和你正在看的内容相关")
    }
  }

  return { score, reasons }
}

// ===========================================================================
// Stable pipeline — usually leave this alone. Filters out anything that should
// not resurface, scores the rest, and returns the strongest few with reasons.
// ===========================================================================
export const selectResurfaced = (
  echoes: Echo[],
  ctx: ResurfaceContext = {},
  limit: number = DEFAULT_LIMIT
): ResurfaceItem[] => {
  const now = ctx.now ?? Date.now()

  return echoes
    .filter((echo) => echo.status !== "ignored" && echo.status !== "pinned")
    .filter((echo) => !echo.snoozeUntil || new Date(echo.snoozeUntil).getTime() <= now)
    .filter(
      (echo) =>
        !echo.lastSurfacedAt ||
        now - new Date(echo.lastSurfacedAt).getTime() > RESURFACE_COOLDOWN_MS
    )
    .map<ResurfaceItem>((echo) => {
      const { score, reasons } = scoreEcho(echo, { ...ctx, now })
      return {
        echo,
        score,
        reasons,
        mode: echo.userThought ? "keep" : "collect"
      }
    })
    .filter((item) => item.score > 0 && item.reasons.length > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}

export const SNOOZE_DEFAULT_MS = 3 * DAY_MS
