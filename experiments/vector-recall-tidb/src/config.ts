import { fileURLToPath } from "node:url"
import path from "node:path"

const here = path.dirname(fileURLToPath(import.meta.url))

export const ROOT = path.resolve(here, "..")
export const DATA_DIR = path.join(ROOT, "data")

export const ECHOES_PATH = path.join(DATA_DIR, "echoes.json")
export const SELECTIONS_PATH = path.join(DATA_DIR, "selections.json")
export const INSTANCE_PATH = path.join(DATA_DIR, "instance.json")
export const REPORT_PATH = path.join(DATA_DIR, "report.md")

// Local, free, multilingual embedding model (downloaded once by transformers.js).
export const MODEL_ID = "Xenova/multilingual-e5-small"
export const EMBED_DIM = 384

export const TABLE = "echoes"
export const TOP_K = 5

// A vector match below this cosine similarity is treated as "not really related"
// when we highlight what vector recall surfaced that lexical recall missed.
export const VECTOR_MIN_SIMILARITY = 0.82

// TiDB Cloud Zero public preview. Keyless by default; set TIDB_ZERO_API_KEY to
// use a claimed key from the conference.
export const ZERO_ENDPOINT =
  process.env.TIDB_ZERO_ENDPOINT ?? "https://zero.tidbapi.com/v1beta1/instances"
export const ZERO_API_KEY = process.env.TIDB_ZERO_API_KEY ?? ""

// Cache transformers.js weights inside the experiment folder so cleanup is a
// single `rm -rf` of this directory.
process.env.TRANSFORMERS_CACHE ??= path.join(ROOT, ".cache")
