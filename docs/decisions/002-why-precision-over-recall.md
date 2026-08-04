# 002 - Why Echo Prefers Precision Over Recall

- **Status:** Accepted
- **Decision date:** 2026-07-06

## Context

Echo is meant to return an old thought without interrupting the user's current reasoning. A missed suggestion is invisible; an irrelevant suggestion consumes attention and weakens trust in future results.

The first lexical probe treated generic overlapping terms as strong evidence and surfaced too many candidates.

## Evidence

An audit of 16 copied Probe reports recorded 1,493 candidate scans and 256 accepted candidates:

- 139 accepts matched only one term.
- 250 of 256 had no consecutive phrase evidence.
- 252 of 256 were strongest in the captured source text rather than the user's own thought.
- 76 candidates scored at least 60 from one term without a phrase.

The underlying audit and resulting rules are preserved in the [Phase 2 product discussion](../product-discussion-phase2.md) and [extension development log](../../extension/DEVELOPMENT.md).

## Decision

Use BM25 as a precision-first evidence gate, not as calibrated semantic confidence. Never surface a one-term match. Require an eligible phrase or at least three eligible terms in the same strongest field, downgrade corpus-common terms, suppress duplicates, and expose rejection reasons in diagnostics.

## Consequences

- False surfaces and interruption risk decrease.
- Paraphrases without shared lexical evidence are often missed.
- An empty result is a valid product decision, not automatically a retrieval failure.
- Scores must be described as lexical evidence, not semantic similarity or confidence.

## Revisit Criteria

Relax the gate only when a labeled dogfood set shows a measurable recall gain without worsening false surfaces or abstention accuracy. User feedback must distinguish `wrong_time` from `not_relevant` before either signal changes ranking behavior.
