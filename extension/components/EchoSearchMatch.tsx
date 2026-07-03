import { Search } from "lucide-react"

import type { EchoSearchMatch } from "~lib/echo-search"
import { SearchHighlight } from "~components/SearchHighlight"

type EchoSearchMatchProps = {
  match: EchoSearchMatch
}

export const EchoSearchMatchHint = ({ match }: EchoSearchMatchProps) => (
  <div className="mt-2 border-t border-outline-variant/40 pt-2">
    <p className="mb-1 flex items-center gap-1 text-label-sm font-medium text-primary">
      <Search size={12} />
      命中 · {match.label}
    </p>
    <p className="line-clamp-2 break-words text-body-sm leading-snug text-on-surface-variant">
      <SearchHighlight terms={match.terms} text={match.snippet} />
    </p>
  </div>
)
