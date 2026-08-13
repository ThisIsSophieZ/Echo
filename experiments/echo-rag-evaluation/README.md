# Echo RAG Evaluation Lab

Independent interview experiment for retrieval and future grounded-generation evaluation. It is not an Echo product feature.

## Boundaries

- Reads only the committed public fixture in `evals/recall-benchmark/data/corpus.json`.
- Never reads private dogfood exports, ignored dev/holdout recall data, or browser IndexedDB.
- Production extension code and builds do not depend on this directory.
- The first phase is retrieval-only: no model API, generation, token usage, or cost yet.

## Phase 1: Dev retrieval baseline

```powershell
cd experiments/echo-rag-evaluation
npm install
npm run retrieval:dev
npm run retrieval:candidate:dev
```

Outputs are written to the ignored `artifacts/` directory:

- `retrieval-product-gate-dev.json` / `.md`
- `retrieval-candidate-bm25-dev.json` / `.md`

Both strategies reuse the production `analyzeRelatedEchoes` BM25 path. The
product baseline keeps only results allowed to surface in Echo; the candidate
strategy keeps up to five lexical candidates for later evidence-sufficiency
checking. Neither strategy changes extension code.

## Holdout lock

The holdout is frozen but must not be inspected while prompts and evaluation rules are still being developed. An accidental holdout run fails unless the caller adds an explicit confirmation flag:

```powershell
npm run retrieval:holdout -- --confirm-holdout
```

Do not use that command until the generation prompt and evaluators have been frozen for the first scored run.

The generation Holdout adds a second lock: it verifies SHA-256 hashes in
`freeze-manifest.json` for the prompt, scorer, retriever, corpus, and Holdout
questions. It also rejects a model override. After the frozen commit exists,
run it once with:

```powershell
npm run generation:holdout -- --confirm-holdout
```

## Phase 2: Dev generation

The Dev generator compares no supplied context against Candidate BM25 RAG. It
uses a locally installed Ollama model, structured claim-level citations, and
never sends fixture data to a remote provider.

```powershell
npm run generation:dev
```

Set `OLLAMA_MODEL` to override the default `qwen2.5:32b`. Generated question,
evidence, answer, citation, token, and latency records are written to ignored
`artifacts/generation-dev.md` and `.json` files.

The reviewed Dev result and its limitations are recorded in
[`GENERATION-DEV-RESULT.md`](./GENERATION-DEV-RESULT.md).

The single frozen Holdout run is recorded in
[`HOLDOUT-RESULT.md`](./HOLDOUT-RESULT.md). The v1 Holdout is now spent and must
not be reused for tuning.

## Interpretation

Retrieval and answer evaluation are separate:

- Missing required evidence is a retrieval failure.
- Retrieving a related hard negative does not give the generator permission to answer.
- An abstention question may still retrieve adjacent material; the future generation stage must judge whether that material is sufficient.
