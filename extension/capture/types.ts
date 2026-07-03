export type EchoCaptureTitle = {
  value: string
  source: "selected-heading" | "nearby-heading"
}

export type EchoCaptureFeatures = {
  charCount: number
  lineCount: number
  tableCount: number
  tableRowCount: number
  listItemCount: number
  codeBlockCount: number
}

export type EchoProviderName = "chatgpt" | "claude" | "gemini" | "grok"

export type EchoMessageFingerprint = {
  fullHash: string
  headHash: string
  tailHash: string
  textLength: number
}

export type EchoProviderAnchor = {
  provider?: EchoProviderName
  nativeId?: {
    attribute: string
    value: string
  }
  fingerprint?: EchoMessageFingerprint
  previousFingerprint?: EchoMessageFingerprint
  nextFingerprint?: EchoMessageFingerprint
  role?: "user" | "assistant"
  capturedAt?: string
  // Legacy fields retained for Echoes captured before Anchor v2.
  messageId?: string
  attribute?: "data-message-id"
  value?: string
}

export type EchoTextQuoteAnchor = {
  exactStart: string
  exactEnd?: string
  prefix?: string
  suffix?: string
}

export type EchoAnchor = {
  version?: 2
  quote: EchoTextQuoteAnchor
  provider?: EchoProviderAnchor
}

export type EchoCapture = {
  version: 1
  markdown: string
  preview: string
  title?: EchoCaptureTitle
  features: EchoCaptureFeatures
  anchor: EchoAnchor
}

export type SelectionCapture = {
  plainText: string
  capture?: EchoCapture
}
