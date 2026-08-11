# Bilingual Alias BM25 Experiment

## Decision

**Keep as an evaluation candidate; do not ship to the extension.**

A nine-group bilingual phrase dictionary adds effectively no runtime or download cost and produced one useful cross-language rescue on the frozen holdout. The evidence is too narrow to justify product integration, and the dev set includes one precision regression.

## Hypothesis

Appending a small, interpretable set of Chinese/English aliases before the existing product BM25 pass can recover cross-language matches without a browser embedding model.

The alias groups were derived only from Report 4 dev topics. After the strategy was made capable of changing rankings on dev, both the dictionary and algorithm were frozen before the Report 5 holdout run.

## Results

| Dataset | Queries | Strategy | P@3 | R@3 | False surfaces /100 | Avg latency |
| --- | ---: | --- | ---: | ---: | ---: | ---: |
| Report 4 dev | 17 | BM25 | 25.5% | 28.4% | 64.7 | 102.3 ms |
| Report 4 dev | 17 | BM25 + aliases | 22.5% | 28.4% | 64.7 | 99.1 ms |
| Report 5 holdout | 21 | BM25 | 27.0% | 34.9% | 47.6 | 112.1 ms |
| Report 5 holdout | 21 | BM25 + aliases | 30.2% | 36.5% | 42.9 | 111.5 ms |

The holdout aggregate improvement comes from **one query out of 21**. A short Chinese memory query changed from no relevant results to two relevant results in the top three and stopped being a false surface. Two other queries changed result identities without changing their query-level metrics; the other 18 were identical to baseline.

## Interpretation

- The experiment proves a lightweight, explainable cross-language rescue is possible for at least one covered concept.
- It does not prove general bilingual recall quality. The dictionary covers only nine topic groups and the positive holdout evidence has a denominator of one query.
- The dev precision regression shows that appending synonyms can also promote adjacent but wrong Echoes.
- No latency penalty was observable in this small local run; the differences above are within ordinary measurement noise.
- The benchmark remains single-user, topic-skewed, mostly Chinese or mixed-language, and model-assisted rather than independently double-annotated.
- Because Report 4 and Report 5 come from the same user and nearby time window, holdout independence is limited even though the rule was frozen before evaluation.

## Next Gate

Add a purpose-built bilingual contrast set before considering product code: at least 20 query pairs where the query and relevant Echo intentionally use different languages, plus hard negatives sharing the expanded terms. Pre-register the alias dictionary and require recall improvement without a higher false-surface rate.

Until that gate passes, BM25 remains the product path and this strategy stays in the offline benchmark only.
