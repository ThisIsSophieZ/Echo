import type { Echo } from "~db/echoes"

export const normalizeSearchText = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim()

export const matchesEchoSearch = (echo: Echo, query: string) => {
  const terms = normalizeSearchText(query).split(" ").filter(Boolean)
  if (!terms.length) return true

  const searchableText = normalizeSearchText(
    [
      echo.triggerText,
      echo.userThought,
      echo.inferredThought,
      echo.title,
      echo.sourceApp
    ]
      .filter(Boolean)
      .join("\n")
  )

  return terms.every((term) => searchableText.includes(term))
}
