# Browser Vector Feasibility

Local browser harness for measuring whether Echo's current embedding candidate
is practical inside a Chrome extension. It does not change extension code or
product retrieval behavior.

## Measures

- exact local model, tokenizer, library, and WASM asset bytes
- first-use pipeline initialization with an empty browser Cache API
- cached-reload pipeline initialization
- public-fixture corpus encoding throughput
- repeated warm query latency (median and p95)
- Chrome JS heap and `measureUserAgentSpecificMemory` when available

The harness uses the public 55-Echo fixture. It never loads private holdout
data. Browser Cache API entries belong only to the local harness origin.

## Run

The model must already exist in the recall benchmark's ignored Transformers.js
cache. Running the vector benchmark once downloads it.

```powershell
cd evals/recall-benchmark
npm install
npm run bench

cd ../../experiments/browser-vector-feasibility
node server.mjs
```

Open `http://127.0.0.1:4174/experiments/browser-vector-feasibility/` in Chrome.
Run `Fresh cache` first, reload the page, then run `Cached reload`.

## Interpretation boundary

Localhost transfer time is not a user download-speed measurement. Asset bytes
show the real payload, while first-use time mostly measures browser parsing,
WASM initialization, and model session creation on this machine. JS heap can
miss native or WASM allocations; user-agent-specific memory is preferred when
Chrome exposes it. Results are machine-specific engineering evidence, not a
production SLA.
