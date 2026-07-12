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

- Collect does **not** auto-open the side panel or force a follow-up.
  After a successful save, a near-selection prompt shows
  `已保存 · {source}` with an optional one-line `补一句想法...` field.
  Ignoring it for about 8 seconds dismisses the prompt; focusing the input
  pauses the timer. Enter saves onto the same Echo; Esc closes it.
- A raw Collect can also receive an optional thought later from its card
  hover action (`补想法`). That editor opens only after an explicit click
  and updates the same Echo to `confirmed`.
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
New Anchor v2 captures then use, in order:

1. A provider-native ID only when it is unique in the page.
2. A normalized SHA-256 message fingerprint, with head/tail fingerprints and
   neighboring-message fingerprints for disambiguation.
3. `prefix + exact + suffix` text context inside the matched message.
4. A high-confidence text fallback for historical Echoes.

When a long conversation has virtualized older messages, the provider adapter
progressively scrolls upward and retries as more history enters the DOM.
`messageIndex` is not written or used by Anchor v2. Existing Echoes without v2
metadata remain readable through the legacy ID and text fallbacks.

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

## Phase 2: Reflection Probe v0

The first Reflection Layer experiment is selection-driven and quiet by
default:

- Selecting text on a supported LLM page sends that temporary context only to
  an already-open extension surface.
- Relevance is calculated locally against the Echoes already loaded from
  Dexie. The selection is not stored and no network request is made.
- If no result clears the conservative threshold, the sidebar does not change.
- If results exist, Home shows one collapsed line:
  `找到 N 条相关 Echo`.
- Nothing expands until the user clicks. Expansion shows at most three Echoes
  with an explanation of the matched field and terms.
- A new selection resets the section to collapsed.

The current lexical baseline uses `Intl.Segmenter`, BM25, per-field length
normalization, IDF, and consecutive phrase boosts:

- Only terms that actually occur in the local Echo corpus enter scoring.
- At most 16 high-IDF query terms survive, preventing long selections from
  accumulating hundreds of weak matches.
- `userThought` receives a small boost, followed by title; source and inferred
  text remain at baseline weight.
- Each Echo is scored by its strongest field rather than summing duplicate
  evidence across every field.
- BM25 is normalized to a `0–100` lexical-evidence score, not presented as a
  calibrated probability.
- One-term matches never surface. Two eligible content terms remain debug-only.
  A result surfaces only with an eligible consecutive phrase or at least three
  eligible content terms in one field.
- Generic Tier 2 terms and terms occurring in more than 20% of an established
  corpus contribute only `0.35` to ranking and cannot create eligibility.
- Very short Echoes use a minimum effective length of half the field average,
  preventing BM25's short-document boost from dominating.
- Duplicate Echo content is suppressed after ranking.
- Exact source text is excluded only when it comes from the same URL.

This probe does not add embeddings, vectors, page-wide context, automatic
sidebar opening, feedback queues, or a Dexie schema migration.

During the Probe, Home also exposes a collapsed `Probe debug` row. It reports
whether a selection arrived, corpus terms, scanned and accepted counts, and
every candidate score. Each Echo exposes its strongest field, field weight and
length, per-term TF/IDF/BM25 contribution, phrase bonus, raw weighted score,
normalized lexical evidence, and final acceptance or rejection reason.
The expanded panel includes `复制精简报告`. Each report has timestamped
start/end markers, a summary table, and ranked non-zero evidence with score
ledgers. Zero-evidence Echoes are represented only by an aggregate count, so
multiple pasted reports remain compact and separable.
Reports also include an experimental intent layer:

- `Selection kind` explains whether the current selection looks like product
  thought, task material, meta/debug analysis, or unknown.
- Each candidate includes `Echo intent` and `Match kind`, distinguishing
  thought continuity from task-material recall, product-meta reference, and
  suspected debug noise.
- These classifications are heuristic report instrumentation only. They do
  not change Dexie data, require user-maintained labels, or currently affect
  the visible recall list.

This is temporary product instrumentation, not a permanent user-facing surface.

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
      version?: 2
      quote: {
        exactStart: string
        exactEnd?: string
        prefix?: string
        suffix?: string
      }
      provider?: {
        provider?: "chatgpt" | "claude" | "gemini" | "grok"
        nativeId?: {
          attribute: string
          value: string
        }
        fingerprint?: {
          fullHash: string
          headHash: string
          tailHash: string
          textLength: number
        }
        previousFingerprint?: EchoMessageFingerprint
        nextFingerprint?: EchoMessageFingerprint
        role?: "user" | "assistant"
        capturedAt?: string
        messageId?: string // legacy
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
