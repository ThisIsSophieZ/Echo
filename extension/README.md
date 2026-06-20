# Echo Sidebar

Echo Sidebar is a Chrome Side Panel MVP for collecting small text fragments while working across LLM pages.

The current goal is intentionally narrow: collect first, keep it local, and make sure every new Echo appears in the list.

## Stack

- Plasmo
- React
- Tailwind CSS
- Dexie / IndexedDB
- Chrome MV3 Side Panel API

## First prototype scope

- Open a native Chrome side panel from the extension action.
- Collect selected text from supported pages through the floating `Add to Echo` button.
- Collect selected text through the browser context menu: `Add selection to Echo`.
- Collect manually typed text from the side panel with `Keep`.
- Store Echoes locally in Chrome IndexedDB through Dexie.
- Show Echoes newest-first in `All Echoes`.
- Delete an Echo from the list.

## Echo data shape

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
}
```

Current write behavior:

- `Add to Echo` from selected page text creates a `raw` Echo with `triggerText`.
- Manual side panel input creates a `confirmed` Echo with `triggerText` and `userThought` set to the typed text.
- Existing legacy local records are normalized into this shape on read/migration.

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
