# Echo 浮现算法全流程指南

**用途**：给 Gemini / 自己复习用。涵盖产品原则、当前代码实现、打分逻辑、以及如何一步步让浮现更精准。

**最后更新**：2026-06-25  
**代码位置**：`products/echo/extension/lib/resurface.ts`（唯一旋钮：`scoreEcho()`）

---

## 1. 这个产品到底在解决什么

Echo 不是收藏夹，不是知识库，不是 Agent。

> **在对的语境，把对的旧念头还给你——不是帮你存更多，而是降低「旧想法 × 新语境」撞上的成本。**

产品价值在 **return（浮现）**，不在 **store（收藏）**。最大风险是做成「更顺手的备忘录」：只进不出，堆满 AI 原文。

设计铁律：
- 浮现必须长在你已经在的地方（浏览器侧边栏），不能要你专门打开本地 app。
- 机器做体力活（连接、浮现、打分），人做价值判断（这条还有没有用）。
- **宁可漏浮，不可打扰**（ADHD 敏感）：precision（浮出来的有用）> recall（该浮的都浮）。

---

## 2. 两种捕获，两种心智

| 动作 | 入口 | 存什么 | 数据形态 |
| --- | --- | --- | --- |
| **Collect** | 选区 + 悬浮按钮 / 右键菜单 | 外部触发（AI 原文、一段话） | `status: raw`，`triggerText` = 选中文本 |
| **Keep** | 侧边栏手输 + `Keep` 按钮 | 自己的念头 | `status: confirmed`，`userThought` = 你写的话 |

Collect 存完**不弹侧边栏**，只在选区旁显示 `⭐ Saved to Echo` 小动画。  
Keep 是你主动写下的「被点亮的瞬间」。

---

## 3. 浮现的产品原则（Collect / Keep 两条回路）

来源：`docs/product-discussion-updated.md` 第 11 节。

> Collect 捕外部触发，Keep 捕自己念头；**浮现以念头为中心——Keep 求「啊对」，Collect 求「这让我想到」。**

| 浮现对象 | 目的 | 用户动作 |
| --- | --- | --- |
| **Keep（已有 `userThought`）** | 唤回你自己的想法 | 「啊对」→ 钉住 / 复用 |
| **Collect（raw，只有 `triggerText`）** | 逼出一个念头 | 「这让你想到什么？」→ 写下 → 升级成 Keep |

**为什么不能只浮现 Keep？**  
如果只浮现有 `userThought` 的条目，raw Collect 永远不回来 → 变成只进不出的收藏夹。  
**为什么不在 Collect 时强迫写想法？**  
会增加摩擦，人就不存了。补想法放在**浮现时**做——旧 quote 带着语境飞回来，这时才有动机写。

一段 Collect 反复浮现你都不补 → 自然降温/归档 → 「只进不出的会被淘汰」。

---

## 4. 技术架构总览

```
打开侧边栏 (sidepanel.tsx)
    │
    ├─→ 读当前页语境 (title, url, selection)
    │       通过 content script 消息 echo:get-page-context
    │
    ├─→ 从 Dexie 加载全部 echo (listRecentEchoes)
    │
    ├─→ selectResurfaced(echoes, context)     ← 稳定管线
    │       ├─ 过滤 ignored / pinned / snooze / 12h 冷却
    │       ├─ 每条调用 scoreEcho()           ← ★ 唯一旋钮 ★
    │       ├─ 必须有 reasons 才浮现
    │       └─ 取 Top 3
    │
    ├─→ 渲染「回声 · 此刻也许相关」区 (ResurfaceCard)
    │
    └─→ markSurfaced(ids) 写入 lastSurfacedAt，进入 12h 冷却
```

**关键设计**：浮现只在侧边栏 **mount 时算一次**，不在每次列表刷新时重算。避免像信息流一样一直跳。

### 文件地图

| 文件 | 职责 |
| --- | --- |
| `lib/resurface.ts` | 打分 + 选择管线（算法在这里） |
| `db/echoes.ts` | 持久化、生命周期字段与动作 |
| `components/ResurfaceCard.tsx` | Keep / Collect 两种 UI 与按钮 |
| `sidepanel.tsx` | 接线：读语境、算浮现、处理用户动作 |
| `contents/llm-context.ts` | 返回当前页 title / url / selection |

---

## 5. 数据模型（Dexie v4）

```ts
type Echo = {
  id: string
  triggerText: string           // Collect 的原文 / Keep 时也可等于 userThought
  inferredThought?: string
  userThought?: string          // 有值 = Keep 回路
  sourceApp: string             // chatgpt / claude / gemini / grok / browser
  url: string
  title: string                 // 收藏时所在页面标题
  createdAt: string             // ISO 时间戳
  status: "raw" | "inferred" | "confirmed" | "ignored" | "pinned"
  lastSurfacedAt?: string       // 上次被放进「回声」区的时间
  snoozeUntil?: string          // 「稍后」到期前不浮现
}
```

### 生命周期动作（`db/echoes.ts`）

| 函数 | 何时调用 | 效果 |
| --- | --- | --- |
| `markSurfaced(ids)` | 浮现展示后 | 写 `lastSurfacedAt`，12h 内不再浮 |
| `snoozeEcho(id, ms)` | 用户点「稍后」 | 写 `snoozeUntil`（默认 3 天） |
| `addThought(id, thought)` | Collect 卡片上「记下」 | 写 `userThought`，`status → confirmed` |
| `setEchoStatus(id, "ignored")` | 用户点「归档」 | 永久退出浮现池 |
| `togglePin(id)` | Keep 卡片「啊对，钉住」 | `status → pinned`，不再自动浮现 |

---

## 6. 当前算法实现（v0）

### 6.1 稳定管线：`selectResurfaced()`

一般**不要改**，除非要改过滤规则或 Top N。

步骤：
1. 排除 `status === "ignored"` 或 `"pinned"`
2. 排除 `snoozeUntil` 未到期
3. 排除 `lastSurfacedAt` 在 **12 小时**内
4. 每条过 `scoreEcho()`，附上 `mode`：
   - 有 `userThought` → `mode: "keep"`
   - 否则 → `mode: "collect"`
5. 过滤：`score > 0` **且** `reasons.length > 0`（没理由的不浮）
6. 按 score 降序，取前 **3** 条

常量（`lib/resurface.ts` 顶部）：

| 常量 | 值 | 含义 |
| --- | --- | --- |
| `MIN_AGE_DAYS` | 1 | 当天新存不因「冷落」浮现 |
| `RESURFACE_COOLDOWN_MS` | 12h | 展示后冷却 |
| `SNOOZE_DEFAULT_MS` | 3 天 | 「稍后」隐藏时长 |
| `DEFAULT_LIMIT` | 3 | 最多浮几条 |

### 6.2 可插拔旋钮：`scoreEcho(echo, ctx)`

**纯函数，无 IO。** 你以后调算法只改这里。

输入：
- `echo`：一条记录
- `ctx`：`{ title?, selection?, now? }` 当前页语境

输出：
- `score`：数字，越大越该浮
- `reasons`：字符串数组，展示为「why surfaced」标签

#### 当前三条规则

**规则 1：Keep 微弱加权**
```ts
if (echo.userThought) score += 2
```
只是同分 tie-breaker，**不能单独触发浮现**（必须有 reasons）。

**规则 2：冷落（neglect）**
```ts
if (ageDays >= 1 && !echo.lastSurfacedAt) {
  score += min(ageDays, 14)
  reasons.push(`存了 ${round(ageDays)} 天还没回看`)
}
```
存了 ≥1 天且从未被浮现过 → 该看一眼了。当天新存的不因此浮现。

**规则 3：语境关键词重叠**
```ts
overlap = 共同词数(echo全文, 当前页 title+selection)
if (overlap > 0) {
  score += overlap * 4
  reasons.push("和你正在看的内容相关")
}
```

#### 分词器（零依赖）

- **英文**：≥3 字符单词，小写，去停用词（the, and, for…）
- **中文**：连续汉字跑 **bigram**（「浮现算法」→「浮现」「现算」「算法」）
- 不用外部分词库，个人规模够用

#### echo 侧参与匹配的文本

```ts
echoText = userThought + inferredThought + triggerText + title
```

#### 当前页的 query 文本

```ts
ctxText = title + selection
```

### 6.3 v0 的已知局限

| 问题 | 例子 | 原因 |
| --- | --- | --- |
| 同义不同字浮不出 | 存了「定价策略」，现在在聊「怎么收费」 | 纯字面匹配 |
| 冷落线性加分 | 最老的 echo 可能长期霸榜 | `min(age,14)` 单调递增 |
| 维度量纲不一 | 冷落 0~14，语境 4n，谁大谁说了算 | 未归一化 |
| 无行为学习 | 你点了「归档」的同类还会浮 | 未记反馈 |

这些正是下面「演进路径」要解决的。

---

## 7. UI：两条回路怎么呈现

### Keep 模式（`ResurfaceCard`, mode === "keep"）

- 显示：`userThought`
- 标签：「你的念头」+ reasons
- 主按钮：**啊对，钉住** → `togglePin`
- 次按钮：稍后 / 归档

### Collect 模式（mode === "collect"）

- 显示：`triggerText`（最多 3 行）
- 标签：「旧片段」+ reasons
- 内联输入：**这让你想到什么？**
- 主按钮：**记下** → `addThought`（升级成 Keep）
- 次按钮：稍后 / 归档

用户操作后，卡片从本地 `resurfaced` state 移除（`dismissResurfaced`），本节不重算。

---

## 8. 如何让浮现更精准：演进路径

这是信息检索里的 **排序（ranking）** 问题：给定语境 query 和一堆 echo documents，排出此刻最该看的几条。

两个指标：
- **Precision（准）**：浮出来的大部分有用 → **对你最重要**
- **Recall（全）**：该浮的别漏 → 次要，漏了下次还能浮

### 第 0 级：当前（关键词重叠）✅ 已实现

- 字面匹配 + bigram + 冷落 + Keep 微弱加权
- 优点：零依赖、纯本地、可解释（每条有 reason）
- 天花板：同义不同字、语义相关但词不同 → 浮不出

### 第 1 级：信号归一化（推荐下一步，零新技术）

**目标**：把 `scoreEcho` 从「拍脑袋加分」变成「加权归一化打分」。

#### 1a. TF-IDF 替代裸词计数

现在每个重叠词 +4，不分稀有度。  
「问题」「方法」这种烂大街词命中，和「Zettelkasten」命中一样加分 → 噪音大。

改法：
- 对每个词算 IDF = log(总 echo 数 / 包含该词的 echo 数)
- 命中分 = TF(词在 echo 里出现次数) × IDF(词有多稀有)
- 罕见词命中 → 高分；常见词 → 几乎不加分

实现：遍历全部 echo 建词频表，纯本地，几十行。

#### 1b. 时间衰减：先升后降

现在 `min(ageDays, 14)` 线性增长 → 最老的永远霸榜。

改法：存 2~14 天的最该浮（还记得语境、又开始忘），太新没必要、太老可能已过时。

常用曲线：
```
neglectScore = exp(-((age - peak)^2) / (2 * sigma^2))   // 高斯，peak 约在 7 天
// 或
neglectScore = 1 / (1 + log(ageDays))                     // 对数衰减
```

#### 1c. 维度归一化 + 可调权重

把每个维度压到 0~1，再加权：

```
finalScore =
    w_context  * normalize(contextOverlap)   // 默认 0.5
  + w_neglect  * normalize(neglectCurve)     // 默认 0.3
  + w_warmth   * normalize(behaviorSignal)   // 默认 0.2（第 2 级才有）
```

权重变成你能直接拧的旋钮，且各维度可比。

**第 1 级投入小、见效快，建议 demo 自用前先上。**

### 第 2 级：行为信号（越用越准）

排序系统变准，往往靠 **学用户反馈**，不是靠更聪明的文本匹配。

| 用户动作 | 信号 | 对 `warmth` 的影响 |
| --- | --- | --- |
| 「啊对」/「记下」 | 正反馈 | +3 |
| 「稍后」 | 弱负反馈 | -1 |
| 「归档」 | 强负反馈 | -5 |
| 浮现了但没动 | 极弱负反馈 | -0.5 |

实现：
- Echo 加字段 `warmth: number`（默认 0）
- 每次用户动作后更新
- `scoreEcho` 里读 `warmth`，归一化后加权

不需要 ML，就是计数器。但威力在于：**机器猜不准没关系，你用一阵它自己就准了。**

建议：**越早开始记 warmth，数据积累越久越准。** 可以在第 1 级同时埋字段，先不参与打分。

### 第 3 级：语义匹配（本地向量）

跨过「同义不同字」天花板的一步。

**做法**：
1. 每条 echo 收藏时算 embedding 向量，存 Dexie（新字段 `embedding: number[]`）
2. 打开侧边栏时，当前页语境也算一个向量
3. 余弦相似度 → `contextScore`

**纯本地可行方案**：
- `Transformers.js` + `multilingual-e5-small`（~100MB，浏览器内跑）
- 或 Python 侧算好导出（若以后有本地服务）
- 个人规模（几百~几千条）：遍历算余弦，不用向量数据库

**何时上**：第 1+2 级跑 2~4 周后，若主要抱怨是「字面匹配漏了该浮的」再上。  
向量是锦上添花，不是救「根本没人看回声区」。

### 第 4 级：混合排序（成熟形态）

```
finalScore =
    w1 * semanticSimilarity(embedding)     // 语义，准
  + w2 * tfidfOverlap(echo, context)       // 关键词，不漏
  + w3 * neglectCurve(age)                 // 时机
  + w4 * normalize(warmth)                 // 学出来的偏好
  + w5 * keepBoost(hasUserThought)         // 念头优先

惩罚项：
  - 刚浮过（lastSurfacedAt 12h 内）→ 已在管线过滤
  - 同源刷屏（同一 url 已浮 2 条）→ 降权
  - snooze / ignored → 已在管线过滤
```

向量管「准」，关键词管「不漏」，行为管「越用越懂你」，时间管「时机」。

---

## 9. 实操建议（别跳级）

```
现在 (v0)          → 关键词 + 冷落 + Keep 加权
     ↓
第 1 级（马上可做）  → TF-IDF + 时间曲线 + 归一化加权
     ↓ 同时埋 warmth 字段
第 2 级（2~4 周）   → 行为信号参与打分
     ↓ 确认「浮现有用」且「字面漏太多」
第 3 级（按需）      → 本地 embedding
     ↓
第 4 级（长期）      → 混合排序
```

**反直觉但重要**：让浮现「显得准」，往往靠**更狠的过滤**，不是更强的算法。
- 3 条全中 > 8 条半相关
- 没把握的不浮（`reasons.length > 0` + `top 3`）已经是对的思路，继续守住

---

## 10. 你怎么改代码（给 Gemini 的上下文）

### 唯一入口

```ts
// products/echo/extension/lib/resurface.ts

export const scoreEcho = (
  echo: Echo,
  ctx: ResurfaceContext
): { score: number; reasons: string[] } => {
  // ← 所有算法演进都改这个函数体
  // ← 可以新增参数，如全部 echoes（算 IDF）或 warmth
}
```

若第 1 级需要 IDF，可把 `selectResurfaced` 改成先建全局词频，再传给 `scoreEcho`：

```ts
export const selectResurfaced = (echoes, ctx, limit) => {
  const idf = buildIdfTable(echoes)  // 新增
  return echoes
    .filter(...)
    .map(echo => {
      const { score, reasons } = scoreEcho(echo, ctx, { idf })  // 传入
      ...
    })
}
```

管线过滤逻辑一般不动；打分逻辑全在 `scoreEcho`（及其小 helper）。

### 若加 warmth 字段

1. `db/echoes.ts`：`Echo` 类型加 `warmth?: number`，Dexie 升 version 5
2. `ResurfaceCard` / `sidepanel` 各 handler 里调用 `bumpWarmth(id, delta)`
3. `scoreEcho` 里读 `echo.warmth`

### 若加 embedding

1. 收藏时（`createEcho`）异步算向量写入
2. `scoreEcho` 里用余弦相似度替代或补充关键词 overlap
3. 注意：模型首次加载 ~100MB，算力在浏览器

### 测试思路（无自动化测试时）

1. 手工存 10 条 echo（5 Keep + 5 Collect），故意用不同词但同主题
2. 打开相关 LLM 页面，看「回声」区浮谁、reasons 是什么
3. 调权重 / 规则，刷新侧边栏（关再开）看变化
4. 记录：浮出来的你会不会点？会不会烦？

---

## 11. 给 Gemini 的提问模板

你可以把本文档全文贴给 Gemini，然后问例如：

1. **「请根据第 6 节当前实现，帮我在 `scoreEcho` 里实现第 1a 节 TF-IDF，给出完整 TypeScript 代码。」**
2. **「我存了『定价策略』，现在在聊『怎么收费』，v0 浮不出来。在不引入向量的情况下，还有什么办法？」**
3. **「请设计 `warmth` 字段和 `bumpWarmth` 函数，并说明在哪些用户动作里调用。」**
4. **「用 Transformers.js 在 Chrome 扩展里算 embedding 可行吗？最小实现步骤是什么？」**
5. **「我附上了 10 条测试 echo 和当前页面 title/selection，请模拟 `selectResurfaced` 会浮哪 3 条、为什么。」**

---

## 12. 相关文档

| 文档 | 内容 |
| --- | --- |
| `docs/product-discussion-updated.md` §11 | Collect / Keep / 浮现产品原则 |
| `products/echo/extension/README.md` | 扩展开发与实现索引 |
| `docs/memory-layer-design.md` | 记忆层整体设计（部分表述已被侧边栏方案 supersede） |
| `docs/memory-theory.md` | 学术背景（Memex、扩散激活、取回线索） |

---

## 13. 一句话锚点

> 浮现是排序问题，不是搜索问题。  
> Keep 求「啊对」，Collect 求「这让我想到」。  
> 算法旋钮在 `scoreEcho()`；先用 TF-IDF + 行为信号把 v0 打磨准，再考虑向量。
