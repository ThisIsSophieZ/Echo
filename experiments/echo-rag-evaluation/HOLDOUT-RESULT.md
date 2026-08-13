# RAG Generation Holdout Result

## Context

The Dev set was used to build the retrieval and generation pipeline, so its
scores cannot be treated as final evidence. This first scored Holdout asks
whether the frozen pipeline generalizes to unseen questions without changing
the prompt, retriever, evaluator, corpus, or model.

The Holdout contains 14 questions: 11 answerable and 3 that require abstention.
It uses the same 55-record public fixture and no private Echo data.

## Decision

Run the frozen `no-context` and `candidate-bm25-rag` conditions once with local
`qwen2.5:32b`. The run was made from freeze commit `483dd94`, after SHA-256
verification of the prompt, scorer, retriever, corpus, and Holdout file.

The Holdout is now spent. These questions must not be used to tune this v1
pipeline. A future material change needs a new Holdout version.

## Why

A separate Holdout reduces the risk of reporting a score that was optimized on
the same six Dev questions. The no-context condition shows whether correct
answers come from supplied evidence rather than unsupported model knowledge.

We report exact counts and limitations instead of claiming general production
accuracy. Automatic checks are followed by manual claim-to-citation review.

## Results

| Holdout signal | No context | Candidate BM25 RAG |
| --- | ---: | ---: |
| Correct answer/abstain behavior | 3 / 14 (21.4%) | 14 / 14 (100.0%) |
| Correct on answerable questions | 0 / 11 | 11 / 11 |
| Correct abstention | 3 / 3 | 3 / 3 |
| Answerable questions citing every required record | 0 / 11 | 9 / 11 (81.8%) |
| Average required-evidence citation coverage | 0.0% | 90.9% |
| Invalid citation IDs | 0 | 0 |
| Uncited generated claims | 0 | 0 |
| Prompt / output tokens | 3,967 / 655 | 7,719 / 1,284 |
| Runtime excluding model load | 127.7 s | 256.1 s |
| Local model load time | 71.8 s | 4.5 s |
| Estimated API cost | $0 | $0 |

The no-context condition got only the three abstention questions right. It
refused all 11 answerable questions because no evidence was supplied.

Candidate retrieval found at least one required record for all 11 answerable
questions. It retrieved all required records for 10 of 11, with average
retrieval coverage of 95.5%. Four questions exposed labeled hard negatives,
and all three abstention questions still received adjacent candidates.

## Human Review

The Candidate RAG condition generated 16 factual claims across 11 answers. All
16 were directly supported by their cited records, and no forbidden claim was
observed. It also abstained correctly on three important traps:

- H11 did not claim that any embedding model is shipped in Echo.
- H12 did not invent production p95 latency or thousands of users.
- H13 did not invent a coffee-roasting temperature from a topic-adjacent note.

Two answers were grounded but incomplete:

- H07 cited the need for a labeled evaluation set, but omitted the second
  expected point: prove hybrid candidate value before adding a reranker.
- H09 explained response caching, but retrieval missed the required record on
  cheap-model routing, so the answer covered only one of two expected tactics.

Hard-negative handling also worked in H08: a superseded Collect idea appeared
in the candidate set, but the answer cited only the record about marking stale
ideas and did not revive the old idea as current guidance.

## Trade-off

The result is strong evidence that the frozen pipeline can answer and abstain
appropriately on this small public benchmark. It is not proof of 100% accuracy
in production. For 14 successes out of 14, the Wilson 95% interval is roughly
78.5% to 100%, which makes the uncertainty from sample size visible.

Seven of the 14 questions require only one evidence record, and the corpus is
small with relatively direct wording. The benchmark does not cover noisy user
documents at scale, long-context synthesis, adversarial prompt injection,
multilingual breadth beyond Chinese and English, model variance, or production
traffic. Local latency on one machine is not a production SLA, and zero API
cost excludes hardware and electricity.

The Holdout score is higher than Dev because this Holdout had stronger lexical
evidence coverage. It should not be interpreted as the system improving after
Dev or as evidence that the Holdout is universally harder.

## Implementation

- Frozen commit: `483dd94`
- Run time: `2026-08-13T07:25:44.215Z`
- Dataset: `echo-rag-holdout-v1`
- Corpus: `2026-08-dogfood-v1`, 55 public records
- Model: local `qwen2.5:32b`, temperature `0`, seed `42`
- Retrieval: Candidate BM25 Top-5 with non-zero lexical evidence
- Raw JSON SHA-256: `e992d9a058d01e2d0a61a2b0288f4b160e2855b94ff3a0efc5d3c4aaa7d8ef4e`
- Detailed records remain in ignored `artifacts/generation-holdout.json` and
  `artifacts/generation-holdout.md`

The interview claim supported by this experiment is narrow: on one frozen
14-question public Holdout, Candidate BM25 RAG improved correct behavior from
3/14 without context to 14/14, with all 16 generated claims manually grounded.
The limitations above must accompany that claim.
