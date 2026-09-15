# Echo - AI Product Engineering Case Study

**A privacy-first, precision-oriented context retrieval system for AI workflows.**

Echo is a Chrome side-panel extension for saving useful context from ChatGPT, Claude, Gemini, and Grok, and resurfacing it when it becomes relevant again.

The project started from a simple problem: useful ideas get buried across long AI conversations, but aggressively resurfacing old context creates a second problem — interruption.

Dogfooding changed the product direction. Instead of maximizing recall, Echo became precision-first: when the evidence is weak, it stays silent.

This repository documents the product decisions, retrieval experiments, browser-extension implementation, and evaluation process behind that shift.

> **Status:** Personal dogfood / alpha. Echo is a local-first prototype and is not currently maintained as a production multi-user service.

## Start here

| Evidence | What it demonstrates |
| --- | --- |
| [Case Study](docs/interview/Echo-case-study.md) | Product pivot, failure analysis, implementation, and measured ship decision |
| [Recall Benchmark](evals/recall-benchmark/) | Reproducible BM25 vs vector vs hybrid comparison |
| [Benchmark Conclusions](evals/recall-benchmark/data/CONCLUSIONS.md) | Why raw vector and hybrid are not shipped |
| [Decision Logs](docs/decisions/) | Traceable product and technical trade-offs |
| [Extension Guide](extension/README.md) | How to run the Chrome extension |
| [Contributing](CONTRIBUTING.md) | How to run the extension and recall benchmark |

## Sixty-second product flow

1. **Capture:** select a useful passage in an LLM conversation and save it beside the current workflow.
2. **Recall or abstain:** a precision-first BM25 gate evaluates the current selection and remains silent when evidence is weak.
3. **Explain:** accepted and rejected candidates can be inspected through a Probe ledger and an explicitly exported local recall trace.
4. **Return:** layered message anchors reopen the source conversation and avoid forced low-confidence jumps.

## Evidence-backed decisions

- **Prefer precision over recall.** Across 16 dogfood Probe reports, the retrieval pipeline accepted 256 of 1,493 scanned candidates. Manual review showed that many accepted candidates lacked strong phrase-level evidence, so the product gate was tightened rather than adding more model complexity.
- **Keep semantic retrieval experimental.** On a constructed 55-Echo / 40-query benchmark, raw vector retrieval improved recall but produced 17.5 false surfaces — irrelevant recalls shown to the user — per 100 queries, compared with 5.0 for the product BM25 configuration.
- **Stay local-first.** Saved Echo content remains in IndexedDB. Reports and backups leave the browser only through explicit user export.
- **Treat browser reliability as product reliability.** Message-anchor fallbacks and MV3 write recovery handle dynamic LLM DOMs, changing message structures, and service-worker suspension.
  
The full rationale and revisit criteria live in the [Decision Logs](docs/decisions/).

## Repository map

```text
Echo/
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
