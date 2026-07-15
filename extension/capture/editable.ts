const EDITABLE_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[contenteditable='']",
  "[contenteditable=plaintext-only]",
  "[contenteditable]",
  "[role='textbox']",
  "[role='searchbox']",
  "[role='combobox']",
  "#prompt-textarea",
  "[data-testid='prompt-textarea']",
  ".ProseMirror"
].join(", ")

const elementFromNode = (node: Node | null) => {
  if (!node) return null
  return node instanceof Element ? node : node.parentElement
}

/** True for search boxes, chat composers, and other typing surfaces. */
export const isEditableElement = (
  element: Element | null | undefined
): boolean => {
  if (!element) return false

  if (
    element instanceof HTMLInputElement ||
    element instanceof HTMLTextAreaElement ||
    element instanceof HTMLSelectElement
  ) {
    return true
  }

  if (element instanceof HTMLElement && element.isContentEditable) {
    return true
  }

  return Boolean(element.closest(EDITABLE_SELECTOR))
}

const hasNativeFormSelection = (element: Element): boolean => {
  if (
    !(element instanceof HTMLInputElement) &&
    !(element instanceof HTMLTextAreaElement)
  ) {
    return false
  }

  const start = element.selectionStart
  const end = element.selectionEnd
  return typeof start === "number" && typeof end === "number" && start !== end
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
