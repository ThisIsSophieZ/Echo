import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))

export const ROOT = path.resolve(here, "..")
export const DATA_DIR = path.join(ROOT, "data")
export const CORPUS_PATH = path.join(DATA_DIR, "corpus.json")
export const QUERIES_PATH = path.join(DATA_DIR, "queries.json")
export const REPORT_PATH = path.join(DATA_DIR, "report.md")
export const METRICS_PATH = path.join(DATA_DIR, "metrics.json")
export const EMBED_CACHE_PATH = path.join(DATA_DIR, "embeddings-cache.json")
export const HOLDOUT_CORPUS_PATH = path.join(DATA_DIR, "holdout-corpus.json")
export const HOLDOUT_QUERIES_PATH = path.join(DATA_DIR, "holdout-queries.json")
export const HOLDOUT_REPORT_PATH = path.join(DATA_DIR, "holdout-report.md")
export const HOLDOUT_METRICS_PATH = path.join(DATA_DIR, "holdout-metrics.json")
export const HOLDOUT_EMBED_CACHE_PATH = path.join(
  DATA_DIR,
  "holdout-embeddings-cache.json"
)
export const DEV_CORPUS_PATH = path.join(DATA_DIR, "dev-corpus.json")
export const DEV_QUERIES_PATH = path.join(DATA_DIR, "dev-queries.json")
export const DEV_REPORT_PATH = path.join(DATA_DIR, "dev-report.md")
export const DEV_METRICS_PATH = path.join(DATA_DIR, "dev-metrics.json")
export const DEV_EMBED_CACHE_PATH = path.join(DATA_DIR, "dev-embeddings-cache.json")

/** Product lexical recall path (type-only imports → runnable under tsx). */
export const PRODUCT_RELATED_PATH = path.resolve(
  ROOT,
  "../../extension/lib/echo-related.ts"
)

export const MODEL_ID = "Xenova/multilingual-e5-small"
export const TOP_K = 5
export const SURFACE_LIMIT = 3
/** Vector-only hits below this cosine are never surfaced in hybrid. */
export const VECTOR_MIN_SIM = 0.82
/** Require this gap between #1 and #3 vector sims to trust raw vector ranking. */
export const VECTOR_MIN_SPREAD = 0.02
/** Dev-set guard: lexical/vector top-1 must agree at very high lexical evidence. */
export const GUARDED_MIN_LEXICAL = 98
/** Dev-set guard for a vector-only top-1 semantic rescue. */
export const GUARDED_MIN_VECTOR_SPREAD = 0.025

export const FIXTURE_VERSION = "2026-08-dogfood-v1"
