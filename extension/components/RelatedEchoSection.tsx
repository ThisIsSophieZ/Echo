import { useState } from "react"
import { ChevronDown, Sparkles } from "lucide-react"

import { EchoCard } from "~components/EchoCard"
import type { Echo } from "~db/echoes"
import type { RelatedEchoResult } from "~lib/echo-related"

type RelatedEchoSectionProps = {
  results: RelatedEchoResult[]
  onAddThought: (id: string, thought: string) => Promise<void>
  onDelete: (id: string) => void
  onOpenSource: (echo: Echo) => void
  onTogglePin: (id: string) => void
}

export const RelatedEchoSection = ({
  results,
  onAddThought,
  onDelete,
  onOpenSource,
  onTogglePin
}: RelatedEchoSectionProps) => {
  const [expanded, setExpanded] = useState(false)
  if (!results.length) return null

  return (
    <section className="mb-stack-md border-y border-outline-variant/70 py-2">
      <button
        aria-expanded={expanded}
        className="flex w-full items-center gap-2 py-1 text-left text-body-sm text-on-surface"
        onClick={() => setExpanded((value) => !value)}
        type="button">
        <Sparkles className="shrink-0 text-primary" size={16} />
        <span className="min-w-0 flex-1 font-medium">
          找到 {results.length} 条相关 Echo
        </span>
        <ChevronDown
          className={`shrink-0 text-on-surface-variant transition-transform ${
            expanded ? "rotate-180" : ""
          }`}
          size={16}
        />
      </button>

      {expanded ? (
        <div className="mt-2 space-y-stack-sm">
          {results.map((result) => (
            <div key={result.echo.id}>
              <p className="mb-1 px-1 text-label-sm text-on-surface-variant">
                {result.reason}
              </p>
              <EchoCard
                echo={result.echo}
                onAddThought={onAddThought}
                onDelete={onDelete}
                onOpenSource={onOpenSource}
                onTogglePin={onTogglePin}
                searchMatch={result.match}
              />
            </div>
          ))}
        </div>
      ) : null}
    </section>
  )
}
