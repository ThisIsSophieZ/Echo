import "./config"
import { pipeline } from "@xenova/transformers"

import { MODEL_ID } from "./config"

type Extractor = (
  input: string | string[],
  options: { pooling: "mean"; normalize: boolean }
) => Promise<{ tolist: () => number[][] }>

let extractorPromise: Promise<Extractor> | null = null

const getExtractor = async (): Promise<Extractor> => {
  if (!extractorPromise) {
    console.log(`[embed] loading local model ${MODEL_ID} (first run downloads weights)...`)
    extractorPromise = pipeline("feature-extraction", MODEL_ID) as unknown as Promise<Extractor>
  }
  return extractorPromise
}

const embed = async (texts: string[]): Promise<number[][]> => {
  if (!texts.length) return []
  const extractor = await getExtractor()
  const output = await extractor(texts, { pooling: "mean", normalize: true })
  return output.tolist()
}

// multilingual-e5 expects asymmetric prefixes: stored docs are "passage:",
// live queries are "query:". Using the right prefix materially improves recall.
export const embedPassages = (texts: string[]): Promise<number[][]> =>
  embed(texts.map((text) => `passage: ${text}`))

export const embedQuery = async (text: string): Promise<number[]> => {
  const [vector] = await embed([`query: ${text}`])
  return vector
}

// TiDB accepts a VECTOR as a bracketed string literal, e.g. "[0.1,0.2,...]".
export const toVectorLiteral = (vector: number[]): string =>
  `[${vector.map((value) => value.toFixed(6)).join(",")}]`
