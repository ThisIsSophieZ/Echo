import fs from "node:fs"

import { DATA_DIR, ECHOES_PATH, SELECTIONS_PATH } from "./config"
import type { Echo } from "./echo-shape"

// Sample Echoes shaped like real captures: a founder's own thought (userThought)
// plus the AI text that triggered it (triggerText), across ChatGPT/Claude/etc.
// Swap this out for exported real data later (see export-from-browser.js).
const seed: Array<Omit<Echo, "createdAt" | "status">> = [
  {
    id: "e01",
    userThought: "先用便宜的小模型跑一遍,把明显不行的筛掉,只把拿不准的交给贵的那个",
    title: "模型分级路由",
    triggerText: "Route easy cases to a cheap model and only escalate the hard ones.",
    inferredThought: "",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e01"
  },
  {
    id: "e02",
    userThought: "同样的问题把结果缓存下来,别每次都重新烧一遍钱",
    title: "响应缓存",
    triggerText: "Cache repeated prompts so you stop paying for the same answer twice.",
    sourceApp: "claude",
    url: "https://claude.ai/chat/e02"
  },
  {
    id: "e03",
    userThought: "切块别按固定字数硬切,按语义边界切,召回质量高很多",
    title: "语义切块",
    triggerText: "Semantic chunking beats fixed-size splitting for retrieval quality.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e03"
  },
  {
    id: "e04",
    userThought: "关键词搜索最大的毛病是换个说法就搜不到,向量能抓住意思一样的",
    title: "为什么需要向量检索",
    triggerText: "Keyword search misses paraphrases; embeddings capture meaning.",
    sourceApp: "gemini",
    url: "https://gemini.google.com/app/e04"
  },
  {
    id: "e05",
    userThought: "Agent 必须记住上一轮聊过什么,不然每次都从头再来,太蠢了",
    title: "Agent 记忆",
    triggerText: "Agents need to remember prior turns instead of starting cold each time.",
    sourceApp: "claude",
    url: "https://claude.ai/chat/e05"
  },
  {
    id: "e06",
    userThought: "把会话状态落到库里,进程重启也不会把进度弄丢",
    title: "会话持久化",
    triggerText: "Persist conversation state to a database so restarts don't lose progress.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e06"
  },
  {
    id: "e07",
    userThought: "自己天天用才知道哪里别扭;你自己都不愿意用的功能,就是还没想清楚",
    title: "先自己用",
    triggerText: "If you won't use it every day, it isn't ready to ship.",
    sourceApp: "grok",
    url: "https://grok.com/chat/e07"
  },
  {
    id: "e08",
    userThought: "存东西这一步只要有一丁点摩擦,人就干脆不存了",
    title: "零摩擦捕获",
    triggerText: "Any friction in the capture step quietly kills the habit.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e08"
  },
  {
    id: "e09",
    userThought: "定价先放个贵的选项当锚点,后面的就显得划算了",
    title: "定价锚定",
    triggerText: "Show an expensive option first so everything else looks reasonable.",
    sourceApp: "claude",
    url: "https://claude.ai/chat/e09"
  },
  {
    id: "e10",
    userThought: "新用户头两分钟没感觉到价值就走了,首屏必须直接给结果",
    title: "首次体验",
    triggerText: "If users don't feel value in the first two minutes, they leave.",
    sourceApp: "gemini",
    url: "https://gemini.google.com/app/e10"
  },
  {
    id: "e11",
    userThought: "TiDB 里用 VEC_COSINE_DISTANCE 给结果按相似度排序",
    title: "TiDB 向量查询",
    triggerText: "Order rows by VEC_COSINE_DISTANCE in TiDB for similarity search.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e11"
  },
  {
    id: "e12",
    userThought: "周报别写成流水账,只写卡点和要做的决策",
    title: "周报怎么写",
    triggerText: "Weekly updates should list blockers and decisions, not an activity log.",
    sourceApp: "claude",
    url: "https://claude.ai/chat/e12"
  },
  {
    id: "e13",
    userThought: "冷启动别急着投广告,先手动找到 100 个真的离不开你的用户",
    title: "冷启动获客",
    triggerText: "Find 100 users who love it before you scale acquisition.",
    sourceApp: "grok",
    url: "https://grok.com/chat/e13"
  },
  {
    id: "e14",
    userThought: "别过早优化性能,先把能用的东西做出来再说",
    title: "别过早优化",
    triggerText: "Don't optimize before you have something that actually works.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e14"
  },
  {
    id: "e15",
    userThought: "能异步就别开会,别为了同步硬凑一个所有人都在的时间",
    title: "异步优先",
    triggerText: "Prefer async over forcing everyone into a synchronous meeting.",
    sourceApp: "claude",
    url: "https://claude.ai/chat/e15"
  },
  {
    id: "e16",
    userThought: "文档写完没人搜得到就等于白写,能被检索到才算数",
    title: "文档要能被搜到",
    triggerText: "Docs nobody can find are worthless; retrievability is the whole point.",
    sourceApp: "gemini",
    url: "https://gemini.google.com/app/e16"
  },
  {
    id: "e17",
    userThought: "embedding 先归一化,再用余弦相似度会稳很多",
    title: "归一化向量",
    triggerText: "Normalize embeddings before cosine similarity for stable results.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e17"
  },
  {
    id: "e18",
    userThought: "提示词里直接给几个例子,比长篇讲规则管用多了",
    title: "少样本示例",
    triggerText: "A few concrete examples in the prompt beat a long list of rules.",
    sourceApp: "claude",
    url: "https://claude.ai/chat/e18"
  }
]

// "Real selections" — text a user might highlight on an LLM page. Each is tagged
// with what we EXPECT so the report is easy to read; the run shows what actually
// happens. Deliberately mixed: some should favor vector, some lexical is enough.
// `relevant` = 人工判定"这条选区真正应该召回哪些 Echo"(用于诚实评估排名/精度)。
const selections = [
  {
    id: "s1",
    text: "推理成本太高了,有没有省钱的优化思路",
    relevant: ["e01", "e02"],
    expect: "语义=降成本。词法里没有『成本/省钱』这些词的 Echo,期待向量捞回 e01(分级路由)、e02(缓存)"
  },
  {
    id: "s2",
    text: "换个说法就搜不到东西了,这个问题怎么解决",
    relevant: ["e04"],
    expect: "用词直接撞上 e04(换个说法/搜不到)。词法应该就能命中——展示词法够用的情况"
  },
  {
    id: "s3",
    text: "怎么让 bot 在不同对话之间保持上下文",
    relevant: ["e05", "e06"],
    expect: "语义=Agent 记忆。用词(对话/保持/上下文)和 e05/e06(上一轮/会话/落库)错开,期待向量赢"
  },
  {
    id: "s4",
    text: "TiDB 向量检索的 SQL 到底怎么写",
    relevant: ["e11"],
    expect: "用词精确撞上 e11(TiDB 向量查询)。词法应清晰命中——展示词法强项"
  },
  {
    id: "s5",
    text: "为什么很多人懒得记笔记、懒得整理想法",
    relevant: ["e08"],
    expect: "语义=捕获摩擦。用词(记笔记/整理)和 e08(存东西/摩擦)完全错开,期待向量做语义跳跃"
  },
  {
    id: "s6",
    text: "产品上线前是不是应该自己先用一段时间",
    relevant: ["e07"],
    expect: "用词(自己/先用)撞上 e07。词法应能命中——又一个词法够用的情况"
  }
]

const now = Date.now()
const echoes: Echo[] = seed.map((item, index) => ({
  ...item,
  status: item.userThought ? "confirmed" : "raw",
  // Space timestamps a minute apart, newest last, so createdAt tie-breaks work.
  createdAt: new Date(now - (seed.length - index) * 60_000).toISOString()
}))

fs.mkdirSync(DATA_DIR, { recursive: true })
fs.writeFileSync(ECHOES_PATH, JSON.stringify(echoes, null, 2), "utf8")
fs.writeFileSync(SELECTIONS_PATH, JSON.stringify(selections, null, 2), "utf8")

console.log(`[seed] wrote ${echoes.length} echoes -> ${ECHOES_PATH}`)
console.log(`[seed] wrote ${selections.length} selections -> ${SELECTIONS_PATH}`)
