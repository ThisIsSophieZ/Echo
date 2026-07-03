import type { EchoMessageFingerprint } from "~capture/types"

const FINGERPRINT_EDGE_LENGTH = 320
const ZERO_WIDTH_CHARACTERS = /[\u200b-\u200d\u2060\ufeff]/g
const EMOJI_CHARACTERS = /\p{Extended_Pictographic}/gu

export const normalizeMessageText = (value: string) =>
  value
    .normalize("NFKC")
    .replace(ZERO_WIDTH_CHARACTERS, "")
    .replace(EMOJI_CHARACTERS, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()

const digestText = async (value: string) => {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(digest).slice(0, 12))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

export const createMessageFingerprint = async (
  value: string
): Promise<EchoMessageFingerprint | undefined> => {
  const normalized = normalizeMessageText(value)
  if (!normalized) return undefined

  const head = normalized.slice(0, FINGERPRINT_EDGE_LENGTH)
  const tail = normalized.slice(-FINGERPRINT_EDGE_LENGTH)
  const [fullHash, headHash, tailHash] = await Promise.all([
    digestText(normalized),
    digestText(head),
    digestText(tail)
  ])

  return {
    fullHash,
    headHash,
    tailHash,
    textLength: normalized.length
  }
}

export const fingerprintsMatch = (
  expected: EchoMessageFingerprint,
  actual: EchoMessageFingerprint
) => {
  if (expected.fullHash === actual.fullHash) return true

  const lengthDelta =
    Math.abs(expected.textLength - actual.textLength) /
    Math.max(expected.textLength, actual.textLength, 1)

  return (
    expected.headHash === actual.headHash &&
    expected.tailHash === actual.tailHash &&
    lengthDelta <= 0.08
  )
}
