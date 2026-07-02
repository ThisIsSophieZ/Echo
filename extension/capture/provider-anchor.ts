import type { EchoProviderAnchor } from "~capture/types"

const PROVIDER_CONTAINERS = {
  chatgpt: "[data-message-id], [data-message-author-role]",
  claude: "[data-testid='user-message'], [data-is-streaming], .font-claude-message",
  gemini: "user-query, model-response, message-content",
  grok: "article, [data-testid*='message']"
} as const

type ProviderName = keyof typeof PROVIDER_CONTAINERS

const currentProvider = (): ProviderName | undefined => {
  const host = location.hostname
  if (host.includes("chatgpt") || host.includes("openai")) return "chatgpt"
  if (host.includes("claude")) return "claude"
  if (host.includes("gemini")) return "gemini"
  if (host.includes("grok") || host === "x.com") return "grok"
  return undefined
}

const providerContainers = (provider: ProviderName) =>
  Array.from(document.querySelectorAll(PROVIDER_CONTAINERS[provider]))

export const createProviderAnchor = (
  startElement: Element | null
): EchoProviderAnchor | undefined => {
  const provider = currentProvider()
  if (!provider || !startElement) return undefined

  const container = startElement.closest(PROVIDER_CONTAINERS[provider])
  if (!container) return undefined

  const messageId = container.getAttribute("data-message-id") || undefined
  const index = providerContainers(provider).indexOf(container)

  return {
    provider,
    messageId,
    messageIndex: index >= 0 ? index : undefined
  }
}

const normalizedText = (element: Element) =>
  (element.textContent ?? "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()

export const findProviderTarget = (
  anchor: EchoProviderAnchor,
  exactText: string
) => {
  if (anchor.messageId) {
    const target = document.querySelector(
      `[data-message-id="${CSS.escape(anchor.messageId)}"]`
    )
    if (target) return target
  }

  if (!anchor.provider || !(anchor.provider in PROVIDER_CONTAINERS)) return null

  const containers = providerContainers(anchor.provider)
  const exactMatch = containers.find((container) =>
    normalizedText(container).includes(exactText)
  )
  if (exactMatch) return exactMatch

  if (
    anchor.messageIndex != null &&
    anchor.messageIndex >= 0 &&
    anchor.messageIndex < containers.length
  ) {
    const indexed = containers[anchor.messageIndex]
    const text = normalizedText(indexed)
    if (text.includes(exactText.slice(0, Math.min(48, exactText.length)))) {
      return indexed
    }
  }

  return null
}
