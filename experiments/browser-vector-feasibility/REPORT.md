# Vector Browser Feasibility Report

- Date: 2026-08-11
- Model: `Xenova/multilingual-e5-small` (quantized ONNX)
- Browser: Chrome 151, Windows 10 x64
- Hardware bucket: 20 logical processors, 32 GB device memory
- Runtime: browser WASM, four threads, cross-origin isolated
- Corpus: public 55-Echo fixture; no private dogfood content

## Decision

Do not bundle this model into the Echo extension or initialize it as part of
the normal side-panel lifecycle. Query speed is good after initialization, but
the current model is too heavy for Echo's lightweight local-first product
promise.

Keep browser vector retrieval as an offline experiment. A future product trial
needs a materially smaller model or an explicitly optional, lazy-downloaded
semantic index running outside the interactive side-panel path.

## Measurements

| Metric | Fresh Cache API | Cached reload |
| --- | ---: | ---: |
| Required local assets | 139.5 MiB | 139.5 MiB |
| Pipeline initialization | 1,983.9 ms | 1,658.0 ms |
| Encode 55 public Echoes | 1,256.0 ms | 1,319.6 ms |
| Encoding per Echo | 22.8 ms | 24.0 ms |
| Warm query p50 | 19.8 ms | 10.8 ms |
| Warm query p95 | 24.2 ms | 13.0 ms |
| Rank 55 vectors p50 | 0.8 ms | 0.2 ms |
| Measured memory delta | 418.9 MiB | 418.2 MiB |

`Fresh Cache API` clears this localhost origin's Cache API before loading.
Because all assets are served from localhost, its initialization time does not
include a realistic user internet download. The byte count is the useful
first-download signal.

A third cached verification after adding the memory timeout measured 1,679.5
ms pipeline initialization, 1,282.5 ms corpus encoding, 10.8 / 14.0 ms warm
query p50 / p95, and 0.4 ms ranking p50. Its broader memory call timed out and
fell back to an 82.0 MiB JS-heap delta; that narrower value is not comparable
to the two user-agent-specific memory measurements above.

## Asset footprint

| Asset | Bytes | MiB |
| --- | ---: | ---: |
| Quantized ONNX model | 118,308,185 | 112.8 |
| Tokenizer | 17,082,730 | 16.3 |
| Transformers.js | 897,938 | 0.9 |
| Threaded SIMD WASM runtime | 9,960,821 | 9.5 |
| Config files | 1,101 | <0.1 |
| **Required total** | **146,250,775** | **139.5** |

## Product interpretation

1. **Interactive retrieval is fast enough once warm.** Query embedding takes
   roughly 11-20 ms at p50, and ranking 55 vectors is below 1 ms.
2. **Model startup is noticeable but potentially manageable if isolated.** A
   cached page still spends about 1.7 seconds creating the pipeline.
3. **Initial corpus work is not the main blocker at today's scale.** Encoding
   55 Echoes takes about 1.3 seconds. A simple linear estimate for 91 Echoes is
   about 2.2 seconds, but that estimate was not directly measured.
4. **Payload and memory are the blockers.** A 139.5 MiB local asset set and
   roughly 418 MiB measured page-memory increase are disproportionate for a
   lightweight side panel.
5. **The architecture matters more than another threshold tweak.** Putting the
   model in the side panel would make an optional recall enhancement dominate
   the extension's resource profile.

## Evidence boundary

- This is one machine and one Chrome build, not a production SLA.
- Localhost does not represent first-download network time.
- The public fixture has 55 Echoes; the 91-Echo number above is an estimate.
- `measureUserAgentSpecificMemory` is broader than JS heap but still reflects a
  page-level browser measurement, not the whole extension process tree.
- Chrome's broader memory measurement sometimes took tens of seconds to return
  during the audit. The harness now falls back to JS heap after 15 seconds;
  memory sampling itself must never enter the product interaction path.
- Two runs are enough for a feasibility screen, not a stable performance
  distribution across hardware.
- This experiment measures runtime feasibility only. Retrieval quality remains
  governed by the separate labeled holdout report.

## Next gate

Do not integrate the current model. Before another browser trial, choose a
candidate that substantially reduces both model assets and measured memory,
then rerun this same harness. Quality must still be evaluated on a newly
collected independent holdout rather than tuning Report 5 again.
