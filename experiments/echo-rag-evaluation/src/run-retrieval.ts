import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { analyzeRelatedEchoes } from "../../../extension/lib/echo-related"

import { aggregateRetrieval, scoreRetrieval } from "./score"
import type {
  CorpusFile,
  QuestionSet,
  RetrievalHit,
  RetrievalRow
} from "./types"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "..")
const repoRoot = path.resolve(root, "../..")
const artifactsDir = path.join(root, "artifacts")
const corpusPath = path.join(
  repoRoot,
  "evals/recall-benchmark/data/corpus.json"
)

const datasetArg = process.argv.find((value) => value.startsWith("--dataset="))
const dataset = datasetArg?.slice("--dataset=".length) === "holdout"
  ? "holdout"
  : "dev"

if (dataset === "holdout" && !process.argv.includes("--confirm-holdout")) {
  throw new Error(
    "Holdout is locked. Freeze prompts and evaluators first, then rerun with --confirm-holdout."
  )
}

const questionsPath = path.join(root, `data/questions-${dataset}.json`)
const readJson = <T>(filePath: string): T =>
  JSON.parse(fs.readFileSync(filePath, "utf8")) as T

const pct = (value: number | null) =>
  value == null ? "n/a" : `${(value * 100).toFixed(1)}%`

const main = () => {
  const corpus = readJson<CorpusFile>(corpusPath)
  const questionSet = readJson<QuestionSet>(questionsPath)

  // Keep timing comparable by warming the same product lexical path once.
  analyzeRelatedEchoes(corpus.echoes as any, "warmup lexical retrieval", 3)

  const rows: RetrievalRow[] = questionSet.questions.map((question) => {
    const started = performance.now()
    const analysis = analyzeRelatedEchoes(
      corpus.echoes as any,
      question.question,
      3
    )
    const latencyMs = performance.now() - started
    const hits: RetrievalHit[] = analysis.results.map((result: any) => ({
      id: result.echo.id,
      title: result.echo.title,
      score: result.score,
      reason: result.reason
    }))

    return {
      question,
      hits,
      latencyMs,
      score: scoreRetrieval(question, hits)
    }
  })

  const aggregate = aggregateRetrieval(rows)
  fs.mkdirSync(artifactsDir, { recursive: true })

  const jsonPath = path.join(artifactsDir, `retrieval-${dataset}.json`)
  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        phase: "retrieval-only",
        dataset,
        datasetVersion: questionSet.datasetVersion,
        corpusVersion: corpus.fixtureVersion,
        corpusSize: corpus.echoes.length,
        aggregate,
        rows
      },
      null,
      2
    ),
    "utf8"
  )

  const lines = [
    "# Echo RAG Lab - Retrieval-only Report",
    "",
    `- Dataset: \`${dataset}\` / \`${questionSet.datasetVersion}\``,
    `- Public corpus: \`${corpus.fixtureVersion}\` / ${corpus.echoes.length} Echoes`,
    `- Questions: ${aggregate.questions} (${aggregate.answerQuestions} answer, ${aggregate.abstentionQuestions} abstain)`,
    "- Generator: not used",
    "- Holdout: not run during Dev baseline work",
    "",
    "## Aggregate",
    "",
    `- Average required-evidence coverage: ${pct(aggregate.requiredEvidenceCoverageAvg)}`,
    `- All required evidence retrieved: ${pct(aggregate.allRequiredEvidenceRetrievedRate)}`,
    `- At least one required evidence retrieved: ${pct(aggregate.anyRequiredEvidenceRetrievedRate)}`,
    `- Retrieval silence on abstention questions: ${pct(aggregate.retrievalSilenceOnAbstentionRate)}`,
    `- Questions with hard-negative exposure: ${aggregate.questionsWithHardNegativeExposure}/${aggregate.questions}`,
    `- Warm latency avg / p50 / p95: ${aggregate.latencyMsAvg.toFixed(1)} / ${aggregate.latencyMsP50.toFixed(1)} / ${aggregate.latencyMsP95.toFixed(1)} ms`,
    "",
    "Retrieval silence is diagnostic only. An abstention question may retrieve adjacent material; the future generator must still judge whether evidence is sufficient.",
    "",
    "## Per question",
    ""
  ]

  for (const row of rows) {
    lines.push(
      `### ${row.question.id} - expected \`${row.question.expectedBehavior}\``,
      "",
      `> ${row.question.question}`,
      "",
      `- Required evidence coverage: ${pct(row.score.requiredEvidenceCoverage)}`,
      `- Missing required evidence: ${row.score.missingRequiredEvidence.join(", ") || "none"}`,
      `- Hard-negative hits: ${row.score.hardNegativeHits.join(", ") || "none"}`,
      `- Retrieval abstained: ${row.score.retrievalAbstained}`,
      `- Latency: ${row.latencyMs.toFixed(1)} ms`,
      ""
    )

    if (!row.hits.length) {
      lines.push("_No product BM25 result surfaced._", "")
      continue
    }

    lines.push(
      "| Rank | Echo | Title | Score |",
      "| ---: | --- | --- | ---: |"
    )
    row.hits.forEach((hit, index) => {
      lines.push(`| ${index + 1} | ${hit.id} | ${hit.title} | ${hit.score.toFixed(1)} |`)
    })
    lines.push("")
  }

  const markdownPath = path.join(artifactsDir, `retrieval-${dataset}.md`)
  fs.writeFileSync(markdownPath, lines.join("\n"), "utf8")

  console.log(`[rag-retrieval] report: ${markdownPath}`)
  console.log(`[rag-retrieval] metrics: ${jsonPath}`)
  console.log(
    `[rag-retrieval] evidence coverage=${pct(aggregate.requiredEvidenceCoverageAvg)} all-required=${pct(aggregate.allRequiredEvidenceRetrievedRate)} hard-negative-exposure=${aggregate.questionsWithHardNegativeExposure}/${aggregate.questions}`
  )
}

main()
