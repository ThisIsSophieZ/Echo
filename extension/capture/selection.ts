import { createEchoAnchor } from "~capture/anchor"
import {
  analyzeFragment,
  fragmentToMarkdown,
  fragmentToPlainText
} from "~capture/serializer"
import {
  resolveCapturePreview,
  resolveCaptureTitle
} from "~capture/title-resolver"
import type { SelectionCapture } from "~capture/types"

export const getSelectionPlainText = (): string | null => {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null

  const plainText = selection.toString().replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()
  return plainText || null
}

export const getSelectionCapture = async (): Promise<SelectionCapture | null> => {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null

  const range = selection.getRangeAt(0)
  const fragment = document.createElement("div")
  fragment.appendChild(range.cloneContents())

  const plainText = fragmentToPlainText(fragment)
  if (!plainText) return null

  const title = resolveCaptureTitle(range, fragment)

  return {
    plainText,
    capture: {
      version: 1,
      markdown: fragmentToMarkdown(fragment) || plainText,
      preview: resolveCapturePreview(fragment, plainText, title),
      title,
      features: analyzeFragment(fragment, plainText),
      anchor: await createEchoAnchor(range, fragment, plainText)
    }
  }
}
