# Privacy and Threat Model

Echo stores passages and personal notes from LLM conversations, so privacy is part of the product architecture rather than a deployment detail.

## Data flow

1. A content script starts from the passage the user explicitly selects on a supported LLM page and reads the surrounding message structure needed to derive source-anchor metadata.
2. The Chrome extension routes that capture to the side panel and stores the Echo in Dexie / IndexedDB inside the current browser profile.
3. Search, BM25 recall, abstention, and Probe diagnostics run locally against that database.
4. Data leaves extension storage only through an explicit backup, report, trace, or copy action initiated by the user.

The extension runtime has no model API or application-backend dependency. Vector retrieval and grounded-generation experiments run separately under `experiments/` and are not bundled into the product path.

## Permission rationale

| Permission | Why Echo needs it |
| --- | --- |
| `activeTab` | Read the user's explicit selection and page context for capture. |
| Supported-site host permissions | Run capture and source-return adapters on ChatGPT, Claude, Gemini, and Grok pages. |
| `contextMenus` | Offer the explicit “Add to Echo” selection action. |
| `sidePanel` | Present Collect, Keep, Search, recall, and export controls beside the current workflow. |
| `storage` | Recover drafts, pending writes, and pending source anchors across MV3 lifecycle interruptions. |
| `tabs` | Reuse or open the saved source conversation and deliver the anchor to the matching tab. |

## Main risks and mitigations

| Risk | Current mitigation |
| --- | --- |
| Accidental capture from an editable or sensitive field | Capture guards reject editable elements and password-like fields; saving still requires an explicit user action. |
| A weak source match opens the wrong message | Anchor resolution uses provider IDs, fingerprints, neighboring-message evidence, text context, and an explicit failure path instead of forcing a low-confidence jump. |
| MV3 worker suspension drops a user thought | Pending thoughts are first parked in `chrome.storage.local` and replayed when Dexie becomes available. |
| A malformed backup corrupts local data | Imports validate the format and version, normalize each record, skip invalid rows, and upsert inside a Dexie transaction. |
| Debugging exports reveal conversation text | Probe and recall traces are produced locally and exported only on request; the default recall trace omits the full selected passage. |
| Removing the extension or changing Chrome profiles loses data | The side panel provides explicit versioned JSON backup and restore. |

## Residual risks and boundaries

- Anyone with access to the same unlocked Chrome profile may be able to access extension data.
- Exported JSON, copied Markdown, and downloaded traces inherit the security of the destination chosen by the user.
- Supported LLM sites can change their DOM, identifiers, or virtualization behavior; source return therefore remains best effort and fails visibly when confidence is insufficient.
- Echo does not currently provide encrypted sync, accounts, remote deletion, enterprise policy controls, or multi-user isolation.

Any future networked feature must define encryption, retention, deletion, access control, failure recovery, and consent before it enters the product runtime.
