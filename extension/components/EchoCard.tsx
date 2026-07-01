import type { Echo } from "~db/echoes"
import { Bot, Link, Pin, Sparkles, Trash2 } from "lucide-react"

import { ExpandableText } from "~components/ExpandableText"

type EchoCardProps = {
  echo: Echo
  onDelete?: (id: string) => void
  onTogglePin?: (id: string) => void
}

const relativeTime = (date: string) => {
  const delta = Date.now() - new Date(date).getTime()
  const minutes = Math.max(1, Math.floor(delta / 60000))

  if (minutes < 60) return `${minutes}m ago`

  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`

  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

const sourceLabel = (source?: string) => {
  if (!source) return "Browser"

  return source.charAt(0).toUpperCase() + source.slice(1)
}

const iconForSource = (source?: string) => {
  if (source === "gemini") return Sparkles
  return Bot
}

export const EchoCard = ({ echo, onDelete, onTogglePin }: EchoCardProps) => {
  const SourceIcon = iconForSource(echo.sourceApp)
  const isPinned = echo.status === "pinned"
  const displayText = echo.userThought || echo.inferredThought || echo.triggerText

  return (
    <article
      className={`echo-card group relative flex cursor-pointer items-start gap-3 rounded-lg border bg-white p-3 transition-colors hover:bg-[#F1F3F4] ${
        isPinned ? "border-primary/50 bg-primary-fixed/10" : "border-[#E3E3E3]"
      }`}>
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
        echo.sourceApp === "gemini"
          ? "bg-tertiary-fixed text-[#341100]"
          : echo.sourceApp === "browser"
            ? "bg-secondary-fixed text-on-secondary-fixed"
            : "bg-primary-fixed text-on-primary-fixed"
      }`}>
        <SourceIcon size={18} strokeWidth={1.8} />
      </div>

      <div className="min-w-0 flex-1">
        <ExpandableText text={displayText} />

        {echo.userThought && echo.triggerText && echo.userThought !== echo.triggerText ? (
          <div className="mt-2 border-t border-outline-variant/40 pt-2">
            <p className="mb-1 flex items-center gap-1 text-label-sm text-on-surface-variant">
              <Link size={12} />
              来源片段
            </p>
            <ExpandableText text={echo.triggerText} tone="quote" />
          </div>
        ) : null}

        <div className="mt-1 flex items-center gap-2 text-on-surface-variant">
          <span className="text-label-md">{sourceLabel(echo.sourceApp)}</span>
          <span className="h-1 w-1 rounded-full bg-outline-variant" />
          <time className="text-label-md">{relativeTime(echo.createdAt)}</time>
        </div>
      </div>

      <div
        className={`action-reveal flex items-center gap-1 self-center transition-opacity ${
          isPinned ? "opacity-100" : "opacity-0"
        }`}>
        <button
          aria-label={isPinned ? "Unpin echo" : "Pin echo"}
          className={`rounded-full p-1 transition-colors ${
            isPinned
              ? "text-primary hover:bg-primary-container"
              : "text-outline hover:bg-secondary-container hover:text-primary"
          }`}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onTogglePin?.(echo.id)
          }}
          type="button">
          <Pin size={16} className={isPinned ? "fill-primary" : ""} />
        </button>
        <button
          aria-label="Delete echo"
          className="rounded-full p-1 text-outline hover:bg-error-container hover:text-error"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onDelete?.(echo.id)
          }}
          type="button">
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  )
}
