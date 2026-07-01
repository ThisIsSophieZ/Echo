import { Pin, Trash2 } from "lucide-react"

import { CopyEchoButton } from "~components/CopyEchoButton"
import type { Echo } from "~db/echoes"

type EchoCardActionsProps = {
  echo: Echo
  onDelete?: (id: string) => void
  onTogglePin?: (id: string) => void
}

export const EchoCardActions = ({
  echo,
  onDelete,
  onTogglePin
}: EchoCardActionsProps) => {
  const isPinned = echo.status === "pinned"

  return (
    <div className="action-reveal inline-flex items-center gap-0.5 rounded-md border border-outline-variant bg-white p-0.5 opacity-0 shadow-sm transition-opacity">
      <CopyEchoButton echo={echo} />
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
        title={isPinned ? "Unpin" : "Pin"}
        type="button">
        <Pin size={16} className={isPinned ? "fill-primary" : ""} />
      </button>
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
  )
}
