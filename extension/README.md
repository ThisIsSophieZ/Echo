# Echo Sidebar

Echo Sidebar is a lightweight Chrome Side Panel for capturing and recalling thought fragments while working across LLM pages.

## Stack

- Plasmo
- React
- Tailwind CSS
- Dexie / IndexedDB
- Chrome MV3 Side Panel API

## Verification

```bash
npm test
npx tsc --noEmit
npm run build
```

The regression suite currently covers long Collect/Keep classification,
structured-card metadata, and the Markdown clipboard contract.

## Capture (store)

Two capture paths, two meanings:

| Action | Entry | Stored as | Meaning |
| --- | --- | --- | --- |
| **Collect** | Floating `Add to Echo` button or context menu on selected text | `status: raw`, `triggerText` = quote | External trigger (AI text that caught your eye) |
| **Keep** | Side panel textarea + `Keep` | `status: confirmed`, `userThought` = typed text | Your own thought |

- Collect does **not** auto-open the side panel; a `Saved to Echo` toast appears near the selection instead.
- After Collect, the confirmation includes an optional one-line
  `Add a thought...` field. It does not take focus, disappears when ignored,
  and updates the same Echo when used.
- New Collect actions preserve paragraph and list-item line breaks from supported LLM pages.
- Structured selections also keep a Markdown representation, compact preview,
  structure metrics, and a text anchor back to the source.
- Data lives in IndexedDB (`echo-sidebar` database, `sparks` object store).

## Long and structured captures

Long Collect items do not render their entire body in the list.

- A reliable selected or nearby heading is used when available.
- Captures without a reliable heading use `Long capture from {source}`.
- Every compact card keeps a one-sentence preview.
- Tables, lists, and code blocks show derived structure metadata.
- `View Markdown` reveals the stored Markdown in a scrollable viewer.
- `Open original position` opens the source conversation, keeps the pending
  anchor across dynamic page initialization, scrolls to the match, and briefly
  highlights it.

The source locator prefers a provider message ID when one is available and
falls back to an exact text quote and then a high-confidence fuzzy match for
lightly edited content. Existing Echoes without capture metadata continue to
render and use their stored text as a best-effort anchor.

## Current recall behavior

The side panel is quiet by default:

- Opening Echo does not calculate or push a neglected Top 3.
- The Keep composer appears first.
- `All Echoes` follows immediately and is ordered strictly newest-first.
- Collect and Keep never create a review task or require a follow-up response.
- A skipped quick thought leaves the Echo `raw`; a saved thought stores
  `userThought` and changes the same record to `confirmed`.
- Adding a thought to a long Collect does not expand its source body; the
  thought appears first while the original remains in the compact long-content
  presentation.
- Every Echo has a direct Copy action. Structured captures copy their stored
  Markdown; an added thought is prepended under `## 想法`, followed by the
  source under `## 来源片段`.
- Copy, Pin, and Delete share a hidden top-right action group. Hovering that
  corner reveals it without reserving space in the card content.

The previous neglect-driven resurface experiment was removed after dogfooding showed
that opening the panel felt like receiving work. Contextual recall will be tested
later as an explicit or high-confidence, low-interruption interaction.

## Echo data shape (full)

```ts
type Echo = {
  id: string
  triggerText: string
  inferredThought?: string
  userThought?: string
  sourceApp: string
  url: string
  title: string
  createdAt: string
  status: "raw" | "inferred" | "confirmed" | "ignored" | "pinned"
  capture?: {
    version: 1
    markdown: string
    preview: string
    title?: {
      value: string
      source: "selected-heading" | "nearby-heading"
    }
    features: {
      charCount: number
      lineCount: number
      tableCount: number
      tableRowCount: number
      listItemCount: number
      codeBlockCount: number
    }
    anchor: {
      quote: {
        exactStart: string
        exactEnd?: string
        prefix?: string
        suffix?: string
      }
      provider?: {
        attribute: "data-message-id"
        value: string
      }
    }
  }
}
```

## Supported source pages

- ChatGPT
- Claude
- Gemini
- Grok / X

The side panel can still be opened from other Chrome pages, but source detection may fall back to `browser`.

## Development

```powershell
npm install
npm run dev
```

Then load the generated development build from Chrome's extensions page.

## Production build

```powershell
npm run build
```

Load this directory in `chrome://extensions`:

```text
products/echo/extension/build/chrome-mv3-prod
```

## Notes

- The IndexedDB database is named `echo-sidebar`.
- The underlying object store is still named `sparks` to preserve early local test data.
- Product/domain code should use Echo naming going forward.
