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

export type EchoProviderAnchor = {
  provider?: "chatgpt" | "claude" | "gemini" | "grok"
  messageId?: string
  messageIndex?: number
  // Legacy fields retained for Echoes captured before provider adapters.
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
