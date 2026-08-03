// Reuse the PRODUCT's real recall logic so the comparison is honest.
//
// products/echo/extension/lib/echo-related.ts has only `import type` imports,
// which are erased at runtime, so it runs standalone under tsx with zero extra
// wiring. If Echo ever gives this file runtime imports, this line will break —
// which is exactly the signal to revisit the comparison.
import { analyzeRelatedEchoes } from "../../../products/echo/extension/lib/echo-related"

import type { Echo } from "./echo-shape"

export type LexicalHit = {
  id: string
  label: string
  score: number
  strength: "strong" | "possible"
  reason: string
}

// Mirror of the product default: only Echoes that clear the confidence /
// evidence thresholds would actually surface in the sidebar.
export const lexicalRecall = (
  echoes: Echo[],
  selection: string,
  limit: number
): LexicalHit[] => {
  const analysis = analyzeRelatedEchoes(echoes as any, selection, limit)
  return analysis.results.map((result: any) => ({
    id: result.echo.id,
    label:
      result.echo.userThought ||
      result.echo.title ||
      result.echo.triggerText.slice(0, 60),
    score: result.score,
    strength: result.strength,
    reason: result.reason
  }))
}
