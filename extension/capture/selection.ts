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

export const getSelectionCapture = (): SelectionCapture | null => {
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
      anchor: createEchoAnchor(range, fragment, plainText)
    }
  }
}
