# 001 - Why Echo Is Local-First

- **Status:** Accepted
- **Decision date:** 2026-06-20; reaffirmed 2026-08-04

## Context

Echo captures personal judgments and source passages from LLM conversations. Uploading that material by default would create a privacy obligation before synchronization or collaboration has demonstrated enough user value to justify it.

The current product is a personal Chrome side panel. Its core loop does not require accounts, team spaces, or cross-device state.

## Evidence

- The extension already provides the full capture, search, recall, and source-return loop using Dexie / IndexedDB.
- Chrome MV3 lifecycle failures are handled locally through a small `chrome.storage.local` pending-write queue.
- Backup and recall-trace exports are explicit user actions rather than background uploads.
- The [privacy and threat model](../privacy-threat-model.md) records the local data flow, Chrome permission rationale, mitigations, and residual risks.
- The product boundary repeatedly rejects cloud infrastructure that does not solve a validated user problem. See the [product boundary](../product-boundary.md) and [development log](../../extension/DEVELOPMENT.md).

## Decision

Store Echo content locally by default. Do not add authentication, cloud storage, or third-party model calls for interview completeness. Data may leave the browser only through an explicit user export or a future feature with a separately reviewed privacy contract.

## Consequences

- Private conversation content has a smaller default exposure surface.
- The product remains usable without network latency or API cost.
- Uninstalling the extension can delete IndexedDB data, so explicit backup and restore remain necessary.
- Cross-device sync, collaboration, server-side observability, and multi-tenant controls are intentionally absent.

## Revisit Criteria

Revisit this decision only when a validated workflow requires cross-device access, encrypted synchronization, or team collaboration. Any proposal must define encryption, retention, deletion, access control, failure recovery, and user consent before implementation.
