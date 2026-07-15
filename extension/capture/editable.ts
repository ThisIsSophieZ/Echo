const EDITABLE_SELECTOR = [
  "textarea",
  "select",
  "input:not([type])",
  'input[type="text"]',
  'input[type="search"]',
  'input[type="password"]',
  'input[type="email"]',
  'input[type="url"]',
  'input[type="tel"]',
  'input[type="number"]',
  "[contenteditable='true']",
  "[contenteditable='']",
  "[contenteditable=plaintext-only]",
  "[role='textbox']",
  "[role='searchbox']",
  "[role='combobox']",
  "#prompt-textarea",
  "[data-testid='prompt-textarea']",
  ".ProseMirror"
].join(", ")

const TEXTUAL_INPUT_TYPES = new Set([
  "",
  "text",
  "search",
  "password",
  "email",
  "url",
  "tel",
  "number"
])

const elementFromNode = (node: Node | null) => {
  if (!node) return null
  return node instanceof Element ? node : node.parentElement
}

const isTextualInput = (element: Element): element is HTMLInputElement =>
  element instanceof HTMLInputElement &&
  TEXTUAL_INPUT_TYPES.has(element.type.toLowerCase())

/** True for search boxes, chat composers, and other typing surfaces. */
export const isEditableElement = (
  element: Element | null | undefined
): boolean => {
  if (!element) return false

  if (element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement) {
    return true
  }

  if (isTextualInput(element)) {
    return true
  }

  if (element instanceof HTMLElement && element.isContentEditable) {
    return true
  }

  return Boolean(element.closest(EDITABLE_SELECTOR))
}

const hasNativeFormSelection = (element: Element): boolean => {
  if (!(element instanceof HTMLTextAreaElement) && !isTextualInput(element)) {
    return false
  }

  // Non-text inputs throw InvalidStateError when reading selectionStart/End.
  try {
    const start = element.selectionStart
    const end = element.selectionEnd
    return typeof start === "number" && typeof end === "number" && start !== end
  } catch {
    return false
  }
}

/** True when the current selection lives inside a typing surface. */
export const isEditableSelection = (
  selection = window.getSelection()
): boolean => {
  const active = document.activeElement
  if (active instanceof Element && isEditableElement(active)) {
    // Inputs/textareas keep selection outside `window.getSelection()`.
    if (hasNativeFormSelection(active)) return true

    if (selection && selection.rangeCount > 0) {
      if (
        !selection.anchorNode ||
        active === selection.anchorNode ||
        active.contains(selection.anchorNode)
      ) {
        return true
      }
    }
  }

  if (!selection || selection.rangeCount === 0) return false

  return (
    isEditableElement(elementFromNode(selection.anchorNode)) ||
    isEditableElement(elementFromNode(selection.focusNode))
  )
}
