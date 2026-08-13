# RAG Lab Dev Questions

## Purpose

These six questions are development cases for the future RAG Lab. They help us build and inspect retrieval, structured answers, citations, and abstention.

They are **not** a final benchmark and must not be reported as model accuracy. The only corpus is the committed public fixture in `evals/recall-benchmark/data/corpus.json`. No private Echo or IndexedDB data is allowed.

## Terms

- **Single evidence**：只需要一条资料就能回答。
- **Multi evidence**：需要组合多条资料才能完整回答。
- **Abstention**：证据不足时明确说不知道。
- **Cross-language retrieval**：问题与证据使用不同语言或混合语言。
- **Hard negative**：关键词看起来相似，但实际不应该作为答案证据。
- **Disambiguation**：根据上下文判断同一个词在这里是什么意思。
- **Forbidden claim**：听起来可能合理，但现有资料没有支持，因此回答中不能出现。

## D01 - Product pivot

**Question:** Why did Echo move away from the standalone Collect app?

**Context:** We need to test whether RAG can combine several product observations rather than copy one sentence.

**Decision:** The answer should connect capture friction, the failure of a separate app workflow, and the move into the browser side panel.

**Why:** `e08`, `e19`, and `e20` each contain a different part of the reasoning. The deprecated Collect hypothesis in `e49` must not be presented as the current decision.

**Trade-off:** The answer may paraphrase, but it cannot upgrade personal dogfood into a formal study or A/B test.

**Implementation:** `answer` · `multi_evidence` · required `e08`, `e19`, `e20` · hard negative `e49`.

## D02 - Precision-first product choice

**Question:** 为什么 Echo 宁可漏掉一些结果，也不愿展示大量弱匹配？

**Context:** Echo must avoid interrupting the user with weak matches.

**Decision:** Explain why weak surfaces reduce trust, why one matching term is insufficient, and why some missed recall is accepted.

**Why:** This tests a product trade-off, not only a retrieval rule.

**Trade-off:** Precision-first behavior reduces interruption but can miss semantic paraphrases.

**Implementation:** `answer` · `multi_evidence` · required `e21`, `e23` · supporting `e33`.

## D03 - MV3 write recovery

**Question:** How does Echo protect pending writes when the MV3 service worker sleeps?

**Context:** The Lab needs a simple factual question before testing complex synthesis.

**Decision:** Explain that the pending thought is queued in `chrome.storage.local` before the Dexie commit.

**Why:** One clear Echo should be enough. Failure here points to a basic retrieval or generation problem.

**Trade-off:** The queue adds state-management complexity but provides a recovery path. It is not a universal zero-data-loss guarantee.

**Implementation:** `answer` · `single_evidence` · required `e25`.

## D04 - Local-first architecture boundary

**Question:** 为什么 Echo 当前没有为了面试搭建云端多租户后端？

**Context:** Interview projects are often expanded with infrastructure that does not solve a real user need.

**Decision:** Explain the current local-first privacy boundary and why resume-only cloud infrastructure was rejected.

**Why:** This tests whether RAG can explain both a product decision and the capability that decision does not prove.

**Trade-off:** Echo avoids unnecessary privacy, network, and operational cost, but does not demonstrate multi-tenancy or cross-device sync.

**Implementation:** `answer` · `multi_evidence` · required `e27`, `e36`.

## D05 - Unsupported business claim

**Question:** How many paying users does Echo currently have?

**Context:** The public fixture contains no paying-user data.

**Decision:** The correct behavior is to say the available evidence cannot answer the question.

**Why:** Saying “zero” would still be invented. Absence of evidence is not evidence of zero.

**Trade-off:** Abstention lowers answer coverage but avoids fabricated traction.

**Implementation:** `abstain` · no required evidence · any specific user or revenue number is forbidden.

## D06 - Hard negative and disambiguation

**Question:** 用户搜索 Apple 公司财报时，为什么不能只根据“苹果”这个词召回记录？

**Context:** The same word can refer to Apple the company or apple-pie cooking.

**Decision:** Use surrounding context to distinguish the meanings and exclude the pie note from a company-filings query.

**Why:** This tests whether the system can reject a keyword match that is superficially similar but actually unrelated.

**Trade-off:** Requiring context can miss very short relevant queries, but reduces obvious cross-topic mistakes.

**Implementation:** `answer` · `hard_negative` + `disambiguation` · required `e54` · hard negative `e55`.

## Review Gate

Before any runner is built, a human should confirm:

1. Each question reflects a reasonable knowledge-work use case.
2. Required evidence is sufficient and not excessive.
3. Forbidden claims capture the most important overstatement risks.
4. The language is understandable without relying on retrieval jargon.
