# Contributing

This is a personal AI product engineering case study, not an open contribution project. The notes below are for running and reading the repo.

## Run the extension

```powershell
cd extension
npm install
npm test
npm run build
npm run dev
```

Load `extension/build/chrome-mv3-dev` as an unpacked Chrome extension.

## Run the recall benchmark

```powershell
cd evals/recall-benchmark
npm install
npm run all
```

## Boundaries

- Vector and hybrid retrieval stay in offline experiments until they beat product BM25 on false surfaces and abstention accuracy.
- Echo stays local-first. Do not add cloud auth, multi-tenant backends, or upload private Echoes to a third-party model.
- Do not commit secrets, `data/instance.json`, private chat exports, or embedding caches.
- Do not describe the constructed fixture as production user data.
