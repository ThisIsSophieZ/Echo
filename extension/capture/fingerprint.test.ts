import { describe, expect, it } from "vitest"

import {
  createMessageFingerprint,
  fingerprintsMatch,
  normalizeMessageText
} from "./fingerprint"

describe("message fingerprints", () => {
  it("normalizes width, whitespace, zero-width characters, and emoji", () => {
    expect(normalizeMessageText("  Ｅｃｈｏ\u200b   idea 💡 ")).toBe("Echo idea")
  })

  it("creates deterministic SHA-256 fingerprints", async () => {
    const first = await createMessageFingerprint("A stable message")
    const second = await createMessageFingerprint("A stable  message")

    expect(first).toEqual(second)
    expect(first?.fullHash).toHaveLength(24)
  })

  it("does not match changed message content", async () => {
    const original = await createMessageFingerprint("Original message")
    const changed = await createMessageFingerprint("Different message")

    expect(original && changed && fingerprintsMatch(original, changed)).toBe(false)
  })

  it("accepts matching head and tail fingerprints with a small length drift", () => {
    expect(
      fingerprintsMatch(
        {
          fullHash: "old",
          headHash: "head",
          tailHash: "tail",
          textLength: 1000
        },
        {
          fullHash: "new",
          headHash: "head",
          tailHash: "tail",
          textLength: 1050
        }
      )
    ).toBe(true)
  })
})
