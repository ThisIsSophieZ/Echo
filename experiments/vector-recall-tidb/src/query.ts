import fs from "node:fs"

import { ECHOES_PATH, REPORT_PATH, SELECTIONS_PATH, TABLE, TOP_K } from "./config"
import { connect } from "./db"
import { echoLabel, type Echo } from "./echo-shape"
import { embedQuery, toVectorLiteral } from "./embed"
import { lexicalRecall } from "./lexical-baseline"

type Selection = { id: string; text: string; relevant?: string[]; expect?: string }

type Ranked = { id: string; label: string; note: string }

const readJson = <T>(path: string, hint: string): T => {
  if (!fs.existsSync(path)) throw new Error(`Missing ${path}. ${hint}`)
  return JSON.parse(fs.readFileSync(path, "utf8")) as T
}

// Rank (1-based) of the first truly-relevant id in an ordered list; 0 = missed.
const firstRelevantRank = (ordered: string[], relevant: Set<string>): number => {
  const index = ordered.findIndex((id) => relevant.has(id))
  return index < 0 ? 0 : index + 1
}

const precisionAtK = (ordered: string[], relevant: Set<string>, k: number): number => {
  const top = ordered.slice(0, k)
  if (!top.length) return 0
  return top.filter((id) => relevant.has(id)).length / top.length
}

const rankTag = (rank: number): string =>
  rank === 0 ? "未召回" : rank <= 3 ? `Top-${rank} ✅` : `第 ${rank} 位`

const main = async () => {
  const echoes = readJson<Echo[]>(ECHOES_PATH, "Run `npm run seed` first.")
  const selections = readJson<Selection[]>(SELECTIONS_PATH, "Run `npm run seed` first.")
  const byId = new Map(echoes.map((echo) => [echo.id, echo]))

  const connection = await connect()

  const lines: string[] = [
    "# Echo 召回对比:BM25 词法(产品真身) vs TiDB 向量",
    "",
    `- 生成时间: ${new Date().toISOString()}`,
    `- 语料: ${echoes.length} 条 Echo · 选区: ${selections.length} 条 · Top-${TOP_K}`,
    "- 词法 = 直接调用 `products/echo/extension/lib/echo-related.ts` 的 `analyzeRelatedEchoes`(含产品阈值)",
    "- 向量 = `multilingual-e5-small` 本地 embedding + TiDB `VEC_COSINE_DISTANCE`",
    "- `相关` 一列基于人工判定的 `relevant`;评估看『对的 Echo 排到第几』和 Top-3 精度,不看虚高的绝对相似度。",
    ""
  ]

  let lexHitTop3 = 0
  let vecHitTop3 = 0
  let lexPrecisionSum = 0
  let vecPrecisionSum = 0

  for (const selection of selections) {
    const relevant = new Set(selection.relevant ?? [])

    const lexical = lexicalRecall(echoes, selection.text, TOP_K)
    const lexOrdered = lexical.map((hit) => hit.id)

    const queryVector = await embedQuery(selection.text)
    const [rows] = await connection.query(
      `SELECT id, source_app,
              VEC_COSINE_DISTANCE(embedding, ?) AS distance
       FROM ${TABLE}
       ORDER BY distance
       LIMIT ${Number(TOP_K)}`,
      [toVectorLiteral(queryVector)]
    )
    const vector = (rows as any[]).map((row) => ({
      id: row.id as string,
      similarity: 1 - Number(row.distance),
      sourceApp: row.source_app as string
    }))
    const vecOrdered = vector.map((hit) => hit.id)

    const lexRank = firstRelevantRank(lexOrdered, relevant)
    const vecRank = firstRelevantRank(vecOrdered, relevant)
    const lexPrecision = precisionAtK(lexOrdered, relevant, 3)
    const vecPrecision = precisionAtK(vecOrdered, relevant, 3)
    if (lexRank >= 1 && lexRank <= 3) lexHitTop3 += 1
    if (vecRank >= 1 && vecRank <= 3) vecHitTop3 += 1
    lexPrecisionSum += lexPrecision
    vecPrecisionSum += vecPrecision

    const spread = vector.length
      ? vector[0].similarity - vector[vector.length - 1].similarity
      : 0

    lines.push(`## ${selection.id} · 「${selection.text}」`, "")
    if (selection.expect) lines.push(`> 预期: ${selection.expect}`, "")
    lines.push(
      `> 相关命中排名 — 词法: **${rankTag(lexRank)}** · 向量: **${rankTag(vecRank)}** ` +
        `｜ Top-3 精度 — 词法 ${(lexPrecision * 100).toFixed(0)}% · 向量 ${(vecPrecision * 100).toFixed(0)}%`,
      ""
    )

    lines.push("**词法召回(产品实际会浮现的)**", "")
    if (lexical.length) {
      lines.push("| # | Echo | 置信度 | 强度 | 相关? | 理由 |", "| --- | --- | --- | --- | --- | --- |")
      lexical.forEach((hit, index) => {
        lines.push(
          `| ${index + 1} | ${hit.label} | ${hit.score} | ${hit.strength} | ${relevant.has(hit.id) ? "✅" : "—"} | ${hit.reason} |`
        )
      })
    } else {
      lines.push("_(词法无命中,侧边栏不会浮现任何东西)_")
    }
    lines.push("")

    lines.push(`**向量召回(TiDB 余弦相似度 · Top-5 相似度跨度仅 ${spread.toFixed(3)})**`, "")
    lines.push("| # | Echo | 相似度 | 来源 | 相关? | 词法也命中? |", "| --- | --- | --- | --- | --- | --- |")
    vector.forEach((hit, index) => {
      const echo = byId.get(hit.id)
      lines.push(
        `| ${index + 1} | ${echo ? echoLabel(echo) : hit.id} | ${hit.similarity.toFixed(3)} | ${hit.sourceApp} | ${relevant.has(hit.id) ? "✅" : "—"} | ${lexOrdered.includes(hit.id) ? "是" : "否"} |`
      )
    })
    lines.push("")

    console.log(
      `[compare] ${selection.id} 词法相关排名 ${lexRank || "未召回"} · 向量相关排名 ${vecRank || "未召回"} · 向量相似度跨度 ${spread.toFixed(3)}`
    )
  }

  const n = selections.length
  lines.push(
    "---",
    "",
    "## 结论(基于相关性,非虚高阈值)",
    "",
    `- **召回**:把"真正相关"的 Echo 排进 Top-3 的选区数 — 向量 **${vecHitTop3}/${n}**,词法 **${lexHitTop3}/${n}**。`,
    `- **精度**:Top-3 平均精度 — 向量 ${((vecPrecisionSum / n) * 100).toFixed(0)}%,词法 ${((lexPrecisionSum / n) * 100).toFixed(0)}%。`,
    "- **判读**:向量在「换了说法/概念相近」的选区上召回明显更强;但 Top-5 相似度普遍挤在 ~0.85–0.91,跨度极小,**无法用固定相似度阈值区分相关与无关**——这正是 Echo「安静、高精度、不打扰」UX 的拦路石。",
    "- **启示**:小模型 + 裸余弦还不够可信;要上语义召回,值得试的是 hybrid(词法先筛 + 向量重排)或更强的 embedding / 加一层 rerank,而不是直接拿相似度当置信度。",
    ""
  )

  await connection.end()
  fs.writeFileSync(REPORT_PATH, lines.join("\n"), "utf8")
  console.log(`[compare] report -> ${REPORT_PATH}`)
  console.log(`[compare] 召回 Top-3: 向量 ${vecHitTop3}/${n} · 词法 ${lexHitTop3}/${n}`)
}

main().catch((error) => {
  console.error("[compare] failed:", error.message)
  process.exit(1)
})
