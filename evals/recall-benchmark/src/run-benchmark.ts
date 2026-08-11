import fs from "node:fs"

import {
  CORPUS_PATH,
  DEV_CORPUS_PATH,
  DEV_EMBED_CACHE_PATH,
  DEV_METRICS_PATH,
  DEV_QUERIES_PATH,
  DEV_REPORT_PATH,
  EMBED_CACHE_PATH,
  FIXTURE_VERSION,
  GUARDED_MIN_LEXICAL,
  GUARDED_MIN_VECTOR_SPREAD,
  HOLDOUT_CORPUS_PATH,
  HOLDOUT_EMBED_CACHE_PATH,
  HOLDOUT_METRICS_PATH,
  HOLDOUT_QUERIES_PATH,
  HOLDOUT_REPORT_PATH,
  METRICS_PATH,
  MODEL_ID,
  QUERIES_PATH,
  REPORT_PATH,
  SURFACE_LIMIT,
  VECTOR_MIN_SIM,
  VECTOR_MIN_SPREAD
} from "./config"
import {
  embedPassages,
  getColdStartMs,
  loadEmbeddingCache,
  saveEmbeddingCache
} from "./embed"
import { aggregate, scoreQuery } from "./metrics"
import {
  buildPassageMap,
  runBm25,
  runGuardedHybrid,
  runHybrid,
  runVector
} from "./strategies"
import type {
  BenchmarkEcho,
  BenchmarkQuery,
  StrategyName,
  StrategyRun
} from "./types"

type CorpusFile = {
  fixtureVersion: string
  note?: string
  echoes: BenchmarkEcho[]
}

type QueriesFile = {
  fixtureVersion: string
  queries: BenchmarkQuery[]
}

type DatasetName = "fixture" | "dev" | "holdout"

const parseDataset = (): DatasetName => {
  const arg = process.argv.find((value) => value.startsWith("--dataset="))
  const value = arg?.slice("--dataset=".length)
  return value === "holdout" || value === "dev" ? value : "fixture"
}

const pathsForDataset = (dataset: DatasetName) => {
  if (dataset === "holdout") {
    return {
      corpus: HOLDOUT_CORPUS_PATH,
      queries: HOLDOUT_QUERIES_PATH,
      report: HOLDOUT_REPORT_PATH,
      metrics: HOLDOUT_METRICS_PATH,
      embeddings: HOLDOUT_EMBED_CACHE_PATH
    }
  }
  if (dataset === "dev") {
    return {
      corpus: DEV_CORPUS_PATH,
      queries: DEV_QUERIES_PATH,
      report: DEV_REPORT_PATH,
      metrics: DEV_METRICS_PATH,
      embeddings: DEV_EMBED_CACHE_PATH
    }
  }
  return {
    corpus: CORPUS_PATH,
    queries: QUERIES_PATH,
    report: REPORT_PATH,
    metrics: METRICS_PATH,
    embeddings: EMBED_CACHE_PATH
  }
}

const readJson = <T>(path: string): T => {
  if (!fs.existsSync(path)) {
    throw new Error(`Missing ${path}. Run npm run seed first.`)
  }
  return JSON.parse(fs.readFileSync(path, "utf8")) as T
}

const parseStrategies = (): StrategyName[] => {
  const arg = process.argv.find((value) => value.startsWith("--strategies="))
  if (!arg) return ["bm25", "vector", "hybrid", "guarded-hybrid"]
  return arg
    .slice("--strategies=".length)
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean) as StrategyName[]
}

const ensureEmbeddings = async (
  echoes: BenchmarkEcho[],
  cachePath: string
) => {
  const cache = loadEmbeddingCache(cachePath)
  if (cache && cache.modelId === MODEL_ID) {
    const missing = echoes.filter((echo) => !cache.byEchoId[echo.id])
    if (!missing.length) {
      console.log(`[embed] cache hit (${echoes.length} vectors)`)
      return new Map(Object.entries(cache.byEchoId))
    }
  }

  const passages = buildPassageMap(echoes)
  const ids = echoes.map((echo) => echo.id)
  const texts = ids.map((id) => passages.get(id) || "")
  console.log(`[embed] encoding ${texts.length} passages...`)
  const vectors = await embedPassages(texts)
  const byEchoId: Record<string, number[]> = {}
  ids.forEach((id, index) => {
    byEchoId[id] = vectors[index]
  })
  saveEmbeddingCache({ modelId: MODEL_ID, byEchoId }, cachePath)
  return new Map(Object.entries(byEchoId))
}

const fingerprint = (value: string) =>
  value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}\s]+/gu, "")

const eligibleEchoesForQuery = (
  echoes: BenchmarkEcho[],
  query: BenchmarkQuery
) => {
  const queryTime = query.timestamp ? Date.parse(query.timestamp) : Number.POSITIVE_INFINITY

  return echoes.filter((echo) => Date.parse(echo.createdAt) < queryTime)
}

const excludeSelfMatches = (
  echoes: BenchmarkEcho[],
  query: BenchmarkQuery
) => {
  if (!query.excludeSelfMatch) return echoes
  const queryFingerprint = fingerprint(query.text)
  return echoes.filter(
    (echo) => fingerprint(echo.triggerText) !== queryFingerprint
  )
}

const pct = (value: number) => `${(value * 100).toFixed(1)}%`

const main = async () => {
  const dataset = parseDataset()
  const paths = pathsForDataset(dataset)
  const strategies = parseStrategies()
  const corpusFile = readJson<CorpusFile>(paths.corpus)
  const queriesFile = readJson<QueriesFile>(paths.queries)
  const echoes = corpusFile.echoes
  const queries = queriesFile.queries

  const needVector = strategies.some(
    (name) =>
      name === "vector" || name === "hybrid" || name === "guarded-hybrid"
  )
  const embeddings = needVector
    ? await ensureEmbeddings(echoes, paths.embeddings)
    : new Map<string, number[]>()

  // Warm lexical once
  runBm25(echoes, "warmup selection for lexical path")

  type Row = {
    query: BenchmarkQuery
    runs: Record<string, StrategyRun>
  }
  const rows: Row[] = []

  for (const query of queries) {
    const eligibleEchoes = eligibleEchoesForQuery(echoes, query)
    const vectorEchoes = excludeSelfMatches(eligibleEchoes, query)
    const runs: Record<string, StrategyRun> = {}
    if (strategies.includes("bm25")) {
      runs.bm25 = runBm25(eligibleEchoes, query.text, query.contextUrl)
    }
    if (strategies.includes("vector")) {
      // Raw vector top-3 for metrics (product would still need a gate)
      runs.vector = await runVector(vectorEchoes, embeddings, query.text, false)
    }
    if (strategies.includes("hybrid")) {
      runs.hybrid = await runHybrid(
        eligibleEchoes,
        vectorEchoes,
        embeddings,
        query.text,
        query.contextUrl
      )
    }
    if (strategies.includes("guarded-hybrid")) {
      runs["guarded-hybrid"] = await runGuardedHybrid(
        eligibleEchoes,
        vectorEchoes,
        embeddings,
        query.text,
        query.contextUrl
      )
    }
    rows.push({ query, runs })
    const summary = Object.entries(runs)
      .map(([name, run]) => `${name}:${run.hits.map((hit) => hit.id).join("|") || "∅"}`)
      .join(" ")
    console.log(`[bench] ${query.id} ${summary}`)
  }

  const aggregates = strategies.map((name) => {
    const scored = rows.map(({ query, runs }) => {
      const run = runs[name]
      return {
        ...scoreQuery(query, run.hits),
        latencyMs: run.latencyMs
      }
    })
    return aggregate(name, scored)
  })

  const failureStories: string[] = []
  for (const { query, runs } of rows) {
    const bm25 = runs.bm25
    const vector = runs.vector
    const hybrid = runs.hybrid
    if (!bm25 || !vector) continue

    const relevant = new Set(query.relevant)
    const bm25Hit = bm25.hits.some((hit) => relevant.has(hit.id))
    const vectorHit = vector.hits.some((hit) => relevant.has(hit.id))

    if (!bm25Hit && vectorHit && query.expectedBehavior === "surface") {
      failureStories.push(
        `- **${query.id}** 词法漏召回、向量捞回：\`${query.text.slice(0, 48)}\` → vector ${vector.hits
          .map((hit) => hit.id)
          .join(", ")}`
      )
    }
    if (scoreQuery(query, bm25.hits).falseSurface) {
      failureStories.push(
        `- **${query.id}** BM25 误浮现：显示 ${bm25.hits
          .map((hit) => hit.id)
          .join(", ") || "∅"} · 期望 ${query.expectedBehavior} · relevant=[${query.relevant.join(",")}]`
      )
    }
    if (
      query.expectedBehavior === "abstain" &&
      vector.hits.length > 0 &&
      (!hybrid || hybrid.hits.length > 0)
    ) {
      failureStories.push(
        `- **${query.id}** 应沉默却被向量/Hybrid 打扰：vector=${vector.hits
          .map((hit) => hit.id)
          .join(",")} hybrid=${hybrid?.hits.map((hit) => hit.id).join(",") || "∅"}`
      )
    }
  }

  // Deduplicate stories, keep first 8
  const uniqueStories = [...new Set(failureStories)].slice(0, 8)

  const lines: string[] = [
    "# Echo Recall Benchmark Report",
    "",
    `- Generated: ${new Date().toISOString()}`,
    `- Dataset: \`${dataset}\``,
    `- Fixture: \`${corpusFile.fixtureVersion || FIXTURE_VERSION}\``,
    `- Corpus: ${echoes.length} Echoes · Queries: ${queries.length}`,
    `- Model: \`${MODEL_ID}\` (local)`,
    `- Surface limit: ${SURFACE_LIMIT}`,
    `- Hybrid vector fill gates: minSim=${VECTOR_MIN_SIM}, minSpread=${VECTOR_MIN_SPREAD}`,
    `- Embedding cold start: ${getColdStartMs()?.toFixed(0) ?? "n/a (cache/warm)"} ms`,
    "",
    "## Method",
    "",
    "- **bm25**: product `analyzeRelatedEchoes` with precision-first gate (what the side panel would show).",
    "- **vector**: local multilingual-e5-small cosine top-3 (raw; no product gate).",
    "- **hybrid**: lexical accepted first, then vector-only fills that clear similarity/spread gates.",
    `- **guarded-hybrid**: Report 4 dev rule; surface one result only when lexical/vector top-1 agree with lexical >= ${GUARDED_MIN_LEXICAL}, or vector top-1/top-3 spread >= ${GUARDED_MIN_VECTOR_SPREAD}.`,
    dataset === "holdout" || dataset === "dev"
      ? "- Labels are model-assisted first-pass annotations over a private dogfood snapshot; time slicing and capture self-match exclusion are enabled."
      : "- Labels are dogfood-realistic fixtures (not a private DB dump). Schema matches browser export.",
    "",
    ...(dataset === "holdout"
      ? [
          "## Credibility and limitations",
          "",
          "This is an internal directional benchmark, not a statistically representative product evaluation. It is strong enough to reject clearly weak options and choose the next experiment, but not to claim production quality or general retrieval superiority.",
          "",
          "- **Small sample:** 21 queries over 91 unique Echoes. One query changes a query-level rate by about 4.8 percentage points. The five abstention cases and nine guarded-hybrid surfaces are especially small denominators, so 100% means 5/5 or 9/9, not a stable population estimate.",
          "- **Single-user, short-window data:** all examples come from one person's recent dogfood snapshot and reflect that user's topics, writing habits, sites, capture behavior, and corpus density. Results cannot be generalized to other users or larger/older databases.",
          "- **Language coverage:** 13 queries are Chinese or Chinese-dominant mixed text, five are English-only, and three are English-dominant mixed text. Many contain English technical terms. There is no meaningful coverage of other languages, colloquial variants, spelling noise, or broad monolingual English/Chinese usage.",
          "- **Topic skew:** the set is concentrated on software engineering, AI/product work, interview preparation, and a small amount of lifestyle content. It does not establish performance for diverse personal knowledge bases.",
          "- **Label uncertainty:** relevance labels are model-assisted first-pass judgments, not independently double-annotated human gold labels. Ambiguous partial relevance and missing relevant Echoes may change P@3, R@3, MRR, and false-surface counts.",
          "- **Limited independence:** guarded thresholds were selected on Report 4 and frozen before Report 5, which reduces direct holdout tuning. However, both reports come from the same user and nearby period, so the holdout is not independent at the population level.",
          "- **Runtime limits:** latency was measured in one local environment; vector corpus encoding is excluded from warm per-query latency. Browser bundle size, cold start, memory, hardware variation, and extension lifecycle costs remain unmeasured.",
          "- **No significance claim:** strategy differences have no confidence intervals or statistical significance test and should be read as observed outcomes on this fixture only.",
          "",
          "Therefore, the report supports keeping vector retrieval experimental and testing a guarded precision-first path. It does not support shipping the current strategy, replacing BM25, or advertising a general accuracy improvement.",
          ""
        ]
      : []),
    "## Aggregate metrics",
    "",
    "| Strategy | P@3 | R@3 | MRR | False surfaces /100 | Abstention acc | Avg latency ms |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |"
  ]

  for (const row of aggregates) {
    lines.push(
      `| ${row.strategy} | ${pct(row.precisionAt3)} | ${pct(row.recallAt3)} | ${row.mrr.toFixed(3)} | ${row.falseSurfacesPer100.toFixed(1)} | ${row.abstentionAccuracy == null ? "n/a" : pct(row.abstentionAccuracy)} | ${row.latencyMsAvg.toFixed(1)} |`
    )
  }

  lines.push(
    "",
    "## Ship / abstain decision",
    "",
    "Reading the aggregates together with failure stories:",
    "",
    "1. Raw **vector** often improves paraphrase recall but raises false surfaces — cosine is not a confidence score.",
    "2. Product **bm25** is quieter (precision-first). That matches Echo's low-interruption UX.",
    "3. **hybrid** is allowed only when vector fills clear similarity + spread gates; if it still worsens false surfaces vs bm25, **do not ship vector into the extension mainline**.",
    "",
    "## Representative failure / contrast stories",
    ""
  )
  if (uniqueStories.length) {
    lines.push(...uniqueStories, "")
  } else {
    lines.push("_No automatic contrast stories fired; inspect per-query tables below._", "")
  }

  lines.push("## Per-query results", "")

  for (const { query, runs } of rows) {
    lines.push(`### ${query.id} · expected \`${query.expectedBehavior}\``, "")
    lines.push(`> ${query.text}`, "")
    lines.push(
      `- relevant: ${query.relevant.join(", ") || "(none)"}`,
      `- hardNegatives: ${query.hardNegatives.join(", ") || "(none)"}`,
      `- rationale: ${query.rationale}`,
      `- tags: ${query.tags.join(", ")}`,
      ""
    )
    for (const name of strategies) {
      const run = runs[name]
      const metrics = scoreQuery(query, run.hits)
      lines.push(
        `**${name}** · P@3 ${pct(metrics.precisionAt3)} · R@3 ${pct(metrics.recallAt3)} · MRR ${metrics.mrr.toFixed(3)} · falseSurface=${metrics.falseSurface} · ${run.latencyMs.toFixed(1)}ms`,
        ""
      )
      if (!run.hits.length) {
        lines.push("_abstain_", "")
        continue
      }
      lines.push("| # | id | score | source | relevant? |", "| --- | --- | ---: | --- | --- |")
      run.hits.forEach((hit, index) => {
        lines.push(
          `| ${index + 1} | ${hit.id} | ${hit.score.toFixed(3)} | ${hit.source} | ${query.relevant.includes(hit.id) ? "yes" : "no"} |`
        )
      })
      lines.push("")
    }
  }

  lines.push(
    "---",
    "",
    "## Reproduce",
    "",
    "```powershell",
    "cd evals/recall-benchmark",
    "npm install",
    "npm run all",
    "```",
    ""
  )

  fs.writeFileSync(paths.report, lines.join("\n"), "utf8")
  fs.writeFileSync(
    paths.metrics,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        dataset,
        fixtureVersion: corpusFile.fixtureVersion || FIXTURE_VERSION,
        coldStartMs: getColdStartMs(),
        aggregates,
        perQuery: rows.map(({ query, runs }) => ({
          queryId: query.id,
          expectedBehavior: query.expectedBehavior,
          relevant: query.relevant,
          strategies: Object.fromEntries(
            Object.entries(runs).map(([name, run]) => [
              name,
              {
                ...scoreQuery(query, run.hits),
                latencyMs: run.latencyMs,
                hitIds: run.hits.map((hit) => hit.id),
                hits: run.hits.map((hit) => ({
                  id: hit.id,
                  score: hit.score,
                  source: hit.source
                })),
                stages: run.stages
              }
            ])
          )
        }))
      },
      null,
      2
    ),
    "utf8"
  )

  console.log(`[bench] report -> ${paths.report}`)
  console.log(`[bench] metrics -> ${paths.metrics}`)
  for (const row of aggregates) {
    console.log(
      `[bench] ${row.strategy} P@3=${pct(row.precisionAt3)} R@3=${pct(row.recallAt3)} FP/100=${row.falseSurfacesPer100.toFixed(1)}`
    )
  }
}

main().catch((error) => {
  console.error("[bench] failed:", error)
  process.exit(1)
})
