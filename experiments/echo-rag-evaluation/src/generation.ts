import type {
  GeneratedAnswer,
  GenerationUsage,
  PublicEcho,
  RagQuestion,
  RetrievalHit
} from "./types"

export type GenerationStrategy = "no-context" | "candidate-bm25-rag"

type OllamaResponse = {
  message: { content: string }
  total_duration?: number
  load_duration?: number
  prompt_eval_count?: number
  prompt_eval_duration?: number
  eval_count?: number
  eval_duration?: number
}

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    status: { type: "string", enum: ["answered", "abstained"] },
    answer: { type: "string" },
    claims: {
      type: "array",
      items: {
        type: "object",
        properties: {
          text: { type: "string" },
          citations: { type: "array", items: { type: "string" } }
        },
        required: ["text", "citations"]
      }
    },
    reason: { type: "string" }
  },
  required: ["status", "answer", "claims", "reason"]
} as const

const systemPrompt = `You are evaluating a private-knowledge RAG workflow using a public fixture.
Answer only from the EVIDENCE supplied in this request. Do not use outside knowledge or infer missing product facts.
Every factual claim in an answered response must cite one or more evidence IDs that directly support it.
If the supplied evidence is absent, merely topic-adjacent, contradictory, or insufficient for the requested conclusion, abstain.
For abstention, set status to "abstained", use an empty claims array, and briefly explain the missing evidence.
For an answer, set status to "answered" and make answer a concise synthesis of the claims.
Never cite an ID that is not present in EVIDENCE.
Reply in the same language as the question.`

const evidenceText = (echo: PublicEcho) =>
  [
    `ID: ${echo.id}`,
    `Title: ${echo.title}`,
    echo.userThought ? `User thought: ${echo.userThought}` : "",
    `Source text: ${echo.triggerText}`,
    echo.inferredThought ? `Inferred thought: ${echo.inferredThought}` : ""
  ]
    .filter(Boolean)
    .join("\n")

const parseAnswer = (content: string): GeneratedAnswer => {
  const parsed = JSON.parse(content) as GeneratedAnswer
  if (
    (parsed.status !== "answered" && parsed.status !== "abstained") ||
    typeof parsed.answer !== "string" ||
    !Array.isArray(parsed.claims) ||
    typeof parsed.reason !== "string"
  ) {
    throw new Error("Model returned an invalid answer shape")
  }
  for (const claim of parsed.claims) {
    if (typeof claim.text !== "string" || !Array.isArray(claim.citations)) {
      throw new Error("Model returned an invalid claim shape")
    }
  }
  return parsed
}

const nsToMs = (value = 0) => value / 1_000_000

export const generateAnswer = async (options: {
  strategy: GenerationStrategy
  model: string
  question: RagQuestion
  corpusById: Map<string, PublicEcho>
  hits: RetrievalHit[]
}) => {
  const providedHits = options.strategy === "no-context" ? [] : options.hits
  const evidence = providedHits
    .map((hit) => options.corpusById.get(hit.id))
    .filter((echo): echo is PublicEcho => Boolean(echo))
  const prompt = [
    `QUESTION:\n${options.question.question}`,
    "",
    "EVIDENCE:",
    evidence.length
      ? evidence.map(evidenceText).join("\n\n---\n\n")
      : "(No evidence was supplied.)",
    "",
    "Return JSON matching this schema:",
    JSON.stringify(OUTPUT_SCHEMA)
  ].join("\n")

  const response = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: options.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt }
      ],
      stream: false,
      format: OUTPUT_SCHEMA,
      keep_alive: "10m",
      options: { temperature: 0, seed: 42 }
    }),
    signal: AbortSignal.timeout(300_000)
  })

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status}: ${await response.text()}`)
  }

  const raw = (await response.json()) as OllamaResponse
  const usage: GenerationUsage = {
    promptTokens: raw.prompt_eval_count ?? 0,
    outputTokens: raw.eval_count ?? 0,
    totalDurationMs: nsToMs(raw.total_duration),
    loadDurationMs: nsToMs(raw.load_duration),
    promptEvalDurationMs: nsToMs(raw.prompt_eval_duration),
    generationDurationMs: nsToMs(raw.eval_duration),
    estimatedApiCostUsd: 0
  }

  return {
    answer: parseAnswer(raw.message.content),
    usage,
    providedEvidenceIds: evidence.map((echo) => echo.id)
  }
}
