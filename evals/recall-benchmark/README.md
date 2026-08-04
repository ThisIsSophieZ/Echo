# Echo Recall Benchmark

Offline, reproducible recall evaluation for interview-grade AI Product Engineering evidence.

This is **not** product code. The extension mainline stays local-first BM25 + precision-first gates until a benchmark says otherwise.

## What it proves

| Artifact | Purpose |
| --- | --- |
| `data/corpus.json` | Fixed Echo corpus (dogfood-realistic fixture; same schema as browser export) |
| `data/queries.json` | 40 annotated selections with relevant ids, hard negatives, surface/abstain |
| `data/report.md` | Human-readable metrics + failure stories (generated) |
| `data/metrics.json` | Machine-readable aggregates (generated) |

Strategies on the **same** labeled set:

1. **bm25** — product `extension/lib/echo-related.ts` `analyzeRelatedEchoes`
2. **vector** — local `multilingual-e5-small` cosine top-3 (raw)
3. **hybrid** — lexical accepted first, then vector-only fills with similarity/spread gates

## Annotation rules (the thinking, not just the JSON)

- **relevant**: would change the user's next decision if resurfaced now
- **hardNegatives**: topic-adjacent distractors that must not count as hits
- **surface**: at least one relevant result is acceptable
- **abstain**: silence is correct (generic tokens, superseded ideas, unrelated chat)

## Run

```powershell
cd evals/recall-benchmark
npm install
npm run all
```

Lexical-only (no model download):

```powershell
npm run bench:lexical
```

## Swap in real dogfood data

1. In the Echo side panel DevTools console, run `experiments/vector-recall-tidb/export-from-browser.js`
2. Replace `data/corpus.json` echoes (keep the wrapper fields or adapt the loader)
3. Re-annotate `data/queries.json` against real ids
4. `npm run bench`

## Honest scope

The seeded fixture is **constructed** from Echo's real product themes so the harness works without exporting private chats. It is labeled clearly in the report. Real IndexedDB export remains the gold standard for personal dogfood claims.
