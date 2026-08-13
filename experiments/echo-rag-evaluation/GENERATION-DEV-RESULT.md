# RAG Generation Dev Result

## Context

Retrieval alone does not show whether a RAG system can use evidence safely. The
Dev experiment therefore asks whether a local model answers from retrieved
records, cites its claims, ignores a hard negative, and abstains when evidence
is insufficient.

This is development evidence, not a final accuracy claim. It uses 6 Dev
questions, a 55-record public fixture, and no private Echo data. Holdout was not
opened or run.

## Decision

Compare two generation conditions with the same local `qwen2.5:32b` model:

1. `no-context`: the model receives the question but no corpus evidence.
2. `candidate-bm25-rag`: the model receives the frozen Top-5 Candidate BM25
   evidence.

The model must return structured claim-level citations or explicitly abstain.
Automatic checks cover behavior, citation IDs, and required-evidence coverage.
Human review covers whether each citation actually supports its claim and
whether the answer introduces a forbidden claim.

## Why

The no-context condition tests whether the model merely knows or guesses an
answer. Candidate BM25 RAG tests the value and risk added by retrieval.

We did not use an LLM judge as the only evaluator. An ID can be syntactically
valid while failing to support the sentence attached to it. The D01 result
demonstrated this exact limitation.

## Results

| Dev signal | No context | Candidate BM25 RAG |
| --- | ---: | ---: |
| Correct answer/abstain behavior | 1 / 6 (16.7%) | 5 / 6 (83.3%) |
| Answerable questions citing every required record | 0 / 5 | 2 / 5 |
| Average required-evidence citation coverage | 0.0% | 56.7% |
| Invalid citation IDs | 0 | 0 |
| Uncited generated claims | 0 | 0 |
| Prompt / output tokens | 1,694 / 278 | 3,214 / 535 |
| Runtime excluding model load | 68.6 s | 81.7 s |
| Local model load time | 93.6 s | 2.0 s |
| Estimated API cost | $0 | $0 |

The large no-context total time is not a fair speed comparison: its first call
paid the 92-second cold model load. Excluding load, Candidate BM25 RAG averaged
13.6 seconds per question versus 11.4 seconds for no-context. Local hardware and
electricity cost are not estimated.

## Human Review

| Question | Candidate behavior | Review |
| --- | --- | --- |
| D01: Why leave standalone Collect? | Answered | Broad answer is correct, but only 1 of 3 required records was retrieved. One claim says the side panel superseded Collect while citing a record that only says Collect was deprecated. Marked partially unsupported. |
| D02: Why prefer precision? | Answered | Correctly explains that weak generic matches consume attention. It cites direct and supporting evidence, but misses 1 of 2 required records. |
| D03: MV3 pending writes | Answered | Correct, concise, and fully supported by the cited record. |
| D04: Why no interview-only cloud backend? | Abstained | Conservative failure. Retrieval supplied the no-fake-backend record but missed the local-first privacy record, so the model refused to synthesize the expected answer. |
| D05: Current paying users? | Abstained | Correct. The retrieved records were only adjacent business/product material; the model did not invent traction. |
| D06: Apple company versus apple pie | Answered | Correctly used context, cited the disambiguation record, and ignored the apple-pie hard negative even though it ranked third. |

Across the 6 generated candidate claims, 5 were directly supported and 1
partially overstated its cited record. Human review found no forbidden claim.
This manual result is descriptive, not a statistically reliable faithfulness
rate.

## Trade-off

RAG materially improved useful behavior on this Dev set, but it did not make
the system automatically trustworthy. Broader retrieval introduced adjacent
and hard-negative evidence; incomplete retrieval caused a false abstention; and
a valid citation ID still accompanied one overstatement.

The experiment supports a product decision to keep generation outside Echo's
main experience. It demonstrates retrieval, grounded generation, citations,
abstention, latency, and cost measurement without changing Echo's local-first,
human-in-the-loop retrieval product.

## Implementation

- Local provider: Ollama at `127.0.0.1`; no remote API or private data.
- Model: `qwen2.5:32b`, temperature `0`, seed `42`.
- Retrieval: frozen Candidate BM25 Top-5 with non-zero lexical evidence.
- Output: structured answer status, answer, claims, citations, and reason.
- Detailed raw records: ignored `artifacts/generation-dev.json` and
  `artifacts/generation-dev.md`.
- Reproduce: `npm run generation:dev` from this experiment directory.

The next valid step is to freeze this generation prompt and evaluator behavior,
then run the locked Holdout once. Do not tune retrieval or generation on the
Holdout results.
