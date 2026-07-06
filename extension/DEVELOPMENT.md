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

### Minimal Local Search

Added the first explicit, on-demand recall path without changing persistence.

Behavior:

- The bottom Search icon switches the side panel from Home to Search.
- Search filters the Echo array already loaded from Dexie in real time.
- Matching includes `triggerText`, `userThought`, `inferredThought`, `title`,
  and `sourceApp`.
- Search text uses Unicode NFKC normalization, lowercase comparison, and
  whitespace-separated AND terms.
- Results preserve the database's existing newest-first order.
- Closing Search or pressing Home clears the query and restores Keep, filter
  chips, and the normal list.
- The top `+` button now also returns to Home and focuses the Keep composer.

Scope:

- No Dexie schema or IndexedDB migration.
- No search dependency, fuzzy matching, ranking, vectors, or AI.
- The current in-memory scan is intentionally sized for the prototype's
  dozens of Echoes.
- Pure normalization and matching live in `lib/echo-search.ts`; the side panel
  only owns view and query state.

Verification:

- `npx tsc --noEmit --incremental false` completed successfully.
- `npm test` completed successfully: 2 files, 10 tests.
- Search tests cover Chinese substring matching, case and Unicode width
  normalization, multi-term AND matching, and optional thought/source fields.
- `npm run build` completed successfully.
- Plasmo's existing optional `svgo` notice remains non-blocking.

### Explainable Keyword Search Ranking

Improved Search without AI, embeddings, vectors, fuzzy matching, or a new
database index.

Ranking:

- All whitespace-separated terms must still match somewhere in the Echo.
- Field weights prioritize `userThought`, capture/page title,
  `inferredThought`, `triggerText`, then `sourceApp`.
- An exact normalized phrase and a same-field multi-term match receive
  additional deterministic boosts.
- Equal scores fall back to `createdAt` descending.
- Empty queries remain a newest-first list.

Visible matches:

- Search returns the strongest matching field, a human-readable label, and a
  compact snippet around the first term.
- Normal and long cards show the hint only when that matching field is not
  already visible, avoiding duplicate text.
- Structured capture titles participate in title search.

Interaction:

- `/` opens Search when focus is not inside an input, textarea, or editable
  region. This avoids Chrome's reserved address-bar shortcuts.
- `Escape` closes Search and clears the query.
- The existing Home, close, and top `+` paths remain unchanged.

Architecture:

- `lib/echo-search.ts` owns normalization, ranking, tie-breaking, and snippets.
- `components/EchoSearchMatch.tsx` owns the shared result hint.
- Cards only decide whether their existing presentation already exposes the
  strongest match.

Verification:

- `npx tsc --noEmit --incremental false` completed successfully.
- `npm test` completed successfully: 2 files, 15 tests.
- `npm run build` completed successfully.
- Plasmo's existing optional `svgo` notice remains non-blocking.

### Small Safety And Source-Return Improvements

Added two local safety nets without changing the Echo schema:

- The Keep composer restores its unfinished draft through
  `chrome.storage.local`. Draft writes are debounced, saving clears the draft,
  and initial hydration is guarded so an empty first render cannot erase it.
- Delete keeps the most recent removed Echo in memory for five seconds and
  exposes Undo. Undo writes the original record back with `Dexie.put`, retaining
  its ID, timestamp, status, capture metadata, and list position.

Improved `Open original position` as a layered locator:

1. Reuse and focus an already-open tab with the same source URL; otherwise open
   a new tab.
2. Try provider-specific message containers for ChatGPT, Claude, Gemini, and
   Grok.
3. Fall back to historical `data-message-id`, exact text, and high-confidence
   fuzzy text matching.

Architecture:

- `capture/provider-anchor.ts` owns provider detection, selectors, capture-time
  message identity, and provider lookup.
- `capture/anchor.ts` owns the shared text quote and fallback algorithm.
- Provider metadata is nested inside the existing optional capture object, so
  no Dexie schema migration is required.
- Legacy provider anchors remain readable through optional `attribute` and
  `value` fields.

This separation is intentional: an LLM DOM change should require editing one
provider selector map, not branching the entire capture or navigation flow.

Verification:

- `npx tsc --noEmit --incremental false` completed successfully.
- `npm test` completed successfully: 2 files, 15 tests.
- `npm run build` completed successfully; the existing optional `svgo` notice
  remains non-blocking.
- A live Grok conversation exposed 18 `data-testid` message containers
  (`user-message` / `assistant-message`), which the Grok adapter matches.
- ChatGPT, Claude, and Gemini still require live end-to-end retesting after the
  unpacked extension is reloaded.

### Quiet Collect And Optional Card Thoughts

Removed the post-Collect quick-thought prompt after product review identified
it as the remaining forced-recording interaction.

Collect feedback:

- Floating-button and context-menu Collect now show only a 1.6-second,
  pointer-transparent toast: `已保存 · 来自 {source}`.
- The background response carries the already-detected `sourceApp`; the content
  script only formats the label and animation.
- The old page-level input, expiry state, and `echo:add-user-thought`
  background message path were removed.

Optional thought:

- Raw cards expose a `MessageSquarePlus` action beside Copy, Pin, and Delete.
- The editor remains collapsed until explicitly requested.
- Saving calls the existing Dexie `addUserThought` method in the side panel,
  updates the same record to `confirmed`, refreshes the list, and emits the
  existing list-change notification.
- No new field, table, index, status, or migration was added.

Search and empty states:

- Search results now carry their normalized terms alongside the strongest
  match.
- A shared `SearchHighlight` component marks matching text in visible card
  bodies, structured titles, previews, and hidden-field snippets.
- Empty Home and Search states now use short, actionable Chinese copy.

Verification:

- `npx tsc --noEmit --incremental false` completed successfully.
- `npm test` completed successfully: 2 files, 15 tests.
- `npm run build` completed successfully; the existing optional `svgo` notice
  remains non-blocking.
- Source search confirmed that the removed page input and runtime message paths
  remain only as historical documentation references.

### Phase 2 Reflection Probe v0

Started Phase 2 as a deliberately small, falsifiable selection-recall
experiment.

Context flow:

- `contents/llm-context.ts` publishes `echo:selection-context` after a user
  selection changes on a supported LLM page.
- The message contains only the temporary plain text and source URL. It is not
  written to storage and does not leave the browser.
- An open side panel listens for the message; when no panel is listening, the
  content script silently continues.
- Clearing the page selection clears the temporary recall context.

Relevance:

- `lib/echo-related.ts` owns normalization, English word extraction, Chinese
  bigrams, deterministic field weights, thresholding, explanations, and the
  three-result limit.
- `userThought` ranks above title, `inferredThought`, and `triggerText`.
- Weak one-token overlap is suppressed.
- An Echo whose normalized source exactly equals the selection is excluded to
  prevent self-recall.
- No AI, embeddings, vector index, network request, or schema migration.

Presentation:

- `components/RelatedEchoSection.tsx` renders one unframed, collapsed row above
  the normal list only when results clear the threshold.
- Expanding is always explicit and shows the existing Echo cards plus a
  human-readable match reason.
- A changed selection remounts the section in its collapsed state.
- Existing Copy, Pin, Delete, Open original, and Add thought actions are reused.

Verification:

- `npx tsc --noEmit --incremental false` completed successfully.
- `npm test` completed successfully: 3 files, 20 tests.
- Focused tests cover English and Chinese tokenization, explainable overlap,
  weak-match suppression, exact-source exclusion, ranking, and result limits.

### Reflection Probe Diagnostics

Added visible, temporary instrumentation before changing the v0 relevance
algorithm.

- `analyzeRelatedEchoes` evaluates every Echo once and returns both accepted
  results and candidate diagnostics.
- Diagnostics retain raw score, strongest field, matched terms, acceptance,
  and a stable rejection category.
- Rejection categories are: empty selection, too few query tokens, exact
  source, no overlap, and below threshold.
- `ProbeDebugPanel` is collapsed by default and remains visible on Home even
  when no candidate passes, making message-delivery failures distinguishable
  from ranking failures.
- The expanded panel shows the received selection, extracted tokens, scanned
  and accepted counts, and up to five ranked candidate explanations.

The scoring formula and threshold were intentionally left unchanged in this
step. Diagnostics must reveal the failure mode before v0.1 replaces the
algorithm; otherwise tuning becomes another set of unexplained constants.

Verification:

- `npx tsc --noEmit --incremental false` completed successfully.
- `npm test` completed successfully: 4 files, 25 tests.
- The new regression test distinguishes below-threshold overlap from a true
  no-overlap rejection.

### Lexical Relevance Baseline A

Replaced the failed character-bigram accumulation formula after live dogfood
produced confident matches from generic fragments such as `实用`, `这个`, and
`快速`.

Tokenization and corpus selection:

- `Intl.Segmenter("zh-CN", { granularity: "word" })` handles mixed Chinese and
  English text without a new dependency.
- A small stop-word set removes pronouns, connectors, and generic adjectives.
- Three- and four-character fallback terms are generated only for unusually
  long unsplit Chinese segments.
- Query terms must occur in the existing Echo corpus.
- IDF keeps at most 16 informative terms, so a 274-token selection cannot gain
  score merely by being long.

Scoring:

- Standard BM25 term saturation and field-length normalization use `k1 = 1.2`
  and `b = 0.75`.
- Field multipliers are intentionally narrow: `userThought 1.3`, title `1.15`,
  source `1.0`, inferred thought `1.0`.
- Only the strongest field contributes to an Echo's final score. Repeated
  evidence across title and source is not added twice.
- Consecutive query terms in the same field receive a modest phrase bonus.
- Raw BM25 is mapped to a `0–100` confidence score.
- Confidence `>= 60` is strong, `30–59` is possible, and lower evidence is
  hidden. Both accepted tiers remain collapsed.
- Exact text is suppressed only when the Echo URL matches the current page.

Explanation and regression:

- Explanations state either that the same token sequence occurred or that
  concrete terms overlap; they do not claim semantic similarity.
- A regression reproduces the long checklist/native-English selection from
  dogfood. The specific checklist Echo passes while generic `实用/这个/快速`
  cards remain hidden.

Verification:

- `npx tsc --noEmit --incremental false` completed successfully.
- `npm test` completed successfully: 4 files, 27 tests.

### Per-Echo BM25 Debug Ledger

Expanded the temporary Probe instrumentation from a top-five summary into a
complete, scrollable score ledger for every scanned Echo.

Each candidate now records:

- strongest matching field and its multiplier;
- field token length and corpus average for that field;
- lexical BM25 subtotal and consecutive-phrase bonus;
- raw weighted score and normalized `0–100` confidence;
- per-term frequency, IDF, and BM25 contribution;
- matched phrase, final acceptance, or explicit rejection reason.

Zero-overlap candidates also state the query corpus terms, zero BM25 evidence,
and absence of a phrase match. This keeps the diagnostic useful when nothing
surfaces and makes every high score auditable instead of merely labeled.

### Copyable Probe Report

Reduced manual dogfood recording to one explicit action:

- `lib/probe-report.ts` converts the current analysis into stable Markdown.
- The report includes the selection, corpus terms, scanned and accepted totals,
  candidate IDs, decisions, confidence, explanations, matches, and full score
  ledgers.
- `ProbeDebugPanel` exposes `复制报告` only after a selection is available.
- Successful copy shows `已复制`; clipboard failures show a temporary error.
- Nothing is automatically stored, uploaded, or added to the Echo database.

Verification:

- The formatter has a deterministic timestamp injection for focused tests.
- Its regression test checks selection, totals, acceptance, confidence, and
  BM25 ledger output.

Report compaction:

- Confidence-zero candidates are omitted from detailed output and retained as
  a single `Zero evidence` summary count.
- Non-zero evidence remains sorted by the analysis ranking.
- Each report has timestamped `ECHO_PROBE_REPORT_START/END` markers.
- A fixed summary table makes several reports easy to compare after pasting
  them into one conversation.
- Single-line Echo labels prevent captured paragraph breaks from corrupting
  report headings.

### Precision-First Lexical Gate

Audited 16 copied Probe reports containing 1,493 candidate scans:

- 256 candidates were accepted, averaging 16 per selection and peaking at 30.
- 139 accepted candidates used only one matched term.
- 250 of 256 had no consecutive phrase.
- 252 of 256 used `triggerText` as the strongest field.
- 76 candidates scored at least 60 from one term with no phrase.

The BM25 scorer is now a high-precision candidate gate rather than a standalone
relatedness judge.

Eligibility:

- A single term never surfaces, regardless of IDF.
- Two eligible content terms are recorded as `possible-only` in diagnostics.
- Surfacing requires an eligible consecutive phrase or at least three eligible
  terms in the same strongest field.
- Tier 2 terms contribute `0.35` to ranking but never count toward eligibility.
- In corpora of at least 10 Echoes, terms present in over 20% of documents are
  automatically treated as Tier 2.

Ranking safety:

- BM25 field length is clamped to at least half the corpus field average,
  limiting extreme boosts for four- or eight-token Echoes.
- Identical normalized thought/source content is deduplicated after ranking;
  suppressed candidates remain visible in diagnostics with a `duplicate`
  reason.
- The displayed number is described as lexical evidence rather than calibrated
  confidence.

Regression coverage:

- one-term rejection;
- two-term debug-only behavior;
- three-term surfacing;
- Tier 2 terms not granting eligibility;
- duplicate suppression;
- small-corpus frequency-tier cold-start behavior.

### Anchor v2: Persistent Message Identity

Replaced capture-time DOM ordering with persistent, layered message identity.
New anchors never write or read `messageIndex`.

Capture:

- A provider-native attribute is stored only when its value is unique in the
  current document. Candidate attributes include `data-message-id`,
  `data-turn-id`, and provider-specific stable IDs.
- Message text is normalized with Unicode NFKC, zero-width removal, emoji
  removal, NBSP replacement, and whitespace compaction.
- Web Crypto SHA-256 hashes the full normalized message plus its first and last
  320 characters. The first 12 digest bytes are stored as 24 hex characters.
- Previous and next message fingerprints, role, and capture time are stored
  when available.
- `capture.anchor.version` is `2`; the outer Echo/Dexie schema remains
  unchanged.

Lookup order:

1. Unique provider-native ID.
2. Exact full-message fingerprint.
3. Matching head/tail fingerprints with at most 8% length drift.
4. Neighboring fingerprints to disambiguate repeated messages.
5. Exact provider-container text.
6. Shared `exactStart`, `exactEnd`, `prefix`, and `suffix` scoring.
7. Historical high-confidence token similarity fallback.

Long-context behavior:

- If no rendered message matches, the provider adapter moves its scroll root
  upward every second lookup pass and retries as virtualized history loads.
- Lookup allows up to 80 passes at 300 ms intervals.
- Once the message is identified, the locator selects the matching paragraph
  inside that message before scrolling and highlighting.
- Failure still opens the correct conversation and returns `found: false`;
  low-confidence candidates are never forced.

Compatibility:

- Existing `messageId`, `attribute`, and `value` anchors remain readable.
- Historical runtime `messageIndex` data is ignored.
- No IndexedDB migration or new dependency is required.

Verification:

- `npx tsc --noEmit --incremental false` completed successfully.
- `npm test` completed successfully: 4 files, 24 tests.
- Fingerprint tests cover canonical normalization, deterministic truncated
  SHA-256 output, changed-content rejection, and head/tail length tolerance.
- `npm run build` completed successfully; the existing optional `svgo` notice
  remains non-blocking.
