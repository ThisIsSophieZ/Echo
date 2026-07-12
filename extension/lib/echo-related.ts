import type { Echo } from "~db/echoes"
import {
  classifyEchoIntent,
  classifyRecallMatchKind,
  classifySelectionKind,
  type EchoIntent,
  type RecallMatchKind,
  type SelectionKind
} from "./echo-intent"
import type { EchoSearchField, EchoSearchMatch } from "~lib/echo-search"

export type RelatedStrength = "strong" | "possible"

export type RelatedEchoResult = {
  echo: Echo
  score: number
  strength: RelatedStrength
  reason: string
  match: EchoSearchMatch
}

export type RelatedEchoRejection =
  | "selection-empty"
  | "no-corpus-terms"
  | "exact-source"
  | "no-overlap"
  | "low-evidence"
  | "possible-only"
  | "duplicate"

export type RelatedEchoCandidateDiagnostic = {
  echo: Echo
  score: number
  accepted: boolean
  reason: string
  rejection?: RelatedEchoRejection
  echoIntent: EchoIntent
  echoIntentReason: string
  matchKind: RecallMatchKind
  matchKindReason: string
  strongestField?: string
  matchedTerms: string[]
  details: string[]
}

export type RelatedEchoAnalysis = {
  selection: string
  selectionKind: SelectionKind
  selectionKindReason: string
  queryTokens: string[]
  scannedCount: number
  acceptedCount: number
  candidates: RelatedEchoCandidateDiagnostic[]
  results: RelatedEchoResult[]
}

type FieldConfig = {
  field: EchoSearchField
  label: string
  weight: number
}

type CorpusTerm = {
  value: string
  idf: number
  documentRatio: number
  tier: 2 | 3 | 4
  weight: number
}

type FieldDocument = FieldConfig & {
  text: string
  tokens: string[]
}

const FIELD_CONFIG: FieldConfig[] = [
  { field: "userThought", label: "你的想法", weight: 1.3 },
  { field: "title", label: "标题", weight: 1.15 },
  { field: "triggerText", label: "来源正文", weight: 1 },
  { field: "inferredThought", label: "关联想法", weight: 1 }
]

const MAX_QUERY_TERMS = 16
const BM25_K1 = 1.2
const BM25_B = 0.75
const POSSIBLE_CONFIDENCE = 30
const TIER_2_WEIGHT = 0.35
const HIGH_DOCUMENT_FREQUENCY = 0.2
const MIN_DOCUMENTS_FOR_FREQUENCY_TIER = 10

const STOP_WORDS = new Set([
  "and",
  "are",
  "but",
  "for",
  "from",
  "have",
  "that",
  "the",
  "this",
  "was",
  "were",
  "with",
  "you",
  "your"
])

const TIER_2_TERMS = new Set([
  "继续",
  "不要",
  "真正",
  "用户",
  "产品",
  "今天",
  "直接",
  "做得",
  "下来",
  "只能",
  "努力",
  "达到",
  "结论",
  "激活",
  "很好",
  "任何",
  "以后",
  "第一",
  "都会",
  "人的",
  "表现",
  "逻辑",
  "识别",
  "统一",
  "相当",
  "一块",
  "遇到",
  "小时",
  "一句",
  "关键",
  "帮助",
  "目标",
  "everything",
  "until",
  "there",
  "itself",
  "description",
  "build"
])

const STOP_CJK = new Set([
  // 代词 / 指示
  "一个",
  "一些",
  "这个",
  "这些",
  "那个",
  "那些",
  "你的",
  "我的",
  "他的",
  "她的",
  "它的",
  "我们",
  "你们",
  "他们",
  "自己",
  "各位",
  "大家",
  "什么",
  "哪个",
  "哪些",
  "那种",
  "这种",
  "那样",
  "这样",
  // 疑问 / 语气
  "怎么",
  "怎样",
  "如何",
  "为何",
  "为什么",
  "哪里",
  "多少",
  "是否",
  "是不是",
  "有没有",
  "能不能",
  "会不会",
  "咱们",
  "好像",
  "似乎",
  "或许",
  // 助词 / 分词碎片
  "做的",
  "了的",
  "着的",
  "的话",
  "是在",
  "的是",
  "也是",
  "只是",
  "又是",
  "正是",
  "却是",
  "都是",
  "更是",
  "像是",
  "有所",
  "一下",
  "一点",
  "一种",
  "一样",
  "这次",
  "那次",
  "每次",
  "已经",
  "正在",
  "将会",
  "可能",
  "应该",
  // 连词 / 逻辑
  "可以",
  "需要",
  "没有",
  "不是",
  "就是",
  "还是",
  "如果",
  "因为",
  "所以",
  "以及",
  "或者",
  "而且",
  "但是",
  "不过",
  "然后",
  "因此",
  "虽然",
  "同时",
  "另外",
  "此外",
  "于是",
  "而是",
  "并非",
  "类似",
  "好比",
  "比如",
  "例如",
  // 泛化副词 / 时间
  "进行",
  "使用",
  "内容",
  "问题",
  "相关",
  "实用",
  "快速",
  "自然",
  "非常",
  "比较",
  "特别",
  "相对",
  "基本",
  "主要",
  "一般",
  "通常",
  "其实",
  "确实",
  "现在",
  "当时",
  "目前",
  "觉得",
  "认为",
  "知道",
  "看到",
  "成为",
  "时候",
  "东西",
  "部分",
  "情况",
  "方法",
  "方式"
])

// 只在「选区 → query」侧过滤；语料分词保留，避免 Echo 里真有「还给用户」时完全失配
const STOP_QUERY_CJK = new Set(["还给"])

const isCjkStopToken = (token: string) => {
  if (STOP_CJK.has(token)) return true
  // 「做的事」等分词边界常产出「做的」类三字碎片
  if (token.length === 3 && /[的了着]$/.test(token)) {
    return STOP_CJK.has(token.slice(0, 2))
  }
  // Segmenter 常把「…是在 / …的是」切成无实义二字连接词
  if (token.length === 2 && token[1] === "是") {
    return "在而也都还就又才便既仍却更似只既".includes(token[0])
  }
  return false
}

export const normalizeRelatedText = (value: string) =>
  value.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, " ").trim()

const isCjk = (value: string) => /^[\u3400-\u9fff]+$/.test(value)

const fallbackSegments = (value: string) => [
  ...(value.match(/[a-z0-9][a-z0-9_-]{2,}/g) ?? []),
  ...(value.match(/[\u3400-\u9fff]+/g) ?? [])
]

const wordSegments = (value: string) => {
  const normalized = normalizeRelatedText(value)
  if (!normalized) return []

  if (typeof Intl !== "undefined" && "Segmenter" in Intl) {
    const segmenter = new Intl.Segmenter("zh-CN", { granularity: "word" })
    return Array.from(segmenter.segment(normalized))
      .filter((segment) => segment.isWordLike)
      .map((segment) => segment.segment)
  }

  return fallbackSegments(normalized)
}

const fallbackCjkTerms = (segment: string) => {
  if (!isCjk(segment) || segment.length < 3) return []

  const terms: string[] = []
  for (const length of [4, 3]) {
    for (let index = 0; index <= segment.length - length; index += 1) {
      terms.push(segment.slice(index, index + length))
    }
  }
  return terms
}

const tokenize = (value: string) => {
  const tokens: string[] = []

  for (const segment of wordSegments(value)) {
    if (isCjk(segment)) {
      if (segment.length >= 2 && !isCjkStopToken(segment)) tokens.push(segment)
      if (segment.length >= 6) tokens.push(...fallbackCjkTerms(segment))
      continue
    }

    const normalized = normalizeRelatedText(segment)
    if (
      /^[a-z0-9][a-z0-9_-]{2,}$/.test(normalized) &&
      !STOP_WORDS.has(normalized)
    ) {
      tokens.push(normalized)
    }
  }

  return tokens
}

export const relatedTokens = (value: string) =>
  [...new Set(tokenize(value))].filter((token) => !STOP_QUERY_CJK.has(token))

const fieldText = (echo: Echo, field: EchoSearchField) => {
  if (field === "title") {
    return [echo.capture?.title?.value, echo.title].filter(Boolean).join("\n")
  }
  return echo[field] ?? ""
}

const echoDocuments = (echo: Echo): FieldDocument[] =>
  FIELD_CONFIG.map((config) => {
    const text = fieldText(echo, config.field)
    return { ...config, text, tokens: tokenize(text) }
  })

const termTier = (
  value: string,
  documentRatio: number,
  documentCount: number
): 2 | 3 | 4 => {
  if (
    TIER_2_TERMS.has(value) ||
    (documentCount >= MIN_DOCUMENTS_FOR_FREQUENCY_TIER &&
      documentRatio > HIGH_DOCUMENT_FREQUENCY)
  ) {
    return 2
  }
  if ((isCjk(value) && value.length >= 3) || (!isCjk(value) && value.length >= 5)) {
    return 4
  }
  return 3
}

const tierWeight = (tier: 2 | 3 | 4) => {
  if (tier === 2) return TIER_2_WEIGHT
  if (tier === 4) return 1.2
  return 1
}

const corpusTerms = (echoes: Echo[], selection: string) => {
  const queryTerms = relatedTokens(selection)
  const corpusDocuments = echoes.map((echo) => {
    const tokens = echoDocuments(echo).flatMap((field) => field.tokens)
    return new Set(tokens)
  })
  const documentCount = Math.max(1, corpusDocuments.length)

  return queryTerms
    .map((value) => {
      const documentFrequency = corpusDocuments.filter((document) =>
        document.has(value)
      ).length
      if (!documentFrequency) return null
      const documentRatio = documentFrequency / documentCount
      const tier = termTier(value, documentRatio, documentCount)

      return {
        value,
        documentRatio,
        tier,
        weight: tierWeight(tier),
        idf: Math.log(
          1 + (documentCount - documentFrequency + 0.5) / (documentFrequency + 0.5)
        )
      }
    })
    .filter((term): term is CorpusTerm => term !== null)
    .sort(
      (left, right) =>
        right.idf * right.weight - left.idf * left.weight
    )
    .slice(0, MAX_QUERY_TERMS)
}

const termFrequency = (tokens: string[], term: string) =>
  tokens.reduce((count, token) => count + Number(token === term), 0)

const bm25TermScore = (
  term: CorpusTerm,
  tokens: string[],
  averageLength: number
) => {
  const frequency = termFrequency(tokens, term.value)
  if (!frequency) return 0

  const length = Math.max(1, tokens.length)
  const effectiveLength = Math.max(length, averageLength * 0.5)
  const normalization =
    frequency +
    BM25_K1 *
      (1 - BM25_B + BM25_B * (effectiveLength / Math.max(1, averageLength)))

  return term.idf * ((frequency * (BM25_K1 + 1)) / normalization)
}

const fixed = (value: number) => value.toFixed(2)

const longestPhraseMatch = (query: string[], document: string[]) => {
  let best: string[] = []

  for (let queryIndex = 0; queryIndex < query.length; queryIndex += 1) {
    for (let documentIndex = 0; documentIndex < document.length; documentIndex += 1) {
      const phrase: string[] = []
      while (
        queryIndex + phrase.length < query.length &&
        documentIndex + phrase.length < document.length &&
        query[queryIndex + phrase.length] === document[documentIndex + phrase.length]
      ) {
        phrase.push(query[queryIndex + phrase.length])
      }
      if (phrase.length > best.length) best = phrase
    }
  }

  return best
}

const compactSnippet = (value: string, token: string) => {
  const compact = value.replace(/\s+/g, " ").trim()
  if (compact.length <= 120) return compact

  const normalized = normalizeRelatedText(compact)
  const index = Math.max(0, normalized.indexOf(token))
  const start = Math.max(0, index - 28)
  const end = Math.min(compact.length, start + 120)
  return `${start ? "…" : ""}${compact.slice(start, end).trim()}${
    end < compact.length ? "…" : ""
  }`
}

const comparableUrl = (value?: string) => {
  if (!value) return ""
  try {
    const parsed = new URL(value)
    parsed.hash = ""
    return parsed.href
  } catch {
    return value
  }
}

const lexicalEvidenceFromBm25 = (score: number) =>
  Math.min(100, Math.round((1 - Math.exp(-score / 4)) * 100))

const evaluateRelatedEcho = (
  echo: Echo,
  selection: string,
  selectionKind: SelectionKind,
  queryTerms: CorpusTerm[],
  averageLengths: Map<EchoSearchField, number>,
  currentUrl?: string
): {
  diagnostic: RelatedEchoCandidateDiagnostic
  result: RelatedEchoResult | null
} => {
  const normalizedSelection = normalizeRelatedText(selection)
  const echoIntent = classifyEchoIntent(echo)
  const matchKind = classifyRecallMatchKind(selectionKind, echoIntent.kind)
  const rejected = (
    rejection: RelatedEchoRejection,
    reason: string,
    score = 0,
    strongestField?: string,
    matchedTerms: string[] = [],
    details: string[] = []
  ) => ({
    diagnostic: {
      echo,
      score,
      accepted: false,
      reason,
      rejection,
      echoIntent: echoIntent.kind,
      echoIntentReason: echoIntent.reason,
      matchKind: matchKind.kind,
      matchKindReason: matchKind.reason,
      strongestField,
      matchedTerms,
      details
    },
    result: null
  })

  if (!normalizedSelection) {
    return rejected("selection-empty", "没有收到有效选区")
  }
  if (!queryTerms.length) {
    return rejected("no-corpus-terms", "选区中没有出现在 Echo 语料里的有效词")
  }
  if (
    normalizeRelatedText(echo.triggerText) === normalizedSelection &&
    (!currentUrl || comparableUrl(echo.url) === comparableUrl(currentUrl))
  ) {
    return rejected("exact-source", "同一来源中的选区原文")
  }

  const querySequence = tokenize(selection).filter((token) =>
    queryTerms.some((term) => term.value === token)
  )
  const fields = echoDocuments(echo).map((field) => {
    const matched = queryTerms.filter((term) => field.tokens.includes(term.value))
    const averageLength = averageLengths.get(field.field) ?? field.tokens.length
    const termScores = matched.map((term) => ({
      term,
      frequency: termFrequency(field.tokens, term.value),
      baseScore: bm25TermScore(term, field.tokens, averageLength),
      score: bm25TermScore(term, field.tokens, averageLength) * term.weight
    }))
    const lexicalScore = termScores.reduce(
      (total, termScore) => total + termScore.score,
      0
    )
    const phrase = longestPhraseMatch(querySequence, field.tokens)
    const phraseBonus = phrase.length >= 2 ? 1.25 * (phrase.length - 1) : 0
    const score = (lexicalScore + phraseBonus) * field.weight

    return {
      ...field,
      matched,
      phrase,
      phraseBonus,
      lexicalScore,
      averageLength,
      termScores,
      score
    }
  })

  const strongest = [...fields].sort((left, right) => right.score - left.score)[0]
  if (!strongest || !strongest.matched.length) {
    return rejected(
      "no-overlap",
      "没有共同的有效词",
      0,
      strongest?.label,
      [],
      [
        `参与评分：${queryTerms.map((term) => term.value).join("、") || "无"}`,
        "所有字段 BM25：0.00",
        "连续短语：无"
      ]
    )
  }

  const lexicalEvidence = lexicalEvidenceFromBm25(strongest.score)
  const matchedTerms = strongest.matched.slice(0, 3).map((term) => term.value)
  const eligibleMatched = strongest.matched.filter((term) => term.tier >= 3)
  const eligibleDistinct = new Set(eligibleMatched.map((term) => term.value)).size
  const phraseTerms = strongest.phrase
    .map((value) => queryTerms.find((term) => term.value === value))
    .filter((term): term is CorpusTerm => Boolean(term))
  const hasEligiblePhrase =
    phraseTerms.length >= 2 && phraseTerms.every((term) => term.tier >= 3)
  const qualifiesAsPossible = eligibleDistinct >= 2
  const qualifiesAsStrong = hasEligiblePhrase || eligibleDistinct >= 3
  const details = [
    `最佳字段：${strongest.label} · 权重 ${strongest.weight}`,
    `字段长度：${strongest.tokens.length} tokens · 计分长度下限 ${fixed(strongest.averageLength * 0.5)} · 同字段平均 ${fixed(strongest.averageLength)}`,
    `BM25 ${fixed(strongest.lexicalScore)} + 短语奖励 ${fixed(strongest.phraseBonus)}，乘字段权重后 ${fixed(strongest.score)} → 词法证据 ${lexicalEvidence}`,
    strongest.termScores.length
      ? `词项贡献：${strongest.termScores
          .map(
            ({ term, frequency, baseScore, score }) =>
              `${term.value}(Tier ${term.tier}, df ${Math.round(term.documentRatio * 100)}%, tf ${frequency}, idf ${fixed(term.idf)}, ${fixed(baseScore)}×${term.weight}=+${fixed(score)})`
          )
          .join("；")}`
      : "词项贡献：无",
    strongest.phrase.length >= 2
      ? `连续短语：${strongest.phrase.join(" ")}`
      : "连续短语：无"
  ]

  if (lexicalEvidence < POSSIBLE_CONFIDENCE || !qualifiesAsPossible) {
    return rejected(
      "low-evidence",
      `词法证据 ${lexicalEvidence}，但没有至少 2 个有效内容词`,
      lexicalEvidence,
      strongest.label,
      matchedTerms,
      details
    )
  }

  if (!qualifiesAsStrong) {
    return rejected(
      "possible-only",
      `可能相关：${eligibleDistinct} 个有效内容词，仅保留在 debug`,
      lexicalEvidence,
      strongest.label,
      matchedTerms,
      details
    )
  }

  const strength: RelatedStrength = "strong"
  const reason = hasEligiblePhrase
    ? `${strongest.label}中出现相同短语「${strongest.phrase.slice(0, 4).join(" ")}」`
    : `${strongest.label}与你选中的「${matchedTerms.join("、")}」有重叠`
  const result: RelatedEchoResult = {
    echo,
    score: lexicalEvidence,
    strength,
    reason,
    match: {
      field: strongest.field,
      label: strongest.label,
      snippet: compactSnippet(strongest.text, matchedTerms[0]),
      terms: matchedTerms
    }
  }

  return {
    diagnostic: {
      echo,
      score: lexicalEvidence,
      accepted: true,
      reason,
      echoIntent: echoIntent.kind,
      echoIntentReason: echoIntent.reason,
      matchKind: matchKind.kind,
      matchKindReason: matchKind.reason,
      strongestField: strongest.label,
      matchedTerms,
      details
    },
    result
  }
}

export const analyzeRelatedEchoes = (
  echoes: Echo[],
  selection: string,
  limit = 3,
  currentUrl?: string
) => {
  const selectionIntent = classifySelectionKind(selection)
  const queryTerms = corpusTerms(echoes, selection)
  const documents = echoes.flatMap(echoDocuments)
  const averageLengths = new Map<EchoSearchField, number>(
    FIELD_CONFIG.map(({ field }) => {
      const fieldDocuments = documents.filter((document) => document.field === field)
      const totalLength = fieldDocuments.reduce(
        (total, document) => total + document.tokens.length,
        0
      )
      return [field, totalLength / Math.max(1, fieldDocuments.length)]
    })
  )
  const evaluated = echoes.map((echo) =>
    evaluateRelatedEcho(
      echo,
      selection,
      selectionIntent.kind,
      queryTerms,
      averageLengths,
      currentUrl
    )
  )
  const acceptedBeforeDeduplication = evaluated
    .map(({ result }) => result)
    .filter((result): result is RelatedEchoResult => result !== null)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.echo.createdAt.localeCompare(left.echo.createdAt)
    )
  const seenContent = new Set<string>()
  const accepted = acceptedBeforeDeduplication.filter((result) => {
    const contentKey = normalizeRelatedText(
      [result.echo.userThought, result.echo.triggerText].filter(Boolean).join("\n")
    )
    if (!contentKey || !seenContent.has(contentKey)) {
      if (contentKey) seenContent.add(contentKey)
      return true
    }

    const duplicate = evaluated.find(
      ({ diagnostic }) => diagnostic.echo.id === result.echo.id
    )?.diagnostic
    if (duplicate) {
      duplicate.accepted = false
      duplicate.rejection = "duplicate"
      duplicate.reason = "与更高排名 Echo 内容重复"
      duplicate.details.push("浮现资格：重复内容已抑制")
    }
    return false
  })
  const candidates = evaluated
    .map(({ diagnostic }) => diagnostic)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.echo.createdAt.localeCompare(left.echo.createdAt)
    )

  return {
    selection: normalizeRelatedText(selection),
    selectionKind: selectionIntent.kind,
    selectionKindReason: selectionIntent.reason,
    queryTokens: queryTerms.map((term) => term.value),
    scannedCount: echoes.length,
    acceptedCount: accepted.length,
    candidates,
    results: accepted.slice(0, limit)
  } satisfies RelatedEchoAnalysis
}

export const rankRelatedEcho = (
  echo: Echo,
  selection: string,
  currentUrl = echo.url
) => analyzeRelatedEchoes([echo], selection, 1, currentUrl).results[0] ?? null

export const findRelatedEchoes = (
  echoes: Echo[],
  selection: string,
  limit = 3,
  currentUrl?: string
) => analyzeRelatedEchoes(echoes, selection, limit, currentUrl).results
