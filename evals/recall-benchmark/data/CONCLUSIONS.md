# Benchmark conclusions (fixture `2026-08-dogfood-v1`)

Generated from `npm run all` on 2026-08-03. Re-run to refresh `data/report.md` / `data/metrics.json`.

## Aggregate

| Strategy | P@3 | R@3 | MRR | False surfaces /100 | Abstention accuracy | Avg latency |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25 (product gate) | 28.7% | 25.8% | 0.288 | **5.0** | **80%** | ~20ms |
| vector (raw cosine top-3) | 32.5% | **76.3%** | 0.792 | 17.5 | 0% | ~6ms warm |
| hybrid (lexical first + gated vector fill) | 25.0% | 59.6% | 0.625 | 7.5 | 60% | ~27ms |

Embedding cold start (multilingual-e5-small): ~8.8s (reported separately from warm latency).

## Ship / abstain decision

**Do not ship raw vector recall into the Echo extension mainline.**

Reasons grounded in this fixture:

1. Vector raises recall on paraphrases, but **false surfaces jump from 5 → 17.5 per 100 queries**, and it never abstains on queries labeled `abstain`.
2. Hybrid recovers some quietness vs raw vector, but still **worsens false surfaces vs product BM25** (7.5 vs 5.0) on this set.
3. Echo's product principle is precision-first / low interruption. Absolute cosine is not confidence when scores crowd.

**Keep** local BM25 + precision-first gate in product. **Keep** this offline harness for future hybrid/rerank experiments. Revisit shipping only after a real desensitized dogfood export beats BM25 on false-surface rate **and** abstention accuracy.

## Fixture honesty

Corpus/queries are dogfood-realistic **constructed** fixtures (Echo product themes + distractors), not a private IndexedDB dump. Schema matches browser export so real data can replace them without changing the runner.
