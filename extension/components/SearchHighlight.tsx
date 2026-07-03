type SearchHighlightProps = {
  terms?: string[]
  text: string
}

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")

export const SearchHighlight = ({ terms = [], text }: SearchHighlightProps) => {
  const usableTerms = terms.filter(Boolean).sort((a, b) => b.length - a.length)
  if (!usableTerms.length) return <>{text}</>

  const expression = new RegExp(
    `(${usableTerms.map(escapeRegExp).join("|")})`,
    "gi"
  )

  return (
    <>
      {text.split(expression).map((part, index) =>
        usableTerms.some((term) => part.toLocaleLowerCase() === term.toLocaleLowerCase()) ? (
          <mark
            className="rounded-sm bg-tertiary-fixed px-0.5 text-on-tertiary-fixed"
            key={`${part}-${index}`}>
            {part}
          </mark>
        ) : (
          part
        )
      )}
    </>
  )
}
