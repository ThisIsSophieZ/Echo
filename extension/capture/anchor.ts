import type {
  EchoAnchor,
  EchoTextQuoteAnchor
} from "~capture/types"
import {
  createProviderAnchor,
  findProviderTarget,
  loadOlderProviderMessages
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
): Promise<EchoAnchor> => {
  const blocks = blockTexts(fragment)
  const fallback = normalizeForAnchorMatch(plainText)
  const exactStart = (blocks[0] ?? fallback).slice(0, 160)
  const finalBlock = blocks.at(-1) ?? exactStart
  const exactEnd = finalBlock !== exactStart ? finalBlock.slice(-160) : undefined

  return Promise.resolve(createProviderAnchor(rangeStartElement(range))).then(
    (provider) => ({
      version: 2,
      quote: {
        exactStart,
        exactEnd,
        ...boundaryContext(range)
      },
      provider
    })
  )
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

const quoteMatchScore = (element: Element, quote: EchoTextQuoteAnchor) => {
  const blockText = normalizeForAnchorMatch(element.textContent ?? "")
  if (!blockText.includes(quote.exactStart)) return 0

  let score = 8
  const contextualText = normalizeForAnchorMatch(
    element.parentElement?.textContent ?? blockText
  )
  if (quote.exactEnd && contextualText.includes(quote.exactEnd)) score += 5
  if (quote.prefix && contextualText.includes(quote.prefix)) score += 3
  if (quote.suffix && contextualText.includes(quote.suffix)) score += 3
  return score
}

const findByTextQuote = (quote: EchoTextQuoteAnchor) => {
  const matches = candidateBlocks()
    .map((element) => ({ element, score: quoteMatchScore(element, quote) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)

  return matches[0]?.element ?? null
}

const findQuoteInside = (container: Element, quote: EchoTextQuoteAnchor) => {
  const candidates = [
    container,
    ...Array.from(container.querySelectorAll(ANCHOR_BLOCK_SELECTOR))
  ]
    .map((element) => ({ element, score: quoteMatchScore(element, quote) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score)

  return candidates[0]?.element ?? container
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

const findAnchorTarget = async (anchor: EchoAnchor) => {
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

    const providerTarget = await findProviderTarget(
      anchor.provider,
      normalizeForAnchorMatch(anchor.quote.exactStart)
    )
    if (providerTarget) return findQuoteInside(providerTarget, anchor.quote)
  }

  return findByTextQuote(anchor.quote) ?? findBySimilarText(anchor.quote)
}

const highlightTarget = (target: Element) => {
  try {
    target.scrollIntoView({
      behavior: "smooth",
      block: "center"
    })
  } catch {
    // Some hosts reject programmatic scroll; locating still succeeded.
  }

  try {
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
  } catch {
    // Web Animations may be unavailable or blocked by the host page.
  }
}

export const locateEchoAnchor = async (
  anchor: EchoAnchor,
  attempts = 80,
  intervalMs = 300
) => {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const target = await findAnchorTarget(anchor)
    if (target) {
      highlightTarget(target)
      return true
    }

    if (attempt > 0 && attempt % 2 === 0) {
      loadOlderProviderMessages(anchor.provider?.provider)
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }

  return false
}
