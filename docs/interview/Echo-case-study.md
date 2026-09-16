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

### Public reproducible recall benchmark

The same labeled set (55 fixture Echoes, 40 annotated queries) compared:

| Strategy | P@3 | R@3 | False surfaces /100 | Abstention accuracy |
| --- | ---: | ---: | ---: | ---: |
| Product BM25 + gate | 28.7% | 25.8% | **5.0** | **80%** |
| Raw vector top-3 | 32.5% | 76.3% | 17.5 | 0% |
| Hybrid (lexical first + gated vector fill) | 25.0% | 59.6% | 7.5 | 60% |

Full tables: [`evals/recall-benchmark/data/CONCLUSIONS.md`](../../evals/recall-benchmark/data/CONCLUSIONS.md)

The fixture is constructed from dogfood-realistic product themes. It makes strategy behavior and failure cases publicly inspectable without publishing private conversations.

### Real dogfood holdout

A later time-sliced evaluation used 21 held-out queries over 91 unique Echoes from a real dogfood window. Raw private text remains unpublished, while the labeling method, aggregate results, and limitations are documented in [`HOLDOUT-CONCLUSIONS.md`](../../evals/recall-benchmark/data/HOLDOUT-CONCLUSIONS.md).

| Strategy | P@3 | R@3 | False surfaces /100 | Abstention accuracy |
| --- | ---: | ---: | ---: | ---: |
| Product BM25 | 27.0% | 34.9% | 47.6 | 0% |
| Raw vector | 30.2% | 46.4% | 38.1 | 0% |
| Existing hybrid | 27.0% | 42.9% | 42.9 | 0% |
| Guarded hybrid | **42.9%** | 29.0% | **0.0** | **100%** |

The guarded rule was selected on a separate Dev window before the first Holdout run. It promoted semantic retrieval from a broad idea to a focused browser-feasibility candidate while keeping the production path unchanged.

### Grounded-generation holdout

The isolated [`echo-rag-evaluation`](../../experiments/echo-rag-evaluation/) lab tested whether broader lexical candidates could support cited answers without weakening Echo's quiet product recall gate. On one frozen 14-question public Holdout, Candidate BM25 RAG improved correct answer-or-abstain behavior from **3/14 to 14/14**. Human review found all 16 generated claims grounded in their cited records, with 90.9% average required-evidence citation coverage. Full results and the frozen boundary are recorded in [`HOLDOUT-RESULT.md`](../../experiments/echo-rag-evaluation/HOLDOUT-RESULT.md).

## 6. Results / decision

**Raw vector and the existing broad hybrid are not shipped into the extension mainline. Guarded hybrid advances to browser-feasibility work, and grounded generation remains an isolated evaluation path.**

The public benchmark showed that raw semantic recall can recover paraphrases while creating too many interruptions. The real dogfood holdout showed that a selective agreement-and-score-spread rule can recover precision, but it does not yet establish browser cost, broader-user generalization, or a reason to replace a working local product path. The RAG holdout demonstrates grounded answer generation as a separate engineering capability without turning every contextual recall into an LLM call.

The resulting roadmap is evidence-led: reject broad semantic surfacing, prototype the guarded candidate narrowly, and keep generation outside the user-facing loop until it earns a product role.

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

1. Measure guarded-hybrid model size, cold start, warm latency, and browser memory outside the extension UI
2. Confirm the guarded rule on a newly collected holdout before changing product behavior
3. Add only the minimum feedback outcomes: `useful`, `not_relevant`, and `wrong_time`
4. Add a compact screenshot or GIF walkthrough for reviewers who do not install the extension

## 10. Verification snapshot

On 2026-09-16, the extension passed **10 test files / 55 tests**, TypeScript typecheck, and a production build. The isolated RAG Lab passed **9 focused tests** and typecheck. Historical development logs keep their original per-stage test counts rather than rewriting earlier snapshots.

## 11. How AI collaboration was used

ChatGPT / Claude / Cursor were used for research, design review, and coding assistance. Product definition, dogfood acceptance, pivot calls, and ship/no-ship decisions stayed human-owned. The Collect failure and the precision-first redesign are evidence the project was not “AI autocomplete with a README.”
