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

    const rect = getSelectionRect()
    addButton!.textContent = "Adding..."

    const response = await chrome.runtime.sendMessage({
      type: "echo:add-selection",
      quote,
      title: document.title,
      url: location.href
    })

    if (response?.ok) {
      hideAddButton()
      flashSaved(rect)
      return
    }

    addButton!.textContent = "Try again"
    setTimeout(hideAddButton, 1200)
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

// Quick, non-intrusive "saved" confirmation near the selection. No side panel
// is opened on capture; this little flash is the whole feedback.
const flashSaved = (rect: DOMRect | null) => {
  const pill = document.createElement("div")
  pill.textContent = "Saved to Echo"

  const star = document.createElement("span")
  star.textContent = "\u2b50"
  star.style.fontSize = "14px"
  pill.prepend(star)

  pill.style.cssText = [
    "position:fixed",
    "z-index:2147483647",
    "display:flex",
    "align-items:center",
    "gap:6px",
    "padding:4px 10px 4px 8px",
    "border-radius:999px",
    "background:rgba(26,115,232,0.96)",
    "color:#ffffff",
    "font:600 12px Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    "box-shadow:0 6px 18px rgba(25,28,35,0.28)",
    "pointer-events:none",
    "user-select:none",
    "white-space:nowrap"
  ].join(";")

  const top = rect ? Math.max(8, rect.top - 12) : 72
  const left = rect
    ? Math.min(window.innerWidth - 132, rect.right + 8)
    : window.innerWidth / 2 - 60
  pill.style.top = `${top}px`
  pill.style.left = `${left}px`

  document.body.appendChild(pill)

  const animation = pill.animate(
    [
      { transform: "translateY(0) scale(0.6)", opacity: 0 },
      { transform: "translateY(-8px) scale(1.05)", opacity: 1, offset: 0.25 },
      { transform: "translateY(-12px) scale(1)", opacity: 1, offset: 0.7 },
      { transform: "translateY(-28px) scale(0.95)", opacity: 0 }
    ],
    { duration: 1300, easing: "ease-out" }
  )
  animation.onfinish = () => pill.remove()
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === "echo:get-page-context") {
    sendResponse({
      title: document.title,
      url: location.href,
      selection: window.getSelection()?.toString().trim() ?? ""
    })
    return
  }

  // Triggered by the background context-menu path after a successful save.
  if (message?.type === "echo:show-star") {
    flashSaved(getSelectionRect())
    return
  }
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
