import type { PlasmoCSConfig } from "plasmo"

import { locateEchoAnchor } from "~capture/anchor"
import { getSelectionCapture } from "~capture/selection"
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

// A reloaded unpacked extension can leave DOM from its invalidated content
// script behind. Remove any previous instance when a live script starts.
document.getElementById(ADD_BUTTON_ID)?.remove()
document.getElementById(THOUGHT_PROMPT_ID)?.remove()

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
    "position:absolute",
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

    const rect = getSelectionRect()
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
        showThoughtPrompt(rect, response.echoId)
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

  document.body.appendChild(addButton)
  return addButton
}

const showAddButton = (rect: DOMRect, selectionCapture: SelectionCapture) => {
  lastSelectionCapture = selectionCapture
  const button = ensureAddButton()
  const top = Math.max(window.scrollY + 8, window.scrollY + rect.top - 40)
  const left = Math.min(window.scrollX + rect.left, window.scrollX + window.innerWidth - 132)

  button.style.top = `${top}px`
  button.style.left = `${left}px`
  button.style.display = "block"
  button.textContent = "Add to Echo"
  button.disabled = false

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
  thoughtPromptExpiry = window.setTimeout(removeThoughtPrompt, THOUGHT_PROMPT_LIFETIME_MS)
}

const showThoughtPrompt = (rect: DOMRect | null, echoId?: string) => {
  if (!echoId) return

  const existingInput = thoughtPrompt?.querySelector("input")
  if (existingInput instanceof HTMLInputElement && existingInput.value.trim()) return
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
  label.textContent = "Saved"
  label.style.cssText = "color:#1a73e8;font-weight:700;white-space:nowrap"

  const input = document.createElement("input")
  input.type = "text"
  input.placeholder = "Add a thought..."
  input.setAttribute("aria-label", "Add a thought to this Echo")
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
  save.textContent = "Save"
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

    clearThoughtPromptExpiry()
    save.disabled = true
    save.textContent = "Saving..."

    try {
      const response = await chrome.runtime.sendMessage({
        type: "echo:add-user-thought",
        echoId,
        thought
      })
      if (!response?.ok) throw new Error(response?.error || "Could not save thought")

      label.textContent = "Thought added"
      input.remove()
      save.remove()
      window.setTimeout(removeThoughtPrompt, 900)
    } catch {
      save.textContent = "Retry"
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

  const top = rect ? Math.max(8, rect.top - 48) : 72
  const left = rect
    ? Math.min(window.innerWidth - 352, Math.max(12, rect.left))
    : Math.max(12, window.innerWidth / 2 - 170)
  prompt.style.top = `${top}px`
  prompt.style.left = `${Math.max(12, left)}px`

  document.body.appendChild(prompt)
  thoughtPrompt = prompt
  scheduleThoughtPromptExpiry()
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "echo:get-page-context") {
    const selectionCapture = getSelectionCapture()
    sendResponse({
      title: document.title,
      url: location.href,
      selection: selectionCapture?.plainText ?? ""
    })
    return
  }

  if (message?.type === "echo:get-selection-capture") {
    sendResponse({ selectionCapture: getSelectionCapture() })
    return
  }

  // Triggered by the background context-menu path after a successful save.
  if (message?.type === "echo:show-star") {
    showThoughtPrompt(getSelectionRect(), message.echoId)
    return
  }

  if (message?.type === "echo:locate-anchor" && message.anchor) {
    locateEchoAnchor(message.anchor).then((found) => sendResponse({ found }))
    return true
  }
})

document.addEventListener("mouseup", (event) => {
  if (addButton && event.target === addButton) return

  setTimeout(() => {
    const selectionCapture = getSelectionCapture()
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
