import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import { fileURLToPath } from "node:url"

import { generateAnswer, type GenerationStrategy } from "./generation"
import { scoreGeneration } from "./generation-score"
import { retrieve } from "./retrievers"
import type {
  CorpusFile,
  GeneratedAnswer,
  GenerationScore,
  GenerationUsage,
  QuestionSet,
  RagQuestion,
  RetrievalHit
} from "./types"

type GenerationRow = {
  question: RagQuestion
  strategy: GenerationStrategy
  candidateHits: RetrievalHit[]
  answer: GeneratedAnswer
  usage: GenerationUsage
  providedEvidenceIds: string[]
  score: GenerationScore
}

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..")
const repoRoot = path.resolve(root, "../..")
const artifactsDir = path.join(root, "artifacts")

const datasetArg = process.argv.find((value) => value.startsWith("--dataset="))
const dataset = datasetArg?.slice("--dataset=".length) === "holdout"
  ? "holdout"
  : "dev"
const model = process.env.OLLAMA_MODEL || "qwen2.5:32b"

const strategyArg = process.argv.find((value) => value.startsWith("--strategy="))
const strategies: GenerationStrategy[] = strategyArg
  ? [
      strategyArg.slice("--strategy=".length) === "candidate-bm25-rag"
        ? "candidate-bm25-rag"
        : "no-context"
    ]
  : ["no-context", "candidate-bm25-rag"]

if (dataset === "holdout" && !process.argv.includes("--confirm-holdout")) {
  throw new Error(
    "Holdout is locked. Run only after freezing the pipeline, with --confirm-holdout."
  )
}

type FreezeManifest = {
  model: string
  files: Record<string, string>
}

const readJson = <T>(filePath: string): T =>
  JSON.parse(fs.readFileSync(filePath, "utf8")) as T

const pct = (value: number | null) =>
  value == null ? "n/a" : `${(value * 100).toFixed(1)}%`

const sha256 = (filePath: string) =>
  crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex")

const verifyFreeze = () => {
  const manifest = readJson<FreezeManifest>(path.join(root, "freeze-manifest.json"))
  if (model !== manifest.model) {
    throw new Error(`Holdout model is frozen to ${manifest.model}; received ${model}.`)
  }

  for (const [relativePath, expectedHash] of Object.entries(manifest.files)) {
    const actualHash = sha256(path.join(repoRoot, relativePath))
    if (actualHash !== expectedHash) {
      throw new Error(`Frozen file changed: ${relativePath}`)
    }
  }
}

const main = async () => {
  if (dataset === "holdout") verifyFreeze()

  const corpus = readJson<CorpusFile>(
    path.join(repoRoot, "evals/recall-benchmark/data/corpus.json")
  )
  const questions = readJson<QuestionSet>(
    path.join(root, `data/questions-${dataset}.json`)
  )
  const corpusById = new Map(corpus.echoes.map((echo) => [echo.id, echo]))
  const rows: GenerationRow[] = []

  for (const question of questions.questions) {
    const candidateHits = retrieve(
      "candidate-bm25",
      corpus.echoes,
      question.question
    )

    for (const strategy of strategies) {
      console.log(`[rag-generation] ${question.id} ${strategy}...`)
      const generated = await generateAnswer({
        strategy,
        model,
        question,
        corpusById,
        hits: candidateHits
      })
      rows.push({
        question,
        strategy,
        candidateHits,
        ...generated,
        score: scoreGeneration(
          question,
          generated.answer,
          generated.providedEvidenceIds
        )
      })
    }
  }

  const aggregates = strategies.map((strategy) => {
    const selected = rows.filter((row) => row.strategy === strategy)
    const answerRows = selected.filter(
      (row) => row.question.expectedBehavior === "answer"
    )
    return {
      strategy,
      questions: selected.length,
      behaviorAccuracy:
        selected.filter((row) => row.score.behaviorCorrect).length /
        selected.length,
      allRequiredEvidenceCitedRate: answerRows.length
        ? answerRows.filter((row) => row.score.allRequiredEvidenceCited).length /
          answerRows.length
        : 0,
      requiredEvidenceCitationCoverageAvg: answerRows.length
        ? answerRows.reduce(
            (sum, row) =>
              sum + (row.score.requiredEvidenceCitationCoverage ?? 0),
            0
          ) / answerRows.length
        : 0,
      invalidCitations: selected.reduce(
        (sum, row) => sum + row.score.invalidCitationIds.length,
        0
      ),
      uncitedClaims: selected.reduce(
        (sum, row) => sum + row.score.uncitedClaims,
        0
      ),
      promptTokens: selected.reduce(
        (sum, row) => sum + row.usage.promptTokens,
        0
      ),
      outputTokens: selected.reduce(
        (sum, row) => sum + row.usage.outputTokens,
        0
      ),
      totalDurationMs: selected.reduce(
        (sum, row) => sum + row.usage.totalDurationMs,
        0
      ),
      loadDurationMs: selected.reduce(
        (sum, row) => sum + row.usage.loadDurationMs,
        0
      ),
      runtimeExcludingLoadMs: selected.reduce(
        (sum, row) =>
          sum + (row.usage.totalDurationMs - row.usage.loadDurationMs),
        0
      ),
      estimatedApiCostUsd: 0
    }
  })

  fs.mkdirSync(artifactsDir, { recursive: true })
  const artifactStem = `generation-${dataset}`
  const jsonPath = path.join(artifactsDir, `${artifactStem}.json`)
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        dataset: questions.datasetVersion,
        corpus: corpus.fixtureVersion,
        model,
        provider: "local Ollama",
        costBoundary:
          "Estimated API cost is $0 for local inference; hardware depreciation and electricity are not estimated.",
        aggregates,
        rows
      },
      null,
      2
    ),
    "utf8"
  )

  const lines = [
    `# Echo RAG Lab - ${dataset === "holdout" ? "Holdout" : "Dev"} Generation Record`,
    "",
    `- Model: \`${model}\` via local Ollama`,
    `- Dataset: \`${questions.datasetVersion}\``,
    `- Public corpus: \`${corpus.fixtureVersion}\` / ${corpus.echoes.length} Echoes`,
    `- Holdout: ${dataset === "holdout" ? "single confirmed run" : "not run"}`,
    "- Cost: local API cost $0; hardware and electricity excluded",
    "",
    "## Aggregate",
    "",
    "| Strategy | Behavior accuracy | All required cited | Required citation coverage | Invalid citations | Tokens in / out | Runtime excluding model load | Model load |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"
  ]

  for (const aggregate of aggregates) {
    lines.push(
      `| ${aggregate.strategy} | ${pct(aggregate.behaviorAccuracy)} | ${pct(aggregate.allRequiredEvidenceCitedRate)} | ${pct(aggregate.requiredEvidenceCitationCoverageAvg)} | ${aggregate.invalidCitations} | ${aggregate.promptTokens} / ${aggregate.outputTokens} | ${(aggregate.runtimeExcludingLoadMs / 1000).toFixed(1)} s | ${(aggregate.loadDurationMs / 1000).toFixed(1)} s |`
    )
  }

  lines.push(
    "",
    "Automatic scores verify behavior and citation IDs. Faithfulness, acceptable claims, and forbidden claims still require human review.",
    "",
    "## Question and answer records",
    ""
  )

  for (const row of rows) {
    lines.push(
      `### ${row.question.id} - ${row.strategy}`,
      "",
      `> ${row.question.question}`,
      "",
      `- Expected / actual: \`${row.question.expectedBehavior}\` / \`${row.answer.status}\``,
      `- Provided evidence: ${row.providedEvidenceIds.join(", ") || "none"}`,
      `- Cited evidence: ${row.score.citedIds.join(", ") || "none"}`,
      `- Required citation coverage: ${pct(row.score.requiredEvidenceCitationCoverage)}`,
      `- Invalid citations: ${row.score.invalidCitationIds.join(", ") || "none"}`,
      `- Tokens in / out: ${row.usage.promptTokens} / ${row.usage.outputTokens}`,
      `- Generation time: ${(row.usage.totalDurationMs / 1000).toFixed(1)} s`,
      "",
      `**Answer:** ${row.answer.answer || "_(abstained)_"}`,
      ""
    )
    if (row.answer.claims.length) {
      row.answer.claims.forEach((claim) => {
        lines.push(
          `- ${claim.text} [${claim.citations.join(", ") || "uncited"}]`
        )
      })
      lines.push("")
    }
    lines.push(`**Reason:** ${row.answer.reason}`, "")
  }

  const markdownPath = path.join(artifactsDir, `${artifactStem}.md`)
  fs.writeFileSync(markdownPath, lines.join("\n"), "utf8")
  console.log(`[rag-generation] report: ${markdownPath}`)
  console.log(`[rag-generation] records: ${jsonPath}`)
}

main().catch((error) => {
  console.error("[rag-generation] failed:", error)
  process.exit(1)
})
