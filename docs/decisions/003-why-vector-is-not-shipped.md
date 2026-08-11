# 003 - Why Vector Recall Is Not Shipped

- **Status:** Accepted for the current product; experiment remains open
- **Decision date:** 2026-08-03

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

## Decision

Keep product BM25 with its precision gate. Keep vector and hybrid retrieval inside the offline evaluation harness. Do not add embeddings, a vector database, reranking, or model calls to the extension mainline based on this fixture.

## Consequences

- The product intentionally misses some semantic paraphrases.
- It avoids embedding cold start, model distribution, additional storage, and semantic false surfaces in the browser.
- The experiment still demonstrates where vectors help and where cosine similarity fails as a confidence signal.
- This is a measured no-ship decision, not a claim that lexical retrieval is universally superior.

## Revisit Criteria

Create a manually labeled, desensitized dogfood dataset. Reconsider a hybrid product experiment only if it beats BM25 on both false surfaces and abstention accuracy while improving useful recall. Report cold and warm latency separately and keep any first experiment behind an explicit product boundary.
