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
4. **guarded-hybrid** — dev-tuned precision gate; one result only on strong cross-retriever agreement or clear vector separation

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

## Private dogfood dev / holdout

Private imports, generated reports, metrics, and embedding caches are gitignored.
Report 4 is the dev set; Report 5 is the frozen holdout.

```powershell
npm run import:dev -- --backup=<backup.json> --report=<probe-4.md> --labels=<labels-4.md>
npm run bench:dev

npm run import:holdout -- --backup=<backup.json> --report=<probe-5.md> --labels=<labels-5.json>
npm run bench:holdout
```

The runner applies per-query timestamp slicing. It preserves the corpus state
used for BM25 statistics, passes the active source URL to the product
exact-source gate, and removes current-selection self matches from vector
candidates.

## Browser feasibility gate

Retrieval quality does not imply product feasibility. The independent
[`browser-vector-feasibility`](../../experiments/browser-vector-feasibility/README.md)
harness measures model assets, browser initialization, corpus encoding, warm
queries, ranking, and memory without integrating vector code into the
extension. Its reviewed [report](../../experiments/browser-vector-feasibility/REPORT.md)
is the runtime gate for any future browser candidate.

## Swap in real dogfood data

1. In the Echo side panel DevTools console, run `experiments/vector-recall-tidb/export-from-browser.js`
2. Replace `data/corpus.json` echoes (keep the wrapper fields or adapt the loader)
3. Re-annotate `data/queries.json` against real ids
4. `npm run bench`

## Honest scope

The seeded fixture is **constructed** from Echo's real product themes so the harness works without exporting private chats. It is labeled clearly in the report. Real IndexedDB export remains the gold standard for personal dogfood claims.
