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

- Collect does **not** auto-open the side panel or ask for another input.
  A brief `已保存 · 来自 {source}` toast is the only confirmation.
- A raw Collect can receive an optional thought later from its collapsed card
  action. The editor opens only after an explicit click and updates the same
  Echo to `confirmed`.
- New Collect actions preserve paragraph and list-item line breaks from supported LLM pages.
- Structured selections also keep a Markdown representation, compact preview,
  structure metrics, and a text anchor back to the source.
- Data lives in IndexedDB (`echo-sidebar` database, `sparks` object store).
- An unfinished Keep draft is restored from `chrome.storage.local` after the
  side panel closes or Chrome restarts. Saving clears the draft.

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

The source locator first reuses an already-open conversation tab when possible.
It then checks provider-specific message containers for ChatGPT, Claude,
Gemini, and Grok before falling back to a legacy message ID, exact text quote,
and high-confidence fuzzy match. Existing Echoes without capture metadata
continue to render and use their stored text as a best-effort anchor.

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
- Delete shows a five-second Undo action and restores the exact same Dexie
  record when used.

The previous neglect-driven resurface experiment was removed after dogfooding showed
that opening the panel felt like receiving work. Contextual recall will be tested
later as an explicit or high-confidence, low-interruption interaction.

## Local search

The bottom Search button opens the first on-demand recall surface.

- Search runs against the Echoes already loaded from Dexie; it does not add a
  database index or schema migration.
- Matching covers `triggerText`, `userThought`, `inferredThought`, `title`, and
  `sourceApp`.
- Input is normalized with Unicode NFKC, lowercased, and split on whitespace.
  Every entered term must appear somewhere in the combined searchable text.
- Non-empty queries use explainable lexical relevance: user thoughts rank
  above titles, inferred thoughts, source text, and source-app matches.
  Exact phrases receive an additional boost; equal scores remain newest-first.
- When a match comes from content the card does not normally show, the result
  includes a compact `命中` snippet so the reason is visible.
- Matching terms are highlighted in visible card text, structured titles,
  previews, and hidden-field snippets.
- Closing Search or pressing Home clears the query and restores the Keep
  composer and normal filter chips.
- `/` opens Search when focus is not inside an editor; `Escape` returns Home.
- Pure search matching lives in `lib/echo-search.ts` and is covered by focused
  regression tests.
- No AI ranking, fuzzy matching, vectors, or external search dependency is
  included in this MVP.

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
        provider?: "chatgpt" | "claude" | "gemini" | "grok"
        messageId?: string
        messageIndex?: number
        attribute?: "data-message-id" // legacy
        value?: string // legacy
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
