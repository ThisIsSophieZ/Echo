# Echo 向量召回实验(TiDB Cloud Zero)

一次性实验,回答一个问题:**给 Echo 上"语义/向量召回",到底比现在的 BM25 词法多捞回多少"意思相近但用词不同"的旧念头?**

> 正式、可复现的标注评测与 BM25 / Vector / Hybrid 对照已迁到 [`evals/recall-benchmark/`](../../evals/recall-benchmark/)。本目录保留 TiDB Cloud Zero 管线作为早期实验痕迹。
>
> 这不是产品代码。Echo 主线是纯本地、无服务器、刻意不用向量;这里只是拿 TiDB Cloud Zero 的免费临时库当**离线实验台**,验证完即弃。**不要**把它接进扩展。

## 它怎么做到"诚实对比"

- **词法一侧直接复用产品真身** `products/echo/extension/lib/echo-related.ts` 的 `analyzeRelatedEchoes`(含真实阈值)。该文件运行时零依赖(只有 `import type`),所以能原样跑,不是近似重写。
- **向量一侧** = 本地 `multilingual-e5-small` 生成 embedding(免费、离线)+ TiDB `VEC_COSINE_DISTANCE` 排序。
- 两侧看到的是**同样的字段**(`userThought / title / triggerText / inferredThought`)。

## 前置

- Node 18+(需要内置 `fetch` 和 `Intl.Segmenter`,和产品分词一致)
- 联网:创建 TiDB 实例、首次下载 embedding 模型(约 100MB)、连库

## 跑起来

```powershell
cd experiments/vector-recall-tidb
npm install

npm run seed      # 造中英混合样本 -> data/echoes.json + data/selections.json
npm run create    # 建 TiDB Cloud Zero 临时库 -> data/instance.json(含凭证,已 gitignore)
npm run load      # 给每条 Echo 算 embedding,建 VECTOR 表并灌数
npm run compare   # 词法 vs 向量并排召回 -> data/report.md

# 或一条龙
npm run all
```

看结果:打开 `data/report.md`。每个选区都有词法命中表、向量命中表,以及"**向量独有召回**"(向量捞到、词法漏掉的高置信 Echo)。

## 换成你的真实数据

样本只是把管线跑通。要拿真证据,用真实 Echo:

1. 按 `export-from-browser.js` 顶部说明,在 Echo 侧边栏的 DevTools Console 里跑一下,下载 `echoes.json`。
2. 覆盖到 `data/echoes.json`。
3. 按需改 `data/selections.json`(填你真的会在 LLM 页面上选中的句子)。
4. `npm run load && npm run compare`。

## 用完清理

- 临时库 30 天自动销毁,啥都不用管。
- 想立刻不留痕:删掉 `data/instance.json`,以及整个 `experiments/vector-recall-tidb/`(模型缓存在 `.cache/`,依赖在 `node_modules/`,都在文件夹内)。
- `data/instance.json` 含数据库凭证,已被 `.gitignore` 排除,别提交。

## 可选:用大会送的 API key

默认走免注册公开预览端点。如果要用 key:

```powershell
$env:TIDB_ZERO_API_KEY = "你的key"
npm run create
```
