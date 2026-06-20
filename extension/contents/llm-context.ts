import type { PlasmoCSConfig } from "plasmo"

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
let lastSelection = ""

const getSelectionText = () => {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed) return ""

  return selection.toString().trim()
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

    const quote = lastSelection.trim()
    if (!quote) return

    addButton!.textContent = "Adding..."

    const response = await chrome.runtime.sendMessage({
      type: "echo:add-selection",
      quote,
      title: document.title,
      url: location.href
    })

    addButton!.textContent = response?.ok ? "Added" : "Try again"
    setTimeout(hideAddButton, 900)
  })

  document.body.appendChild(addButton)
  return addButton
}

const showAddButton = (rect: DOMRect, text: string) => {
  lastSelection = text
  const button = ensureAddButton()
  const top = Math.max(window.scrollY + 8, window.scrollY + rect.top - 40)
  const left = Math.min(window.scrollX + rect.left, window.scrollX + window.innerWidth - 132)

  button.style.top = `${top}px`
  button.style.left = `${left}px`
  button.style.display = "block"
  button.textContent = "Add to Echo"
}

const hideAddButton = () => {
  if (addButton) addButton.style.display = "none"
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== "echo:get-page-context") return

  sendResponse({
    title: document.title,
    url: location.href,
    selection: window.getSelection()?.toString().trim() ?? ""
  })
})

document.addEventListener("mouseup", () => {
  setTimeout(() => {
    const text = getSelectionText()
    if (!text) {
      hideAddButton()
      return
    }

    const rect = getSelectionRect()
    if (!rect) {
      hideAddButton()
      return
    }

    showAddButton(rect, text)
  }, 10)
})

document.addEventListener("mousedown", (event) => {
  if (addButton && event.target === addButton) return
  hideAddButton()
})

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hideAddButton()
})
