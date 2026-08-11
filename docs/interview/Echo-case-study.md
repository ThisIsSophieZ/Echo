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

The fixture is constructed from dogfood-realistic product themes. It is useful for reproducible comparison, but it is not presented as private-user or production evidence. A desensitized real dogfood set is the next evaluation upgrade.

## 6. Results / decision

**Vector and hybrid are not shipped into the extension mainline.**

Vector helps paraphrases but destroys quietness. Hybrid is quieter than raw vector yet still worse than BM25 on false surfaces in this fixture. Echo optimizes for low interruption; absolute cosine is not confidence when scores crowd.

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

1. Replace fixture corpus with desensitized personal export when safe
2. Re-run hybrid only if false-surface rate and abstention beat BM25
3. Add only the minimum feedback outcomes: `useful`, `not_relevant`, and `wrong_time`
4. Add a compact privacy and threat-model note

## 10. Verification snapshot

On 2026-08-04, the extension passed **10 test files / 52 tests** and completed a production build. Historical development logs keep their original per-stage test counts rather than rewriting earlier snapshots.

## 11. How AI collaboration was used

ChatGPT / Claude / Cursor were used for research, design review, and coding assistance. Product definition, dogfood acceptance, pivot calls, and ship/no-ship decisions stayed human-owned. The Collect failure and the precision-first redesign are evidence the project was not “AI autocomplete with a README.”
