// Local copy of the fields we care about from the product's Echo type
// (products/echo/extension/db/echoes.ts). Kept minimal on purpose — this is a
// throwaway experiment and should not import product runtime code for types.

export type Echo = {
  id: string
  triggerText: string
  inferredThought?: string
  userThought?: string
  sourceApp: string
  url: string
  title: string
  createdAt: string
  status: "raw" | "inferred" | "confirmed" | "ignored" | "pinned"
}

// The text we hand to the embedding model. We combine the same fields the
// product's BM25 baseline scores (userThought / title / triggerText /
// inferredThought) so the two approaches see the same information.
export const buildDocText = (echo: Echo): string =>
  [echo.userThought, echo.title, echo.triggerText, echo.inferredThought]
    .map((part) => (part ?? "").trim())
    .filter(Boolean)
    .join("\n")

export const echoLabel = (echo: Echo): string =>
  echo.userThought ||
  echo.title ||
  echo.triggerText.slice(0, 60) ||
  echo.id
