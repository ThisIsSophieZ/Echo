import { MessageSquarePlus, Pin, PinOff, Trash2 } from "lucide-react"

import { CopyEchoButton } from "~components/CopyEchoButton"
import type { Echo } from "~db/echoes"

type EchoCardActionsProps = {
  echo: Echo
  onDelete?: (id: string) => void
  onAddThought?: () => void
  onTogglePin?: (id: string) => void
}

export const EchoCardActions = ({
  echo,
  onAddThought,
  onDelete,
  onTogglePin
}: EchoCardActionsProps) => {
  const isPinned = echo.status === "pinned"

  // Pin is the only always-visible control and sits above the hover group so
  // unpin never competes with an invisible dead zone for clicks.
  return (
    <div className="relative inline-flex items-center justify-end">
      <div className="action-reveal absolute right-full top-0 mr-0.5 inline-flex items-center gap-0.5 rounded-md border border-outline-variant bg-white p-0.5 opacity-0 shadow-sm transition-opacity">
        <CopyEchoButton echo={echo} />
        {!echo.userThought && onAddThought ? (
          <button
            aria-label="Add thought"
            className="rounded-full p-1 text-outline transition-colors hover:bg-secondary-container hover:text-primary"
            onClick={(event) => {
              event.preventDefault()
              event.stopPropagation()
              onAddThought()
            }}
            title="补想法"
            type="button">
            <MessageSquarePlus size={16} />
          </button>
        ) : null}
        <button
          aria-label="Delete echo"
          className="rounded-full p-1 text-outline transition-colors hover:bg-error-container hover:text-error"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onDelete?.(echo.id)
          }}
          title="Delete"
          type="button">
          <Trash2 size={16} />
        </button>
      </div>
      <button
        aria-label={isPinned ? "Unpin echo" : "Pin echo"}
        aria-pressed={isPinned}
        className={`relative z-20 rounded-full border border-outline-variant bg-white p-1 shadow-sm transition-colors hover:bg-primary-container ${
          isPinned ? "text-primary" : "text-outline hover:text-primary"
        }`}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onTogglePin?.(echo.id)
        }}
        title={isPinned ? "Unpin" : "Pin"}
        type="button">
        {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
      </button>
    </div>
  )
}
