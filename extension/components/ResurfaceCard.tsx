import { useState } from "react"
import { Archive, Clock, Pin, Quote, Sparkles } from "lucide-react"

import { ExpandableText } from "~components/ExpandableText"
import type { ResurfaceItem } from "~lib/resurface"

type ResurfaceCardProps = {
  item: ResurfaceItem
  onPin: (id: string) => void
  onSnooze: (id: string) => void
  onArchive: (id: string) => void
  onAddThought: (id: string, thought: string) => void
}

const relativeTime = (date: string) => {
  const delta = Date.now() - new Date(date).getTime()
  const minutes = Math.max(1, Math.floor(delta / 60000))
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export const ResurfaceCard = ({
  item,
  onPin,
  onSnooze,
  onArchive,
  onAddThought
}: ResurfaceCardProps) => {
  const { echo, reasons, mode } = item
  const [thought, setThought] = useState("")

  const submitThought = () => {
    const clean = thought.trim()
    if (!clean) return
    onAddThought(echo.id, clean)
  }

  return (
    <article className="rounded-lg border border-primary/30 bg-primary-fixed/10 p-3">
      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-primary-container px-2 py-0.5 text-label-sm text-on-primary-container">
          <Sparkles size={12} />
          {mode === "keep" ? "你的念头" : "旧片段"}
        </span>
        {reasons.map((reason) => (
          <span
            key={reason}
            className="rounded-full bg-surface-container-high px-2 py-0.5 text-label-sm text-on-surface-variant">
            {reason}
          </span>
        ))}
      </div>

      {mode === "keep" ? (
        <ExpandableText text={echo.userThought ?? ""} />
      ) : (
        <div className="flex gap-1.5">
          <Quote size={14} className="mt-1 shrink-0 text-outline" />
          <div className="min-w-0 flex-1">
            <ExpandableText text={echo.triggerText} tone="quote" />
          </div>
        </div>
      )}

      <div className="mt-1 text-label-sm text-on-surface-variant/70">
        {echo.sourceApp} · {relativeTime(echo.createdAt)}
      </div>

      {mode === "collect" ? (
        <div className="mt-2">
          <textarea
            className="min-h-12 w-full resize-none rounded-md border border-outline-variant bg-white px-2.5 py-1.5 text-body-md text-on-surface outline-none transition focus:border-primary-container focus:ring-2 focus:ring-primary-container/30"
            placeholder="这让你想到什么？（记下就成了你的念头）"
            value={thought}
            onChange={(event) => setThought(event.target.value)}
            onKeyDown={(event) => {
              if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                event.preventDefault()
                submitThought()
              }
            }}
          />
        </div>
      ) : null}

      <div className="mt-2 flex items-center gap-1.5">
        {mode === "collect" ? (
          <button
            className="rounded-full bg-primary-container px-3 py-1 text-label-md font-medium text-on-primary transition hover:bg-primary disabled:cursor-not-allowed disabled:bg-surface-container-high disabled:text-on-surface-variant"
            disabled={!thought.trim()}
            onClick={submitThought}
            type="button">
            记下
          </button>
        ) : (
          <button
            className="inline-flex items-center gap-1 rounded-full bg-primary-container px-3 py-1 text-label-md font-medium text-on-primary transition hover:bg-primary"
            onClick={() => onPin(echo.id)}
            type="button">
            <Pin size={13} />
            啊对，钉住
          </button>
        )}

        <button
          className="inline-flex items-center gap-1 rounded-full border border-outline-variant px-3 py-1 text-label-md text-secondary transition hover:bg-surface-container-low"
          onClick={() => onSnooze(echo.id)}
          type="button">
          <Clock size={13} />
          稍后
        </button>

        <button
          className="ml-auto inline-flex items-center gap-1 rounded-full p-1.5 text-outline transition hover:bg-error-container hover:text-error"
          aria-label="归档"
          onClick={() => onArchive(echo.id)}
          type="button">
          <Archive size={15} />
        </button>
      </div>
    </article>
  )
}
