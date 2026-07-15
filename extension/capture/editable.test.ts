/** @vitest-environment happy-dom */

import { afterEach, describe, expect, it } from "vitest"

import { isEditableElement, isEditableSelection } from "./editable"

describe("editable selection guards", () => {
  afterEach(() => {
    document.body.innerHTML = ""
    window.getSelection()?.removeAllRanges()
  })

  it("treats inputs, textareas, and role=textbox as editable", () => {
    const input = document.createElement("input")
    const textarea = document.createElement("textarea")
    const searchRole = document.createElement("div")
    searchRole.setAttribute("role", "searchbox")
    const textbox = document.createElement("div")
    textbox.setAttribute("role", "textbox")
    const article = document.createElement("article")

    expect(isEditableElement(input)).toBe(true)
    expect(isEditableElement(textarea)).toBe(true)
    expect(isEditableElement(searchRole)).toBe(true)
    expect(isEditableElement(textbox)).toBe(true)
    expect(isEditableElement(article)).toBe(false)
  })

  it("detects a selection inside a search input", () => {
    const input = document.createElement("input")
    input.value = "二分法搜索想法"
    document.body.appendChild(input)
    input.focus()
    input.setSelectionRange(0, input.value.length)

    expect(isEditableSelection()).toBe(true)
  })

  it("detects a selection inside contenteditable composer", () => {
    const composer = document.createElement("div")
    composer.setAttribute("contenteditable", "true")
    composer.id = "prompt-textarea"
    composer.textContent = "在输入框里选中这段字"
    document.body.appendChild(composer)

    const range = document.createRange()
    range.selectNodeContents(composer)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)
    composer.focus()

    expect(isEditableSelection(selection ?? undefined)).toBe(true)
  })

  it("allows selection in normal page content", () => {
    const paragraph = document.createElement("p")
    paragraph.textContent = "普通正文划词应该触发"
    document.body.appendChild(paragraph)

    const range = document.createRange()
    range.selectNodeContents(paragraph)
    const selection = window.getSelection()
    selection?.removeAllRanges()
    selection?.addRange(range)

    expect(isEditableSelection(selection ?? undefined)).toBe(false)
  })
})
