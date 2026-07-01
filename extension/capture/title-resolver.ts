import type { EchoCaptureTitle } from "~capture/types"
import { normalizeMultilineText } from "~capture/serializer"

const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6, caption"
const MESSAGE_SCOPE_SELECTOR = "article, [data-message-author-role], main"
const PREVIEW_SELECTOR = "p, li, blockquote"
const MAX_TITLE_LENGTH = 120
const MAX_PREVIEW_LENGTH = 180

const normalizeInline = (value: string) =>
  normalizeMultilineText(value).replace(/\s+/g, " ").trim()

const isBeforeRange = (element: Element, range: Range) => {
  try {
    return range.comparePoint(element, 0) < 0
  } catch {
    return Boolean(
      element.compareDocumentPosition(range.startContainer) & Node.DOCUMENT_POSITION_FOLLOWING
    )
  }
}

const textDistanceToRange = (element: Element, range: Range) => {
  try {
    const distanceRange = document.createRange()
    distanceRange.setStartAfter(element)
    distanceRange.setEnd(range.startContainer, range.startOffset)
    return normalizeInline(distanceRange.toString()).length
  } catch {
    return Number.POSITIVE_INFINITY
  }
}

export const resolveCaptureTitle = (
  range: Range,
  fragment: Element
): EchoCaptureTitle | undefined => {
  const selectedHeading = normalizeInline(
    fragment.querySelector(HEADING_SELECTOR)?.textContent ?? ""
  )
  if (selectedHeading) {
    return {
      value: selectedHeading.slice(0, MAX_TITLE_LENGTH),
      source: "selected-heading"
    }
  }

  const startElement =
    range.startContainer instanceof Element
      ? range.startContainer
      : range.startContainer.parentElement
  const scope = startElement?.closest(MESSAGE_SCOPE_SELECTOR) ?? document.body
  const headings = Array.from(scope.querySelectorAll(HEADING_SELECTOR)).filter((heading) =>
    isBeforeRange(heading, range)
  )
  const nearestHeading = headings.at(-1)
  const nearbyHeading =
    nearestHeading && textDistanceToRange(nearestHeading, range) <= 2500
      ? normalizeInline(nearestHeading.textContent ?? "")
      : ""

  return nearbyHeading
    ? {
        value: nearbyHeading.slice(0, MAX_TITLE_LENGTH),
        source: "nearby-heading"
      }
    : undefined
}

const completeSentence = (value: string) => {
  const clean = normalizeInline(value)
  if (clean.length <= MAX_PREVIEW_LENGTH) return clean

  const candidate = clean.slice(0, MAX_PREVIEW_LENGTH)
  const sentenceEnd = Math.max(
    candidate.lastIndexOf("。"),
    candidate.lastIndexOf("！"),
    candidate.lastIndexOf("？"),
    candidate.lastIndexOf(". "),
    candidate.lastIndexOf("! "),
    candidate.lastIndexOf("? ")
  )

  return `${candidate.slice(0, sentenceEnd > 40 ? sentenceEnd + 1 : MAX_PREVIEW_LENGTH).trim()}…`
}

export const resolveCapturePreview = (
  fragment: Element,
  plainText: string,
  title?: EchoCaptureTitle
) => {
  const candidates = Array.from(fragment.querySelectorAll(PREVIEW_SELECTOR))
    .map((element) => completeSentence(element.textContent ?? ""))
    .filter((value) => value.length >= 8 && value !== title?.value)

  if (candidates.length) return candidates[0]

  const tableRows = Array.from(fragment.querySelectorAll("tr"))
  const firstDataRow = tableRows.find((row, index) => index > 0 || !row.querySelector("th"))
  const tablePreview = firstDataRow
    ? completeSentence(
        Array.from(firstDataRow.children)
          .map((cell) => normalizeInline(cell.textContent ?? ""))
          .filter(Boolean)
          .join(" · ")
      )
    : ""
  if (tablePreview.length >= 8) return tablePreview

  const fallback = plainText
    .split("\n")
    .map(completeSentence)
    .find((value) => value.length >= 8 && value !== title?.value)

  return fallback ?? completeSentence(plainText)
}
