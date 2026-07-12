import type { Echo } from "~db/echoes"

export type SelectionKind =
  | "product-thought"
  | "task-material"
  | "meta-debug"
  | "unknown"

export type EchoIntent =
  | "insight"
  | "product-meta"
  | "task-material"
  | "debug"
  | "unknown"

export type RecallMatchKind =
  | "thought-continuity"
  | "product-meta-reference"
  | "task-material-recall"
  | "debug-noise"
  | "weak-lexical-overlap"
  | "unknown"

export type IntentClassification<TKind extends string> = {
  kind: TKind
  reason: string
}

const normalize = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim()

const includesAny = (value: string, patterns: Array<string | RegExp>) =>
  patterns.some((pattern) =>
    typeof pattern === "string" ? value.includes(pattern) : pattern.test(value)
  )

const PRODUCT_THOUGHT_PATTERNS: Array<string | RegExp> = [
  "红海",
  "recall",
  "continuity",
  "thought continuity",
  "方向",
  "怀疑",
  "差异化",
  "定位",
  "北极星",
  "愿景",
  "价值",
  "打扰",
  "浮现",
  "唤回",
  "第二大脑",
  "产品",
  "用户",
  "想法",
  "思考"
]

const TASK_MATERIAL_PATTERNS: Array<string | RegExp> = [
  "procreate",
  "tailwind",
  "导出",
  "步骤",
  "画布",
  "尺寸",
  "配置",
  "设置",
  "素材",
  "指南",
  "教程",
  "实操",
  "代码",
  "webp",
  "svg",
  "animation",
  "onion",
  "pipeline"
]

const META_DEBUG_PATTERNS: Array<string | RegExp> = [
  "phase",
  "probe",
  "bm25",
  "case",
  "schema",
  "dogfood",
  "debug",
  "报告",
  "测试",
  "调试",
  "语料",
  "置信度",
  "词法证据"
]

const INSIGHT_PATTERNS: Array<string | RegExp> = [
  "我突然意识到",
  "我突然想到",
  "我刚刚想到",
  "我最后想",
  "最大的感悟",
  "真正值得",
  "我觉得",
  "我认为",
  "我的想法",
  "我意识到",
  "我一直觉得",
  "本质",
  "根本区别",
  "一句话",
  "判断"
]

const PRODUCT_META_PATTERNS: Array<string | RegExp> = [
  "recall",
  "continuity",
  "second brain",
  "第二大脑",
  "echo",
  "phase",
  "北极星",
  "竞品",
  "差异化",
  "系统提示",
  "快速对比表",
  "case",
  "产品",
  "定位",
  "愿景"
]

const DEBUG_PATTERNS: Array<string | RegExp> = [
  "gemini 说",
  "chrome插件 - google gemini",
  "google gemini",
  "grok",
  "new project",
  "0701",
  "工作",
  "想问你两个问题",
  "给你一个",
  "抛一个",
  "疯狂问题",
  "probe",
  "dogfood",
  "debug",
  "测试",
  "调试",
  "报告"
]

const TASK_TITLE_PATTERNS: Array<string | RegExp> = [
  "指南",
  "实操",
  "设定",
  "设置",
  "步骤",
  "素材",
  "分镜",
  "教程",
  "落地",
  "专用画布",
  "procreate",
  "chrononav"
]

const echoText = (echo: Echo) =>
  normalize(
    [
      echo.userThought,
      echo.inferredThought,
      echo.capture?.title?.value,
      echo.title,
      echo.triggerText
    ]
      .filter(Boolean)
      .join("\n")
  )

const echoTitle = (echo: Echo) =>
  normalize([echo.capture?.title?.value, echo.title].filter(Boolean).join(" "))

const isVeryShort = (echo: Echo) =>
  normalize([echo.userThought, echo.triggerText].filter(Boolean).join(" ")).length <=
  8

export const classifySelectionKind = (
  selection: string
): IntentClassification<SelectionKind> => {
  const text = normalize(selection)
  if (!text) return { kind: "unknown", reason: "empty selection" }

  if (includesAny(text, META_DEBUG_PATTERNS)) {
    return {
      kind: "meta-debug",
      reason: "selection contains Phase/Probe/debug evaluation terms"
    }
  }

  if (includesAny(text, TASK_MATERIAL_PATTERNS)) {
    return {
      kind: "task-material",
      reason: "selection looks like task material or implementation steps"
    }
  }

  if (includesAny(text, PRODUCT_THOUGHT_PATTERNS)) {
    return {
      kind: "product-thought",
      reason: "selection contains product/continuity/reflection terms"
    }
  }

  return { kind: "unknown", reason: "no strong selection intent signal" }
}

export const classifyEchoIntent = (
  echo: Echo
): IntentClassification<EchoIntent> => {
  const text = echoText(echo)
  const title = echoTitle(echo)

  if (!text) return { kind: "unknown", reason: "empty Echo content" }

  if (isVeryShort(echo) || includesAny(title || text, DEBUG_PATTERNS)) {
    return {
      kind: "debug",
      reason: isVeryShort(echo)
        ? "very short or low-information Echo"
        : "title/content looks like LLM page title, CTA, or dogfood/debug note"
    }
  }

  if (echo.userThought && includesAny(normalize(echo.userThought), INSIGHT_PATTERNS)) {
    return {
      kind: "insight",
      reason: "userThought contains first-person judgment or insight phrasing"
    }
  }

  if (includesAny(title, TASK_TITLE_PATTERNS) || includesAny(text, TASK_MATERIAL_PATTERNS)) {
    return {
      kind: "task-material",
      reason: "Echo looks like how-to, task steps, or concrete implementation material"
    }
  }

  if (includesAny(text, INSIGHT_PATTERNS)) {
    return {
      kind: "insight",
      reason: "Echo contains first-person judgment or insight phrasing"
    }
  }

  if (includesAny(text, PRODUCT_META_PATTERNS)) {
    return {
      kind: "product-meta",
      reason: "Echo looks like product meta, comparison, or system framing"
    }
  }

  return { kind: "unknown", reason: "no strong Echo intent signal" }
}

export const classifyRecallMatchKind = (
  selectionKind: SelectionKind,
  echoIntent: EchoIntent
): IntentClassification<RecallMatchKind> => {
  if (echoIntent === "debug") {
    return {
      kind: "debug-noise",
      reason: "debug/test-like Echo should not be treated as normal recall"
    }
  }

  if (selectionKind === "product-thought") {
    if (echoIntent === "insight") {
      return {
        kind: "thought-continuity",
        reason: "product-thought selection matched a first-person insight"
      }
    }
    if (echoIntent === "product-meta") {
      return {
        kind: "product-meta-reference",
        reason: "product-thought selection matched product meta/reference material"
      }
    }
    if (echoIntent === "task-material") {
      return {
        kind: "task-material-recall",
        reason: "product-thought selection matched task material, not continuity"
      }
    }
  }

  if (selectionKind === "task-material" && echoIntent === "task-material") {
    return {
      kind: "task-material-recall",
      reason: "task-material selection matched task material"
    }
  }

  if (selectionKind === "meta-debug") {
    return {
      kind: echoIntent === "product-meta" ? "product-meta-reference" : "debug-noise",
      reason: "meta/debug selection is useful for analysis but should not prove continuity"
    }
  }

  if (selectionKind === "unknown" || echoIntent === "unknown") {
    return {
      kind: "unknown",
      reason: "selection or Echo intent is unknown"
    }
  }

  return {
    kind: "weak-lexical-overlap",
    reason: "selection and Echo types do not strongly align"
  }
}
