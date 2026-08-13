# Candidate BM25 Dev Result

## Context

The unchanged product BM25 surface gate retrieved all required evidence for only 1 of 5 answerable Dev questions. It was designed to decide whether an Echo should interrupt the user, not to assemble a broader evidence set for RAG.

## Decision

Add an experiment-only `candidate-bm25` adapter. It keeps up to five candidates that have lexical overlap, including candidates rejected by the product surface gate. Extension code and product behavior remain unchanged.

## Why

The adapter reuses the same product tokenization, BM25 scoring, and diagnostics. It broadens candidate selection without adding question-specific synonyms or rewriting the retrieval algorithm.

We rejected lowering the production surface gate because RAG candidates are reviewed by a later evidence-sufficiency step, while product surfaces appear directly in the user's attention.

## Results

| Dev signal | Product gate | Candidate BM25 |
| --- | ---: | ---: |
| Average required-evidence coverage | 20.0% | 76.7% |
| All required evidence retrieved | 1 / 5 | 3 / 5 |
| At least one required evidence retrieved | 1 / 5 | 5 / 5 |
| Retrieval silence on abstention question | 1 / 1 | 0 / 1 |
| Questions exposing a labeled hard negative | 1 / 6 | 2 / 6 |
| Warm average latency | about 20 ms | about 19 ms |

The broader adapter recovered both required precision-first records for D02, preserved the correct D03 result, recovered the privacy/backend decision partially for D04, and found the Apple disambiguation evidence for D06.

It still missed two of three required records for D01 and one of two for D04 because those records share too little literal language with the questions. It also returned adjacent material for the unsupported paying-user question and exposed the apple-pie hard negative for D06.

## Trade-off

Candidate recall improved substantially, but silence and precision decreased. This is acceptable only inside the isolated RAG pipeline, where generation must check evidence sufficiency, cite claims, and abstain when retrieved material cannot support an answer.

The result does not justify relaxing Echo's production gate.

## Implementation Boundary

Freeze this Dev candidate rule at Top-5 candidates with non-zero lexical evidence. Do not tune it on Holdout. The next phase may compare `No Context` and `candidate-bm25` generation on Dev, with claim-level citations and explicit abstention.
