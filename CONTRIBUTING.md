# Contributing

This is a personal AI product engineering case study, not an open contribution project. The notes below are for running and reading the repo.

Use Node.js 24; the repository records this in `.nvmrc`.

## Run the extension

```powershell
cd extension
npm ci
npm test
npm run typecheck
npm run build
npm run dev
```

Load `extension/build/chrome-mv3-dev` as an unpacked Chrome extension.

## Run the recall benchmark

```powershell
cd evals/recall-benchmark
npm ci
npm run all
```

## Verify the RAG Lab

This fast path verifies retrieval and scoring logic without starting Ollama:

```powershell
cd experiments/echo-rag-evaluation
npm ci
npm test
npm run typecheck
```

## Boundaries

- Guarded hybrid stays in offline browser-feasibility work until a newly collected holdout justifies changing product behavior.
- Grounded generation remains an isolated evaluation path rather than an extension runtime dependency.
- Echo stays local-first. Do not add cloud auth, multi-tenant backends, or upload private Echoes to a third-party model.
- Do not commit secrets, `data/instance.json`, private chat exports, or embedding caches.
- Do not describe the constructed fixture as production user data.
