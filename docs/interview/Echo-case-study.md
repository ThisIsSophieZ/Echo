# Echo Case Study — AI Product Engineering

> Audience: AI Product Engineer / LLM Application Engineer interviews
> Positioning: privacy-first, precision-oriented context retrieval system for AI workflows
> Product: local-first Chrome side panel for capturing and resurfacing high-value thoughts from LLM chats
> Repo role: interview-grade evidence, not a growth-hack demo

## 1. Problem

People produce sharp judgments inside ChatGPT / Claude / Gemini / Grok, then lose them inside long threads and cross-provider history. Bookmarking stores more text; it does not lower the cost of **old idea × new context** colliding at the right moment.

Echo targets four jobs:

1. Capture with near-zero friction while the user is already in an LLM tab
2. Store the user's thought plus enough source context to return later
3. Resurface quietly when the current selection is related
4. Stay local-first, explainable, and human-in-the-loop

## 2. Initial hypothesis (failed)

**Hypothesis:** users will open a separate Collect-style local app to manage AI snippets after the fact.

**Failure mode:** dogfood showed entry friction kills the loop. If capture/management live outside the browser workflow the user is already in, they simply do not open the tool.

This was not a UI skin change. It invalidated the product entry, the session model, and the “store then curate elsewhere” value prop.

## 3. Pivot

Rebuild as **Echo**: a Chrome Manifest V3 side panel that stays beside LLM pages.

- Capture and resurface happen in-place
- Storage is Dexie / IndexedDB (`echo-sidebar`)
- Value contracts from “save more” to “return one useful old thought without nagging”

## 4. Technical challenges (production-shaped, browser-constrained)

### Precision-first recall

First lexical probe over-fired on generic Chinese tokens (`实用`, `这个`, `快速`). Instead of mystically retuning weights, we shipped explainable Probe ledgers, audited **16 reports / 1,493 candidate scans / 256 accepts**, and tightened gates: no single-token surfaces; prefer phrases / multi-term evidence; suppress duplicates.

### Reliable anchors on dynamic LLM DOMs

Anchor v2 stacks native message ids, SHA-256 fingerprints, head/tail tolerance, neighbor disambiguation, limited scroll retry, and explicit failure instead of low-confidence jumps.

### MV3 lifecycle recovery

Pending “add thought” writes queue in `chrome.storage.local` before Dexie commits so Service Worker sleep cannot silently drop user edits; the side panel can replay the queue.

### Local decision traces

The Probe panel can copy or download a request-level JSON trace containing corpus size, accepted candidates, rejection distributions, and lexical latency. Traces are generated locally and leave the browser only through an explicit user action. The default trace avoids storing the full selected passage.

## 5. Evaluation

Offline harness: [`evals/recall-benchmark/`](../../evals/recall-benchmark/)

Same labeled set (55 fixture Echoes, 40 annotated queries) compared:

| Strategy | P@3 | R@3 | False surfaces /100 | Abstention accuracy |
| --- | ---: | ---: | ---: | ---: |
| Product BM25 + gate | 28.7% | 25.8% | **5.0** | **80%** |
| Raw vector top-3 | 32.5% | 76.3% | 17.5 | 0% |
| Hybrid (lexical first + gated vector fill) | 25.0% | 59.6% | 7.5 | 60% |

Full tables: [`evals/recall-benchmark/data/CONCLUSIONS.md`](../../evals/recall-benchmark/data/CONCLUSIONS.md)

The fixture is constructed from dogfood-realistic product themes. It is useful for reproducible comparison, but it is not presented as private-user or production evidence.

A later frozen dogfood holdout used 91 unique Echoes and 21 model-assisted
labeled queries. Raw vector improved R@3 from 34.9% to 46.4%, while a
precision-first guarded hybrid produced 9/9 useful surfaces and correctly
abstained on 5/5 abstention cases, at the cost of recovering only 9/16 expected
surface queries. The report explicitly limits these claims to one user, a
small sample, and Chinese/English technical-topic-heavy content.

Runtime feasibility was evaluated separately in real browser WASM. The current
model requires 139.5 MiB of assets and added about 418 MiB in two broader page
memory measurements. Cached initialization was about 1.7 seconds, while warm
query p50 was about 11 ms. Query speed is acceptable; payload and memory are
not. Full results: [`experiments/browser-vector-feasibility/REPORT.md`](../../experiments/browser-vector-feasibility/REPORT.md).

## 6. Results / decision

**Vector and hybrid are not shipped into the extension mainline.**

Vector helps paraphrases, but raw cosine cannot decide when to stay silent. A
guarded hybrid is promising on the small holdout, yet the current browser model
is disproportionate for a lightweight side panel. Echo therefore keeps BM25
in product while quality and runtime evidence remain separate gates.

That “no” is the deliverable: a measured abstain from shipping, not a missing feature.

## 7. Trade-offs we keep defending

| Choice | Why |
| --- | --- |
| Local-first, no cloud backend | Real privacy boundary; fake multi-tenant auth for resumes is negative signal |
| No autonomous memory Agent | Resurface candidates; humans confirm |
| BM25 in product, vectors in evals | Experiment boundary prevents unproven retrieval from polluting UX |
| Probe / trace export, not cloud APM | Observability without uploading chat memory |

Decision records, including evidence and revisit criteria, are indexed in [`docs/decisions/`](../decisions/).

## 8. What this is not

- Not ML training / fine-tuning
- Not multi-tenant production SaaS
- Not large-scale user retention proof (personal dogfood / alpha)
- Not “we used RAG therefore AI engineer”

## 9. Next steps

1. Compare a materially smaller browser embedding candidate with the same runtime harness
2. Collect a new independent holdout instead of tuning Report 5 again
3. Prepare three demo stories: lexical success, semantic rescue, and correct silence
4. Keep any future vector trial optional and outside the side-panel startup path

## 10. Verification snapshot

On 2026-08-11, the extension passed **10 test files / 55 tests**. The browser
feasibility harness also completed fresh-cache and cached-reload runs on the
public fixture. Historical development logs keep their original per-stage test
counts rather than rewriting earlier snapshots.

## 11. How AI collaboration was used

ChatGPT / Claude / Cursor were used for research, design review, and coding assistance. Product definition, dogfood acceptance, pivot calls, and ship/no-ship decisions stayed human-owned. The Collect failure and the precision-first redesign are evidence the project was not “AI autocomplete with a README.”
