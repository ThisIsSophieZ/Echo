import type { PlasmoCSConfig } from "plasmo"

import { locateEchoAnchor } from "~capture/anchor"
import {
  getSelectionCapture,
  getSelectionPlainText
} from "~capture/selection"
import type { SelectionCapture } from "~capture/types"

export const config: PlasmoCSConfig = {
  matches: [
    "https://chatgpt.com/*",
    "https://chat.openai.com/*",
    "https://claude.ai/*",
    "https://gemini.google.com/*",
    "https://grok.com/*",
    "https://x.com/*"
  ],
  run_at: "document_idle"
}

let addButton: HTMLButtonElement | null = null
let lastSelectionCapture: SelectionCapture | null = null
let buttonExpiry: Animation | null = null
let savedToast: HTMLDivElement | null = null
let savedToastExpiry: number | null = null

const ADD_BUTTON_ID = "echo-add-to-echo-button"
const SAVED_TOAST_ID = "echo-saved-toast"
const ADD_BUTTON_LIFETIME_MS = 10_000
const SAVED_TOAST_LIFETIME_MS = 1_600
const ADD_BUTTON_GAP = 8
const VIEWPORT_MARGIN = 8

// A reloaded unpacked extension can leave DOM from its invalidated content
// script behind. Remove any previous instance when a live script starts.
document.getElementById(ADD_BUTTON_ID)?.remove()
document.getElementById(SAVED_TOAST_ID)?.remove()

const sourceLabel = (source?: string) => {
  if (source === "chatgpt") return "ChatGPT"
  if (source === "claude") return "Claude"
  if (source === "gemini") return "Gemini"
  if (source === "grok") return "Grok"
  return "Browser"
}

const publishSelectionContext = (plainText: string | null) => {
  const runtime = globalThis.chrome?.runtime
  if (!runtime?.sendMessage) return

  runtime
    .sendMessage({
      type: "echo:selection-context",
      text: plainText ?? "",
      url: location.href
    })
    .catch(() => {})
}

const getSelectionRect = () => {
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return null

  const rect = selection.getRangeAt(0).getBoundingClientRect()
  if (!rect || (!rect.width && !rect.height)) return null

  return rect
}

const ensureAddButton = () => {
  if (addButton) return addButton

  addButton = document.createElement("button")
  addButton.id = ADD_BUTTON_ID
  addButton.type = "button"
  addButton.textContent = "Add to Echo"
  addButton.style.cssText = [
    "position:fixed",
    "z-index:2147483647",
    "display:none",
    "padding:6px 10px",
    "border:1px solid rgba(193,198,214,0.9)",
    "border-radius:999px",
    "background:#ffffff",
    "color:#191c23",
    "font:600 12px Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "box-shadow:0 6px 18px rgba(25,28,35,0.18)",
    "cursor:pointer"
  ].join(";")

  addButton.addEventListener("mousedown", (event) => {
    event.preventDefault()
    event.stopPropagation()
  })

  addButton.addEventListener("click", async (event) => {
    event.preventDefault()
    event.stopPropagation()

    const selectionCapture = lastSelectionCapture
    if (!selectionCapture?.plainText || addButton?.disabled) return

    addButton!.textContent = "Adding..."
    addButton!.disabled = true

    const runtime = globalThis.chrome?.runtime
    if (!runtime?.sendMessage) {
      addButton!.textContent = "Refresh page"
      addButton!.disabled = false
      return
    }

    try {
      const response = await runtime.sendMessage({
        type: "echo:add-selection",
        quote: selectionCapture.plainText,
        capture: selectionCapture.capture,
        title: document.title,
        url: location.href
      })

      if (response?.ok) {
        hideAddButton()
        showSavedToast(response.sourceApp)
        return
      }

      addButton!.textContent = "Try again"
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      addButton!.textContent =
        message.includes("context invalidated") || message.includes("sendMessage")
        ? "Refresh page"
        : "Try again"
    }

    addButton!.disabled = false
    setTimeout(hideAddButton, 1800)
  })

  document.documentElement.appendChild(addButton)
  return addButton
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max)

const measureAddButton = (button: HTMLButtonElement) => {
  button.style.visibility = "hidden"
  button.style.display = "block"
  const size = { width: button.offsetWidth, height: button.offsetHeight }
  button.style.visibility = ""
  return size
}

// LLM pages (e.g. ChatGPT) render their own selection toolbar above the highlight.
// Prefer below the selection; when above, align to the trailing edge to avoid overlap.
const positionAddButton = (button: HTMLButtonElement, rect: DOMRect) => {
  const { width, height } = measureAddButton(button)
  const maxLeft = window.innerWidth - width - VIEWPORT_MARGIN
  const clampLeft = (left: number) => clamp(left, VIEWPORT_MARGIN, maxLeft)

  const belowTop = rect.bottom + ADD_BUTTON_GAP
  const aboveTop = rect.top - height - ADD_BUTTON_GAP
  const fitsBelow = belowTop + height <= window.innerHeight - VIEWPORT_MARGIN
  const fitsAbove = aboveTop >= VIEWPORT_MARGIN

  let top = belowTop
  let left = clampLeft(rect.left)

  if (fitsBelow) {
    top = belowTop
    left = clampLeft(rect.left)
  } else if (fitsAbove) {
    top = aboveTop
    left = clampLeft(rect.right - width)
  } else {
    top = clamp(belowTop, VIEWPORT_MARGIN, window.innerHeight - height - VIEWPORT_MARGIN)
    left = clampLeft(rect.left)
  }

  button.style.top = `${top}px`
  button.style.left = `${left}px`
}

const showAddButton = (rect: DOMRect, selectionCapture: SelectionCapture) => {
  lastSelectionCapture = selectionCapture
  const button = ensureAddButton()
  button.textContent = "Add to Echo"
  button.disabled = false
  positionAddButton(button, rect)
  button.style.display = "block"

  buttonExpiry?.cancel()
  buttonExpiry = button.animate(
    [
      { opacity: 1, pointerEvents: "auto" },
      { opacity: 1, pointerEvents: "auto", offset: 0.9 },
      { opacity: 0, pointerEvents: "none" }
    ],
    {
      duration: ADD_BUTTON_LIFETIME_MS,
      fill: "forwards"
    }
  )
  buttonExpiry.onfinish = hideAddButton
}

const hideAddButton = () => {
  buttonExpiry?.cancel()
  buttonExpiry = null
  if (addButton) {
    addButton.style.display = "none"
    addButton.style.opacity = "1"
    addButton.style.pointerEvents = "auto"
  }
}

const removeSavedToast = () => {
  if (savedToastExpiry != null) {
    window.clearTimeout(savedToastExpiry)
    savedToastExpiry = null
  }
  savedToast?.remove()
  savedToast = null
}

const showSavedToast = (sourceApp?: string) => {
  removeSavedToast()

  const toast = document.createElement("div")
  toast.id = SAVED_TOAST_ID
  toast.textContent = `已保存 · 来自 ${sourceLabel(sourceApp)}`
  toast.setAttribute("role", "status")
  toast.style.cssText = [
    "position:fixed",
    "z-index:2147483647",
    "left:50%",
    "bottom:24px",
    "transform:translateX(-50%)",
    "padding:7px 11px",
    "border-radius:999px",
    "background:rgba(25,28,35,0.94)",
    "color:#ffffff",
    "font:600 12px Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "box-shadow:0 4px 12px rgba(25,28,35,0.2)",
    "pointer-events:none",
    "white-space:nowrap"
  ].join(";")

  document.body.appendChild(toast)
  savedToast = toast
  toast.animate(
    [
      { opacity: 0, transform: "translate(-50%, 4px)" },
      { opacity: 1, transform: "translate(-50%, 0)", offset: 0.18 },
      { opacity: 1, transform: "translate(-50%, 0)", offset: 0.82 },
      { opacity: 0, transform: "translate(-50%, 4px)" }
    ],
    { duration: SAVED_TOAST_LIFETIME_MS, easing: "ease-out" }
  )
  savedToastExpiry = window.setTimeout(removeSavedToast, SAVED_TOAST_LIFETIME_MS)
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "echo:get-page-context") {
    getSelectionCapture().then((selectionCapture) =>
      sendResponse({
        title: document.title,
        url: location.href,
        selection: selectionCapture?.plainText ?? ""
      })
    )
    return true
  }

  if (message?.type === "echo:get-selection-capture") {
    getSelectionCapture().then((selectionCapture) =>
      sendResponse({ selectionCapture })
    )
    return true
  }

  if (message?.type === "echo:show-saved") {
    showSavedToast(message.sourceApp)
    return
  }

  if (message?.type === "echo:locate-anchor" && message.anchor) {
    locateEchoAnchor(message.anchor).then((found) => sendResponse({ found }))
    return true
  }
})

document.addEventListener("mouseup", (event) => {
  if (addButton && event.target === addButton) return

  setTimeout(async () => {
    try {
      const plainText = getSelectionPlainText()
      if (!plainText) {
        hideAddButton()
        publishSelectionContext(null)
        return
      }

      publishSelectionContext(plainText)

      const selectionCapture = await getSelectionCapture()
      if (!selectionCapture) {
        hideAddButton()
        return
      }

      const rect = getSelectionRect()
      if (!rect) {
        hideAddButton()
        return
      }

      showAddButton(rect, selectionCapture)
    } catch {
      const plainText = getSelectionPlainText()
      publishSelectionContext(plainText)
      hideAddButton()
    }
  }, 10)
})

document.addEventListener("mousedown", (event) => {
  if (addButton && event.target === addButton) return
  hideAddButton()
})

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideAddButton()
})

const resumePendingAnchor = async () => {
  try {
    const response = await chrome.runtime.sendMessage({
      type: "echo:get-pending-anchor"
    })
    if (!response?.anchor) return

    const found = await locateEchoAnchor(response.anchor)
    await chrome.runtime.sendMessage({
      type: "echo:anchor-result",
      found
    })
  } catch {
    // The extension may be reloading while the page initializes.
  }
}

resumePendingAnchor()
