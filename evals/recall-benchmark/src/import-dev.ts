import fs from "node:fs"

import { DEV_CORPUS_PATH, DEV_QUERIES_PATH } from "./config"
import type { BenchmarkEcho, BenchmarkQuery, ExpectedBehavior } from "./types"

type BackupFile = { echoes: BenchmarkEcho[] }

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
  const timestamps = new Map<string, string>()
  const pattern =
    /<!-- ECHO_PROBE_REPORT_START (?<timestamp>[^ ]+) -->[\s\S]*?## Selection\s*> (?<selection>[\s\S]*?)\s*## Summary[\s\S]*?<!-- ECHO_PROBE_REPORT_END/g
  let index = 0
  for (const match of raw.matchAll(pattern)) {
    index += 1
    const id = `Q${String(index).padStart(2, "0")}`
    selections.set(
      id,
      (match.groups?.selection || "")
        .replace(/\r?\n> ?/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    )
    timestamps.set(id, match.groups?.timestamp || "")
  }
  return { selections, timestamps }
}

const parseLabels = (raw: string) => {
  const rows = new Map<
    string,
    {
      summary: string
      expected: ExpectedBehavior
      relevant: string[]
      hardNegatives: string[]
    }
  >()
  const sections = raw.split(/(?=^### Q\d+ - )/gm)
  for (const section of sections) {
    const heading = section.match(
      /^### (?<id>Q\d+) - (?<timestamp>\S+) - (?<summary>.+)$/m
    )
    const expected = section.match(/^- Expected behavior: `(?<value>surface|abstain)`/m)
    if (!heading?.groups || !expected?.groups) continue
    const relevant = new Set<string>()
    const hardNegatives = new Set<string>()
    for (const match of section.matchAll(
      /^- `(?<id>[^`]+)` - .* - `(?<label>useful|not_relevant|wrong_time)` -/gm
    )) {
      const id = match.groups?.id || ""
      if (match.groups?.label === "useful") relevant.add(id)
      else hardNegatives.add(id)
    }
    for (const match of section.matchAll(/^- Missed useful: `(?<id>[^`]+)`/gm)) {
      relevant.add(match.groups?.id || "")
    }
    rows.set(heading.groups.id, {
      summary: heading.groups.summary.trim(),
      expected: expected.groups.value as ExpectedBehavior,
      relevant: [...relevant],
      hardNegatives: [...hardNegatives]
    })
  }
  return rows
}

const main = () => {
  const backupPath = requiredArg("backup")
  const reportPath = requiredArg("report")
  const labelsPath = requiredArg("labels")
  const backup = JSON.parse(fs.readFileSync(backupPath, "utf8")) as BackupFile
  const report = extractSelections(fs.readFileSync(reportPath, "utf8"))
  const labelRows = parseLabels(fs.readFileSync(labelsPath, "utf8"))
  const echoes = dedupeEchoes(backup.echoes)

  const queries: BenchmarkQuery[] = [...labelRows.entries()].map(([id, label]) => {
    const text = report.selections.get(id)
    const timestamp = report.timestamps.get(id)
    if (!text || !timestamp) throw new Error(`Missing report data for ${id}`)
    const queryTime = Date.parse(timestamp)
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
      id,
      text,
      timestamp,
      contextUrl: exactSource?.url || nearestSource?.url,
      excludeSelfMatch: true,
      relevant: label.relevant,
      hardNegatives: label.hardNegatives,
      expectedBehavior: label.expected,
      rationale: label.summary,
      tags: ["dev", label.expected]
    }
  })

  fs.writeFileSync(
    DEV_CORPUS_PATH,
    `${JSON.stringify(
      {
        fixtureVersion: "2026-08-10-dogfood-dev-v1",
        note: `Private dev snapshot imported from ${backupPath}; normalized-text dedupe applied.`,
        echoes
      },
      null,
      2
    )}\n`,
    "utf8"
  )
  fs.writeFileSync(
    DEV_QUERIES_PATH,
    `${JSON.stringify(
      {
        fixtureVersion: "2026-08-10-dogfood-dev-v1",
        annotationType: "model-assisted-first-pass",
        queries
      },
      null,
      2
    )}\n`,
    "utf8"
  )
  console.log(
    `[dev] imported ${backup.echoes.length} rows -> ${echoes.length} unique Echoes; ${queries.length} queries`
  )
}

main()
