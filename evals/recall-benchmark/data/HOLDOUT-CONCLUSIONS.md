# Real Dogfood Recall Evaluation - 2026-08-11

## Decision

Do not replace product BM25 with raw vector search. Do not ship the existing
lexical-first hybrid. Keep vector retrieval as an experimental candidate and
use a precision-first guarded fusion when prototyping the next product path.

## Data boundary

- Dev: Probe Report 4, 17 model-assisted labeled queries, 66-Echo snapshot.
- Holdout: Probe Report 5, 21 model-assisted labeled queries, 91 unique Echoes.
- The exported holdout had 92 rows; one duplicated lifestyle capture was
  deduplicated by normalized text.
- Candidates are time-sliced at each probe timestamp.
- Current-selection self matches are excluded without removing the document
  from BM25 corpus statistics when it existed at query time.
- Private corpus, query text, generated reports, metrics, and vectors remain
  gitignored.

## Credibility and limitations

Treat this as an internal directional benchmark. It is useful for rejecting
weak options and deciding what to test next, but it is not evidence of
production readiness or general retrieval superiority.

- The holdout contains only 21 queries over 91 unique Echoes. One query moves
  a query-level rate by about 4.8 percentage points. In particular, 100%
  abstention is 5/5 cases and zero false guarded surfaces is 9/9 surfaces.
- All data comes from one user's recent dogfood window. It reflects one set of
  topics, writing habits, source sites, and capture behavior, not the target
  user population or a mature large database.
- Language coverage is 13 Chinese or Chinese-dominant mixed queries, five
  English-only queries, and three English-dominant mixed queries. Many include
  English technical terms. Other languages, colloquial variants, spelling
  noise, and broad monolingual usage are not covered.
- Topics skew toward software engineering, AI/product work, and interview
  preparation, with only a small amount of lifestyle content.
- Labels are model-assisted first-pass judgments, not independently
  double-annotated human gold labels. Ambiguous or missed relevance can move
  every reported retrieval metric.
- Report 4 and Report 5 are separated for threshold selection and evaluation,
  but come from the same user and nearby period. The holdout therefore limits
  direct tuning leakage without providing population-level independence.
- Latency is from one local environment. Warm query latency excludes corpus
  encoding, and browser size, cold start, memory, hardware variation, and
  extension lifecycle costs remain unmeasured.
- No confidence interval or significance test is reported. Numerical
  differences apply only to this fixture.

The evidence supports continued offline experimentation with guarded vector
retrieval. It does not support replacing BM25, shipping the strategy, or
claiming a general accuracy improvement.

## Holdout results

| Strategy | P@3 | R@3 | MRR | False surfaces /100 | Abstention accuracy | Surface queries hit |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| BM25 | 27.0% | 34.9% | 0.421 | 47.6 | 0% | 10 / 16 |
| Raw vector | 30.2% | 46.4% | 0.587 | 38.1 | 0% | 13 / 16 |
| Existing hybrid | 27.0% | 42.9% | 0.492 | 42.9 | 0% | 12 / 16 |
| Guarded hybrid | 42.9% | 29.0% | 0.429 | 0.0 | 100% | 9 / 16 |

`P@3` and `R@3` are macro averages across all 21 queries. Guarded hybrid
surfaces at most one result, so its 42.9% macro P@3 corresponds to 9 surfaced
queries and 9 useful top results, with no false surfaces.

## What changed the decision

1. Raw multilingual E5 recovers useful semantic and cross-language results
   that BM25 misses, including heap semantics, product research, Agent
   workflows, and the lifestyle/medical case.
2. Raw cosine does not provide abstention. Scores cluster tightly around high
   values, so a global `0.82` similarity threshold is not meaningful here.
3. Lexical-first hybrid preserves BM25 false positives and can fill all three
   result slots before a useful vector candidate arrives.
4. A Report 4 dev rule based on strong top-1 agreement and vector score spread
   transfers cleanly to Report 5: no false surfaces and perfect abstention,
   but intentionally lower recall.

## Guarded rule

- Surface one result when BM25 and vector agree on top-1 and BM25 evidence is
  at least 98.
- Otherwise surface vector top-1 only when cosine is at least 0.82 and the
  top-1 versus top-3 spread is at least 0.025.
- Otherwise abstain.

These thresholds were selected on Report 4 before the guarded strategy was
run on Report 5. They must not be tuned further on Report 5.

## Next engineering step

Prototype guarded candidate generation outside the extension UI first. Measure
model size, cold start, warm query latency, and browser memory before any
mainline integration. A later independently collected holdout should confirm
the result before changing product behavior.
