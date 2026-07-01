import { Check, Copy } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import type { Echo } from "~db/echoes"
import { echoClipboardMarkdown } from "~lib/echo-presentation"

type CopyEchoButtonProps = {
  echo: Echo
}

export const CopyEchoButton = ({ echo }: CopyEchoButtonProps) => {
  const [copied, setCopied] = useState(false)
  const resetTimer = useRef<number | null>(null)

  useEffect(
    () => () => {
      if (resetTimer.current != null) window.clearTimeout(resetTimer.current)
    },
    []
  )

  const copyEcho = async () => {
    try {
      await navigator.clipboard.writeText(echoClipboardMarkdown(echo))
      setCopied(true)
      if (resetTimer.current != null) window.clearTimeout(resetTimer.current)
      resetTimer.current = window.setTimeout(() => setCopied(false), 1400)
    } catch {
      setCopied(false)
    }
  }

  const Icon = copied ? Check : Copy
  const label = copied ? "Copied" : "Copy Markdown"

  return (
    <button
      aria-label={label}
      className={`rounded-full p-1 transition-colors ${
        copied
          ? "text-primary"
          : "text-outline hover:bg-secondary-container hover:text-primary"
      }`}
      onClick={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void copyEcho()
      }}
      title={label}
      type="button">
      <Icon size={16} />
    </button>
  )
}
