# Echo Sidebar Development Log

This document records product and engineering changes for the Echo Sidebar prototype.

## 2026-06-20

### Stack Decision

The first version uses:

- Plasmo for Chrome extension project structure and MV3 build output.
- React for the side panel UI.
- Tailwind CSS for fast UI implementation and Stitch design handoff.
- Dexie / IndexedDB for local-first Echo storage.

### Current Prototype Scope

- Native Chrome Side Panel entry through `sidepanel.tsx`.
- Extension action opens the side panel through `chrome.sidePanel.setPanelBehavior`.
- Content script reads current page title, URL, and selected text from supported LLM pages.
- Dexie stores local Echo records with text, source app, title, URL, timestamp, and status.
- Side panel can create an Echo and list recent active or pinned Echoes.

### Files Added

- `package.json`: Plasmo scripts, dependencies, permissions, and host permissions.
- `sidepanel.tsx`: first React side panel UI.
- `background.ts`: side panel action behavior.
- `contents/llm-context.ts`: page context content script.
- `db/echoes.ts`: Dexie database and Echo helpers.
- `lib/source-app.ts`: source app detection from URL.
- `components/EchoCard.tsx`: reusable Echo card.
- `style.css`, `tailwind.config.js`, `postcss.config.js`: Tailwind setup.
- `assets/icon.png`: temporary local icon for Plasmo build output.
- `.gitignore`: ignores generated Plasmo artifacts and dependencies.
- `README.md`: local setup and prototype scope.

### Verification

`npm run build` completed successfully.

Generated extension build:

```text
products/echo/extension/build/chrome-mv3-prod
```

Manual Chrome verification completed:

- Loaded `build/chrome-mv3-prod` through `chrome://extensions`.
- Native Chrome side panel opens from the extension action.
- The current prototype can collect and display a local Echo.

### Stitch Design Integration

The attached Stitch static HTML concept was converted into local React/Tailwind code.

Key implementation choices:

- Converted Material Symbols usage to bundled `lucide-react` icons to avoid remote font dependencies in the extension.
- Moved Stitch design tokens into `tailwind.config.js`.
- Reworked `sidepanel.tsx` around the Stitch layout: top app bar, quick capture input, filter chips, echo list, and bottom navigation.
- Updated `EchoCard` to match the compact echo-card visual style.
- Kept the existing Dexie capture and current-page context behavior.

Verification:

- `npm run build` completed successfully after the Stitch conversion.
- Build emitted an optional `svgo` optimization notice from the bundler; it does not block the generated Chrome extension.

### Capture Input Adjustment

The Stitch capture field looked too much like a search box. It was changed from a pill-shaped search-style input into a normal multiline capture box.

Behavior changes:

- Saving is now explicit through the `Keep` button.
- Keyboard save uses `Ctrl/Command + Enter` instead of plain Enter, so multiline thought entry stays natural.
- The manual input field creates a normal Echo item.

Verification:

- `npm run build` completed successfully after the capture input adjustment.

### Selection To Sidebar

The old "select text then collect it" loop was merged into the Echo sidebar flow.

Current behavior:

- Selecting text on supported LLM pages shows a small `Add to Echo` floating button.
- Right-clicking selected text also exposes `Add selection to Echo`.
- Both paths immediately create a new Echo item in Dexie and open the native side panel.
- Manual input in the sidebar also creates a new Echo item directly.
- There is no pending selection slot, so adding a second selection appends another item instead of overwriting the previous one.

Verification:

- `npm run build` completed successfully after the selection-to-sidebar integration.
- Generated manifest includes the `contextMenus` permission and the LLM page content script.

Adjustment:

- Removed the pending selected text UI and pending storage slot.
- `Add to Echo` now appends directly to the `All Echoes` list.

Verification:

- `npm run build` completed successfully after simplifying Add-to-Echo into direct append behavior.

### Next Implementation Steps

1. Reload the Chrome extension from `chrome://extensions`.
2. Visually compare the implemented sidebar against the Stitch design.
3. Add basic Echo actions: pin and ignore.
4. Add lightweight recent/contextual sorting only after the capture loop feels right.

### Bug Fixes

- Fixed the list appearing to overwrite items after five entries by removing the hardcoded five-item display limit.
- Fixed Echo card text truncation by removing the two-line clamp from the main card body.

Verification:

- `npm run build` completed successfully after both bug fixes.

### Delete Echo

Added the first item management action for the collect MVP:

- Each Echo card exposes a delete button on hover.
- Delete removes the Echo from Dexie and refreshes the list.
- No confirmation dialog or undo flow yet, to keep the MVP simple.

Verification:

- `npm run build` completed successfully after adding delete.

### Echo Data Shape

Updated the local Echo record shape for the collect MVP and future inference flow.

Current fields:

```ts
Echo {
  triggerText: string
  inferredThought?: string
  userThought?: string
  sourceApp: string
  url: string
  title: string
  status: "raw" | "inferred" | "confirmed" | "ignored" | "pinned"
}
```

Behavior:

- `Add to Echo` from selected page text creates a `raw` Echo with `triggerText`.
- Manual sidebar input creates a `confirmed` Echo with both `triggerText` and `userThought` set to the typed text.
- Card display prefers `userThought`, then `inferredThought`, then `triggerText`.
- Sidebar title changed from `Spark Echo` to `Echo`.
- Existing local records using the old `thought/status: active` shape are normalized at read time so prior test data remains visible.
- Added Dexie version 3 migration to rewrite existing local records into the Echo shape.
- Code-level DB API now uses Echo naming: `Echo`, `EchoStatus`, `createEcho`, `listRecentEchoes`, and `deleteEcho`.
- The underlying IndexedDB object store is still named `sparks` only to preserve existing local browser data.

Verification:

- `npm run build` completed successfully after the title and data-shape changes.
- `npm run build` completed successfully after DB API naming was unified around Echo.

Consistency rule:

- New product/domain code should use Echo naming and the Echo record shape above.
- Do not introduce new `Spark` data models or APIs; `sparks` only remains as the legacy IndexedDB object store name.

### Echo Ordering

- MVP list ordering is now strictly newest-first by `createdAt`.
- Status no longer affects the `All Echoes` order, so newly collected Echoes appear at the top immediately.

Verification:

- `npm run build` completed successfully after the ordering change.
