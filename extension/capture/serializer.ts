import type { EchoCaptureFeatures } from "~capture/types"

const BLOCK_TAGS = new Set([
  "ADDRESS",
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "DIV",
  "FIGCAPTION",
  "FIGURE",
  "FOOTER",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HEADER",
  "LI",
  "MAIN",
  "NAV",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "TABLE",
  "TR",
  "UL"
])

export const normalizeMultilineText = (value: string) =>
  value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

const appendBreak = (value: string) => (value && !value.endsWith("\n") ? `${value}\n` : value)

export const fragmentToPlainText = (root: ParentNode) => {
  let text = ""

  const visit = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? ""
      return
    }

    if (!(node instanceof Element)) return
    if (node.tagName === "BR") {
      text = appendBreak(text)
      return
    }
    if (node.tagName === "TABLE") {
      text = appendBreak(text)
      text += Array.from(node.querySelectorAll("tr"))
        .map((row) =>
          Array.from(row.children)
            .filter((cell) => cell.tagName === "TH" || cell.tagName === "TD")
            .map((cell) => normalizeMultilineText(cell.textContent ?? ""))
            .join(" | ")
        )
        .filter(Boolean)
        .join("\n")
      text = appendBreak(text)
      return
    }

    const isBlock = BLOCK_TAGS.has(node.tagName)
    if (isBlock) text = appendBreak(text)
    node.childNodes.forEach(visit)
    if (isBlock) text = appendBreak(text)
  }

  root.childNodes.forEach(visit)
  return normalizeMultilineText(text)
}

const escapeTableCell = (value: string) =>
  normalizeMultilineText(value).replace(/\n/g, "<br>").replace(/\|/g, "\\|")

const tableToMarkdown = (table: Element) => {
  const rowElements = Array.from(table.querySelectorAll("tr"))
  const rows = rowElements
    .map((row) =>
      Array.from(row.children)
        .filter((cell) => cell.tagName === "TH" || cell.tagName === "TD")
        .map((cell) => escapeTableCell(fragmentToPlainText(cell)))
    )
    .filter((row) => row.length)

  if (!rows.length) return ""

  const columnCount = Math.max(...rows.map((row) => row.length))
  const fillRow = (row: string[]) =>
    Array.from({ length: columnCount }, (_, index) => row[index] ?? "")
  const header = fillRow(rows[0])
  const body = rows.slice(1).map(fillRow)

  return [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...body.map((row) => `| ${row.join(" | ")} |`)
  ].join("\n")
}

const childrenToMarkdown = (node: ParentNode) =>
  Array.from(node.childNodes)
    .map(nodeToMarkdown)
    .join("")

const listToMarkdown = (list: Element) => {
  const ordered = list.tagName === "OL"
  const items = Array.from(list.children).filter((child) => child.tagName === "LI")

  return `\n${items
    .map((item, index) => {
      const marker = ordered ? `${index + 1}.` : "-"
      return `${marker} ${normalizeMultilineText(childrenToMarkdown(item))}`
    })
    .join("\n")}\n`
}

const nodeToMarkdown = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? ""
  if (!(node instanceof Element)) return ""

  const tag = node.tagName
  if (tag === "BR") return "\n"
  if (tag === "TABLE") return `\n\n${tableToMarkdown(node)}\n\n`
  if (/^H[1-6]$/.test(tag)) {
    const level = Number(tag.slice(1))
    return `\n\n${"#".repeat(level)} ${normalizeMultilineText(childrenToMarkdown(node))}\n\n`
  }
  if (tag === "P" || tag === "DIV" || tag === "SECTION" || tag === "ARTICLE") {
    return `\n\n${childrenToMarkdown(node)}\n\n`
  }
  if (tag === "STRONG" || tag === "B") return `**${childrenToMarkdown(node)}**`
  if (tag === "EM" || tag === "I") return `*${childrenToMarkdown(node)}*`
  if (tag === "CODE" && node.parentElement?.tagName !== "PRE") {
    return `\`${childrenToMarkdown(node)}\``
  }
  if (tag === "PRE") return `\n\n\`\`\`\n${node.textContent?.trim() ?? ""}\n\`\`\`\n\n`
  if (tag === "BLOCKQUOTE") {
    const quote = normalizeMultilineText(childrenToMarkdown(node))
    return `\n\n${quote
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n")}\n\n`
  }
  if (tag === "A") {
    const label = normalizeMultilineText(childrenToMarkdown(node))
    const href = node.getAttribute("href")
    return href && label ? `[${label}](${href})` : label
  }
  if (tag === "UL" || tag === "OL") return listToMarkdown(node)
  if (tag === "LI") return childrenToMarkdown(node)

  return childrenToMarkdown(node)
}

export const fragmentToMarkdown = (root: ParentNode) =>
  childrenToMarkdown(root)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

export const analyzeFragment = (
  fragment: Element,
  plainText: string
): EchoCaptureFeatures => {
  const tables = Array.from(fragment.querySelectorAll("table"))
  const tableRowCount = tables.reduce((total, table) => {
    const rows = Array.from(table.querySelectorAll("tr"))
    if (!rows.length) return total
    const hasHeader = Boolean(rows[0].querySelector("th"))
    return total + Math.max(0, rows.length - (hasHeader ? 1 : 0))
  }, 0)

  return {
    charCount: plainText.length,
    lineCount: plainText ? plainText.split("\n").length : 0,
    tableCount: tables.length,
    tableRowCount,
    listItemCount: fragment.querySelectorAll("li").length,
    codeBlockCount: fragment.querySelectorAll("pre").length
  }
}
