# 003 - Why Vector Recall Is Not Shipped

- **Status:** Accepted for the current product; experiment remains open
- **Decision date:** 2026-08-03
- **Last reviewed:** 2026-08-11

## Context

Lexical retrieval misses paraphrases, so semantic embeddings were a reasonable candidate for improving recall. Echo's product constraint, however, is not maximum retrieval coverage. It is useful recall with a strong ability to remain silent.

## Evidence

The offline harness compared product BM25, raw multilingual-e5-small cosine retrieval, and a gated hybrid on the same constructed 55-Echo / 40-query fixture:

| Strategy | P@3 | R@3 | False surfaces /100 | Abstention accuracy |
| --- | ---: | ---: | ---: | ---: |
| Product BM25 + gate | 28.7% | 25.8% | **5.0** | **80%** |
| Raw vector top-3 | 32.5% | **76.3%** | 17.5 | 0% |
| Gated hybrid | 25.0% | 59.6% | 7.5 | 60% |

The reproducible method, limitations, and full output are in the [benchmark README](../../evals/recall-benchmark/README.md) and [conclusions](../../evals/recall-benchmark/data/CONCLUSIONS.md).

A later private dogfood holdout (91 unique Echoes, 21 model-assisted labeled
queries) confirmed the quality trade-off. Raw vector improved R@3 from 34.9%
to 46.4%, but neither BM25 nor raw vector abstained correctly. A dev-tuned
guarded hybrid correctly abstained on 5/5 holdout cases and made 9/9 useful
surfaces, while recovering only 9/16 expected-surface queries. These are small,
single-user denominators and support continued experimentation, not a general
accuracy claim.

Browser feasibility added a separate no-ship constraint:

| Runtime signal | Observed on one Chrome/Windows machine |
| --- | ---: |
| Required model + tokenizer + JS + WASM | 139.5 MiB |
| Cached pipeline initialization | about 1.7 s |
| Warm query p50 / p95 | about 11 / 13-14 ms |
| Encode 55 public fixture Echoes | about 1.3 s |
| User-agent-specific page memory delta | about 418 MiB |

The full method and limitations are in the [browser feasibility report](../../experiments/browser-vector-feasibility/REPORT.md).

## Decision

Keep product BM25 with its precision gate. Keep vector and hybrid retrieval
inside offline evaluation. Do not bundle or eagerly initialize the current
embedding model in the extension mainline. A future trial requires a materially
smaller model or an explicitly optional, lazy-loaded architecture, plus a new
independent quality holdout.

## Consequences

- The product intentionally misses some semantic paraphrases.
- It avoids embedding cold start, model distribution, additional storage, and semantic false surfaces in the browser.
- The experiment still demonstrates where vectors help and where cosine similarity fails as a confidence signal.
- This is a measured no-ship decision, not a claim that lexical retrieval is universally superior.

## Revisit Criteria

Reconsider a hybrid product experiment only when a candidate materially lowers
asset and memory cost, preserves guarded precision on a newly collected
holdout, and keeps model initialization outside the side-panel interaction
path. Report first use, cached initialization, corpus encoding, warm query, and
memory separately.
