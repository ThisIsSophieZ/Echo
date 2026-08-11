import {
  env,
  pipeline
} from "/evals/recall-benchmark/node_modules/@xenova/transformers/dist/transformers.min.js"

const MODEL_ID = "Xenova/multilingual-e5-small"
const MODEL_ROOT = "/evals/recall-benchmark/node_modules/@xenova/transformers/.cache/"
const RUNTIME_ROOT = "/evals/recall-benchmark/node_modules/@xenova/transformers/dist/"
const CORPUS_URL = "/evals/recall-benchmark/data/corpus.json"
const QUERIES_URL = "/evals/recall-benchmark/data/queries.json"
const QUERY_RUNS = 10
const MEMORY_TIMEOUT_MS = 15_000

env.localModelPath = MODEL_ROOT
env.allowRemoteModels = false
env.useBrowserCache = true
env.backends.onnx.wasm.wasmPaths = RUNTIME_ROOT
env.backends.onnx.wasm.numThreads = Math.max(
  1,
  Math.min(4, navigator.hardwareConcurrency || 1)
)

const elements = {
  assetBytes: document.querySelector("#assetBytes"),
  assets: document.querySelector("#assets"),
  coldStart: document.querySelector("#coldStart"),
  coldStartMode: document.querySelector("#coldStartMode"),
  download: document.querySelector("#download"),
  environment: document.querySelector("#environment"),
  memoryDelta: document.querySelector("#memoryDelta"),
  memoryKind: document.querySelector("#memoryKind"),
  mode: document.querySelector("#mode"),
  run: document.querySelector("#run"),
  stages: document.querySelector("#stages"),
  status: document.querySelector("#status"),
  warmQuery: document.querySelector("#warmQuery")
}

let latestResult = null
let manifest = null

const formatBytes = (bytes) => {
  if (bytes == null) return "missing"
  const units = ["B", "KB", "MB", "GB"]
  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value.toFixed(unit > 1 ? 1 : 0)} ${units[unit]}`
}

const round = (value, digits = 1) => Number(value.toFixed(digits))

const percentile = (values, fraction) => {
  const sorted = [...values].sort((left, right) => left - right)
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)
  return sorted[index]
}

const setStatus = (message, tone = "ready") => {
  elements.status.textContent = message
  elements.status.dataset.tone = tone
}

const echoText = (echo) =>
  [echo.title, echo.userThought, echo.triggerText, echo.inferredThought]
    .filter(Boolean)
    .join("\n")

const memorySnapshot = async () => {
  if (typeof performance.measureUserAgentSpecificMemory === "function") {
    try {
      const timeout = new Promise((resolve) =>
        setTimeout(() => resolve(null), MEMORY_TIMEOUT_MS)
      )
      const measurement = await Promise.race([
        performance.measureUserAgentSpecificMemory(),
        timeout
      ])
      if (measurement) {
        return { bytes: measurement.bytes, kind: "user-agent-specific" }
      }
    } catch {
      // Chrome may expose the API while declining a measurement.
    }
  }

  if (performance.memory?.usedJSHeapSize != null) {
    return { bytes: performance.memory.usedJSHeapSize, kind: "js-heap" }
  }

  return { bytes: null, kind: "unavailable" }
}

const clearOriginCaches = async () => {
  const cacheNames = await caches.keys()
  await Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName)))
  return cacheNames.length
}

const embed = async (extractor, texts, prefix) => {
  const output = await extractor(
    texts.map((text) => `${prefix}: ${text}`),
    { pooling: "mean", normalize: true }
  )
  return output.tolist()
}

const renderManifest = (assetManifest) => {
  const rows = Object.entries(assetManifest.groups).flatMap(([group, assets]) =>
    assets.map((asset) => ({ ...asset, group }))
  )
  const total = rows.reduce((sum, asset) => sum + (asset.bytes || 0), 0)
  elements.assetBytes.textContent = formatBytes(total)
  elements.assets.innerHTML = rows
    .map(
      (asset) =>
        `<tr><td><code>${asset.path.split("/").at(-1)}</code></td><td>${asset.group}</td><td class="number">${formatBytes(asset.bytes)}</td></tr>`
    )
    .join("")
}

const renderEnvironment = () => {
  const values = {
    Browser: navigator.userAgent,
    "Logical processors": navigator.hardwareConcurrency || "unknown",
    "Device memory": navigator.deviceMemory ? `${navigator.deviceMemory} GB bucket` : "unavailable",
    "Cross-origin isolated": String(crossOriginIsolated),
    "WASM threads": env.backends.onnx.wasm.numThreads,
    "Memory API": typeof performance.measureUserAgentSpecificMemory === "function"
      ? "measureUserAgentSpecificMemory"
      : performance.memory
        ? "performance.memory"
        : "unavailable"
  }
  elements.environment.innerHTML = Object.entries(values)
    .map(([key, value]) => `<dt>${key}</dt><dd>${value}</dd>`)
    .join("")
}

const renderResult = (result) => {
  elements.coldStart.textContent = `${result.pipelineInitMs.toFixed(0)} ms`
  elements.coldStartMode.textContent = result.mode === "fresh" ? "empty Cache API" : "persistent browser cache"
  elements.warmQuery.textContent = `${result.warmQueryMs.p50.toFixed(0)} / ${result.warmQueryMs.p95.toFixed(0)} ms`

  const memoryDelta = result.memory.afterCorpusBytes == null || result.memory.beforeBytes == null
    ? null
    : result.memory.afterCorpusBytes - result.memory.beforeBytes
  elements.memoryDelta.textContent = memoryDelta == null ? "unavailable" : formatBytes(memoryDelta)
  elements.memoryKind.textContent = result.memory.kind

  const stages = [
    ["Pipeline initialization", result.pipelineInitMs, result.mode],
    ["Corpus encoding", result.corpusEncodingMs, `${result.corpusCount} public Echoes`],
    ["Corpus per Echo", result.corpusMsPerEcho, "measured average"],
    ["Warm query p50", result.warmQueryMs.p50, `${result.warmQueryMs.samples.length} runs`],
    ["Warm query p95", result.warmQueryMs.p95, `${result.warmQueryMs.samples.length} runs`],
    ["Vector ranking p50", result.rankingMs.p50, `${result.corpusCount} vectors`]
  ]
  elements.stages.innerHTML = stages
    .map(([stage, duration, scope]) => `<tr><td>${stage}</td><td class="number">${duration.toFixed(1)} ms</td><td>${scope}</td></tr>`)
    .join("")
}

const runBenchmark = async () => {
  elements.run.disabled = true
  elements.download.disabled = true
  latestResult = null

  try {
    if (!manifest || manifest.missing.length) {
      throw new Error("Model assets are missing. Run the Node vector benchmark once first.")
    }

    const mode = elements.mode.value
    if (mode === "fresh") {
      setStatus("Clearing local model cache", "running")
      await clearOriginCaches()
    }

    const [corpusFile, queryFile] = await Promise.all([
      fetch(CORPUS_URL).then((response) => response.json()),
      fetch(QUERIES_URL).then((response) => response.json())
    ])
    const documents = corpusFile.echoes.map(echoText)
    const queries = queryFile.queries.slice(0, QUERY_RUNS).map((query) => query.text)
    setStatus("Measuring baseline memory", "running")
    const memoryBefore = await memorySnapshot()

    performance.clearResourceTimings()
    setStatus(`Loading ${MODEL_ID}`, "running")
    const pipelineStarted = performance.now()
    const extractor = await pipeline("feature-extraction", MODEL_ID, {
      progress_callback: (progress) => {
        if (progress.status === "progress" && progress.file) {
          const percent = progress.progress == null ? "" : ` ${progress.progress.toFixed(0)}%`
          setStatus(`Loading ${progress.file}${percent}`, "running")
        }
      }
    })
    const pipelineInitMs = performance.now() - pipelineStarted
    const memoryAfterModel = await memorySnapshot()

    setStatus(`Encoding ${documents.length} public Echoes`, "running")
    const corpusStarted = performance.now()
    const corpusVectors = await embed(extractor, documents, "passage")
    const corpusEncodingMs = performance.now() - corpusStarted
    const memoryAfterCorpus = await memorySnapshot()

    setStatus("Measuring warm queries", "running")
    await embed(extractor, [queries[0]], "query")
    const querySamples = []
    const rankingSamples = []
    for (const query of queries) {
      const queryStarted = performance.now()
      const [queryVector] = await embed(extractor, [query], "query")
      querySamples.push(performance.now() - queryStarted)

      const rankStarted = performance.now()
      corpusVectors
        .map((vector, index) => ({
          index,
          score: vector.reduce((sum, value, offset) => sum + value * queryVector[offset], 0)
        }))
        .sort((left, right) => right.score - left.score)
        .slice(0, 3)
      rankingSamples.push(performance.now() - rankStarted)
    }

    const resourceEntries = performance
      .getEntriesByType("resource")
      .filter((entry) => entry.name.includes("multilingual-e5-small") || entry.name.includes("ort-wasm"))
      .map((entry) => ({
        name: entry.name,
        transferSize: entry.transferSize,
        encodedBodySize: entry.encodedBodySize,
        durationMs: round(entry.duration)
      }))

    latestResult = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      modelId: MODEL_ID,
      mode,
      pipelineInitMs: round(pipelineInitMs),
      corpusCount: documents.length,
      corpusEncodingMs: round(corpusEncodingMs),
      corpusMsPerEcho: round(corpusEncodingMs / documents.length, 2),
      warmQueryMs: {
        p50: round(percentile(querySamples, 0.5)),
        p95: round(percentile(querySamples, 0.95)),
        samples: querySamples.map((value) => round(value))
      },
      rankingMs: {
        p50: round(percentile(rankingSamples, 0.5), 3),
        p95: round(percentile(rankingSamples, 0.95), 3)
      },
      memory: {
        kind: memoryAfterCorpus.kind,
        beforeBytes: memoryBefore.bytes,
        afterModelBytes: memoryAfterModel.bytes,
        afterCorpusBytes: memoryAfterCorpus.bytes
      },
      assetManifest: manifest,
      resourceEntries,
      environment: {
        userAgent: navigator.userAgent,
        hardwareConcurrency: navigator.hardwareConcurrency || null,
        deviceMemoryGbBucket: navigator.deviceMemory || null,
        crossOriginIsolated,
        wasmThreads: env.backends.onnx.wasm.numThreads
      },
      limitations: [
        "Localhost transfer duration is not user network download time.",
        "The public 55-Echo fixture is used; private holdout content is excluded.",
        "User-agent-specific memory falls back to JS heap after a 15-second timeout; JS heap may omit native or WASM allocations.",
        "Results describe one Chrome and hardware environment, not a production SLA."
      ]
    }

    globalThis.__echoVectorBenchmarkResult = latestResult
    renderResult(latestResult)
    elements.download.disabled = false
    setStatus("Benchmark complete")
  } catch (error) {
    console.error(error)
    setStatus(error instanceof Error ? error.message : String(error), "error")
  } finally {
    elements.run.disabled = false
  }
}

elements.run.addEventListener("click", () => void runBenchmark())
elements.download.addEventListener("click", () => {
  if (!latestResult) return
  const blob = new Blob([JSON.stringify(latestResult, null, 2)], { type: "application/json" })
  const link = document.createElement("a")
  link.href = URL.createObjectURL(blob)
  link.download = `echo-vector-browser-${latestResult.mode}-${new Date().toISOString().replaceAll(":", "-")}.json`
  link.click()
  URL.revokeObjectURL(link.href)
})

const initialize = async () => {
  renderEnvironment()
  manifest = await fetch("/__asset-manifest").then((response) => response.json())
  renderManifest(manifest)
  if (manifest.missing.length) {
    setStatus("Model assets are missing. Run the Node vector benchmark once first.", "error")
  }
}

void initialize()
