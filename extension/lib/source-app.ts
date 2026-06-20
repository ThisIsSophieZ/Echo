export const detectSourceApp = (url?: string) => {
  if (!url) return "browser"

  const host = new URL(url).hostname

  if (host.includes("chatgpt") || host.includes("openai")) return "chatgpt"
  if (host.includes("claude")) return "claude"
  if (host.includes("gemini")) return "gemini"
  if (host.includes("grok") || host === "x.com") return "grok"

  return "browser"
}
