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

export const FIXTURE_VERSION = "2026-08-dogfood-v1"
