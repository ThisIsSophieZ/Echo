# RAG Lab Retrieval Baseline

## Context

Before adding answer generation or an LLM judge, the Lab needs to know whether Echo's current product BM25 can retrieve the evidence required by the six public Dev questions.

The product retriever was designed for quiet contextual resurfacing. It requires strong lexical evidence before showing anything to the user. A RAG retriever has a different job: propose evidence candidates for a later sufficiency and citation check.

## Decision

Run the unchanged product `analyzeRelatedEchoes` path as the first retrieval baseline. Do not loosen the production gate and do not run the frozen Holdout yet.

## Why

This gives us an honest reference point. Rewriting or relaxing BM25 before measuring it would hide whether the existing product behavior fits question-answer retrieval.

Rejected alternatives:

- Do not use an LLM judge before retrieval results exist.
- Do not report Dev questions as final accuracy.
- Do not tune against the frozen Holdout.
- Do not change Echo's production recall behavior to improve an isolated RAG experiment.

## Results

Run conditions: six Dev questions, committed 55-Echo public fixture, product BM25 top three, warm local process, no generator.

| Signal | Result |
| --- | ---: |
| Average required-evidence coverage | 20.0% |
| Questions with all required evidence | 1 / 5 answerable questions |
| Questions with at least one required evidence | 1 / 5 answerable questions |
| Retrieval silence on the abstention question | 1 / 1 |
| Questions exposing a labeled hard negative | 1 / 6 |
| Warm latency average / p50 / p95 | 20.0 / 19.5 / 21.1 ms |

Per-question interpretation:

- **D01:** returned the deprecated Collect hypothesis (`e49`) and missed all three current decision records.
- **D02:** returned supporting evidence about generic Chinese-token noise (`e33`) but missed both required precision-first records.
- **D03:** correctly retrieved the MV3 write-recovery record (`e25`).
- **D04:** stayed silent and missed both local-first/backend-boundary records.
- **D05:** correctly stayed silent for the unsupported paying-user question.
- **D06:** stayed silent and missed the Apple disambiguation record.

## Trade-off

The result is poor for RAG evidence coverage but consistent with the product's conservative interruption policy. Relaxing the product gate might improve candidate recall while creating more false surfaces in Echo itself.

Therefore this baseline does **not** show that product BM25 is broken. It shows that a surface gate and a RAG candidate retriever have different responsibilities.

## Implementation Boundary

The next experiment may add a retrieval adapter inside `experiments/echo-rag-evaluation/` that can inspect a broader lexical candidate set. It must:

- leave `extension/lib/echo-related.ts` unchanged;
- keep hard-negative exposure visible;
- pass candidates to a later evidence-sufficiency step rather than surface them directly;
- tune only on the six Dev questions;
- freeze the adapter before the first Holdout run.

Generated per-query JSON and Markdown remain ignored under `artifacts/`.
