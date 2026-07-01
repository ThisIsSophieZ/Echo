# Echo Sidebar

Echo Sidebar is a Chrome Side Panel for capturing thought fragments while working across LLM pages, then resurfacing the right ones at the right moment.

## Stack

- Plasmo
- React
- Tailwind CSS
- Dexie / IndexedDB
- Chrome MV3 Side Panel API

## Capture (store)

Two capture paths, two meanings:

| Action | Entry | Stored as | Meaning |
| --- | --- | --- | --- |
| **Collect** | Floating `Add to Echo` button or context menu on selected text | `status: raw`, `triggerText` = quote | External trigger (AI text that caught your eye) |
| **Keep** | Side panel textarea + `Keep` | `status: confirmed`, `userThought` = typed text | Your own thought |

- Collect does **not** auto-open the side panel; a `Saved to Echo` toast appears near the selection instead.
- Data lives in IndexedDB (`echo-sidebar` database, `sparks` object store).

## Resurface (return) — implementation detail

Product rule (see local `docs/product-discussion-updated.md` §11):

> Collect captures external triggers; Keep captures your own thoughts. Resurface is thought-centered: Keep seeks resonance; Collect provokes a thought so raw quotes upgrade instead of rotting as a bookmark pile.

### End-to-end flow

```
Open side panel
  -> read current tab context (title, url, selection) via content script message
  -> load all echoes from Dexie
  -> selectResurfaced(echoes, context)   // stable pipeline
       -> filter (ignored, pinned, snooze, cooldown)
       -> scoreEcho() per echo            // tunable seam
       -> sort, take top 3
  -> render "回声" section with ResurfaceCard per item
  -> markSurfaced(ids)                   // 12h cooldown starts
```

Resurface is computed **once per panel open** (not on every list refresh), so the section feels like a calm glance rather than a live feed that reshuffles after each action.

### File map

| File | Role |
| --- | --- |
| `lib/resurface.ts` | Scoring + selection pipeline (algorithm lives here) |
| `db/echoes.ts` | Persistence, lifecycle fields, `markSurfaced` / `snoozeEcho` / `addThought` |
| `components/ResurfaceCard.tsx` | Two UI modes (Keep vs Collect) and action buttons |
| `sidepanel.tsx` | Wires context, computes resurface on mount, handles user actions |
| `contents/llm-context.ts` | Answers `echo:get-page-context` with title, url, selection |

### Data model additions (Dexie v4)

```ts
type Echo = {
  // ...existing fields...
  lastSurfacedAt?: string  // ISO timestamp; set when shown in resurface section
  snoozeUntil?: string     // ISO timestamp; hide until this time ("稍后")
}
```

Lifecycle helpers in `db/echoes.ts`:

- `markSurfaced(ids)` — write `lastSurfacedAt = now` for all echoes just shown
- `snoozeEcho(id, ms)` — set `snoozeUntil` (default 3 days via `SNOOZE_DEFAULT_MS`)
- `addThought(id, thought)` — set `userThought`, upgrade `status` to `confirmed` (Collect → Keep)
- `setEchoStatus(id, "ignored")` — archive ("归档")

### The pluggable seam: `scoreEcho()`

**This is the only function you need to tune while dogfooding.** Pure function, no database or DOM access.

Input: one `Echo` + `ResurfaceContext` (`title`, `selection`, optional `now` for tests).

Output: `{ score, reasons }`. An echo only surfaces if `score > 0` **and** `reasons.length > 0` (the +2 Keep boost alone is not enough).

Current v0 rules:

1. **Keep standing boost** — if `echo.userThought` exists, `score += 2` (tie-breaker only, no reason tag)
2. **Neglect** — if age ≥ 1 day and `lastSurfacedAt` is empty, add `min(ageDays, 14)` to score; reason: `存了 N 天还没回看`
3. **Context overlap** — tokenize echo text (`userThought` + `inferredThought` + `triggerText` + `title`) and page context (`title` + `selection`); each overlapping token adds 4 to score; reason: `和你正在看的内容相关`

Tokenizer (no external NLP lib):

- English: words ≥ 3 chars, lowercased, stopwords removed
- Chinese: character bigrams from CJK runs (crude but zero-dependency)

### Stable pipeline: `selectResurfaced()`

Usually leave this alone. Steps:

1. **Exclude** `status === "ignored"` or `"pinned"`
2. **Exclude** if `snoozeUntil` is in the future
3. **Exclude** if `lastSurfacedAt` is within the last **12 hours** (`RESURFACE_COOLDOWN_MS`)
4. **Map** each survivor through `scoreEcho()`, attach `mode`:
   - `mode: "keep"` if `echo.userThought` is set
   - `mode: "collect"` otherwise (raw quote)
5. **Filter** `score > 0 && reasons.length > 0`
6. **Sort** by score descending, **slice** to 3 (`DEFAULT_LIMIT`)

Constants (all in `lib/resurface.ts`):

| Constant | Value | Meaning |
| --- | --- | --- |
| `MIN_AGE_DAYS` | 1 | Fresh captures do not surface for neglect on day 0 |
| `RESURFACE_COOLDOWN_MS` | 12h | Same echo won't reappear immediately after being shown |
| `SNOOZE_DEFAULT_MS` | 3 days | "稍后" hide duration |
| `DEFAULT_LIMIT` | 3 | Max cards in resurface section |

### UI: two loops in `ResurfaceCard`

**Keep mode** (`userThought` present):

- Shows your thought text
- Primary action: **啊对，钉住** → `togglePin` (status → `pinned`, leaves resurface pool)
- Secondary: **稍后** → `snoozeEcho`, **归档** → `setEchoStatus("ignored")`

**Collect mode** (raw quote, no `userThought`):

- Shows `triggerText` (clamped to 3 lines)
- Inline textarea: **这让你想到什么？**
- Primary action: **记下** → `addThought` (writes `userThought`, status → `confirmed`, card dismissed)
- Same snooze / archive actions

After any action, the card is removed from local `resurfaced` state via `dismissResurfaced(id)` so the section does not reshuffle mid-session.

### How to tune the algorithm

Edit only `scoreEcho()` in `lib/resurface.ts`. Examples:

- Change neglect threshold: `MIN_AGE_DAYS`
- Weight context higher: multiply overlap score
- Add a new reason: e.g. boost echoes from the same `sourceApp` as current page
- Add reuse signal later: new field on `Echo`, read it inside `scoreEcho()`

No changes needed in `sidepanel.tsx` or `ResurfaceCard.tsx` unless you add new user actions.

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
  lastSurfacedAt?: string
  snoozeUntil?: string
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
