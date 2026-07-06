import type {
  RelatedEchoAnalysis,
  RelatedEchoCandidateDiagnostic
} from "~lib/echo-related"

const echoLabel = (candidate: RelatedEchoCandidateDiagnostic) =>
  (
    candidate.echo.userThought ||
    candidate.echo.capture?.title?.value ||
    candidate.echo.title ||
    candidate.echo.triggerText.slice(0, 80) ||
    "Untitled Echo"
  )
    .replace(/\s+/g, " ")
    .trim()

const quoted = (value: string) =>
  (value || "(empty)")
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n")

export const formatProbeReport = (
  analysis: RelatedEchoAnalysis,
  generatedAt = new Date()
) => {
  const reportId = generatedAt.toISOString()
  const evidenceCandidates = analysis.candidates.filter(
    (candidate) => candidate.score > 0
  )
  const zeroEvidenceCount = analysis.candidates.length - evidenceCandidates.length
  const lines = [
    `<!-- ECHO_PROBE_REPORT_START ${reportId} -->`,
    `# Echo Probe Report · ${reportId}`,
    "",
    "## Selection",
    "",
    quoted(analysis.selection),
    "",
    "## Summary",
    "",
    "| Scanned | Evidence > 0 | Accepted | Zero evidence |",
    "| ---: | ---: | ---: | ---: |",
    `| ${analysis.scannedCount} | ${evidenceCandidates.length} | ${analysis.acceptedCount} | ${zeroEvidenceCount} |`,
    "",
    `**Corpus terms:** ${analysis.queryTokens.join(", ") || "(none)"}`,
    "",
    "## Ranked Evidence",
    ""
  ]

  evidenceCandidates.forEach((candidate, index) => {
    lines.push(
      `### ${index + 1}. [${candidate.score}] ${echoLabel(candidate)}`,
      "",
      `- Echo ID: ${candidate.echo.id}`,
      `- Decision: ${candidate.accepted ? "accepted" : `rejected (${candidate.rejection ?? "unknown"})`}`,
      `- Reason: ${candidate.reason}`,
      `- Strongest field: ${candidate.strongestField ?? "(none)"}`,
      `- Matched terms: ${candidate.matchedTerms.join(", ") || "(none)"}`
    )

    if (candidate.details.length) {
      lines.push("- Score ledger:")
      candidate.details.forEach((detail) => lines.push(`  - ${detail}`))
    }

    lines.push("")
  })

  if (!evidenceCandidates.length) {
    lines.push("No candidate had non-zero evidence.", "")
  }

  lines.push(`<!-- ECHO_PROBE_REPORT_END ${reportId} -->`)
  return lines.join("\n").trimEnd()
}
