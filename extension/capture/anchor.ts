import type {
  EchoAnchor,
  EchoTextQuoteAnchor
} from "~capture/types"
import {
  createProviderAnchor,
  findProviderTarget
} from "~capture/provider-anchor"

const ANCHOR_BLOCK_SELECTOR = "p, li, blockquote, td, th, pre, h1, h2, h3, h4, h5, h6"

export const normalizeForAnchorMatch = (value: string) =>
  value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()

const boundaryContext = (range: Range) => {
  const prefix =
    range.startContainer.nodeType === Node.TEXT_NODE
      ? normalizeForAnchorMatch(
          (range.startContainer.textContent ?? "").slice(
            Math.max(0, range.startOffset - 80),
            range.startOffset
          )
        )
      : ""
  const suffix =
    range.endContainer.nodeType === Node.TEXT_NODE
      ? normalizeForAnchorMatch(
          (range.endContainer.textContent ?? "").slice(range.endOffset, range.endOffset + 80)
        )
      : ""

  return {
    prefix: prefix || undefined,
    suffix: suffix || undefined
  }
}

const rangeStartElement = (range: Range) => {
  const startElement =
    range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement
  return startElement
}

const blockTexts = (fragment: Element) =>
  Array.from(fragment.querySelectorAll(ANCHOR_BLOCK_SELECTOR))
    .map((element) => normalizeForAnchorMatch(element.textContent ?? ""))
    .filter((value) => value.length >= 8)

export const createEchoAnchor = (
  range: Range,
  fragment: Element,
  plainText: string
): EchoAnchor => {
  const blocks = blockTexts(fragment)
  const fallback = normalizeForAnchorMatch(plainText)
  const exactStart = (blocks[0] ?? fallback).slice(0, 160)
  const finalBlock = blocks.at(-1) ?? exactStart
  const exactEnd = finalBlock !== exactStart ? finalBlock.slice(-160) : undefined

  return {
    quote: {
      exactStart,
      exactEnd,
      ...boundaryContext(range)
    },
    provider: createProviderAnchor(rangeStartElement(range))
  }
}

const candidateBlocks = () =>
  Array.from(document.querySelectorAll(ANCHOR_BLOCK_SELECTOR))

const anchorTokens = (value: string) => {
  const normalized = normalizeForAnchorMatch(value).toLowerCase()
  const tokens = new Set<string>(normalized.match(/[a-z0-9]{3,}/g) ?? [])

  for (const run of normalized.match(/[\u3400-\u9fff]+/g) ?? []) {
    for (let index = 0; index < run.length - 1; index += 1) {
      tokens.add(run.slice(index, index + 2))
    }
  }

  return tokens
}

const tokenSimilarity = (left: Set<string>, right: Set<string>) => {
  if (!left.size || !right.size) return 0

  let intersection = 0
  for (const token of left) {
    if (right.has(token)) intersection += 1
  }

  return (2 * intersection) / (left.size + right.size)
}

const ancestorContaining = (element: Element, text: string) => {
  let current: Element | null = element
  for (let depth = 0; current && depth < 8; depth += 1) {
    if (normalizeForAnchorMatch(current.textContent ?? "").includes(text)) return current
    current = current.parentElement
  }
  return null
}

const findByTextQuote = (quote: EchoTextQuoteAnchor) => {
  const matches = candidateBlocks().filter((element) =>
    normalizeForAnchorMatch(element.textContent ?? "").includes(quote.exactStart)
  )

  if (!matches.length) return null
  if (!quote.exactEnd) return matches[0]

  for (const match of matches) {
    const container = ancestorContaining(match, quote.exactEnd)
    if (container) return match
  }

  return matches[0]
}

const findBySimilarText = (quote: EchoTextQuoteAnchor) => {
  const expected = anchorTokens(quote.exactStart)
  const maxLength = Math.max(500, quote.exactStart.length * 4)
  let best: { element: Element; score: number } | null = null

  for (const element of candidateBlocks()) {
    const text = normalizeForAnchorMatch(element.textContent ?? "")
    if (text.length < 8 || text.length > maxLength) continue

    const score = tokenSimilarity(expected, anchorTokens(text))
    if (!best || score > best.score) best = { element, score }
  }

  return best && best.score >= 0.48 ? best.element : null
}

const findAnchorTarget = (anchor: EchoAnchor) => {
  if (anchor.provider) {
    const legacyAttribute = anchor.provider.attribute
    const legacyValue = anchor.provider.value
    const legacyTarget =
      legacyAttribute && legacyValue
        ? document.querySelector(
            `[${legacyAttribute}="${CSS.escape(legacyValue)}"]`
          )
        : null
    if (legacyTarget) return legacyTarget

    const providerTarget = findProviderTarget(
      anchor.provider,
      normalizeForAnchorMatch(anchor.quote.exactStart)
    )
    if (providerTarget) return providerTarget
  }

  return findByTextQuote(anchor.quote) ?? findBySimilarText(anchor.quote)
}

const highlightTarget = (target: Element) => {
  target.scrollIntoView({
    behavior: "smooth",
    block: "center"
  })
  target.animate(
    [
      { backgroundColor: "rgba(26, 115, 232, 0)" },
      { backgroundColor: "rgba(26, 115, 232, 0.24)", offset: 0.2 },
      { backgroundColor: "rgba(26, 115, 232, 0.24)", offset: 0.75 },
      { backgroundColor: "rgba(26, 115, 232, 0)" }
    ],
    {
      duration: 2800,
      easing: "ease-out"
    }
  )
}

export const locateEchoAnchor = async (
  anchor: EchoAnchor,
  attempts = 30,
  intervalMs = 500
) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const target = findAnchorTarget(anchor)
    if (target) {
      highlightTarget(target)
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  return false
}
