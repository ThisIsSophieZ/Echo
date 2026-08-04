import fs from "node:fs"

import {
  CORPUS_PATH,
  DATA_DIR,
  FIXTURE_VERSION,
  QUERIES_PATH
} from "./config"
import type { BenchmarkEcho, BenchmarkQuery } from "./types"

/**
 * Dogfood-realistic fixture corpus.
 *
 * Honest labeling: these are NOT a dump of the author's private IndexedDB.
 * They are constructed from Echo's real product themes (pivot, precision-first
 * recall, anchors, MV3 recovery, local-first) plus common AI-application
 * judgments so the benchmark exercises paraphrase, hard negatives, abstention,
 * and bilingual queries. Swap in a desensitized export via export-from-browser.js
 * when available — same schema.
 */
const seed: Array<Omit<BenchmarkEcho, "createdAt" | "status">> = [
  {
    id: "e01",
    userThought: "先用便宜的小模型跑一遍,把明显不行的筛掉,只把拿不准的交给贵的那个",
    title: "模型分级路由",
    triggerText: "Route easy cases to a cheap model and only escalate the hard ones.",
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
  },
  {
    id: "e19",
    userThought: "用户不会为了整理 AI 对话专门打开另一个本地 App,入口必须长在已有工作流里",
    title: "Collect 被推翻的原因",
    triggerText: "People will not open a separate desktop app just to manage chat snippets.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e19"
  },
  {
    id: "e20",
    userThought: "侧边栏常驻比独立工具重要:捕获和浮现都要零启动",
    title: "转向浏览器 Side Panel",
    triggerText: "Keep capture and resurfacing inside the browser side panel the user already has open.",
    sourceApp: "claude",
    url: "https://claude.ai/chat/e20"
  },
  {
    id: "e21",
    userThought: "宁可沉默也不要用泛词把十几个弱匹配推到脸上",
    title: "精度优先于召回",
    triggerText: "Prefer silence over surfacing a pile of weak single-token matches.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e21"
  },
  {
    id: "e22",
    userThought: "Probe 报告要能解释为什么接受或拒绝,不能只丢一个神秘分数",
    title: "可解释召回",
    triggerText: "Every accept/reject needs an explainable ledger, not a black-box confidence.",
    sourceApp: "gemini",
    url: "https://gemini.google.com/app/e22"
  },
  {
    id: "e23",
    userThought: "单词匹配一律不浮现;至少要有连续短语或三个有效词",
    title: "Precision-first gate",
    triggerText: "Single-token lexical hits never surface; require a phrase or three solid terms.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e23"
  },
  {
    id: "e24",
    userThought: "动态 DOM 和虚拟列表下,锚点要用原生 ID + 指纹 + 邻居消歧 + 失败回退",
    title: "Anchor v2",
    triggerText: "Locate messages with native ids, SHA-256 fingerprints, neighbor disambiguation, and fallbacks.",
    sourceApp: "claude",
    url: "https://claude.ai/chat/e24"
  },
  {
    id: "e25",
    userThought: "MV3 Service Worker 会睡死,补想法要先入 chrome.storage 队列再写 Dexie",
    title: "写入竞态恢复",
    triggerText: "Queue pending thought writes in chrome.storage.local before Dexie commits.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e25"
  },
  {
    id: "e26",
    userThought: "记忆层不是 Agent:不要自动替用户做决定,人必须确认",
    title: "人在回路",
    triggerText: "A memory layer should resurface candidates; humans confirm what to use.",
    sourceApp: "grok",
    url: "https://grok.com/chat/e26"
  },
  {
    id: "e27",
    userThought: "本地优先:默认不上传对话,导出才是用户主动带走数据",
    title: "Local-first 隐私",
    triggerText: "Keep Echoes in IndexedDB by default; export is the only intentional leave-device path.",
    sourceApp: "claude",
    url: "https://claude.ai/chat/e27"
  },
  {
    id: "e28",
    userThought: "相关但时机不对,不能当成内容不相关;反馈要拆 wrong_time",
    title: "区分时机与相关性",
    triggerText: "Wrong timing is not the same as irrelevant content; keep those feedback signals separate.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e28"
  },
  {
    id: "e29",
    userThought: "向量相似度挤在一起时,不能拿绝对 cosine 当置信度",
    title: "相似度拥挤",
    triggerText: "When top-k cosine scores cluster tightly, absolute similarity is not confidence.",
    sourceApp: "gemini",
    url: "https://gemini.google.com/app/e29"
  },
  {
    id: "e30",
    userThought: "Hybrid 应该是词法候选并上语义候选,再 precision-first 重排,而不是直接替换 BM25",
    title: "Hybrid 不是替换",
    triggerText: "Hybrid means union then gated rerank, not dropping lexical recall wholesale.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e30"
  },
  {
    id: "e31",
    userThought: "评测先有 golden set,再谈换 embedding 或上 reranker",
    title: "先评测再调模型",
    triggerText: "Build a labeled recall set before swapping embedding models or adding rerankers.",
    sourceApp: "claude",
    url: "https://claude.ai/chat/e31"
  },
  {
    id: "e32",
    userThought: "面试叙事要讲清:我如何用 1493 个候选诊断推翻第一版召回",
    title: "用诊断数据推翻算法",
    triggerText: "Show how probe ledgers and failure counts drove the precision-first redesign.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e32"
  },
  {
    id: "e33",
    userThought: "实用、这个、快速这类泛词在中文里会制造大量误匹配",
    title: "中文泛词陷阱",
    triggerText: "Generic Chinese tokens create false positives if single-token matches can surface.",
    sourceApp: "gemini",
    url: "https://gemini.google.com/app/e33"
  },
  {
    id: "e34",
    userThought: "备份导入导出按 id upsert,狗粮迁移和重装扩展才不怕丢数据",
    title: "备份恢复",
    triggerText: "Backup/import should upsert by id so reinstalls and forks do not lose Echoes.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e34"
  },
  {
    id: "e35",
    userThought: "Chrome 扩展路径改了会换 ID,IndexedDB 不会跟着走;用 junction 或备份导入",
    title: "扩展 ID 与数据绑定",
    triggerText: "Unpacked extension path changes change the extension id and orphan IndexedDB.",
    sourceApp: "claude",
    url: "https://claude.ai/chat/e35"
  },
  {
    id: "e36",
    userThought: "不要为了简历临时搭一个没有用户的云后端",
    title: "不做假后端",
    triggerText: "A fake multi-tenant backend built only for resumes is negative signal.",
    sourceApp: "grok",
    url: "https://grok.com/chat/e36"
  },
  {
    id: "e37",
    userThought: "失败案例比平均分更有说服力:挑出误浮现和漏召回各讲清楚",
    title: "失败案例叙事",
    triggerText: "Interviewers trust concrete false-positive and false-negative stories over averages alone.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e37"
  },
  {
    id: "e38",
    userThought: "LLM 页面标题会变,捕获时要解析真实会话标题而不是 tab 默认名",
    title: "标题解析",
    triggerText: "Resolve the real conversation title instead of trusting a generic browser tab name.",
    sourceApp: "claude",
    url: "https://claude.ai/chat/e38"
  },
  {
    id: "e39",
    userThought: "内容脚本在扩展 reload 后会过期,用户需要刷新 LLM 标签页",
    title: "Content script 过期",
    triggerText: "After extension reload, content scripts on open tabs go stale until refresh.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e39"
  },
  {
    id: "e40",
    userThought: "搜索是本地过滤已加载数组,暂时不需要单独的全文索引",
    title: "本地搜索策略",
    triggerText: "Client-side filter over the loaded Echo array is enough at dogfood scale.",
    sourceApp: "gemini",
    url: "https://gemini.google.com/app/e40"
  },
  {
    id: "e41",
    userThought: "被推翻的想法要能标记,否则旧结论会在新语境里继续误导",
    title: "过期想法治理",
    triggerText: "Superseded ideas need status so resurfacing does not revive dead conclusions.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e41"
  },
  {
    id: "e42",
    userThought: "多模型对照时记录分歧,不要假装只有一个正确答案",
    title: "多模型分歧",
    triggerText: "When models disagree, capture the disagreement instead of forcing a single answer.",
    sourceApp: "claude",
    url: "https://claude.ai/chat/e42"
  },
  {
    id: "e43",
    userThought: "成本看板要分冷启动和热运行,否则 embedding 模型下载会污染延迟数字",
    title: "冷热延迟分开报",
    triggerText: "Report cold-start and warm latency separately for embedding pipelines.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e43"
  },
  {
    id: "e44",
    userThought: "威胁模型一页就够:扩展可读范围、临时选区、导出内容、第三方 API 边界",
    title: "轻量威胁模型",
    triggerText: "A one-page threat model covering page access, selection, export, and third-party APIs is enough.",
    sourceApp: "grok",
    url: "https://grok.com/chat/e44"
  },
  {
    id: "e45",
    userThought: "实用工具清单可以很长,但那不等于我现在要做这些功能",
    title: "泛词噪声样本",
    triggerText: "A long list of practical tips is not a commitment to build every tip.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e45"
  },
  {
    id: "e46",
    userThought: "这个方案看起来很快,但快速落地不等于解决了误打扰",
    title: "快速≠正确",
    triggerText: "Shipping fast is not the same as fixing false resurfacing.",
    sourceApp: "claude",
    url: "https://claude.ai/chat/e46"
  },
  {
    id: "e47",
    userThought: "咖啡豆烘焙曲线和产品路线图无关,只是偶然聊到的兴趣",
    title: "无关兴趣噪声",
    triggerText: "Coffee roasting curves are an unrelated hobby chat, not product memory.",
    sourceApp: "gemini",
    url: "https://gemini.google.com/app/e47"
  },
  {
    id: "e48",
    userThought: "健身房卧推计划本周完成三次,跟 AI 记忆产品无关",
    title: "生活噪声",
    triggerText: "Gym schedule notes should never resurface during LLM engineering work.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e48"
  },
  {
    id: "e49",
    userThought: "旧假设:独立 Collect 桌面端是正确入口——已推翻,勿再当正例",
    title: "已推翻的 Collect 假设",
    triggerText: "Deprecated hypothesis: a standalone Collect desktop app is the right entry point.",
    sourceApp: "claude",
    url: "https://claude.ai/chat/e49",
    inferredThought: "superseded by side-panel Echo"
  },
  {
    id: "e50",
    userThought: "旧假设:把所有 AI 原文全文存下来以后总能搜到——已推翻",
    title: "已推翻的全文囤积",
    triggerText: "Deprecated hypothesis: store entire AI transcripts and search later.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e50"
  },
  {
    id: "e51",
    userThought: "Reranker 可以晚一点上,先证明 hybrid 候选生成是否值得",
    title: "Rerank 排期",
    triggerText: "Prove hybrid candidate generation before investing in a cross-encoder reranker.",
    sourceApp: "gemini",
    url: "https://gemini.google.com/app/e51"
  },
  {
    id: "e52",
    userThought: "Trace 默认本地可导出,不要为了 observability 强行上云监控",
    title: "本地可观测性",
    triggerText: "Local-first products can prove observability with exportable traces, not cloud APM.",
    sourceApp: "claude",
    url: "https://claude.ai/chat/e52"
  },
  {
    id: "e53",
    userThought: "英文 paraphrase 测试: cheap model first, escalate only uncertain cases",
    title: "Bilingual routing note",
    triggerText: "Keep a bilingual twin of the routing idea for mixed-language selections.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e53"
  },
  {
    id: "e54",
    userThought: "同词异义:苹果公司财报 versus 苹果派食谱,检索必须靠上下文消歧",
    title: "同词异义消歧",
    triggerText: "The token apple needs context to decide between company filings and pie recipes.",
    sourceApp: "grok",
    url: "https://grok.com/chat/e54"
  },
  {
    id: "e55",
    userThought: "周末想做苹果派,黄油要提前从冰箱拿出来软化",
    title: "苹果派食谱",
    triggerText: "Take the butter out early so it softens before you make apple pie.",
    sourceApp: "chatgpt",
    url: "https://chatgpt.com/c/e55"
  }
]

const queries: BenchmarkQuery[] = [
  {
    id: "q01",
    text: "推理成本太高了,有没有省钱的优化思路",
    relevant: ["e01", "e02"],
    hardNegatives: ["e14", "e43"],
    expectedBehavior: "surface",
    rationale: "换词表达降成本;词法可能弱,语义应捞回路由/缓存",
    tags: ["paraphrase", "cost"]
  },
  {
    id: "q02",
    text: "换个说法就搜不到东西了,这个问题怎么解决",
    relevant: ["e04"],
    hardNegatives: ["e16", "e40"],
    expectedBehavior: "surface",
    rationale: "词法强项:用词直接撞上向量检索动机",
    tags: ["lexical-friendly"]
  },
  {
    id: "q03",
    text: "怎么让 bot 在不同对话之间保持上下文",
    relevant: ["e05", "e06"],
    hardNegatives: ["e19", "e20"],
    expectedBehavior: "surface",
    rationale: "Agent 记忆 paraphrase,词法易漏",
    tags: ["paraphrase", "memory"]
  },
  {
    id: "q04",
    text: "TiDB 向量检索的 SQL 到底怎么写",
    relevant: ["e11"],
    hardNegatives: ["e04", "e17"],
    expectedBehavior: "surface",
    rationale: "精确技术词,BM25 应赢",
    tags: ["lexical-friendly", "exact"]
  },
  {
    id: "q05",
    text: "为什么很多人懒得记笔记、懒得整理想法",
    relevant: ["e08"],
    hardNegatives: ["e12", "e16"],
    expectedBehavior: "surface",
    rationale: "捕获摩擦的语义跳跃",
    tags: ["paraphrase", "capture"]
  },
  {
    id: "q06",
    text: "产品上线前是不是应该自己先用一段时间",
    relevant: ["e07"],
    hardNegatives: ["e10", "e13"],
    expectedBehavior: "surface",
    rationale: "dogfood 词法友好",
    tags: ["lexical-friendly"]
  },
  {
    id: "q07",
    text: "用户根本不愿意打开一个单独的本地应用去管理聊天收藏",
    relevant: ["e19", "e20"],
    hardNegatives: ["e49", "e08"],
    expectedBehavior: "surface",
    rationale: "产品 pivot 核心故事",
    tags: ["product", "pivot"]
  },
  {
    id: "q08",
    text: "独立桌面 Collect 工具是不是正确的产品入口",
    relevant: ["e49"],
    hardNegatives: ["e19", "e20"],
    expectedBehavior: "abstain",
    rationale: "问的是已推翻假设;理想行为是沉默或明确标 superseded,不应当正例强推 e19 当答案替代叙事混乱——标注为 abstain:旧结论不应再当有效建议浮现",
    tags: ["superseded", "abstain"]
  },
  {
    id: "q09",
    text: "误匹配太多,泛词也能打出很高分,怎么改召回",
    relevant: ["e21", "e23", "e33"],
    hardNegatives: ["e45", "e46"],
    expectedBehavior: "surface",
    rationale: "precision-first 改造动机",
    tags: ["product", "precision"]
  },
  {
    id: "q10",
    text: "实用 这个 快速",
    relevant: [],
    hardNegatives: ["e45", "e46", "e33"],
    expectedBehavior: "abstain",
    rationale: "纯泛词选区:正确行为是沉默",
    tags: ["abstain", "generic-tokens"]
  },
  {
    id: "q11",
    text: "LLM 页面消息滚走了还能不能跳回原句",
    relevant: ["e24"],
    hardNegatives: ["e38", "e39"],
    expectedBehavior: "surface",
    rationale: "锚点可靠性 paraphrase",
    tags: ["paraphrase", "anchor"]
  },
  {
    id: "q12",
    text: "Service Worker 挂了补想法丢了怎么办",
    relevant: ["e25"],
    hardNegatives: ["e06", "e34"],
    expectedBehavior: "surface",
    rationale: "MV3 恢复 paraphrase",
    tags: ["paraphrase", "reliability"]
  },
  {
    id: "q13",
    text: "要不要做一个全自动记忆 Agent 替我决定用哪条旧想法",
    relevant: ["e26"],
    hardNegatives: ["e05", "e30"],
    expectedBehavior: "surface",
    rationale: "人在回路边界",
    tags: ["product", "hitl"]
  },
  {
    id: "q14",
    text: "对话内容默认真的不会上传吗",
    relevant: ["e27"],
    hardNegatives: ["e34", "e44"],
    expectedBehavior: "surface",
    rationale: "隐私 local-first",
    tags: ["privacy"]
  },
  {
    id: "q15",
    text: "相似分数都挤在 0.85 到 0.91,能直接当置信度吗",
    relevant: ["e29"],
    hardNegatives: ["e17", "e04"],
    expectedBehavior: "surface",
    rationale: "向量拥挤教训",
    tags: ["eval", "vector"]
  },
  {
    id: "q16",
    text: "是不是应该直接用向量替换现在的 BM25",
    relevant: ["e30", "e29"],
    hardNegatives: ["e04", "e11"],
    expectedBehavior: "surface",
    rationale: "Hybrid 不是替换",
    tags: ["hybrid"]
  },
  {
    id: "q17",
    text: "还没标注集就先换一个更大的 embedding 模型 dual",
    relevant: ["e31"],
    hardNegatives: ["e17", "e51"],
    expectedBehavior: "surface",
    rationale: "先评测再调模型",
    tags: ["eval"]
  },
  {
    id: "q18",
    text: "面试怎么证明召回不是拍脑袋调的",
    relevant: ["e32", "e37", "e22"],
    hardNegatives: ["e36"],
    expectedBehavior: "surface",
    rationale: "诊断驱动叙事",
    tags: ["interview"]
  },
  {
    id: "q19",
    text: "重装扩展或 fork 仓库后本地 Echo 会不会丢",
    relevant: ["e34", "e35"],
    hardNegatives: ["e25", "e06"],
    expectedBehavior: "surface",
    rationale: "备份与扩展 ID",
    tags: ["reliability", "migration"]
  },
  {
    id: "q20",
    text: "为了找工作要不要先做一个带鉴权的云同步后端",
    relevant: ["e36"],
    hardNegatives: ["e27", "e52"],
    expectedBehavior: "surface",
    rationale: "明确反对假后端",
    tags: ["interview", "scope"]
  },
  {
    id: "q21",
    text: "observability 一定要接 Datadog 吗",
    relevant: ["e52"],
    hardNegatives: ["e43", "e22"],
    expectedBehavior: "surface",
    rationale: "本地 trace 立场",
    tags: ["observability"]
  },
  {
    id: "q22",
    text: "cheap model first, only escalate hard cases",
    relevant: ["e01", "e53"],
    hardNegatives: ["e02"],
    expectedBehavior: "surface",
    rationale: "英文选区对齐路由想法",
    tags: ["bilingual", "paraphrase"]
  },
  {
    id: "q23",
    text: "Apple 最新季度收入怎么样",
    relevant: ["e54"],
    hardNegatives: ["e55"],
    expectedBehavior: "abstain",
    rationale: "同词异义:公司语境不应捞出苹果派;语料里也没有财报 Echo → 应沉默",
    tags: ["polysemy", "abstain"]
  },
  {
    id: "q24",
    text: "做派之前黄油要怎么处理",
    relevant: ["e55"],
    hardNegatives: ["e54"],
    expectedBehavior: "surface",
    rationale: "生活噪声在生活语境下可召回",
    tags: ["noise-positive"]
  },
  {
    id: "q25",
    text: "今天练卧推安排",
    relevant: ["e48"],
    hardNegatives: ["e21", "e07"],
    expectedBehavior: "surface",
    rationale: "生活查询对生活 Echo",
    tags: ["noise-positive"]
  },
  {
    id: "q26",
    text: "如何降低 LLM 应用的单位调用费用",
    relevant: ["e01", "e02"],
    hardNegatives: ["e14", "e09"],
    expectedBehavior: "surface",
    rationale: "成本主题中英混合 paraphrase",
    tags: ["paraphrase", "cost", "bilingual"]
  },
  {
    id: "q27",
    text: "固定长度切 chunk 为什么不好",
    relevant: ["e03"],
    hardNegatives: ["e04", "e16"],
    expectedBehavior: "surface",
    rationale: "语义切块",
    tags: ["lexical-friendly"]
  },
  {
    id: "q28",
    text: "提示里塞规则不如塞例子",
    relevant: ["e18"],
    hardNegatives: ["e22", "e31"],
    expectedBehavior: "surface",
    rationale: "few-shot",
    tags: ["lexical-friendly"]
  },
  {
    id: "q29",
    text: "相关内容现在不想看,是不是应该永久降权这条记忆",
    relevant: ["e28"],
    hardNegatives: ["e41", "e21"],
    expectedBehavior: "surface",
    rationale: "wrong_time vs not_relevant",
    tags: ["feedback"]
  },
  {
    id: "q30",
    text: "长选区测试:" +
      "我们在做浏览器里的记忆层,核心不是存更多 AI 原文,而是在未来合适语境安静地还回一条旧想法。" +
      "如果召回靠泛词,用户会关掉扩展。需要可解释的拒绝和精度优先。",
    relevant: ["e21", "e20", "e26"],
    hardNegatives: ["e50", "e45"],
    expectedBehavior: "surface",
    rationale: "长选区多主题,应优先产品原则类 Echo",
    tags: ["long-query", "product"]
  },
  {
    id: "q31",
    text: "文档写了但团队找不到",
    relevant: ["e16"],
    hardNegatives: ["e40", "e04"],
    expectedBehavior: "surface",
    rationale: "可检索性",
    tags: ["paraphrase"]
  },
  {
    id: "q32",
    text: "周报写成了日常流水账",
    relevant: ["e12"],
    hardNegatives: ["e15", "e37"],
    expectedBehavior: "surface",
    rationale: "词法友好",
    tags: ["lexical-friendly"]
  },
  {
    id: "q33",
    text: "要不要先投流拉新用户",
    relevant: ["e13"],
    hardNegatives: ["e10", "e09"],
    expectedBehavior: "surface",
    rationale: "冷启动",
    tags: ["paraphrase"]
  },
  {
    id: "q34",
    text: "会议能不能改成异步留言",
    relevant: ["e15"],
    hardNegatives: ["e12", "e05"],
    expectedBehavior: "surface",
    rationale: "异步优先",
    tags: ["lexical-friendly"]
  },
  {
    id: "q35",
    text: "cosine 之前要不要 normalize",
    relevant: ["e17"],
    hardNegatives: ["e11", "e29"],
    expectedBehavior: "surface",
    rationale: "英文技术词",
    tags: ["bilingual", "exact"]
  },
  {
    id: "q36",
    text: "首屏两分钟留不住人",
    relevant: ["e10"],
    hardNegatives: ["e07", "e13"],
    expectedBehavior: "surface",
    rationale: "首次体验 paraphrase",
    tags: ["paraphrase"]
  },
  {
    id: "q37",
    text: "价格页要不要先放一个很贵的套餐",
    relevant: ["e09"],
    hardNegatives: ["e01", "e02"],
    expectedBehavior: "surface",
    rationale: "定价锚定",
    tags: ["paraphrase"]
  },
  {
    id: "q38",
    text: "今天天气不错适合散步",
    relevant: [],
    hardNegatives: ["e47", "e48", "e55"],
    expectedBehavior: "abstain",
    rationale: "与语料无决策相关;应完全沉默",
    tags: ["abstain", "unrelated"]
  },
  {
    id: "q39",
    text: "把全部 ChatGPT 历史原文都存下来以后慢慢搜",
    relevant: ["e50"],
    hardNegatives: ["e19", "e08"],
    expectedBehavior: "abstain",
    rationale: "已推翻的全文囤积假设;不应作为现行建议浮现",
    tags: ["superseded", "abstain"]
  },
  {
    id: "q40",
    text: "hybrid 候选生成之后要不要立刻上 cross-encoder",
    relevant: ["e51", "e30"],
    hardNegatives: ["e31", "e17"],
    expectedBehavior: "surface",
    rationale: "rerank 排期判断",
    tags: ["hybrid", "eval"]
  }
]

const now = Date.now()
const corpus: BenchmarkEcho[] = seed.map((item, index) => ({
  ...item,
  status: "confirmed",
  createdAt: new Date(now - (seed.length - index) * 60_000).toISOString()
}))

fs.mkdirSync(DATA_DIR, { recursive: true })
fs.writeFileSync(
  CORPUS_PATH,
  JSON.stringify(
    {
      fixtureVersion: FIXTURE_VERSION,
      note:
        "Dogfood-realistic fixture (not a private IndexedDB dump). Same schema as browser export.",
      echoes: corpus
    },
    null,
    2
  ),
  "utf8"
)
fs.writeFileSync(
  QUERIES_PATH,
  JSON.stringify(
    {
      fixtureVersion: FIXTURE_VERSION,
      annotationGuide: {
        relevant: "Ids that should appear if the system surfaces anything",
        hardNegatives: "Topic-adjacent distractors that must not count as hits",
        expectedBehavior:
          "surface = at least one relevant should be acceptable; abstain = silence is correct"
      },
      queries
    },
    null,
    2
  ),
  "utf8"
)

console.log(`[seed] ${corpus.length} echoes -> ${CORPUS_PATH}`)
console.log(`[seed] ${queries.length} queries -> ${QUERIES_PATH}`)
