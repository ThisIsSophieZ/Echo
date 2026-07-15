import { describe, expect, it } from "vitest"

import { nextPinStatus } from "./echoes"

describe("nextPinStatus", () => {
  it("pins a raw echo", () => {
    expect(nextPinStatus({ status: "raw" })).toBe("pinned")
  })

  it("unpins to confirmed when a user thought exists", () => {
    expect(
      nextPinStatus({ status: "pinned", userThought: "这个方向值得跟" })
    ).toBe("confirmed")
  })

  it("unpins to raw when there is no thought", () => {
    expect(nextPinStatus({ status: "pinned" })).toBe("raw")
    expect(nextPinStatus({ status: "pinned", userThought: "   " })).toBe("raw")
  })

  it("pins confirmed and inferred echoes", () => {
    expect(nextPinStatus({ status: "confirmed", userThought: "x" })).toBe(
      "pinned"
    )
    expect(nextPinStatus({ status: "inferred" })).toBe("pinned")
  })
})
