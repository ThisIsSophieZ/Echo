import { describe, expect, it } from "vitest"

import type { Echo } from "../db/echoes"
import {
  classifyEchoIntent,
  classifyRecallMatchKind,
  classifySelectionKind
} from "./echo-intent"

const echo = (overrides: Partial<Echo> = {}): Echo => ({
  id: "echo-1",
  triggerText: "真正值得存的不是 Claude 回答了什么，而是我因为回答产生的新想法。",
  sourceApp: "claude",
  url: "https://claude.ai/chat/example",
  title: "产品方向",
  createdAt: "2026-07-08T00:00:00.000Z",
  status: "raw",
  ...overrides
})

describe("Echo intent classification", () => {
  it("classifies selection intent separately from Echo intent", () => {
    expect(classifySelectionKind("我又开始怀疑 Echo 方向和 Recall 红海了").kind).toBe(
      "product-thought"
    )
    expect(
      classifySelectionKind("Procreate 画布尺寸和 WebP 导出步骤").kind
    ).toBe("task-material")
    expect(classifySelectionKind("Phase 2 Probe case schema 怎么评估").kind).toBe(
      "meta-debug"
    )
  })

  it("classifies first-person insight, task material, product meta, and debug Echoes", () => {
    expect(
      classifyEchoIntent(
        echo({ userThought: "我突然意识到 Echo 的价值不是 memory，而是 continuity。" })
      ).kind
    ).toBe("insight")

    expect(
      classifyEchoIntent(
        echo({
          title: "Procreate 网页动画绘制与切图实操指南",
          triggerText: "画布设定、Animation Assist、SVG 导出和 WebP 步骤。"
        })
      ).kind
    ).toBe("task-material")

    expect(
      classifyEchoIntent(
        echo({
          title: "1. 快速对比表",
          triggerText: "Recall 和 Echo 的产品差异化、第二大脑与 Thought Continuity。"
        })
      ).kind
    ).toBe("product-meta")

    expect(
      classifyEchoIntent(
        echo({
          title: "Gemini 说",
          triggerText: "给你一个你可能更接受的版本示例"
        })
      ).kind
    ).toBe("debug")
  })

  it("explains selection and Echo combinations", () => {
    expect(classifyRecallMatchKind("product-thought", "insight").kind).toBe(
      "thought-continuity"
    )
    expect(classifyRecallMatchKind("product-thought", "task-material").kind).toBe(
      "task-material-recall"
    )
    expect(classifyRecallMatchKind("product-thought", "debug").kind).toBe(
      "debug-noise"
    )
    expect(classifyRecallMatchKind("task-material", "task-material").kind).toBe(
      "task-material-recall"
    )
  })
})
