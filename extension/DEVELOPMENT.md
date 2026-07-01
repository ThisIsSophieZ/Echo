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

## 2026-07-01

### Remove Neglect-Driven Top 3

Dogfood showed that computing three neglected Echoes whenever the side panel
opened made the product feel like a review queue and reduced normal use.

Changes:

- Removed the automatic Top 3 computation and the resurface section from
  `sidepanel.tsx`.
- Removed the failed neglect scoring module and its dedicated resurface card.
- Removed resurface-only database helpers for marking, snoozing, archiving, and
  forced Collect-to-Keep upgrades.
- Restored the opening flow to Keep first, followed immediately by the normal
  Echo list.
- Restored `All Echoes` to strict newest-first ordering. Pinned items remain
  available through the existing Pinned filter but no longer displace new items.
- Kept Dexie at schema version 4 to avoid rolling back existing local databases.
  Historical resurface fields already stored by Chrome are ignored; Echo content
  is not migrated or deleted.

Product boundary:

- Collect remains direct and does not open the side panel.
- Keep remains the primary reason to open the side panel.
- Opening Echo does not create a review task or require the user to respond.
- Future recall work must be explicit or high-confidence and low-interruption.

Verification:

- `npm run build` completed successfully.
- Generated Chrome MV3 output remains at `build/chrome-mv3-prod`.
- Plasmo still reports the existing optional `svgo` optimization notice; it
  does not block the build.

### Selection Button After Extension Reload

During local development, reloading the extension invalidates content scripts
that are already running in open LLM tabs. Their injected `Add to Echo` button
can remain visible even though its connection to the new background worker is
gone; the context menu still works because it belongs to the reloaded worker.

Changes:

- Disabled the floating button while a save request is in flight.
- Added explicit error handling around `chrome.runtime.sendMessage`.
- The button now displays `Refresh page` when its extension context was
  invalidated or `chrome.runtime` is unavailable, and `Try again` for other
  save failures.
- Refreshing the affected LLM tab reinjects the active content script and
  restores the normal click-to-collect path.

Verification:

- `npm run build` completed successfully.
- Plasmo's existing optional `svgo` notice remains non-blocking.

### Automated Presentation Regression Tests

Vitest was added as the first persistent automated regression layer for the
capture presentation boundary.

Coverage:

- A long Collect remains compact after `userThought` is added.
- A long manual Keep is not misclassified as a long Collect.
- Structured title, preview, and table metadata survive presentation.
- Copy uses stored structured Markdown instead of flattened text.
- Quick thought plus source produces the agreed two-section Markdown.
- Manual Keep is copied once without duplicate content.

Commands:

- `npm test`: 1 test file, 6 tests passed.
- `npx tsc --noEmit`: passed.
- `npm run build`: passed.

Test setup note:

- The first run did not execute assertions because Vitest does not inherit
  Plasmo's `~` aliases automatically. Test imports now use relative paths;
  production imports remain unchanged.
- Installing Vitest reported 70 dependency audit findings (3 moderate, 67
  high). No automatic audit fix was applied because forced dependency upgrades
  are outside this feature's scope and may be breaking.
- Plasmo's existing optional `svgo` notice remains non-blocking.

### Compact Card Action Row

The first Copy placement reduced the text column width, especially on long
cards in the narrow side panel.

Changes:

- `EchoCardActions` now owns the Copy, Pin, and Delete group.
- Normal cards place the group beside source/time metadata below the body.
- Long cards place it at the right side of the Markdown/source command row.
- The group wraps as one unit on narrow widths and no longer reserves space
  inside the title or content column.

Verification:

- `npm run build` completed successfully.
- Plasmo's existing optional `svgo` notice remains non-blocking.

Follow-up layout correction:

- The visible metadata/footer placement was too heavy in the narrow panel.
- Both card types now use the same absolute top-right hover zone.
- The action group is hidden unless that corner is hovered or keyboard focus
  is inside it.
- The hover zone reserves no content width and does not change card height.
- Production build completed successfully after the correction.

### Long Collect With A Quick Thought

Regression: adding `userThought` caused a long Collect to leave
`LongEchoCard` and render its entire source body through the normal card. The
presentation rule had treated every record with `userThought` as a manual
Keep.

Fix:

- Manual Keep remains identified by `triggerText === userThought`.
- A Collect with a distinct source quote remains eligible for long-content
  presentation after a thought is added.
- `LongEchoCard` shows the user's thought first and keeps the source title,
  preview, metadata, Markdown expansion, and original-position action below.

Verification:

- Production build completed successfully.
- Regression cases checked in the presentation rule: long Collect plus a
  distinct `userThought` stays compact; long manual Keep remains a normal card.

### Copy Echo As Markdown

Every Echo card now exposes Copy as a persistent high-frequency action while
Pin and Delete retain their existing hover behavior.

Clipboard contract:

- Structured Collect copies the deterministic Markdown stored in
  `capture.markdown`.
- Plain Collect and manual Keep fall back to `triggerText`.
- A Collect with `userThought` produces `## 想法`, then `## 来源片段` with the
  original Markdown.
- Manual Keep is copied once without duplicating its identical
  `triggerText`/`userThought`.

Implementation:

- `echoClipboardMarkdown` is the single formatter for all card types.
- `CopyEchoButton` owns Clipboard API access and temporary Copy/Check feedback.
- Normal and long cards share the same component and output contract.

Verification:

- `npm run build` completed successfully.
- Plasmo's existing optional `svgo` notice remains non-blocking.
- Reproduced the stale-script failure in the user's open Gemini tab:
  `chrome.runtime` was unavailable, so the message never reached the worker.
- Opened a fresh supported Grok page and verified selection, floating-button
  click, `Saved to Echo` feedback, and background persistence with no console
  errors.

### Preserve Paragraphs In Collected Text

Large selections spanning multiple paragraphs were stored as one continuous
block on some LLM pages.

Cause:

- `Selection.toString()` and Chrome's context-menu `selectionText` do not
  reliably preserve boundaries between block-level elements in every LLM DOM.
- Card rendering already used `whitespace-pre-wrap`, so the loss happened
  before the Echo reached Dexie.

Changes:

- Added DOM Range-based selection extraction in the content script.
- Paragraphs, headings, list items, block quotes, table rows, and `<br>`
  elements now contribute line breaks.
- Normalized non-breaking spaces and excessive blank lines before saving.
- The right-click context-menu path now asks the content script for the same
  formatted selection and falls back to Chrome's plain `selectionText` when the
  page script is unavailable.
- Existing Echo records are unchanged; paragraph preservation applies to new
  Collect actions.

Verification:

- `npm run build` completed successfully.
- The generated content script contains the DOM Range parser and the
  `echo:get-selection-capture` message used by the context-menu fallback.
- Plasmo's existing optional `svgo` notice remains non-blocking.

### Prevent Stale Selection Buttons

The floating button appeared to fail again after extension reloads.

Browser verification found two separate causes:

- Reloading an unpacked extension invalidates its running content scripts, but
  an already injected button can remain in the page DOM without a live click
  listener.
- Clicking a live button also bubbled a `mouseup` event to the document
  selection handler, which immediately showed and reset the button again after
  the save started.

Changes:

- Added a stable DOM ID and remove any previous button when a live content
  script starts.
- Ignore document-level `mouseup` handling when the event came from the
  floating button.
- Added a 10-second Web Animation expiry so an abandoned button fades out and
  stops accepting clicks instead of remaining indefinitely.
- Kept the context-menu path as the fallback while an old page still needs a
  refresh after an unpacked extension reload.

Verification:

- Reproduced a listener-less stale button in the user's Grok tab.
- Reloaded that tab, selected text again, and verified the live script saved
  successfully with the `Saved to Echo` confirmation and no console errors.
- `npm run build` completed successfully for the lifecycle changes.
- Plasmo's existing optional `svgo` notice remains non-blocking.

### Structured Capture Envelope

Long content support was implemented as one versioned capture envelope instead
of adding unrelated fields for each content type.

Architecture:

- `capture/types.ts`: versioned data contract shared by capture, persistence,
  presentation, and navigation.
- `capture/serializer.ts`: deterministic plain-text and Markdown conversion for
  paragraphs, headings, emphasis, links, lists, quotes, code, and tables.
- `capture/title-resolver.ts`: high-confidence semantic title and separate
  one-sentence preview.
- `capture/anchor.ts`: provider message ID and generic text-quote anchor
  creation, exact and high-confidence fuzzy DOM lookup, scrolling, and
  temporary highlighting.
- `capture/selection.ts`: the only selection orchestration entry point.
- `lib/echo-presentation.ts`: centralized long/structured presentation rules.
- `components/LongEchoCard.tsx`: compact card, Markdown viewer, and
  open-original-position command.

Compatibility rules:

- `triggerText` remains the canonical plain-text fallback and existing records
  require no migration.
- New Collect records optionally add `capture.version = 1`.
- Floating-button and context-menu capture use the same selection envelope.
- Context-menu capture falls back to Chrome's plain selection when the content
  script is unavailable.
- Missing semantic headings use `Long capture from {source}`; the first
  meaningful sentence remains a preview and is never promoted to a fake title.
- Existing long records without capture metadata still receive a compact card
  and best-effort source anchor.
- A failed anchor does not block opening the source conversation.
- No raw HTML is persisted.
- No Obsidian routing or automatic knowledge-base decision was added.

Presentation rules:

- External Collects become compact when they exceed 360 characters, exceed
  eight lines, contain a table or code block, or contain more than four list
  items.
- Manual Keep notes retain the existing card behavior.
- Markdown is opt-in and scrollable; structured content is never expanded by
  default in the list.

Verification:

- `npm run build` completed successfully after the capture envelope,
  presentation layer, and anchor navigation were integrated.
- A second production build passed after table plain-text separation and
  nearby-heading distance limits were added.
- Plasmo's existing optional `svgo` notice remains non-blocking.

### Cross-provider Anchor Reliability

Real-page verification found three distinct behaviors:

- Gemini retained the selected text and accepted the original direct locator.
- Grok retained the full text, but its SPA replaced the document after the
  background worker had already delivered the locator message.
- ChatGPT changed both the stored message ID and nearby wording, so neither the
  provider ID nor an exact quote was stable enough by itself.

The locator now uses one provider-neutral recovery path:

- The background worker stores a pending anchor in `chrome.storage.session`
  before opening the source tab.
- Each freshly initialized content script asks for that tab's pending anchor,
  so a SPA document replacement cannot permanently lose the request.
- Matching tries provider ID, exact quote, then token-based fuzzy similarity
  with a conservative threshold.
- A successful match clears the pending task; failed tasks expire after 24
  hours.
- Source URLs are opened without Text Fragment suffixes because dynamic LLM
  applications may consume or race against fragment navigation.

No Grok-, ChatGPT-, or Gemini-specific selector branch was added.

Verification:

- `npm run build` completed successfully.
- The saved ChatGPT title matched its changed DNA teaching-design section at
  `0.522`, above the conservative `0.48` fuzzy threshold.
- Grok and ChatGPT still require extension reload and end-to-end user retest.

### Optional Thought After Collect

Collect now offers a quiet, optional one-line note immediately after saving.
This extends the existing record instead of creating a second Echo.

Behavior:

- The Collect response returns the newly created `echoId`.
- Floating-button and context-menu capture both show the same prompt.
- The prompt is visible for eight seconds, does not auto-focus, and disappears
  without changing the saved `raw` Echo when ignored.
- Typing pauses expiry. Enter or Save writes `userThought` to the exact record
  and changes its status to `confirmed`; Escape dismisses it.
- Empty thoughts are rejected. Failed writes preserve the input and expose a
  Retry action.
- A second Collect does not replace an active prompt that already contains
  unsaved text.

Architecture:

- `db/echoes.ts` owns the ID-based `addUserThought` update.
- `background.ts` returns the created ID, validates thought updates, persists
  them, and emits the existing list-change notification.
- `contents/llm-context.ts` owns only the temporary page-level interaction.
- No schema migration is required because `userThought` and `confirmed`
  already exist in the Echo model.

Verification:

- `npm run build` completed successfully.
- Plasmo's existing optional `svgo` notice remains non-blocking.
