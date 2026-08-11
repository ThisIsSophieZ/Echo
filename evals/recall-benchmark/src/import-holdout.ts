import fs from "node:fs"

import {
  HOLDOUT_CORPUS_PATH,
  HOLDOUT_QUERIES_PATH
} from "./config"
import type {
  BenchmarkEcho,
  BenchmarkQuery,
  ExpectedBehavior
} from "./types"

type BackupFile = {
  echoes: BenchmarkEcho[]
}

type LabelQuery = {
  id: string
  timestamp: string
  summary: string
  expected: ExpectedBehavior
  acceptedLabels: Record<string, "useful" | "not_relevant" | "wrong_time">
  relevantEchoIds: string[]
}

type LabelsFile = {
  annotationType: string
  queries: LabelQuery[]
}

const argValue = (name: string) => {
  const prefix = `--${name}=`
  return process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length)
    .replace(/^['"]|['"]$/g, "")
}

const requiredArg = (name: string) => {
  const value = argValue(name)
  if (!value) throw new Error(`Missing --${name}=...`)
  return value
}

const readJson = <T>(path: string): T =>
  JSON.parse(fs.readFileSync(path, "utf8")) as T

const fingerprint = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, "")

const dedupeEchoes = (echoes: BenchmarkEcho[]) => {
  const byText = new Map<string, BenchmarkEcho>()
  for (const echo of [...echoes].sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
    const key = fingerprint(echo.triggerText)
    if (!byText.has(key)) byText.set(key, echo)
  }
  return [...byText.values()]
}

const extractSelections = (raw: string) => {
  const selections = new Map<string, string>()
  const blockPattern =
    /<!-- ECHO_PROBE_REPORT_START (?<timestamp>[^ ]+) -->[\s\S]*?## Selection\s*> (?<selection>[\s\S]*?)\s*## Summary[\s\S]*?<!-- ECHO_PROBE_REPORT_END/g
  let index = 0
  for (const match of raw.matchAll(blockPattern)) {
    index += 1
    const id = `Q${String(index).padStart(2, "0")}`
    const selection = (match.groups?.selection || "")
      .replace(/\r?\n> ?/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    selections.set(id, selection)
  }
  return selections
}

const tagsByQuery: Record<string, string[]> = {
  Q01: ["technical", "heap", "lexical"],
  Q02: ["discovery-loop", "abstain"],
  Q03: ["discovery-loop", "long-query"],
  Q04: ["discovery-loop", "rsi"],
  Q05: ["discovery-loop", "rsi"],
  Q06: ["english", "abstain"],
  Q07: ["english", "speaking"],
  Q08: ["seo", "temporal", "abstain"],
  Q09: ["seo", "lexical"],
  Q10: ["seo", "english", "long-query"],
  Q11: ["seo"],
  Q12: ["image-tools"],
  Q13: ["english", "unrelated", "abstain"],
  Q14: ["chrome-store", "temporal", "abstain"],
  Q15: ["chrome-store", "cross-language", "short-query"],
  Q16: ["user-research", "long-query"],
  Q17: ["product-thesis", "english"],
  Q18: ["memory", "short-query", "semantic"],
  Q19: ["agent", "short-query"],
  Q20: ["product-discovery", "long-query"],
  Q21: ["lifestyle", "medical", "semantic"]
}

const main = () => {
  const backupPath = requiredArg("backup")
  const reportPath = requiredArg("report")
  const labelsPath = requiredArg("labels")
  const backup = readJson<BackupFile>(backupPath)
  const labels = readJson<LabelsFile>(labelsPath)
  const selections = extractSelections(fs.readFileSync(reportPath, "utf8"))
  const echoes = dedupeEchoes(backup.echoes)

  const queries: BenchmarkQuery[] = labels.queries.map((query) => {
    const text = selections.get(query.id)
    if (!text) throw new Error(`Missing report selection for ${query.id}`)
    const queryTime = Date.parse(query.timestamp)
    const exactSource = backup.echoes
      .filter((echo) => fingerprint(echo.triggerText) === fingerprint(text))
      .sort(
        (left, right) =>
          Math.abs(Date.parse(left.createdAt) - queryTime) -
          Math.abs(Date.parse(right.createdAt) - queryTime)
      )[0]
    const nearestSource = [...backup.echoes].sort(
      (left, right) =>
        Math.abs(Date.parse(left.createdAt) - queryTime) -
        Math.abs(Date.parse(right.createdAt) - queryTime)
    )[0]
    return {
      id: query.id,
      text,
      timestamp: query.timestamp,
      contextUrl: exactSource?.url || nearestSource?.url,
      excludeSelfMatch: true,
      relevant: query.relevantEchoIds,
      hardNegatives: Object.entries(query.acceptedLabels)
        .filter(([, label]) => label !== "useful")
        .map(([id]) => id),
      expectedBehavior: query.expected,
      rationale: query.summary,
      tags: ["holdout", ...(tagsByQuery[query.id] || [])]
    }
  })

  fs.writeFileSync(
    HOLDOUT_CORPUS_PATH,
    `${JSON.stringify(
      {
        fixtureVersion: "2026-08-11-dogfood-holdout-v1",
        note: `Private dogfood snapshot imported from ${backupPath}; normalized-text dedupe applied.`,
        echoes
      },
      null,
      2
    )}\n`,
    "utf8"
  )
  fs.writeFileSync(
    HOLDOUT_QUERIES_PATH,
    `${JSON.stringify(
      {
        fixtureVersion: "2026-08-11-dogfood-holdout-v1",
        annotationType: labels.annotationType,
        queries
      },
      null,
      2
    )}\n`,
    "utf8"
  )

  console.log(
    `[holdout] imported ${backup.echoes.length} rows -> ${echoes.length} unique Echoes; ${queries.length} queries`
  )
}

main()
