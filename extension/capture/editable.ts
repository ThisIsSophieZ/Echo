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
  TEXTUAL_INPUT_TYPES.has((element.type || "").toLowerCase())

/** True for search boxes, chat composers, and other typing surfaces. */
export const isEditableElement = (
  element: Element | null | undefined
): boolean => {
  try {
    if (!element) return false

    if (
      element instanceof HTMLTextAreaElement ||
      element instanceof HTMLSelectElement
    ) {
      return true
    }

    if (isTextualInput(element)) {
      return true
    }

    if (element instanceof HTMLElement && element.isContentEditable) {
      return true
    }

    return Boolean(element.closest(EDITABLE_SELECTOR))
  } catch {
    return false
  }
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
  try {
    const active = document.activeElement

    // Inputs/textareas keep selection outside `window.getSelection()`.
    if (active instanceof Element && hasNativeFormSelection(active)) {
      return true
    }

    // Caret-only (collapsed) selections are not "划词".
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
      return false
    }

    if (
      isEditableElement(elementFromNode(selection.anchorNode)) ||
      isEditableElement(elementFromNode(selection.focusNode))
    ) {
      return true
    }

    // Focused contenteditable whose non-collapsed selection lives inside it.
    if (
      active instanceof Element &&
      isEditableElement(active) &&
      selection.anchorNode &&
      active.contains(selection.anchorNode)
    ) {
      return true
    }

    return false
  } catch {
    return false
  }
}
