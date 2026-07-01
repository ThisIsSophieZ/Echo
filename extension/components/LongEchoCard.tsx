import { useState } from "react"
import {
  Bot,
  ExternalLink,
  FileText,
  Pin,
  Sparkles,
  Trash2
} from "lucide-react"

import type { Echo } from "~db/echoes"
import { longCollectPresentation } from "~lib/echo-presentation"

type LongEchoCardProps = {
  echo: Echo
  onDelete?: (id: string) => void
  onOpenSource?: (echo: Echo) => void
  onTogglePin?: (id: string) => void
}

const iconForSource = (source?: string) => {
  if (source === "gemini") return Sparkles
  return Bot
}

export const LongEchoCard = ({
  echo,
  onDelete,
  onOpenSource,
  onTogglePin
}: LongEchoCardProps) => {
  const [showMarkdown, setShowMarkdown] = useState(false)
  const presentation = longCollectPresentation(echo)
  const SourceIcon = iconForSource(echo.sourceApp)
  const isPinned = echo.status === "pinned"

  return (
    <article
      className={`echo-card group relative rounded-lg border bg-white p-3 transition-colors hover:bg-[#F1F3F4] ${
        isPinned ? "border-primary/50 bg-primary-fixed/10" : "border-[#E3E3E3]"
      }`}>
      <div className="flex items-start gap-3">
        <div
          className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
            echo.sourceApp === "gemini"
              ? "bg-tertiary-fixed text-[#341100]"
              : echo.sourceApp === "browser"
                ? "bg-secondary-fixed text-on-secondary-fixed"
                : "bg-primary-fixed text-on-primary-fixed"
          }`}>
          <SourceIcon size={18} strokeWidth={1.8} />
        </div>

        <div className="min-w-0 flex-1 pr-12">
          <h2 className="break-words text-body-md font-semibold leading-snug text-on-surface">
            {presentation.title}
          </h2>
          <p className="mt-1 line-clamp-2 break-words text-body-sm leading-snug text-on-surface-variant">
            “{presentation.preview}”
          </p>
          <p className="mt-2 text-label-sm text-on-surface-variant/80">
            {presentation.meta}
          </p>
        </div>

        <div
          className={`action-reveal absolute right-2 top-2 flex items-center gap-1 transition-opacity ${
            isPinned ? "opacity-100" : "opacity-0"
          }`}>
          <button
            aria-label={isPinned ? "Unpin echo" : "Pin echo"}
            className={`rounded-full p-1 transition-colors ${
              isPinned
                ? "text-primary hover:bg-primary-container"
                : "text-outline hover:bg-secondary-container hover:text-primary"
            }`}
            onClick={() => onTogglePin?.(echo.id)}
            type="button">
            <Pin size={16} className={isPinned ? "fill-primary" : ""} />
          </button>
          <button
            aria-label="Delete echo"
            className="rounded-full p-1 text-outline hover:bg-error-container hover:text-error"
            onClick={() => onDelete?.(echo.id)}
            type="button">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {showMarkdown ? (
        <pre className="mt-3 max-h-[55vh] overflow-auto rounded-md border border-outline-variant bg-surface-container-lowest p-3 text-xs leading-relaxed text-on-surface">
          {presentation.markdown}
        </pre>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-3 py-1.5 text-label-sm font-medium text-secondary transition-colors hover:bg-secondary-container"
          onClick={() => setShowMarkdown((value) => !value)}
          type="button">
          <FileText size={14} />
          {showMarkdown ? "收起 Markdown" : "查看 Markdown"}
        </button>
        {echo.url ? (
          <button
            className="inline-flex items-center gap-1.5 rounded-full border border-outline-variant px-3 py-1.5 text-label-sm font-medium text-secondary transition-colors hover:bg-secondary-container"
            onClick={() => onOpenSource?.(echo)}
            type="button">
            <ExternalLink size={14} />
            打开原位置
          </button>
        ) : null}
      </div>
    </article>
  )
}
