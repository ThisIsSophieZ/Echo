import type { PlasmoCSConfig } from "plasmo"

import { locateEchoAnchor } from "~capture/anchor"
import {
  getSelectionCapture,
  getSelectionPlainText,
  isEditableElement,
  isEditableSelection
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
let thoughtPrompt: HTMLDivElement | null = null
let thoughtPromptExpiry: number | null = null

const ADD_BUTTON_ID = "echo-add-to-echo-button"
const THOUGHT_PROMPT_ID = "echo-quick-thought-prompt"
const ADD_BUTTON_LIFETIME_MS = 10_000
const THOUGHT_PROMPT_LIFETIME_MS = 8_000
const ADD_BUTTON_GAP = 8
const VIEWPORT_MARGIN = 8

// A reloaded unpacked extension can leave DOM from its invalidated content
// script behind. Remove any previous instance when a live script starts.
document.getElementById(ADD_BUTTON_ID)?.remove()
document.getElementById(THOUGHT_PROMPT_ID)?.remove()

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
        showThoughtPrompt(getSelectionRect(), response.echoId, response.sourceApp)
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

const clearThoughtPromptExpiry = () => {
  if (thoughtPromptExpiry != null) {
    window.clearTimeout(thoughtPromptExpiry)
    thoughtPromptExpiry = null
  }
}

const removeThoughtPrompt = () => {
  clearThoughtPromptExpiry()
  thoughtPrompt?.remove()
  thoughtPrompt = null
}

const scheduleThoughtPromptExpiry = () => {
  clearThoughtPromptExpiry()
  thoughtPromptExpiry = window.setTimeout(
    removeThoughtPrompt,
    THOUGHT_PROMPT_LIFETIME_MS
  )
}

// Optional one-line thought right after Collect. Auto-dismisses if ignored;
// focusing the input pauses the timer so typing is never cut off.
const showThoughtPrompt = (
  rect: DOMRect | null,
  echoId?: string,
  sourceApp?: string
) => {
  if (!echoId) return

  const existingInput = thoughtPrompt?.querySelector("input")
  if (existingInput instanceof HTMLInputElement && existingInput.value.trim()) {
    return
  }
  removeThoughtPrompt()

  const prompt = document.createElement("div")
  prompt.id = THOUGHT_PROMPT_ID
  prompt.style.cssText = [
    "position:fixed",
    "z-index:2147483647",
    "display:flex",
    "align-items:center",
    "gap:8px",
    "width:min(340px,calc(100vw - 24px))",
    "padding:8px",
    "border:1px solid rgba(193,198,214,0.95)",
    "border-radius:8px",
    "background:#ffffff",
    "color:#191c23",
    "font:500 12px Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "box-shadow:0 6px 18px rgba(25,28,35,0.28)",
    "box-sizing:border-box"
  ].join(";")

  const label = document.createElement("span")
  label.textContent = `已保存 · ${sourceLabel(sourceApp)}`
  label.style.cssText =
    "color:#1a73e8;font-weight:700;white-space:nowrap;max-width:118px;overflow:hidden;text-overflow:ellipsis"

  const input = document.createElement("input")
  input.type = "text"
  input.placeholder = "补一句想法..."
  input.setAttribute("aria-label", "补一句想法")
  input.style.cssText = [
    "min-width:0",
    "flex:1",
    "border:0",
    "outline:0",
    "background:transparent",
    "color:#191c23",
    "font:inherit"
  ].join(";")

  const save = document.createElement("button")
  save.type = "button"
  save.textContent = "保存"
  save.disabled = true
  save.style.cssText = [
    "border:0",
    "background:transparent",
    "color:#1a73e8",
    "font-family:inherit",
    "font-size:12px",
    "font-weight:700",
    "cursor:pointer",
    "padding:3px"
  ].join(";")

  const submitThought = async () => {
    const thought = input.value.trim()
    if (!thought || save.disabled) return

    const runtime = globalThis.chrome?.runtime
    if (!runtime?.sendMessage) {
      save.textContent = "刷新页"
      save.disabled = false
      return
    }

    clearThoughtPromptExpiry()
    save.disabled = true
    save.textContent = "..."

    try {
      const response = await runtime.sendMessage({
        type: "echo:add-user-thought",
        echoId,
        thought
      })
      if (!response?.ok) {
        throw new Error(response?.error || "Could not save thought")
      }

      label.textContent = "想法已加上"
      input.remove()
      save.remove()
      window.setTimeout(removeThoughtPrompt, 900)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      // Extension reload invalidates this content script mid-prompt.
      if (
        message.includes("Extension context invalidated") ||
        message.includes("context invalidated")
      ) {
        save.textContent = "刷新页"
      } else {
        save.textContent = "重试"
      }
      save.disabled = false
      input.focus()
    }
  }

  input.addEventListener("input", () => {
    save.disabled = !input.value.trim()
  })
  input.addEventListener("focus", clearThoughtPromptExpiry)
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault()
      void submitThought()
    } else if (event.key === "Escape") {
      event.preventDefault()
      removeThoughtPrompt()
    }
  })
  save.addEventListener("click", () => void submitThought())
  prompt.addEventListener("mousedown", (event) => event.stopPropagation())
  prompt.append(label, input, save)

  const top = rect ? Math.max(8, rect.top - 52) : 72
  const left = rect
    ? Math.min(window.innerWidth - 352, Math.max(12, rect.left))
    : Math.max(12, window.innerWidth / 2 - 170)
  prompt.style.top = `${top}px`
  prompt.style.left = `${Math.max(12, left)}px`

  document.documentElement.appendChild(prompt)
  thoughtPrompt = prompt
  scheduleThoughtPromptExpiry()
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
    showThoughtPrompt(getSelectionRect(), message.echoId, message.sourceApp)
    return
  }

  if (message?.type === "echo:locate-anchor" && message.anchor) {
    locateEchoAnchor(message.anchor).then((found) => sendResponse({ found }))
    return true
  }
})

document.addEventListener("mouseup", (event) => {
  if (addButton && event.target === addButton) return
  if (thoughtPrompt && thoughtPrompt.contains(event.target as Node)) return
  // Search / composer / textbox selections must never drive Probe or Add to Echo.
  if (
    (event.target instanceof Element && isEditableElement(event.target)) ||
    isEditableSelection()
  ) {
    hideAddButton()
    return
  }

  setTimeout(async () => {
    try {
      if (isEditableSelection()) {
        hideAddButton()
        return
      }

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
      if (isEditableSelection()) {
        hideAddButton()
        return
      }
      const plainText = getSelectionPlainText()
      publishSelectionContext(plainText)
      hideAddButton()
    }
  }, 10)
})

document.addEventListener("mousedown", (event) => {
  if (addButton && event.target === addButton) return
  if (thoughtPrompt && thoughtPrompt.contains(event.target as Node)) return
  hideAddButton()
})

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hideAddButton()
    if (!(thoughtPrompt?.querySelector("input") instanceof HTMLInputElement)) {
      removeThoughtPrompt()
    }
  }
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
