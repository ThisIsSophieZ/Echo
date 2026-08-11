import fs from "node:fs"

import { pipeline } from "@xenova/transformers"

import { EMBED_CACHE_PATH, MODEL_ID } from "./config"

type Extractor = (
  input: string | string[],
  options: { pooling: "mean"; normalize: boolean }
) => Promise<{ tolist: () => number[][] }>

let extractorPromise: Promise<Extractor> | null = null
let coldStartMs: number | null = null

const getExtractor = async (): Promise<Extractor> => {
  if (!extractorPromise) {
    const started = performance.now()
    console.log(`[embed] loading ${MODEL_ID} (first run downloads weights)...`)
    extractorPromise = pipeline("feature-extraction", MODEL_ID) as unknown as Promise<Extractor>
    await extractorPromise
    coldStartMs = performance.now() - started
    console.log(`[embed] cold start ${coldStartMs.toFixed(0)}ms`)
  }
  return extractorPromise
}

export const getColdStartMs = () => coldStartMs

const embed = async (texts: string[]): Promise<number[][]> => {
  if (!texts.length) return []
  const extractor = await getExtractor()
  const output = await extractor(texts, { pooling: "mean", normalize: true })
  return output.tolist()
}

export const embedPassages = (texts: string[]) =>
  embed(texts.map((text) => `passage: ${text}`))

export const embedQuery = async (text: string) => {
  const [vector] = await embed([`query: ${text}`])
  return vector
}

export const cosine = (left: number[], right: number[]) => {
  let sum = 0
  for (let i = 0; i < left.length; i += 1) sum += left[i] * right[i]
  return sum
}

export type EmbeddingCache = {
  modelId: string
  byEchoId: Record<string, number[]>
}

export const loadEmbeddingCache = (
  path = EMBED_CACHE_PATH
): EmbeddingCache | null => {
  if (!fs.existsSync(path)) return null
  try {
    return JSON.parse(fs.readFileSync(EMBED_CACHE_PATH, "utf8")) as EmbeddingCache
  } catch {
    return null
  }
}

export const saveEmbeddingCache = (
  cache: EmbeddingCache,
  path = EMBED_CACHE_PATH
) => {
  fs.writeFileSync(path, JSON.stringify(cache), "utf8")
}
