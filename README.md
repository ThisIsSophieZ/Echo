# Echo - AI Product Engineering Case Study

**A privacy-first, precision-oriented context retrieval system for AI workflows.**

Echo is a local-first Chrome side panel that captures high-value thoughts from ChatGPT, Claude, Gemini, and Grok, then resurfaces them only when lexical evidence is strong enough. The project is an interview case study in product judgment, retrieval evaluation, explainability, and browser reliability.

> Personal dogfood / alpha. This repository demonstrates an end-to-end AI product engineering process, not model training, a cloud multi-tenant service, or production-scale usage.

## Start here

| Evidence | What it demonstrates |
| --- | --- |
| [Case Study](docs/interview/Echo-case-study.md) | Product pivot, failure analysis, implementation, and measured ship decision |
| [Recall Benchmark](evals/recall-benchmark/) | Reproducible BM25 vs vector vs hybrid comparison |
| [Benchmark Conclusions](evals/recall-benchmark/data/CONCLUSIONS.md) | Why raw vector and hybrid are not shipped |
| [Decision Logs](docs/decisions/) | Traceable product and technical trade-offs |
| [Extension Guide](extension/README.md) | How to run the Chrome extension |
| [Documentation Index](docs/README.md) | Original research, dogfood records, and engineering history |

## Sixty-second product flow

1. **Capture:** select a useful passage in an LLM conversation and save it beside the current workflow.
2. **Recall or abstain:** a precision-first BM25 gate evaluates the current selection and remains silent when evidence is weak.
3. **Explain:** accepted and rejected candidates can be inspected through a Probe ledger and an explicitly exported local recall trace.
4. **Return:** layered message anchors reopen the source conversation and avoid forced low-confidence jumps.

## Evidence-backed decisions

- **Prefer precision over recall.** An audit of 16 Probe reports found 256 accepts across 1,493 candidate scans; most accepted candidates lacked phrase evidence. The product gate was tightened instead of adding model complexity.
- **Do not ship semantic retrieval by default.** On the constructed 55-Echo / 40-query fixture, raw vector improved recall but produced 17.5 false surfaces per 100 queries versus 5.0 for product BM25.
- **Keep the product local-first.** Echo content stays in IndexedDB; reports and backups leave the browser only through explicit user export.
- **Treat browser failures as product failures.** Anchor v2 and MV3 write recovery address dynamic LLM DOMs and service-worker suspension.

The full rationale and revisit criteria live in the [Decision Logs](docs/decisions/).

## Repository map

```text
echo-ai-product-engineering/
|-- extension/                      # Chrome MV3 product: Plasmo, React, Dexie
|-- evals/recall-benchmark/         # Offline labeled recall evaluation
|-- experiments/vector-recall-tidb/ # Earlier isolated vector experiment
|-- docs/                           # Decisions, specs, dogfood, interview evidence
|-- research/                       # Competitive and technical analysis
`-- competitive-intel/echo/         # Dated competitive notes
```

## Reproduce

Extension:

```powershell
cd extension
npm install
npm test
npm run build
npm run dev
# Load build/chrome-mv3-dev as an unpacked Chrome extension.
```

Recall benchmark:

```powershell
cd evals/recall-benchmark
npm install
npm run all
```

## Current evidence boundary

- Extension verification on 2026-08-04: **10 test files / 52 tests passed**, followed by a successful production build.
- Recall results currently use a clearly labeled, dogfood-realistic **constructed fixture**, not a private IndexedDB dump.
- Real desensitized dogfood labels are the next evidence upgrade.
- Vector and hybrid retrieval remain offline experiments until they beat product BM25 on false surfaces and abstention accuracy.
