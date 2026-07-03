import {
  createMessageFingerprint,
  fingerprintsMatch,
  normalizeMessageText
} from "~capture/fingerprint"
import type {
  EchoMessageFingerprint,
  EchoProviderAnchor,
  EchoProviderName
} from "~capture/types"

const PROVIDER_CONTAINER_SELECTORS: Record<EchoProviderName, string[]> = {
  chatgpt: ["[data-message-id]", "[data-message-author-role]"],
  claude: [
    "[data-testid='user-message']",
    "[data-testid='assistant-message']",
    ".font-claude-message",
    "[data-is-streaming]"
  ],
  gemini: ["user-query", "model-response"],
  grok: ["[data-testid='user-message']", "[data-testid='assistant-message']", "article"]
}

const NATIVE_ID_ATTRIBUTES: Record<EchoProviderName, string[]> = {
  chatgpt: ["data-message-id", "data-turn-id"],
  claude: ["data-message-id", "data-turn-id", "data-testid"],
  gemini: ["data-message-id", "data-turn-id", "id"],
  grok: ["data-message-id", "data-turn-id", "id"]
}

export const currentProvider = (): EchoProviderName | undefined => {
  const host = location.hostname
  if (host.includes("chatgpt") || host.includes("openai")) return "chatgpt"
  if (host.includes("claude")) return "claude"
  if (host.includes("gemini")) return "gemini"
  if (host.includes("grok") || host === "x.com") return "grok"
  return undefined
}

export const providerContainers = (provider: EchoProviderName) => {
  if (provider === "chatgpt") {
    const withIds = Array.from(document.querySelectorAll("[data-message-id]"))
    if (withIds.length) return withIds
    return Array.from(document.querySelectorAll("[data-message-author-role]"))
  }

  if (provider === "claude") {
    const messages = Array.from(
      document.querySelectorAll(
        "[data-testid='user-message'], [data-testid='assistant-message'], .font-claude-message"
      )
    )
    if (messages.length) return messages
    return Array.from(document.querySelectorAll("[data-is-streaming]"))
  }

  if (provider === "gemini") {
    return Array.from(document.querySelectorAll("user-query, model-response"))
  }

  const grokMessages = Array.from(
    document.querySelectorAll(
      "[data-testid='user-message'], [data-testid='assistant-message']"
    )
  )
  return grokMessages.length
    ? grokMessages
    : Array.from(document.querySelectorAll("article"))
}

const uniqueNativeId = (
  container: Element,
  provider: EchoProviderName
): EchoProviderAnchor["nativeId"] => {
  for (const attribute of NATIVE_ID_ATTRIBUTES[provider]) {
    const value = container.getAttribute(attribute)
    if (!value) continue

    const selector = `[${attribute}="${CSS.escape(value)}"]`
    if (document.querySelectorAll(selector).length === 1) {
      return { attribute, value }
    }
  }
  return undefined
}

const messageRole = (container: Element): EchoProviderAnchor["role"] => {
  const value = [
    container.getAttribute("data-message-author-role"),
    container.getAttribute("data-testid"),
    container.tagName
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()

  if (value.includes("user")) return "user"
  if (value.includes("assistant") || value.includes("model-response")) {
    return "assistant"
  }
  return undefined
}

const fingerprintElement = (element?: Element) =>
  element
    ? createMessageFingerprint(element.textContent ?? "")
    : Promise.resolve(undefined)

export const createProviderAnchor = async (
  startElement: Element | null
): Promise<EchoProviderAnchor | undefined> => {
  const provider = currentProvider()
  if (!provider || !startElement) return undefined

  const containers = providerContainers(provider)
  const container =
    containers.find(
      (candidate) =>
        candidate === startElement || candidate.contains(startElement)
    ) ??
    startElement.closest(PROVIDER_CONTAINER_SELECTORS[provider].join(", "))
  if (!container) return undefined

  const position = containers.indexOf(container)
  const [fingerprint, previousFingerprint, nextFingerprint] = await Promise.all([
    fingerprintElement(container),
    fingerprintElement(position > 0 ? containers[position - 1] : undefined),
    fingerprintElement(
      position >= 0 && position < containers.length - 1
        ? containers[position + 1]
        : undefined
    )
  ])

  return {
    provider,
    nativeId: uniqueNativeId(container, provider),
    fingerprint,
    previousFingerprint,
    nextFingerprint,
    role: messageRole(container),
    capturedAt: new Date().toISOString()
  }
}

const fingerprintCache = new WeakMap<
  Element,
  { text: string; fingerprint?: EchoMessageFingerprint }
>()

const currentFingerprint = async (element: Element) => {
  const text = normalizeMessageText(element.textContent ?? "")
  const cached = fingerprintCache.get(element)
  if (cached?.text === text) return cached.fingerprint

  const fingerprint = await createMessageFingerprint(text)
  fingerprintCache.set(element, { text, fingerprint })
  return fingerprint
}

const neighborsSupportMatch = async (
  containers: Element[],
  index: number,
  anchor: EchoProviderAnchor
) => {
  let evidence = 0

  if (anchor.previousFingerprint && index > 0) {
    const previous = await currentFingerprint(containers[index - 1])
    if (previous && fingerprintsMatch(anchor.previousFingerprint, previous)) {
      evidence += 1
    }
  }
  if (anchor.nextFingerprint && index < containers.length - 1) {
    const next = await currentFingerprint(containers[index + 1])
    if (next && fingerprintsMatch(anchor.nextFingerprint, next)) evidence += 1
  }

  return evidence
}

export const findProviderTarget = async (
  anchor: EchoProviderAnchor,
  exactText: string
) => {
  const normalizedExact = normalizeMessageText(exactText)

  if (anchor.nativeId) {
    const { attribute, value } = anchor.nativeId
    const target = document.querySelector(
      `[${attribute}="${CSS.escape(value)}"]`
    )
    if (target) return target
  }

  // Historical ChatGPT anchors remain readable.
  const legacyMessageId = anchor.messageId ?? anchor.value
  if (legacyMessageId) {
    const target = document.querySelector(
      `[data-message-id="${CSS.escape(legacyMessageId)}"]`
    )
    if (target) return target
  }

  if (!anchor.provider) return null
  const containers = providerContainers(anchor.provider)

  if (anchor.fingerprint) {
    const candidates: Array<{ element: Element; index: number; neighborEvidence: number }> =
      []

    for (let index = 0; index < containers.length; index += 1) {
      const fingerprint = await currentFingerprint(containers[index])
      if (!fingerprint || !fingerprintsMatch(anchor.fingerprint, fingerprint)) {
        continue
      }
      candidates.push({
        element: containers[index],
        index,
        neighborEvidence: await neighborsSupportMatch(containers, index, anchor)
      })
    }

    if (candidates.length) {
      candidates.sort((left, right) => right.neighborEvidence - left.neighborEvidence)
      return candidates[0].element
    }
  }

  return (
    containers.find((container) =>
      normalizeMessageText(container.textContent ?? "").includes(normalizedExact)
    ) ?? null
  )
}

const scrollableAncestor = (element?: Element) => {
  let current = element?.parentElement
  while (current) {
    const style = getComputedStyle(current)
    if (
      /(auto|scroll)/.test(style.overflowY) &&
      current.scrollHeight > current.clientHeight
    ) {
      return current
    }
    current = current.parentElement
  }
  return null
}

export const loadOlderProviderMessages = (provider?: EchoProviderName) => {
  if (!provider) return false

  const containers = providerContainers(provider)
  const scrollRoot = scrollableAncestor(containers[0])

  if (scrollRoot) {
    const previousTop = scrollRoot.scrollTop
    scrollRoot.scrollTop = Math.max(
      0,
      previousTop - Math.max(scrollRoot.clientHeight * 0.85, 600)
    )
    scrollRoot.dispatchEvent(new Event("scroll", { bubbles: true }))
    return scrollRoot.scrollTop !== previousTop
  }

  const previousY = window.scrollY
  window.scrollBy({
    top: -Math.max(window.innerHeight * 0.85, 600),
    behavior: "auto"
  })
  return window.scrollY !== previousY
}
