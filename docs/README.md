# Docs index

这些文档是 Echo 的产品规格、决策记录与面试证据。先看这里，再看代码。运行方式见 [`../CONTRIBUTING.md`](../CONTRIBUTING.md)。

## 产品与设计（来自原仓库 docs/）

| 文件 | 用途 |
| --- | --- |
| [prd.md](./prd.md) | 产品需求 |
| [product-boundary.md](./product-boundary.md) | 产品边界 |
| [roadmap.md](./roadmap.md) | 路线图 |
| [privacy-threat-model.md](./privacy-threat-model.md) | 本地数据流、浏览器权限与威胁模型 |
| [mvp-user-flows.md](./mvp-user-flows.md) | MVP 用户流 |
| [mvp-risks.md](./mvp-risks.md) | MVP 风险 |
| [memory-layer-design.md](./memory-layer-design.md) | Memory Layer 设计 |
| [memory-schema.md](./memory-schema.md) | 记忆 schema |
| [memory-theory.md](./memory-theory.md) | 记忆理论 |
| [resurface-algorithm-guide.md](./resurface-algorithm-guide.md) | 浮现算法 |
| [information-architecture.md](./information-architecture.md) | 信息架构 |
| [founder-memory.md](./founder-memory.md) | Founder 记忆笔记 |
| [capture-and-consensus-notes.md](./capture-and-consensus-notes.md) | Capture / 共识笔记 |
| [chatgpt-collect-project.md](./chatgpt-collect-project.md) | 一代 Collect 项目 |
| [product-discussion-updated.md](./product-discussion-updated.md) | 产品讨论（更新） |
| [product-discussion-phase2.md](./product-discussion-phase2.md) | 产品讨论 Phase 2 |
| [change-log.md](./change-log.md) | 变更日志 |

## 面试证据

| 文件 | 用途 |
| --- | --- |
| [interview/Echo-case-study.md](./interview/Echo-case-study.md) | 主面试 Case Study（pivot / 评测 / 不上线决策） |
| [interview/daily/2026-08-04.md](./interview/daily/2026-08-04.md) | Interview Edition 开发日报 |

## 决策记录

Decision Logs 是当前有效的决策摘要；长篇产品讨论保留为原始证据。

| 文件 | 当前决策 |
| --- | --- |
| [decisions/001-why-local-first.md](./decisions/001-why-local-first.md) | 为什么默认本地存储、主动导出 |
| [decisions/002-why-precision-over-recall.md](./decisions/002-why-precision-over-recall.md) | 为什么宁愿沉默也不弱匹配 |
| [decisions/003-why-vector-is-not-shipped.md](./decisions/003-why-vector-is-not-shipped.md) | 为什么向量与 Hybrid 只留在离线实验 |

## 评测

- 召回 benchmark：[`../evals/recall-benchmark/`](../evals/recall-benchmark/)
- 结论摘要：[`../evals/recall-benchmark/data/CONCLUSIONS.md`](../evals/recall-benchmark/data/CONCLUSIONS.md)

## 仓库内其他文档位置

- 扩展开发日志：`../extension/DEVELOPMENT.md`
- 扩展 README：`../extension/README.md`
- 技术壁垒：`../research/technical-moat-analysis-2026-07.md`
- 竞品分析：`../research/competitive-analysis-2026-07.md`
- 竞品日报：`../competitive-intel/echo/`
- 向量召回实验：`../experiments/vector-recall-tidb/README.md`
