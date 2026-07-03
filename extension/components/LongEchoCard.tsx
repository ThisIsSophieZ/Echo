import { useState } from "react"
import {
  Bot,
  ExternalLink,
  FileText,
  Sparkles
} from "lucide-react"

import type { Echo } from "~db/echoes"
import { AddThoughtEditor } from "~components/AddThoughtEditor"
import { EchoCardActions } from "~components/EchoCardActions"
import { EchoSearchMatchHint } from "~components/EchoSearchMatch"
import { longCollectPresentation } from "~lib/echo-presentation"
import type { EchoSearchMatch } from "~lib/echo-search"
import { SearchHighlight } from "~components/SearchHighlight"

type LongEchoCardProps = {
  echo: Echo
  onDelete?: (id: string) => void
  onAddThought?: (id: string, thought: string) => Promise<void>
  onOpenSource?: (echo: Echo) => void
  onTogglePin?: (id: string) => void
  searchMatch?: EchoSearchMatch
}

const iconForSource = (source?: string) => {
  if (source === "gemini") return Sparkles
  return Bot
}

export const LongEchoCard = ({
  echo,
  onAddThought,
  onDelete,
  onOpenSource,
  onTogglePin,
  searchMatch
}: LongEchoCardProps) => {
  const [showMarkdown, setShowMarkdown] = useState(false)
  const [isAddingThought, setIsAddingThought] = useState(false)
  const presentation = longCollectPresentation(echo)
  const SourceIcon = iconForSource(echo.sourceApp)
  const isPinned = echo.status === "pinned"
  const showSearchMatch =
    searchMatch &&
    searchMatch.field !== "userThought" &&
    searchMatch.field !== "sourceApp"

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

        <div className="min-w-0 flex-1">
          {echo.userThought ? (
            <p className="whitespace-pre-wrap break-words text-body-md font-medium leading-snug text-on-surface">
              <SearchHighlight
                terms={searchMatch?.terms}
                text={echo.userThought}
              />
            </p>
          ) : null}

          <div
            className={
              echo.userThought
                ? "mt-2 border-t border-outline-variant/40 pt-2"
                : undefined
            }>
            <h2 className="break-words text-body-md font-semibold leading-snug text-on-surface">
              <SearchHighlight
                terms={searchMatch?.terms}
                text={presentation.title}
              />
            </h2>
            <p className="mt-1 line-clamp-2 break-words text-body-sm leading-snug text-on-surface-variant">
              “
              <SearchHighlight
                terms={searchMatch?.terms}
                text={presentation.preview}
              />
              ”
            </p>
            <p className="mt-2 text-label-sm text-on-surface-variant/80">
              {presentation.meta}
            </p>
          </div>

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

      {showMarkdown ? (
        <pre className="mt-3 max-h-[55vh] overflow-auto rounded-md border border-outline-variant bg-surface-container-lowest p-3 text-xs leading-relaxed text-on-surface">
          {presentation.markdown}
        </pre>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-2">
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
      </div>
    </article>
  )
}
