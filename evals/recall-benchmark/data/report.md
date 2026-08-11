# Echo Recall Benchmark Report

- Generated: 2026-08-03T14:15:42.246Z
- Fixture: `2026-08-dogfood-v1`
- Corpus: 55 Echoes · Queries: 40
- Model: `Xenova/multilingual-e5-small` (local)
- Surface limit: 3
- Hybrid vector fill gates: minSim=0.82, minSpread=0.02
- Embedding cold start: 8799 ms

## Method

- **bm25**: product `analyzeRelatedEchoes` with precision-first gate (what the side panel would show).
- **vector**: local multilingual-e5-small cosine top-3 (raw; no product gate).
- **hybrid**: lexical accepted first, then vector-only fills that clear similarity/spread gates.
- Labels are dogfood-realistic fixtures (not a private DB dump). Schema matches browser export.

## Aggregate metrics

| Strategy | P@3 | R@3 | MRR | False surfaces /100 | Abstention acc | Avg latency ms |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| bm25 | 28.7% | 25.8% | 0.287 | 5.0 | 80.0% | 20.2 |
| vector | 32.5% | 76.3% | 0.792 | 17.5 | 0.0% | 6.1 |
| hybrid | 25.0% | 59.6% | 0.625 | 7.5 | 60.0% | 27.3 |

## Ship / abstain decision

Reading the aggregates together with failure stories:

1. Raw **vector** often improves paraphrase recall but raises false surfaces — cosine is not a confidence score.
2. Product **bm25** is quieter (precision-first). That matches Echo's low-interruption UX.
3. **hybrid** is allowed only when vector fills clear similarity + spread gates; if it still worsens false surfaces vs bm25, **do not ship vector into the extension mainline**.

## Representative failure / contrast stories

- **q01** 词法漏召回、向量捞回：`推理成本太高了,有没有省钱的优化思路` → vector e09, e01, e46
- **q03** 词法漏召回、向量捞回：`怎么让 bot 在不同对话之间保持上下文` → vector e06, e19, e03
- **q06** 词法漏召回、向量捞回：`产品上线前是不是应该自己先用一段时间` → vector e10, e07, e14
- **q07** 词法漏召回、向量捞回：`用户根本不愿意打开一个单独的本地应用去管理聊天收藏` → vector e19, e27, e07
- **q08** BM25 误浮现：显示 e49 · 期望 abstain · relevant=[e49]
- **q08** 应沉默却被向量/Hybrid 打扰：vector=e49,e19,e20 hybrid=e49,e19,e20
- **q09** 词法漏召回、向量捞回：`误匹配太多,泛词也能打出很高分,怎么改召回` → vector e21, e33, e03
- **q11** 词法漏召回、向量捞回：`LLM 页面消息滚走了还能不能跳回原句` → vector e38, e39, e24

## Per-query results

### q01 · expected `surface`

> 推理成本太高了,有没有省钱的优化思路

- relevant: e01, e02
- hardNegatives: e14, e43
- rationale: 换词表达降成本;词法可能弱,语义应捞回路由/缓存
- tags: paraphrase, cost

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 18.9ms

_abstain_

**vector** · P@3 33.3% · R@3 50.0% · MRR 0.500 · falseSurface=false · 7.7ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e09 | 0.897 | vector | no |
| 2 | e01 | 0.895 | vector | yes |
| 3 | e46 | 0.893 | vector | no |

**hybrid** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 28.4ms

_abstain_

### q02 · expected `surface`

> 换个说法就搜不到东西了,这个问题怎么解决

- relevant: e04
- hardNegatives: e16, e40
- rationale: 词法强项:用词直接撞上向量检索动机
- tags: lexical-friendly

**bm25** · P@3 100.0% · R@3 100.0% · MRR 1.000 · falseSurface=false · 23.3ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e04 | 98.000 | bm25 | yes |

**vector** · P@3 33.3% · R@3 100.0% · MRR 0.500 · falseSurface=false · 5.7ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e16 | 0.888 | vector | no |
| 2 | e04 | 0.885 | vector | yes |
| 3 | e35 | 0.881 | vector | no |

**hybrid** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 27.0ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e04 | 98.000 | bm25 | yes |
| 2 | e16 | 0.888 | vector | no |
| 3 | e35 | 0.881 | vector | no |

### q03 · expected `surface`

> 怎么让 bot 在不同对话之间保持上下文

- relevant: e05, e06
- hardNegatives: e19, e20
- rationale: Agent 记忆 paraphrase,词法易漏
- tags: paraphrase, memory

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 20.1ms

_abstain_

**vector** · P@3 33.3% · R@3 50.0% · MRR 1.000 · falseSurface=false · 6.5ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e06 | 0.873 | vector | yes |
| 2 | e19 | 0.872 | vector | no |
| 3 | e03 | 0.864 | vector | no |

**hybrid** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 25.0ms

_abstain_

### q04 · expected `surface`

> TiDB 向量检索的 SQL 到底怎么写

- relevant: e11
- hardNegatives: e04, e17
- rationale: 精确技术词,BM25 应赢
- tags: lexical-friendly, exact

**bm25** · P@3 50.0% · R@3 100.0% · MRR 0.500 · falseSurface=false · 19.5ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e04 | 85.000 | bm25 | no |
| 2 | e11 | 84.000 | bm25 | yes |

**vector** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 6.3ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e11 | 0.907 | vector | yes |
| 2 | e04 | 0.873 | vector | no |
| 3 | e17 | 0.864 | vector | no |

**hybrid** · P@3 33.3% · R@3 100.0% · MRR 0.500 · falseSurface=false · 25.8ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e04 | 85.000 | bm25 | no |
| 2 | e11 | 84.000 | bm25 | yes |
| 3 | e17 | 0.864 | vector | no |

### q05 · expected `surface`

> 为什么很多人懒得记笔记、懒得整理想法

- relevant: e08
- hardNegatives: e12, e16
- rationale: 捕获摩擦的语义跳跃
- tags: paraphrase, capture

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 20.9ms

_abstain_

**vector** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=true · 6.3ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e41 | 0.889 | vector | no |
| 2 | e18 | 0.873 | vector | no |
| 3 | e50 | 0.864 | vector | no |

**hybrid** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=true · 25.4ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e41 | 0.889 | vector | no |
| 2 | e18 | 0.873 | vector | no |
| 3 | e50 | 0.864 | vector | no |

### q06 · expected `surface`

> 产品上线前是不是应该自己先用一段时间

- relevant: e07
- hardNegatives: e10, e13
- rationale: dogfood 词法友好
- tags: lexical-friendly

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 20.4ms

_abstain_

**vector** · P@3 33.3% · R@3 100.0% · MRR 0.500 · falseSurface=false · 5.6ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e10 | 0.907 | vector | no |
| 2 | e07 | 0.907 | vector | yes |
| 3 | e14 | 0.895 | vector | no |

**hybrid** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 25.8ms

_abstain_

### q07 · expected `surface`

> 用户根本不愿意打开一个单独的本地应用去管理聊天收藏

- relevant: e19, e20
- hardNegatives: e49, e08
- rationale: 产品 pivot 核心故事
- tags: product, pivot

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 20.5ms

_abstain_

**vector** · P@3 33.3% · R@3 50.0% · MRR 1.000 · falseSurface=false · 6.1ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e19 | 0.912 | vector | yes |
| 2 | e27 | 0.893 | vector | no |
| 3 | e07 | 0.891 | vector | no |

**hybrid** · P@3 33.3% · R@3 50.0% · MRR 1.000 · falseSurface=false · 27.3ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e19 | 0.912 | vector | yes |
| 2 | e27 | 0.893 | vector | no |
| 3 | e07 | 0.891 | vector | no |

### q08 · expected `abstain`

> 独立桌面 Collect 工具是不是正确的产品入口

- relevant: e49
- hardNegatives: e19, e20
- rationale: 问的是已推翻假设;理想行为是沉默或明确标 superseded,不应当正例强推 e19 当答案替代叙事混乱——标注为 abstain:旧结论不应再当有效建议浮现
- tags: superseded, abstain

**bm25** · P@3 100.0% · R@3 100.0% · MRR 1.000 · falseSurface=true · 20.6ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e49 | 100.000 | bm25 | yes |

**vector** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=true · 5.5ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e49 | 0.924 | vector | yes |
| 2 | e19 | 0.901 | vector | no |
| 3 | e20 | 0.888 | vector | no |

**hybrid** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=true · 25.7ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e49 | 100.000 | bm25 | yes |
| 2 | e19 | 0.901 | vector | no |
| 3 | e20 | 0.888 | vector | no |

### q09 · expected `surface`

> 误匹配太多,泛词也能打出很高分,怎么改召回

- relevant: e21, e23, e33
- hardNegatives: e45, e46
- rationale: precision-first 改造动机
- tags: product, precision

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 19.6ms

_abstain_

**vector** · P@3 66.7% · R@3 66.7% · MRR 1.000 · falseSurface=false · 6.0ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e21 | 0.923 | vector | yes |
| 2 | e33 | 0.906 | vector | yes |
| 3 | e03 | 0.895 | vector | no |

**hybrid** · P@3 66.7% · R@3 66.7% · MRR 1.000 · falseSurface=false · 25.6ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e21 | 0.923 | vector | yes |
| 2 | e33 | 0.906 | vector | yes |
| 3 | e03 | 0.895 | vector | no |

### q10 · expected `abstain`

> 实用 这个 快速

- relevant: (none)
- hardNegatives: e45, e46, e33
- rationale: 纯泛词选区:正确行为是沉默
- tags: abstain, generic-tokens

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 12.7ms

_abstain_

**vector** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=true · 4.7ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e46 | 0.876 | vector | no |
| 2 | e45 | 0.871 | vector | no |
| 3 | e27 | 0.868 | vector | no |

**hybrid** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 27.3ms

_abstain_

### q11 · expected `surface`

> LLM 页面消息滚走了还能不能跳回原句

- relevant: e24
- hardNegatives: e38, e39
- rationale: 锚点可靠性 paraphrase
- tags: paraphrase, anchor

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 19.1ms

_abstain_

**vector** · P@3 33.3% · R@3 100.0% · MRR 0.333 · falseSurface=false · 5.7ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e38 | 0.895 | vector | no |
| 2 | e39 | 0.887 | vector | no |
| 3 | e24 | 0.880 | vector | yes |

**hybrid** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 26.7ms

_abstain_

### q12 · expected `surface`

> Service Worker 挂了补想法丢了怎么办

- relevant: e25
- hardNegatives: e06, e34
- rationale: MV3 恢复 paraphrase
- tags: paraphrase, reliability

**bm25** · P@3 100.0% · R@3 100.0% · MRR 1.000 · falseSurface=false · 20.1ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e25 | 99.000 | bm25 | yes |

**vector** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 5.3ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e25 | 0.912 | vector | yes |
| 2 | e41 | 0.878 | vector | no |
| 3 | e06 | 0.869 | vector | no |

**hybrid** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 25.5ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e25 | 99.000 | bm25 | yes |
| 2 | e41 | 0.878 | vector | no |
| 3 | e06 | 0.869 | vector | no |

### q13 · expected `surface`

> 要不要做一个全自动记忆 Agent 替我决定用哪条旧想法

- relevant: e26
- hardNegatives: e05, e30
- rationale: 人在回路边界
- tags: product, hitl

**bm25** · P@3 100.0% · R@3 100.0% · MRR 1.000 · falseSurface=false · 20.5ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e26 | 99.000 | bm25 | yes |

**vector** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 6.6ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e26 | 0.915 | vector | yes |
| 2 | e05 | 0.900 | vector | no |
| 3 | e41 | 0.887 | vector | no |

**hybrid** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 27.4ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e26 | 99.000 | bm25 | yes |
| 2 | e05 | 0.900 | vector | no |
| 3 | e41 | 0.887 | vector | no |

### q14 · expected `surface`

> 对话内容默认真的不会上传吗

- relevant: e27
- hardNegatives: e34, e44
- rationale: 隐私 local-first
- tags: privacy

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 19.8ms

_abstain_

**vector** · P@3 33.3% · R@3 100.0% · MRR 0.333 · falseSurface=false · 5.4ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e28 | 0.886 | vector | no |
| 2 | e18 | 0.868 | vector | no |
| 3 | e27 | 0.868 | vector | yes |

**hybrid** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 25.1ms

_abstain_

### q15 · expected `surface`

> 相似分数都挤在 0.85 到 0.91,能直接当置信度吗

- relevant: e29
- hardNegatives: e17, e04
- rationale: 向量拥挤教训
- tags: eval, vector

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 21.2ms

_abstain_

**vector** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 7.6ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e29 | 0.913 | vector | yes |
| 2 | e17 | 0.886 | vector | no |
| 3 | e11 | 0.873 | vector | no |

**hybrid** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 27.9ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e29 | 0.913 | vector | yes |
| 2 | e17 | 0.886 | vector | no |
| 3 | e11 | 0.873 | vector | no |

### q16 · expected `surface`

> 是不是应该直接用向量替换现在的 BM25

- relevant: e30, e29
- hardNegatives: e04, e11
- rationale: Hybrid 不是替换
- tags: hybrid

**bm25** · P@3 100.0% · R@3 50.0% · MRR 1.000 · falseSurface=false · 20.1ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e30 | 94.000 | bm25 | yes |

**vector** · P@3 33.3% · R@3 50.0% · MRR 1.000 · falseSurface=false · 5.4ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e30 | 0.877 | vector | yes |
| 2 | e31 | 0.874 | vector | no |
| 3 | e46 | 0.869 | vector | no |

**hybrid** · P@3 33.3% · R@3 50.0% · MRR 1.000 · falseSurface=false · 25.2ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e30 | 94.000 | bm25 | yes |
| 2 | e31 | 0.874 | vector | no |
| 3 | e46 | 0.869 | vector | no |

### q17 · expected `surface`

> 还没标注集就先换一个更大的 embedding 模型 dual

- relevant: e31
- hardNegatives: e17, e51
- rationale: 先评测再调模型
- tags: eval

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=true · 20.5ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e43 | 86.000 | bm25 | no |

**vector** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 6.1ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e31 | 0.918 | vector | yes |
| 2 | e17 | 0.906 | vector | no |
| 3 | e43 | 0.896 | vector | no |

**hybrid** · P@3 33.3% · R@3 100.0% · MRR 0.500 · falseSurface=false · 26.7ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e43 | 86.000 | bm25 | no |
| 2 | e31 | 0.918 | vector | yes |
| 3 | e17 | 0.906 | vector | no |

### q18 · expected `surface`

> 面试怎么证明召回不是拍脑袋调的

- relevant: e32, e37, e22
- hardNegatives: e36
- rationale: 诊断驱动叙事
- tags: interview

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 20.8ms

_abstain_

**vector** · P@3 66.7% · R@3 66.7% · MRR 1.000 · falseSurface=false · 5.2ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e32 | 0.883 | vector | yes |
| 2 | e22 | 0.876 | vector | yes |
| 3 | e21 | 0.875 | vector | no |

**hybrid** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 53.2ms

_abstain_

### q19 · expected `surface`

> 重装扩展或 fork 仓库后本地 Echo 会不会丢

- relevant: e34, e35
- hardNegatives: e25, e06
- rationale: 备份与扩展 ID
- tags: reliability, migration

**bm25** · P@3 100.0% · R@3 50.0% · MRR 1.000 · falseSurface=false · 19.4ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e34 | 90.000 | bm25 | yes |

**vector** · P@3 33.3% · R@3 50.0% · MRR 1.000 · falseSurface=false · 6.6ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e34 | 0.923 | vector | yes |
| 2 | e27 | 0.877 | vector | no |
| 3 | e06 | 0.875 | vector | no |

**hybrid** · P@3 33.3% · R@3 50.0% · MRR 1.000 · falseSurface=false · 25.3ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e34 | 90.000 | bm25 | yes |
| 2 | e27 | 0.877 | vector | no |
| 3 | e06 | 0.875 | vector | no |

### q20 · expected `surface`

> 为了找工作要不要先做一个带鉴权的云同步后端

- relevant: e36
- hardNegatives: e27, e52
- rationale: 明确反对假后端
- tags: interview, scope

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 19.2ms

_abstain_

**vector** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 6.5ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e36 | 0.927 | vector | yes |
| 2 | e15 | 0.887 | vector | no |
| 3 | e14 | 0.886 | vector | no |

**hybrid** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 27.3ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e36 | 0.927 | vector | yes |
| 2 | e15 | 0.887 | vector | no |
| 3 | e14 | 0.886 | vector | no |

### q21 · expected `surface`

> observability 一定要接 Datadog 吗

- relevant: e52
- hardNegatives: e43, e22
- rationale: 本地 trace 立场
- tags: observability

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 20.3ms

_abstain_

**vector** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 5.1ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e52 | 0.891 | vector | yes |
| 2 | e34 | 0.877 | vector | no |
| 3 | e31 | 0.860 | vector | no |

**hybrid** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 24.1ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e52 | 0.891 | vector | yes |
| 2 | e34 | 0.877 | vector | no |
| 3 | e31 | 0.860 | vector | no |

### q22 · expected `surface`

> cheap model first, only escalate hard cases

- relevant: e01, e53
- hardNegatives: e02
- rationale: 英文选区对齐路由想法
- tags: bilingual, paraphrase

**bm25** · P@3 100.0% · R@3 100.0% · MRR 1.000 · falseSurface=false · 19.4ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e53 | 100.000 | bm25 | yes |
| 2 | e01 | 100.000 | bm25 | yes |

**vector** · P@3 66.7% · R@3 100.0% · MRR 1.000 · falseSurface=false · 5.7ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e01 | 0.866 | vector | yes |
| 2 | e53 | 0.833 | vector | yes |
| 3 | e46 | 0.833 | vector | no |

**hybrid** · P@3 66.7% · R@3 100.0% · MRR 1.000 · falseSurface=false · 24.3ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e53 | 100.000 | bm25 | yes |
| 2 | e01 | 100.000 | bm25 | yes |
| 3 | e46 | 0.833 | vector | no |

### q23 · expected `abstain`

> Apple 最新季度收入怎么样

- relevant: e54
- hardNegatives: e55
- rationale: 同词异义:公司语境不应捞出苹果派;语料里也没有财报 Echo → 应沉默
- tags: polysemy, abstain

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 19.6ms

_abstain_

**vector** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=true · 4.6ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e12 | 0.851 | vector | no |
| 2 | e13 | 0.850 | vector | no |
| 3 | e07 | 0.850 | vector | no |

**hybrid** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 24.0ms

_abstain_

### q24 · expected `surface`

> 做派之前黄油要怎么处理

- relevant: e55
- hardNegatives: e54
- rationale: 生活噪声在生活语境下可召回
- tags: noise-positive

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 19.0ms

_abstain_

**vector** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 4.9ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e55 | 0.909 | vector | yes |
| 2 | e07 | 0.857 | vector | no |
| 3 | e01 | 0.853 | vector | no |

**hybrid** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 23.9ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e55 | 0.909 | vector | yes |
| 2 | e07 | 0.857 | vector | no |
| 3 | e01 | 0.853 | vector | no |

### q25 · expected `surface`

> 今天练卧推安排

- relevant: e48
- hardNegatives: e21, e07
- rationale: 生活查询对生活 Echo
- tags: noise-positive

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 12.1ms

_abstain_

**vector** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 9.8ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e48 | 0.887 | vector | yes |
| 2 | e25 | 0.860 | vector | no |
| 3 | e12 | 0.859 | vector | no |

**hybrid** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 17.2ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e48 | 0.887 | vector | yes |
| 2 | e25 | 0.860 | vector | no |
| 3 | e12 | 0.859 | vector | no |

### q26 · expected `surface`

> 如何降低 LLM 应用的单位调用费用

- relevant: e01, e02
- hardNegatives: e14, e09
- rationale: 成本主题中英混合 paraphrase
- tags: paraphrase, cost, bilingual

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 20.2ms

_abstain_

**vector** · P@3 33.3% · R@3 50.0% · MRR 1.000 · falseSurface=false · 5.4ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e01 | 0.878 | vector | yes |
| 2 | e48 | 0.872 | vector | no |
| 3 | e38 | 0.865 | vector | no |

**hybrid** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 53.6ms

_abstain_

### q27 · expected `surface`

> 固定长度切 chunk 为什么不好

- relevant: e03
- hardNegatives: e04, e16
- rationale: 语义切块
- tags: lexical-friendly

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 25.7ms

_abstain_

**vector** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 9.0ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e03 | 0.909 | vector | yes |
| 2 | e14 | 0.877 | vector | no |
| 3 | e06 | 0.876 | vector | no |

**hybrid** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 47.4ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e03 | 0.909 | vector | yes |
| 2 | e14 | 0.877 | vector | no |
| 3 | e06 | 0.876 | vector | no |

### q28 · expected `surface`

> 提示里塞规则不如塞例子

- relevant: e18
- hardNegatives: e22, e31
- rationale: few-shot
- tags: lexical-friendly

**bm25** · P@3 100.0% · R@3 100.0% · MRR 1.000 · falseSurface=false · 24.1ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e18 | 97.000 | bm25 | yes |

**vector** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 9.1ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e18 | 0.893 | vector | yes |
| 2 | e21 | 0.872 | vector | no |
| 3 | e29 | 0.872 | vector | no |

**hybrid** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 23.7ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e18 | 97.000 | bm25 | yes |
| 2 | e21 | 0.872 | vector | no |
| 3 | e29 | 0.872 | vector | no |

### q29 · expected `surface`

> 相关内容现在不想看,是不是应该永久降权这条记忆

- relevant: e28
- hardNegatives: e41, e21
- rationale: wrong_time vs not_relevant
- tags: feedback

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 19.6ms

_abstain_

**vector** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=true · 5.6ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e41 | 0.891 | vector | no |
| 2 | e02 | 0.882 | vector | no |
| 3 | e36 | 0.882 | vector | no |

**hybrid** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 25.5ms

_abstain_

### q30 · expected `surface`

> 长选区测试:我们在做浏览器里的记忆层,核心不是存更多 AI 原文,而是在未来合适语境安静地还回一条旧想法。如果召回靠泛词,用户会关掉扩展。需要可解释的拒绝和精度优先。

- relevant: e21, e20, e26
- hardNegatives: e50, e45
- rationale: 长选区多主题,应优先产品原则类 Echo
- tags: long-query, product

**bm25** · P@3 100.0% · R@3 33.3% · MRR 1.000 · falseSurface=false · 22.2ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e21 | 91.000 | bm25 | yes |

**vector** · P@3 66.7% · R@3 66.7% · MRR 1.000 · falseSurface=false · 12.8ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e26 | 0.912 | vector | yes |
| 2 | e50 | 0.906 | vector | no |
| 3 | e21 | 0.905 | vector | yes |

**hybrid** · P@3 66.7% · R@3 66.7% · MRR 1.000 · falseSurface=false · 39.3ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e21 | 91.000 | bm25 | yes |
| 2 | e26 | 0.912 | vector | yes |
| 3 | e50 | 0.906 | vector | no |

### q31 · expected `surface`

> 文档写了但团队找不到

- relevant: e16
- hardNegatives: e40, e04
- rationale: 可检索性
- tags: paraphrase

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 11.9ms

_abstain_

**vector** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 4.8ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e16 | 0.889 | vector | yes |
| 2 | e25 | 0.876 | vector | no |
| 3 | e12 | 0.866 | vector | no |

**hybrid** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 17.0ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e16 | 0.889 | vector | yes |
| 2 | e25 | 0.876 | vector | no |
| 3 | e12 | 0.866 | vector | no |

### q32 · expected `surface`

> 周报写成了日常流水账

- relevant: e12
- hardNegatives: e15, e37
- rationale: 词法友好
- tags: lexical-friendly

**bm25** · P@3 100.0% · R@3 100.0% · MRR 1.000 · falseSurface=false · 19.7ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e12 | 99.000 | bm25 | yes |

**vector** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 5.4ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e12 | 0.925 | vector | yes |
| 2 | e48 | 0.870 | vector | no |
| 3 | e07 | 0.870 | vector | no |

**hybrid** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 24.7ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e12 | 99.000 | bm25 | yes |
| 2 | e48 | 0.870 | vector | no |
| 3 | e07 | 0.870 | vector | no |

### q33 · expected `surface`

> 要不要先投流拉新用户

- relevant: e13
- hardNegatives: e10, e09
- rationale: 冷启动
- tags: paraphrase

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 20.0ms

_abstain_

**vector** · P@3 33.3% · R@3 100.0% · MRR 0.500 · falseSurface=false · 4.9ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e10 | 0.896 | vector | no |
| 2 | e13 | 0.892 | vector | yes |
| 3 | e12 | 0.880 | vector | no |

**hybrid** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 25.0ms

_abstain_

### q34 · expected `surface`

> 会议能不能改成异步留言

- relevant: e15
- hardNegatives: e12, e05
- rationale: 异步优先
- tags: lexical-friendly

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 20.1ms

_abstain_

**vector** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 4.9ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e15 | 0.906 | vector | yes |
| 2 | e41 | 0.874 | vector | no |
| 3 | e28 | 0.871 | vector | no |

**hybrid** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 25.0ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e15 | 0.906 | vector | yes |
| 2 | e41 | 0.874 | vector | no |
| 3 | e28 | 0.871 | vector | no |

### q35 · expected `surface`

> cosine 之前要不要 normalize

- relevant: e17
- hardNegatives: e11, e29
- rationale: 英文技术词
- tags: bilingual, exact

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 46.9ms

_abstain_

**vector** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 4.9ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e17 | 0.890 | vector | yes |
| 2 | e14 | 0.881 | vector | no |
| 3 | e29 | 0.880 | vector | no |

**hybrid** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 25.1ms

_abstain_

### q36 · expected `surface`

> 首屏两分钟留不住人

- relevant: e10
- hardNegatives: e07, e13
- rationale: 首次体验 paraphrase
- tags: paraphrase

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 19.1ms

_abstain_

**vector** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 5.2ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e10 | 0.925 | vector | yes |
| 2 | e21 | 0.880 | vector | no |
| 3 | e28 | 0.880 | vector | no |

**hybrid** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 24.7ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e10 | 0.925 | vector | yes |
| 2 | e21 | 0.880 | vector | no |
| 3 | e28 | 0.880 | vector | no |

### q37 · expected `surface`

> 价格页要不要先放一个很贵的套餐

- relevant: e09
- hardNegatives: e01, e02
- rationale: 定价锚定
- tags: paraphrase

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 18.7ms

_abstain_

**vector** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 5.6ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e09 | 0.902 | vector | yes |
| 2 | e10 | 0.882 | vector | no |
| 3 | e13 | 0.878 | vector | no |

**hybrid** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=false · 24.7ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e09 | 0.902 | vector | yes |
| 2 | e10 | 0.882 | vector | no |
| 3 | e13 | 0.878 | vector | no |

### q38 · expected `abstain`

> 今天天气不错适合散步

- relevant: (none)
- hardNegatives: e47, e48, e55
- rationale: 与语料无决策相关;应完全沉默
- tags: abstain, unrelated

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 11.9ms

_abstain_

**vector** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=true · 4.1ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e08 | 0.854 | vector | no |
| 2 | e07 | 0.849 | vector | no |
| 3 | e06 | 0.848 | vector | no |

**hybrid** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 16.4ms

_abstain_

### q39 · expected `abstain`

> 把全部 ChatGPT 历史原文都存下来以后慢慢搜

- relevant: e50
- hardNegatives: e19, e08
- rationale: 已推翻的全文囤积假设;不应作为现行建议浮现
- tags: superseded, abstain

**bm25** · P@3 0.0% · R@3 0.0% · MRR 0.000 · falseSurface=false · 19.8ms

_abstain_

**vector** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=true · 6.0ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e50 | 0.911 | vector | yes |
| 2 | e16 | 0.884 | vector | no |
| 3 | e25 | 0.881 | vector | no |

**hybrid** · P@3 33.3% · R@3 100.0% · MRR 1.000 · falseSurface=true · 27.2ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e50 | 0.911 | vector | yes |
| 2 | e16 | 0.884 | vector | no |
| 3 | e25 | 0.881 | vector | no |

### q40 · expected `surface`

> hybrid 候选生成之后要不要立刻上 cross-encoder

- relevant: e51, e30
- hardNegatives: e31, e17
- rationale: rerank 排期判断
- tags: hybrid, eval

**bm25** · P@3 100.0% · R@3 100.0% · MRR 1.000 · falseSurface=false · 20.3ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e51 | 99.000 | bm25 | yes |
| 2 | e30 | 93.000 | bm25 | yes |

**vector** · P@3 33.3% · R@3 50.0% · MRR 1.000 · falseSurface=false · 6.5ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e51 | 0.929 | vector | yes |
| 2 | e31 | 0.887 | vector | no |
| 3 | e17 | 0.884 | vector | no |

**hybrid** · P@3 66.7% · R@3 100.0% · MRR 1.000 · falseSurface=false · 26.8ms

| # | id | score | source | relevant? |
| --- | --- | ---: | --- | --- |
| 1 | e51 | 99.000 | bm25 | yes |
| 2 | e30 | 93.000 | bm25 | yes |
| 3 | e31 | 0.887 | vector | no |

---

## Reproduce

```powershell
cd evals/recall-benchmark
npm install
npm run all
```
