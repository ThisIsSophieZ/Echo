import { useState } from "react"
import type { Echo } from "~db/echoes"
import { Bot, Link, Sparkles } from "lucide-react"

import { AddThoughtEditor } from "~components/AddThoughtEditor"
import { ExpandableText } from "~components/ExpandableText"
import { EchoCardActions } from "~components/EchoCardActions"
import { EchoSearchMatchHint } from "~components/EchoSearchMatch"
import { LongEchoCard } from "~components/LongEchoCard"
import { isLongCollect } from "~lib/echo-presentation"
import type { EchoSearchMatch } from "~lib/echo-search"

type EchoCardProps = {
  echo: Echo
  onDelete?: (id: string) => void
  onAddThought?: (id: string, thought: string) => Promise<void>
  onOpenSource?: (echo: Echo) => void
  onTogglePin?: (id: string) => void
  searchMatch?: EchoSearchMatch
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

export const EchoCard = ({
  echo,
  onAddThought,
  onDelete,
  onOpenSource,
  onTogglePin,
  searchMatch
}: EchoCardProps) => {
  const [isAddingThought, setIsAddingThought] = useState(false)

  if (isLongCollect(echo)) {
    return (
      <LongEchoCard
        echo={echo}
        onAddThought={onAddThought}
        onDelete={onDelete}
        onOpenSource={onOpenSource}
        onTogglePin={onTogglePin}
        searchMatch={searchMatch}
      />
    )
  }

  const SourceIcon = iconForSource(echo.sourceApp)
  const isPinned = echo.status === "pinned"
  const displayText = echo.userThought || echo.inferredThought || echo.triggerText
  const visiblePrimaryField = echo.userThought
    ? "userThought"
    : echo.inferredThought
      ? "inferredThought"
      : "triggerText"
  const showSearchMatch =
    searchMatch &&
    searchMatch.field !== visiblePrimaryField &&
    searchMatch.field !== "sourceApp" &&
    !(searchMatch.field === "triggerText" && echo.userThought)

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
        <ExpandableText
          highlightTerms={searchMatch?.terms}
          text={displayText}
        />

        {echo.userThought && echo.triggerText && echo.userThought !== echo.triggerText ? (
          <div className="mt-2 border-t border-outline-variant/40 pt-2">
            <p className="mb-1 flex items-center gap-1 text-label-sm text-on-surface-variant">
              <Link size={12} />
              来源片段
            </p>
            <ExpandableText
              highlightTerms={searchMatch?.terms}
              text={echo.triggerText}
              tone="quote"
            />
          </div>
        ) : null}

        {showSearchMatch ? <EchoSearchMatchHint match={searchMatch} /> : null}

        {isAddingThought && onAddThought ? (
          <AddThoughtEditor
            onCancel={() => setIsAddingThought(false)}
            onSave={async (thought) => {
              await onAddThought(echo.id, thought)
              setIsAddingThought(false)
            }}
          />
        ) : null}

        <div className="mt-2 flex items-center gap-2 text-on-surface-variant">
          <span className="text-label-md">{sourceLabel(echo.sourceApp)}</span>
          <span className="h-1 w-1 rounded-full bg-outline-variant" />
          <time className="text-label-md">{relativeTime(echo.createdAt)}</time>
        </div>
      </div>

      <div className="action-zone absolute right-1 top-1 z-10 flex h-10 w-28 items-start justify-end p-1">
        <EchoCardActions
          echo={echo}
          onAddThought={() => setIsAddingThought(true)}
          onDelete={onDelete}
          onTogglePin={onTogglePin}
        />
      </div>
    </article>
  )
}
